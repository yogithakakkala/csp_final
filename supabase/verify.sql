-- ══════════════════════════════════════════════════════════════════════════
-- SachiSeva database check. Read-only: changes nothing.
-- Supabase → SQL Editor → paste → Run. Every row should say OK.
-- Anything MISSING → run supabase/migrations/20261014000000_vercel_hardening.sql, then
-- supabase/migrations/20261015000000_catalog_profile.sql and 20261015010000_staff_key.sql
-- (or supabase/schema.sql on an empty project).
-- ══════════════════════════════════════════════════════════════════════════
with
need_tables(t) as (values
  ('app_secrets'),('staff_key_attempts'),('profiles'),('schemes'),('applications'),('application_messages'),('application_status_history'),
  ('application_drafts'),('grievances'),('user_documents'),('sachivalayam_centers'),('meeseva_centers'),
  ('certificate_requests'),('document_offices')),
need_cols(t, c) as (values
  ('profiles','is_staff'),('profiles','email'),('profiles','eligibility_profile'),('applications','token_number'),('applications','applicant_details'),
  ('applications','submitted_documents'),('application_messages','is_document_request'),('application_messages','requested_document_type'),
  ('sachivalayam_centers','busy_level'),('sachivalayam_centers','busy_updated_at'),('sachivalayam_centers','busy_note'),
  ('sachivalayam_centers','osm_id'),('meeseva_centers','osm_id'),('meeseva_centers','services'),
  ('application_status_history','document_requested')),
need_funcs(f) as (values
  ('is_staff'),('set_staff_status'),('claim_staff'),('citizen_add_submitted_document'),('lookup_application_by_token'),
  ('lookup_application_history'),('lookup_certificate_by_token'),('handle_new_user'),('set_application_token'),
  ('force_new_application_status'),('record_application_status_history')),
need_triggers(tg) as (values
  ('on_auth_user_created'),('trg_set_application_token'),('trg_force_new_application_status'),
  ('trg_app_status_history_ins'),('trg_app_status_history_upd'),('trg_delete_draft_on_app')),
need_realtime(t) as (values ('applications'),('application_messages'),('application_status_history'),('grievances'),('sachivalayam_centers')),
checks as (
  select 1 as ord, 'table ' || t as item,
         case when to_regclass('public.' || t) is not null then 'OK' else 'MISSING' end as status
    from need_tables
  union all
  select 2, 'column ' || t || '.' || c,
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = c) then 'OK' else 'MISSING' end
    from need_cols
  union all
  select 3, 'function ' || f || '()',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f) then 'OK' else 'MISSING' end
    from need_funcs
  union all
  select 4, 'trigger ' || tg,
         case when exists (select 1 from pg_trigger where tgname = tg and not tgisinternal) then 'OK' else 'MISSING' end
    from need_triggers
  union all
  select 5, 'row-level security on ' || t,
         case when (select relrowsecurity from pg_class where oid = to_regclass('public.' || t)) then 'OK' else 'MISSING' end
    from need_tables
  union all
  select 6, 'realtime for ' || t,
         case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then 'OK' else 'MISSING' end
    from need_realtime
  union all
  select 7, 'storage bucket "applications"',
         case when exists (select 1 from storage.buckets where id = 'applications') then 'OK' else 'MISSING' end
  union all
  select 8, 'policy: citizens upload to own folder',
         case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'app upload own folder') then 'OK' else 'MISSING' end
  union all
  select 9, 'security fix: citizens cannot post as staff',
         case when exists (select 1 from pg_policies where tablename = 'application_messages' and policyname = 'citizen insert own thread' and with_check like '%sender_type%') then 'OK' else 'MISSING' end
  union all
  select 10, 'security fix: certificate list not public',
         case when not exists (select 1 from pg_policies where tablename = 'certificate_requests' and policyname = 'public read certs') then 'OK' else 'MISSING' end
  union all
  select 11, 'centre names may repeat (all-AP import)',
         case when not exists (select 1 from pg_constraint where conname = 'sachivalayam_centers_name_key') then 'OK' else 'MISSING' end
  union all
  select 12, 'data: schemes = ' || (select count(*) from public.schemes where id not like 'svc-%'), case when (select count(*) from public.schemes) > 0 then 'OK' else 'EMPTY' end
  union all
  select 12, 'data: services = ' || (select count(*) from public.schemes where id like 'svc-%'), case when (select count(*) from public.schemes where id like 'svc-%') >= 16 then 'OK' else 'MISSING (run the catalog migration)' end
  union all
  select 12, 'data: sachivalayam centres = ' || (select count(*) from public.sachivalayam_centers), case when (select count(*) from public.sachivalayam_centers) > 0 then 'OK' else 'EMPTY' end
  union all
  select 12, 'data: MeeSeva centres = ' || (select count(*) from public.meeseva_centers), case when (select count(*) from public.meeseva_centers) > 0 then 'OK' else 'EMPTY' end
  union all
  select 12, 'data: staff accounts = ' || (select count(*) from public.profiles where is_staff), case when (select count(*) from public.profiles where is_staff) > 0 then 'OK' else 'NONE YET (sign up with the staff key)' end
)
select item, status from checks order by (status = 'OK'), ord, item;
