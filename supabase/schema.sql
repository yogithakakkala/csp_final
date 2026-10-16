-- ══════════════════════════════════════════════════════════════════════════
-- SachiSeva — complete database setup for a NEW Supabase project.
--
-- Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
-- Run it once. (For a database that already has the old tables, run only
-- supabase/migrations/20261014000000_vercel_hardening.sql and
-- supabase/migrations/20261015000000_catalog_profile.sql and
-- supabase/migrations/20261015010000_staff_key.sql instead.)
--
-- Afterwards:
--   • Authentication → URL Configuration → Site URL = your Vercel URL
--   • Optional e-mails: Vault secrets `resend_api_key`, `notification_from_email`
--   • Optional: npm run import:centers   (loads every AP centre from OpenStreetMap)
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────── Base schema: roles, profiles, schemes, centres, applications, messages, emails, tokens ───────────
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'staff');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(_uid,'staff') or public.has_role(_uid,'admin') $$;

create policy "users see own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "staff view all profiles" on public.profiles for select using (public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.sachivalayam_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null, name_telugu text, address text not null, area text not null,
  district text not null, latitude float8 not null, longitude float8 not null, phone text,
  created_at timestamptz not null default now()
);
grant select on public.sachivalayam_centers to anon, authenticated;
grant insert, update, delete on public.sachivalayam_centers to authenticated;
grant all on public.sachivalayam_centers to service_role;
alter table public.sachivalayam_centers enable row level security;
create policy "public read centers" on public.sachivalayam_centers for select using (true);
create policy "staff manage centers" on public.sachivalayam_centers for all using (public.is_staff(auth.uid()));

create table public.schemes (
  id text primary key, name text not null, name_telugu text not null, description text not null,
  required_documents text[] not null default '{}', eligibility_rules jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.schemes to anon, authenticated;
grant insert, update, delete on public.schemes to authenticated;
grant all on public.schemes to service_role;
alter table public.schemes enable row level security;
create policy "public read schemes" on public.schemes for select using (true);
create policy "staff manage schemes" on public.schemes for all using (public.is_staff(auth.uid()));

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheme_id text not null references public.schemes(id),
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected')),
  submitted_documents jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "citizen own apps select" on public.applications for select using (auth.uid()=user_id);
create policy "citizen insert own apps" on public.applications for insert with check (auth.uid()=user_id);
create policy "staff select all apps" on public.applications for select using (public.is_staff(auth.uid()));
create policy "staff update all apps" on public.applications for update using (public.is_staff(auth.uid()));
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create table public.certificate_requests (
  id uuid primary key default gen_random_uuid(),
  token_number text not null unique, citizen_name text not null, certificate_type text not null,
  status text not null default 'pending' check (status in ('pending','ready','collected')),
  requested_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  notes text, contact_email text, contact_phone text
);
grant select on public.certificate_requests to anon, authenticated;
grant insert, update, delete on public.certificate_requests to authenticated;
grant all on public.certificate_requests to service_role;
alter table public.certificate_requests enable row level security;
create policy "public read certs" on public.certificate_requests for select using (true);
create policy "staff manage certs" on public.certificate_requests for all using (public.is_staff(auth.uid()));
create trigger certificate_requests_set_updated_at before update on public.certificate_requests
  for each row execute function public.set_updated_at();

create table public.document_offices (
  id uuid primary key default gen_random_uuid(),
  document_type text not null, issuing_office_type text not null, notes text
);
grant select on public.document_offices to anon, authenticated;
grant insert, update, delete on public.document_offices to authenticated;
grant all on public.document_offices to service_role;
alter table public.document_offices enable row level security;
create policy "public read doc offices" on public.document_offices for select using (true);
create policy "staff manage doc offices" on public.document_offices for all using (public.is_staff(auth.uid()));

create table public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null, file_url text not null,
  uploaded_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_documents to authenticated;
grant all on public.user_documents to service_role;
alter table public.user_documents enable row level security;
create policy "own docs all" on public.user_documents for all using (auth.uid()=user_id);

create table public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','staff')),
  message text, file_url text,
  created_at timestamptz not null default now()
);
grant select, insert on public.application_messages to authenticated;
grant all on public.application_messages to service_role;
alter table public.application_messages enable row level security;
create policy "citizen see own thread" on public.application_messages for select
  using (exists(select 1 from public.applications a where a.id=application_id and a.user_id=auth.uid()));
create policy "citizen insert own thread" on public.application_messages for insert
  with check (exists(select 1 from public.applications a where a.id=application_id and a.user_id=auth.uid()));
create policy "staff see all threads" on public.application_messages for select using (public.is_staff(auth.uid()));
create policy "staff insert all threads" on public.application_messages for insert with check (public.is_staff(auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.applications;
exception when duplicate_object then null;
end $$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.is_staff(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.is_staff(uuid) to service_role;
grant execute on function public.is_staff(uuid) to authenticated;

alter table public.profiles add column if not exists is_staff boolean not null default false;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, is_staff)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, false)
    on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select is_staff from public.profiles where id = _uid), false)
    or public.has_role(_uid, 'staff')
    or public.has_role(_uid, 'admin')
$$;

grant execute on function public.is_staff(uuid) to authenticated;

create policy "staff update all profiles" on public.profiles for update using (public.is_staff(auth.uid()));

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.set_staff_status(_target_id uuid, _new_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'not permitted';
  end if;
  update public.profiles set is_staff = _new_value where id = _target_id;
end $$;

grant execute on function public.set_staff_status(uuid, boolean) to authenticated;

do $$ begin
  alter table public.applications
    add constraint applications_user_id_profiles_fkey foreign key (user_id) references public.profiles(id) on delete cascade
    not valid;
exception when duplicate_object then null;
end $$;

alter table public.applications add column if not exists applicant_details jsonb not null default '{}';
alter table public.applications alter column submitted_documents set default '[]';

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted','under_review','documents_requested','approved','rejected'));

alter table public.application_messages add column if not exists is_document_request boolean not null default false;
alter table public.application_messages add column if not exists requested_document_type text;

create or replace function public.citizen_add_submitted_document(
  _application_id uuid, _document_type text, _file_url text
) returns void language plpgsql security definer set search_path = public as $$
declare
  _owner uuid;
  _existing jsonb;
  _updated jsonb;
begin
  select user_id, submitted_documents into _owner, _existing
    from public.applications where id = _application_id;

  if _owner is null or _owner <> auth.uid() then
    raise exception 'not permitted';
  end if;

  select coalesce(jsonb_agg(doc), '[]'::jsonb) into _updated
    from jsonb_array_elements(coalesce(_existing, '[]'::jsonb)) doc
    where doc->>'document_type' <> _document_type;

  _updated := _updated || jsonb_build_array(jsonb_build_object('document_type', _document_type, 'file_url', _file_url));

  update public.applications set submitted_documents = _updated where id = _application_id;
end $$;

grant execute on function public.citizen_add_submitted_document(uuid, text, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.application_messages;
exception when duplicate_object then null;
end $$;

insert into public.document_offices (document_type, issuing_office_type, notes)
select v.document_type, v.issuing_office_type, v.notes
from (values
  ('Aadhaar Card', 'Aadhaar Seva Kendra', null::text),
  ('Caste Certificate', 'Tahsildar Office / MeeSeva Center', null::text),
  ('Income Certificate', 'Tahsildar Office', null::text),
  ('Ration Card', 'Sachivalayam Center', null::text),
  ('Residence Certificate', 'Tahsildar Office / MeeSeva Center', null::text),
  ('Birth Certificate', 'Municipal Corporation / Gram Panchayat Office', null::text)
) as v(document_type, issuing_office_type, notes)
where not exists (
  select 1 from public.document_offices d where d.document_type = v.document_type
);

do $$ begin create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net unavailable: email notifications disabled'; end $$;

create or replace function public.send_email(_to text, _subject text, _html text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _api_key text;
  _from text;
begin
  if _to is null or _to = '' then
    return;
  end if;

  begin
    select decrypted_secret into _api_key from vault.decrypted_secrets where name = 'resend_api_key';
    select decrypted_secret into _from from vault.decrypted_secrets where name = 'notification_from_email';
  exception when others then
    raise notice 'send_email: Vault not configured, skipping email to %', _to;
    return;
  end;

  if _api_key is null then
    raise notice 'send_email: resend_api_key not set in Vault, skipping email to %', _to;
    return;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || _api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', coalesce(_from, 'SachiSeva <onboarding@resend.dev>'),
      'to', array[_to],
      'subject', _subject,
      'html', _html
    )
  );
end $$;

create or replace function public.notify_application_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _email text;
  _scheme_name text;
begin
  if new.status is distinct from old.status then
    select email into _email from public.profiles where id = new.user_id;
    select name into _scheme_name from public.schemes where id = new.scheme_id;
    perform public.send_email(
      _email,
      'Your application status has changed',
      format(
        '<p>Your application for <strong>%s</strong> is now: <strong>%s</strong>.</p><p>Log in to SachiSeva to see details.</p>',
        coalesce(_scheme_name, 'your scheme'), replace(new.status, '_', ' ')
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists on_application_status_change on public.applications;
create trigger on_application_status_change
  after update on public.applications
  for each row execute function public.notify_application_status_change();

create or replace function public.notify_application_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _email text;
begin
  if new.sender_type = 'staff' then
    select email into _email from public.profiles p join public.applications a on a.user_id = p.id
      where a.id = new.application_id;
    perform public.send_email(
      _email,
      case when new.is_document_request then 'A document was requested for your application'
           else 'New message about your application' end,
      case when new.is_document_request then
        format('<p>Staff requested: <strong>%s</strong></p><p>%s</p>', new.requested_document_type, coalesce(new.message, ''))
      else
        format('<p>%s</p>', coalesce(new.message, ''))
      end
    );
  end if;
  return new;
end $$;

drop trigger if exists on_application_message on public.application_messages;
create trigger on_application_message
  after insert on public.application_messages
  for each row execute function public.notify_application_message();

create or replace function public.notify_certificate_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.contact_email is not null then
    perform public.send_email(
      new.contact_email,
      'Your certificate status has changed',
      format('<p>Certificate <strong>%s</strong> (token %s) is now: <strong>%s</strong>.</p>',
        new.certificate_type, new.token_number, new.status)
    );
  end if;
  return new;
end $$;

drop trigger if exists on_certificate_status_change on public.certificate_requests;
create trigger on_certificate_status_change
  after update on public.certificate_requests
  for each row execute function public.notify_certificate_status_change();

do $$ begin
  alter table public.sachivalayam_centers add constraint sachivalayam_centers_name_key unique (name);
exception when duplicate_object then null;
end $$;

alter table public.sachivalayam_centers
  add column if not exists ward text,
  add column if not exists secretariat_code text;

alter table public.applications replica identity full;
alter table public.application_messages replica identity full;

CREATE TABLE IF NOT EXISTS public.meeseva_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_telugu text NOT NULL,
  address text NOT NULL,
  area text,
  district text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  phone text,
  services text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeseva_centers TO anon, authenticated;
GRANT ALL ON public.meeseva_centers TO service_role;
ALTER TABLE public.meeseva_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read meeseva_centers" ON public.meeseva_centers FOR SELECT USING (true);
CREATE POLICY "Staff manage meeseva_centers" ON public.meeseva_centers FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

revoke execute on function public.send_email(text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_application_status_change() from public, anon, authenticated;
revoke execute on function public.notify_application_message() from public, anon, authenticated;
revoke execute on function public.notify_certificate_status_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

CREATE SEQUENCE IF NOT EXISTS public.application_token_seq START 1;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS token_number text UNIQUE;

CREATE OR REPLACE FUNCTION public.set_application_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.token_number IS NULL OR NEW.token_number = '' THEN
    NEW.token_number := 'APP-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.application_token_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_application_token ON public.applications;
CREATE TRIGGER trg_set_application_token
BEFORE INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_application_token();

UPDATE public.applications
SET token_number = 'APP-' || to_char(created_at, 'YYYY') || '-' ||
    lpad(nextval('public.application_token_seq')::text, 6, '0')
WHERE token_number IS NULL;

CREATE OR REPLACE FUNCTION public.lookup_application_by_token(_token text)
RETURNS TABLE (
  token_number text,
  status text,
  scheme_id text,
  scheme_name text,
  applicant_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.token_number,
         a.status,
         a.scheme_id,
         s.name AS scheme_name,
         COALESCE(p.full_name, a.applicant_details->>'full_name') AS applicant_name,
         a.created_at,
         a.updated_at
    FROM public.applications a
    LEFT JOIN public.schemes s  ON s.id = a.scheme_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
   WHERE a.token_number = _token
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_application_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_application_by_token(text) TO anon, authenticated;

-- ─────────── Storage policies ───────────
create policy "app upload own folder" on storage.objects for insert
  with check (bucket_id='applications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app read own folder" on storage.objects for select
  using (bucket_id='applications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app staff read all" on storage.objects for select
  using (bucket_id='applications' and public.is_staff(auth.uid()));

-- ─────────── Token sequence grants ───────────
CREATE SEQUENCE IF NOT EXISTS public.application_token_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.application_token_seq TO authenticated, service_role;

-- ─────────── Schemes ───────────
INSERT INTO public.schemes (id, name, name_telugu, description, required_documents, eligibility_rules) VALUES
('ntr-bharosa-pension','NTR Bharosa Pension','ఎన్టీఆర్ భరోసా పింఛన్','Monthly social security pension.', ARRAY['Aadhaar Card','Age proof (SSC / Birth certificate)','Bank passbook (Aadhaar linked)','Ration card','Passport size photo','Disability certificate (if applicable)','Husband''s death certificate (widow pension)'], '{}'::jsonb),
('talliki-vandanam','Talliki Vandanam','తల్లికి వందనం','Annual ₹15,000 to mothers.', ARRAY['Aadhaar (mother)','Child''s school enrollment proof','Bank passbook','Ration card','Passport size photo'], '{}'::jsonb),
('annadata-sukhibhava','Annadata Sukhibhava','అన్నదాత సుఖీభవ','Annual ₹20,000 farmer income support.', ARRAY['Aadhaar','Pattadar Passbook','Bank passbook','Ration card','Residence certificate'], '{}'::jsonb),
('deepam-2','Deepam 2.0','దీపం 2.0','3 free LPG cylinders per year.', ARRAY['Aadhaar','Ration card (White / Yellow)','Bank passbook','Passport photo','Residence certificate'], '{}'::jsonb),
('free-bus-travel','Free Bus Travel for Women','మహిళలకు ఉచిత బస్సు ప్రయాణం','Free APSRTC travel for women.', ARRAY['Aadhaar card','Any valid photo ID (Female)'], '{}'::jsonb),
('yuva-galam','Yuva Galam','యువ గళం','₹3,000/month unemployment allowance.', ARRAY['Aadhaar','Educational certificates','Unemployment proof','Bank passbook','Residence certificate','Income certificate'], '{}'::jsonb),
('aadabidda-nidhi','Aadabidda Nidhi','ఆడబిడ్డ నిధి','₹1,500/month women assistance.', ARRAY['Aadhaar','Bank passbook','Ration card','Passport photo','Residence certificate'], '{}'::jsonb),
('chandranna-pelli-kanuka','Chandranna Pelli Kanuka','చంద్రన్న పెళ్ళి కానుక','One-time ₹1,00,000 marriage gift.', ARRAY['Aadhaar (bride)','Caste certificate','Marriage certificate / invitation','Income certificate','Bank passbook','Ration card'], '{}'::jsonb),
('pmay-gramin','PMAY-Gramin','పీఎం ఆవాస్ యోజన గ్రామీణ','Rural housing assistance.', ARRAY['Aadhaar','Ration card','Land ownership proof','Income certificate','Bank passbook','Residence certificate'], '{}'::jsonb),
('ap-housing-scheme','AP Housing Scheme','ఏపీ గృహ పథకం','State housing assistance.', ARRAY['Aadhaar','Caste certificate','Income certificate','Land ownership proof','Ration card','Passport photo'], '{}'::jsonb),
('post-matric-rtf','Post Matric RTF','పోస్ట్ మెట్రిక్ RTF','Full tuition fee reimbursement.', ARRAY['Aadhaar','Caste certificate','Income certificate','College admission proof','Previous year marks memo','Bank passbook'], '{}'::jsonb),
('post-matric-mtf','Post Matric MTF','పోస్ట్ మెట్రిక్ MTF','Maintenance charges reimbursement.', ARRAY['Aadhaar','Caste certificate','Income certificate','College admission proof','Hostel certificate (if applicable)','Bank passbook'], '{}'::jsonb),
('ntr-vidyonnathi','NTR Vidyonnathi','ఎన్టీఆర్ విద్యోన్నతి','Free UPSC/APPSC coaching.', ARRAY['Aadhaar','Graduation certificate','Income certificate','Residence certificate','Passport photo'], '{}'::jsonb),
('ambedkar-overseas','Ambedkar Overseas Vidya Nidhi','అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి','Overseas education assistance.', ARRAY['Aadhaar','Caste certificate (SC/ST)','Foreign university admission letter','Income certificate','Passport','Bank passbook'], '{}'::jsonb),
('pm-kisan','PM Kisan Samman Nidhi','పీఎం కిసాన్ సమ్మాన్ నిధి','₹6,000/year to farmers.', ARRAY['Aadhaar','Pattadar Passbook','Bank passbook','Mobile number (Aadhaar linked)'], '{}'::jsonb),
('nethanna-bharosa','Nethanna Bharosa','నేతన్న భరోసా','₹25,000/year for weavers.', ARRAY['Aadhaar','Weaver identity card','Bank passbook','Residence certificate'], '{}'::jsonb),
('adarana-3','Adarana 3.0','ఆదరణ 3.0','Free tools for artisans.', ARRAY['Aadhaar','Caste certificate','Ration card','Occupation proof','Residence certificate'], '{}'::jsonb),
('ntr-arogya-seva','NTR Arogya Seva','ఎన్టీఆర్ ఆరోగ్య సేవ','Cashless health cover up to ₹25 lakh.', ARRAY['Aadhaar','Ration card (White / Yellow)','Hospital referral letter'], '{}'::jsonb),
('sc-corp-loan','SC Corporation Loan','ఎస్సీ కార్పొరేషన్ రుణం','Subsidised loans for SC entrepreneurs.', ARRAY['Aadhaar','Caste certificate (SC)','Income certificate','Project report','Bank passbook'], '{}'::jsonb),
('bc-corp-loan','BC Corporation Loan','బీసీ కార్పొరేషన్ రుణం','Subsidised loans for BC entrepreneurs.', ARRAY['Aadhaar','Caste certificate (BC)','Income certificate','Project report','Bank passbook'], '{}'::jsonb),
('minority-shaadi-mubarak','Minority Shaadi Mubarak','మైనారిటీ షాదీ ముబారక్','Marriage assistance for minority brides.', ARRAY['Aadhaar (bride)','Minority religion proof','Marriage certificate / invitation','Income certificate','Bank passbook'], '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─────────── MeeSeva centres (Visakhapatnam seed) ───────────
INSERT INTO public.meeseva_centers (name, name_telugu, address, area, district, latitude, longitude, phone, services) VALUES
('MeeSeva Center Service Road Gajuwaka','మీసేవ కేంద్రం సర్వీస్ రోడ్ గాజువాక','D.No 7-7-2/3, Service Road, Opposite Electrical Sub Station, Near Auto Nagar Bus Stop, Chattivanipalem, Gajuwaka, Visakhapatnam 530012','Gajuwaka','Visakhapatnam',17.7030,83.2125,'0891-2345613',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('New Gajuwaka MeeSeva Center','న్యూ గాజువాక మీసేవ కేంద్రం','New Gajuwaka Main Road, Near Bus Stand, New Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6875,83.2015,'9440119789',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Pedagantyada MeeSeva Center','పేడగంట్యాడ మీసేవ కేంద్రం','Pedagantyada Junction, Near Padmavathi Theatre, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6820,83.2060,'9154320518',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('Botcha Square MeeSeva Center','బొట్చా స్క్వేర్ మీసేవ కేంద్రం','Door No 39-6-71, Kapparada Village, Opposite Birla Junction, Murali Nagar, Visakhapatnam 530012','Gajuwaka','Visakhapatnam',17.7090,83.2100,'9100797270',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Ukkunagaram MeeSeva Center','ఉక్కునగరం మీసేవ కేంద్రం','Near Steel Plant Gate-1, Ukkunagaram Township, Visakhapatnam 530031','Steel Plant','Visakhapatnam',17.6350,83.2010,'9393111452',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Residence Certificate']),
('Akkireddy Palem MeeSeva Center','అక్కిరెడ్డి పాలెం మీసేవ కేంద్రం','Akkireddy Palem Main Road, Gajuwaka, Visakhapatnam 530012','Auto Nagar','Visakhapatnam',17.7120,83.2070,'8686086194',ARRAY['Caste Certificate','Income Certificate','Aadhaar Enrolment','Aadhaar Update','Birth Certificate']),
('Sramika Nagar MeeSeva Center','శ్రమిక నగర్ మీసేవ కేంద్రం','Sramika Nagar Main Road, Old Gajuwaka, Visakhapatnam 530026','Old Gajuwaka','Visakhapatnam',17.7070,83.2090,'7396172223',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('HPCL Colony MeeSeva Center','హెచ్పిసిఎల్ కాలనీ మీసేవ కేంద్రం','HPCL Colony, Near Petroleum Township, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6980,83.2050,'9885523089',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Dwaraka Nagar MeeSeva Center','ద్వారకా నగర్ మీసేవ కేంద్రం','Dwaraka Nagar, Visakhapatnam 530016','Dwaraka Nagar','Visakhapatnam',17.7231,83.3012,'0891-2560201',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate','Birth Certificate','Death Certificate','PAN Card']),
('Lakshmi Enterprises MeeSeva Dwaraka Nagar','లక్ష్మి ఎంటర్‌ప్రైజెస్ మీసేవ','Door No 47-10-17, Varanasi Majestic Building, 2nd Lane, Near Siri Digital, Opposite Pizza Hut, Dwaraka Nagar, Visakhapatnam 530016','Dwaraka Nagar','Visakhapatnam',17.7225,83.3018,'8686086193',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Akkayyapalem MeeSeva Center','అక్కాయపాలెం మీసేవ కేంద్రం','Behind HDFC Bank, Abid Nagar, Akkayyapalem, Visakhapatnam 530016','Akkayyapalem','Visakhapatnam',17.7310,83.3075,'9154320516',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Siripuram MeeSeva Center','సిరిపురం మీసేవ కేంద్రం','Siripuram Junction, Near RTC Complex, Visakhapatnam 530003','Siripuram','Visakhapatnam',17.7137,83.2984,'0891-2560202',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('MVP Colony MeeSeva Center','ఎంవిపి కాలనీ మీసేవ కేంద్రం','MVP Colony Sector-11, Near PM Palem, Visakhapatnam 530017','MVP Colony','Visakhapatnam',17.7436,83.3280,'0891-2560203',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','Death Certificate','PAN Card']),
('Srinagar MeeSeva Center','శ్రీనగర్ మీసేవ కేంద్రం','Sri Akshaya Aadhaar Cards, Srinagar Colony, Visakhapatnam 530012','Srinagar','Visakhapatnam',17.7140,83.2950,'0891-6626737',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Madhurawada MeeSeva Center','మధురవాడ మీసేవ కేంద్రం','18-11, Krishna Nagar Road, Near ABC Construction, Madhurawada, Visakhapatnam 530048','Madhurawada','Visakhapatnam',17.7845,83.3742,'7013347588',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Prahladapuram MeeSeva Center','ప్రహ్లాదాపురం మీసేవ కేంద్రం','16-77/2, Beside Apollo Pharmacy, Simhachalam Road, Prahladapuram, Visakhapatnam 530027','Prahladapuram','Visakhapatnam',17.7540,83.3120,'7396172222',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','PAN Card']),
('Gajuwaka Circle MeeSeva Aadhaar Center','గాజువాక సర్కిల్ ఆధార్ మీసేవ','Kumar Aadhaar Card, Gajuwaka Circle, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6985,83.2160,'0891-5548579',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card']),
('Daba Gardens MeeSeva Center','దాబా గార్డెన్స్ మీసేవ కేంద్రం','CBM Compound Road, Daba Gardens, Visakhapatnam 530020','Daba Gardens','Visakhapatnam',17.7056,83.3048,'0891-2797952',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','Death Certificate']),
('Spring Road MeeSeva Center','స్ప్రింగ్ రోడ్ మీసేవ కేంద్రం','MB Aadhaar Card Services, Spring Road, Near Collector Office, Visakhapatnam 530002','Main City','Visakhapatnam',17.7200,83.2950,'9440119787',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate']),
('Waltair Uplands MeeSeva Center','వాల్టేర్ అప్‌ల్యాండ్స్ మీసేవ కేంద్రం','Waltair Main Road, Waltair Uplands, Visakhapatnam 530003','Waltair','Visakhapatnam',17.7210,83.3180,'0891-2560204',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Venkojipalem MeeSeva Center','వెంకోజీపాలెం మీసేవ కేంద్రం','IAM Cards, Venkojipalem Main Road, Visakhapatnam 530024','Venkojipalem','Visakhapatnam',17.7165,83.2875,'8977797878',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Kommadi MeeSeva Center','కొమ్మాడి మీసేవ కేంద్రం','Kommadi Village Junction, Visakhapatnam 530048','Kommadi','Visakhapatnam',17.7780,83.3590,'9885523090',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Bheemunipatnam MeeSeva Center','భీముని పట్నం మీసేవ కేంద్రం','Maha E-Seva Kendra, Thagarapuvalasa, Bheemunipatnam, Visakhapatnam 531163','Bheemunipatnam','Visakhapatnam',17.8892,83.4520,'08933225082',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Gajuwaka Mandal MeeSeva Center Official','గాజువాక మండల్ మీసేవ కేంద్రం','Gajuwaka Mandal Office Road, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.7000,83.2167,'0891-2560450',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate','Birth Certificate','Death Certificate','Land Records']),
('Kapparada Village MeeSeva Center','కప్పరాడ గ్రామం మీసేవ కేంద్రం','Kapparada Village Main Road, Near Birla Temple Junction, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.7095,83.2085,'9100797271',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Vadlapudi MeeSeva Center','వడ్లపూడి మీసేవ కేంద్రం','Vadlapudi Junction, Near Kanithi Colony, Visakhapatnam 530046','Vadlapudi','Visakhapatnam',17.6780,83.1730,'9533164862',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Yathapalem MeeSeva Center','యత్రపాలెం మీసేవ కేంద్రం','China Yathapalem Road, Near Duvvada Railway Station, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7090,83.1680,'7013347589',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('Kondayyavalasa MeeSeva Center','కొండయ్యవలస మీసేవ కేంద్రం','Kondayyavalasa Village Road, Duvvada, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7115,83.1660,'9849667576',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Narava MeeSeva Center','నరవ మీసేవ కేంద్రం','Narava Village Junction, Near VSEZ, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7235,83.1715,'9440119790',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Mindi MeeSeva Center','మిండి మీసేవ కేంద్రం','Mindi Village, Near Port Area, Visakhapatnam 530012','Mindi','Visakhapatnam',17.7150,83.2800,'9154320519',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Arilova MeeSeva Center','అరిలోవ మీసేవ కేంద్రం','Arilova Main Road, Ward-1, Visakhapatnam 530040','Arilova','Visakhapatnam',17.7540,83.2600,'8686086195',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Simhachalam MeeSeva Center','సింహాచలం మీసేవ కేంద్రం','Simhachalam Road, Prahladapuram, Visakhapatnam 530027','Simhachalam','Visakhapatnam',17.7630,83.2710,'7396172224',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','Residence Certificate']),
('Gambheeram MeeSeva Center','గంభీరం మీసేవ కేంద్రం','Gambheeram Road, Near Gambheeram Junction, Visakhapatnam 530027','Gambheeram','Visakhapatnam',17.7680,83.2800,'9393111453',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Pendurthi MeeSeva Center','పెండూర్తి మీసేవ కేంద్రం','Pendurthi Mandal Office Road, Pendurthi, Visakhapatnam 531173','Pendurthi','Visakhapatnam',17.8280,83.2320,'9885523091',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','Land Records']),
('Gopalapatnam MeeSeva Center','గోపాలపట్నం మీసేవ కేంద్రం','Gopalapatnam Main Road, Near Bus Stand, Visakhapatnam 530027','Gopalapatnam','Visakhapatnam',17.7730,83.3080,'9154320520',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Appughar MeeSeva Center','అప్పుఘర్ మీసేవ కేంద్రం','Near Appughar, Beach Road, Visakhapatnam 530023','Beach Road','Visakhapatnam',17.7210,83.3380,'0891-2560205',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Seethammadhara MeeSeva Center','సీతమ్మధార మీసేవ కేంద్రం','Seethammadhara Junction, Visakhapatnam 530013','Seethammadhara','Visakhapatnam',17.7390,83.3210,'9440119791',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','PAN Card']),
('Visakhapatnam Tahsildar Office MeeSeva','విశాఖపట్నం తహసీల్దార్ కార్యాలయం మీసేవ','Visakhapatnam Tahsildar Office, District Collectorate Premises, Visakhapatnam 530001','Main City','Visakhapatnam',17.6880,83.2162,'0891-2560100',ARRAY['Caste Certificate','Income Certificate','Residence Certificate','Land Records','Birth Certificate','Death Certificate','Aadhaar Update','Ration Card']);

-- ─────────── Timeline, drafts, busy indicator, grievances, reminders ───────────
-- =========================================================
-- FEATURE 2: application_status_history
-- =========================================================
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_staff boolean NOT NULL DEFAULT false,
  note text,
  document_requested text
);
CREATE INDEX IF NOT EXISTS idx_ash_app ON public.application_status_history(application_id, changed_at);

GRANT SELECT ON public.application_status_history TO authenticated;
GRANT ALL ON public.application_status_history TO service_role;

ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citizen see own history" ON public.application_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.applications a
            WHERE a.id = application_status_history.application_id AND a.user_id = auth.uid())
  );
CREATE POLICY "staff see all history" ON public.application_status_history
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert history" ON public.application_status_history
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Trigger to auto-insert history rows
CREATE OR REPLACE FUNCTION public.record_application_status_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _by_staff boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_status_history (application_id, status, changed_at, changed_by_staff)
      VALUES (NEW.id, NEW.status, NEW.created_at, false);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _by_staff := coalesce(public.is_staff(auth.uid()), false);
    INSERT INTO public.application_status_history (application_id, status, changed_at, changed_by_staff)
      VALUES (NEW.id, NEW.status, now(), _by_staff);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_app_status_history_ins ON public.applications;
CREATE TRIGGER trg_app_status_history_ins
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_status_history();

DROP TRIGGER IF EXISTS trg_app_status_history_upd ON public.applications;
CREATE TRIGGER trg_app_status_history_upd
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_status_history();

-- Backfill for existing applications
INSERT INTO public.application_status_history (application_id, status, changed_at)
SELECT a.id, a.status, a.created_at FROM public.applications a
WHERE NOT EXISTS (SELECT 1 FROM public.application_status_history h WHERE h.application_id = a.id);

-- =========================================================
-- FEATURE 3: application_drafts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.application_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id text NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_percentage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheme_id)
);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON public.application_drafts(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_drafts TO authenticated;
GRANT ALL ON public.application_drafts TO service_role;

ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own drafts all" ON public.application_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_drafts_updated_at ON public.application_drafts;
CREATE TRIGGER trg_drafts_updated_at BEFORE UPDATE ON public.application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-delete draft when application submitted
CREATE OR REPLACE FUNCTION public.delete_draft_on_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.application_drafts
    WHERE user_id = NEW.user_id AND scheme_id = NEW.scheme_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_delete_draft_on_app ON public.applications;
CREATE TRIGGER trg_delete_draft_on_app
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.delete_draft_on_application_insert();

-- =========================================================
-- FEATURE 4: sachivalayam_centers busy indicator
-- =========================================================
ALTER TABLE public.sachivalayam_centers
  ADD COLUMN IF NOT EXISTS busy_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS busy_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS busy_note text;

DO $$ BEGIN
  ALTER TABLE public.sachivalayam_centers
    ADD CONSTRAINT sachivalayam_busy_level_chk CHECK (busy_level IN ('low','moderate','busy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- FEATURE 5: grievances
-- =========================================================
CREATE TABLE IF NOT EXISTS public.grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'raised' CHECK (status IN ('raised','acknowledged','resolved')),
  raised_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  admin_response text
);
CREATE INDEX IF NOT EXISTS idx_griev_app ON public.grievances(application_id);
CREATE INDEX IF NOT EXISTS idx_griev_user ON public.grievances(user_id);

GRANT SELECT, INSERT ON public.grievances TO authenticated;
GRANT UPDATE ON public.grievances TO authenticated;
GRANT ALL ON public.grievances TO service_role;

ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citizen see own grievances" ON public.grievances
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "citizen insert own grievances" ON public.grievances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff see all grievances" ON public.grievances
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update grievances" ON public.grievances
  FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Email notification trigger on grievance status changes
CREATE OR REPLACE FUNCTION public.notify_grievance_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _scheme text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT p.email INTO _email FROM public.profiles p WHERE p.id = NEW.user_id;
    SELECT s.name INTO _scheme FROM public.applications a
      LEFT JOIN public.schemes s ON s.id = a.scheme_id WHERE a.id = NEW.application_id;
    IF NEW.status = 'acknowledged' THEN
      PERFORM public.send_email(_email, 'Your grievance has been acknowledged',
        format('<p>Your grievance for <strong>%s</strong> has been acknowledged. Staff will review your application shortly.</p>', coalesce(_scheme, 'your application')));
    ELSIF NEW.status = 'resolved' THEN
      PERFORM public.send_email(_email, 'Your grievance has been resolved',
        format('<p>Your grievance for <strong>%s</strong> has been resolved.</p><p>%s</p>',
          coalesce(_scheme, 'your application'), coalesce(NEW.admin_response, '')));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_grievance ON public.grievances;
CREATE TRIGGER trg_notify_grievance
  AFTER UPDATE ON public.grievances
  FOR EACH ROW EXECUTE FUNCTION public.notify_grievance_status();

-- =========================================================
-- Realtime
-- =========================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.application_status_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sachivalayam_centers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.grievances;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Scheduled: daily 9 AM stale application reminder
-- =========================================================
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron unavailable: daily reminder disabled'; END $$;

CREATE OR REPLACE FUNCTION public.notify_stale_applications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.id, a.user_id, s.name AS scheme_name, s.name_telugu AS scheme_name_te, p.email
      FROM public.applications a
      LEFT JOIN public.schemes s ON s.id = a.scheme_id
      LEFT JOIN public.profiles p ON p.id = a.user_id
     WHERE a.status IN ('submitted','under_review')
       AND a.updated_at < now() - interval '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.grievances g
          WHERE g.application_id = a.id AND g.status <> 'resolved'
       )
       AND p.email IS NOT NULL
  LOOP
    PERFORM public.send_email(
      r.email,
      'Your application has not been updated in 7 days',
      format('<p>Your application for <strong>%s</strong> has not been updated in 7 days.</p><p>You can raise a grievance through SachiSeva to escalate this. / మీ %s దరఖాస్తు 7 రోజులుగా అప్‌డేట్ కాలేదు.</p>',
        coalesce(r.scheme_name, 'your scheme'), coalesce(r.scheme_name_te, ''))
    );
  END LOOP;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('notify_stale_applications_daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $outer$ BEGIN
  PERFORM cron.schedule('notify_stale_applications_daily', '0 9 * * *', 'SELECT public.notify_stale_applications();');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'cron schedule skipped'; END $outer$;

-- ─────────── More centres ───────────
INSERT INTO public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude, phone) VALUES
('Siripuram Sachivalayam','సిరిపురం సచివాలయం','Siripuram, Visakhapatnam, Andhra Pradesh 530003','Visakhapatnam (Main City)','Visakhapatnam',17.7245,83.3038,'0891-2560123'),
('Dwaraka Nagar Sachivalayam','ద్వారకా నగర్ సచివాలయం','Dwaraka Nagar, Visakhapatnam, Andhra Pradesh 530016','Visakhapatnam (Main City)','Visakhapatnam',17.7266,83.307,'0891-2560201'),
('MVP Colony Sachivalayam','ఎం.వి.పి. కాలనీ సచివాలయం','MVP Colony, Visakhapatnam, Andhra Pradesh 530017','Visakhapatnam (Main City)','Visakhapatnam',17.7419,83.3199,'0891-2560214'),
('Sheela Nagar Sachivalayam','షీలా నగర్ సచివాలయం','Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012','Sheela Nagar','Visakhapatnam',17.718533,83.198379,'0891-2560452'),
('BHPV Township Sachivalayam (Sheela Nagar)','బి.హెచ్.పి.వి టౌన్‌షిప్ సచివాలయం (షీలా నగర్)','BHPV Township, Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012','Sheela Nagar','Visakhapatnam',17.705,83.19,'0891-2560460'),
('New Gajuwaka Sachivalayam (Ward 64)','న్యూ గాజువాక సచివాలయం (వార్డు 64)','New Gajuwaka, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.687,83.21,'0891-2560446'),
('Old Gajuwaka Sachivalayam','పాత గాజువాక సచివాలయం','Old Gajuwaka, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.695,83.205,'0891-2560447'),
('Pedagantyada Sachivalayam','పెదగంట్యాడ సచివాలయం','Pedagantyada, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.675,83.215,'0891-2560448'),
('Kailasapuram Sachivalayam','కైలాసపురం సచివాలయం','Kailasapuram, Gajuwaka, Visakhapatnam, Andhra Pradesh 530011','Gajuwaka','Visakhapatnam',17.69,83.22,'0891-2560449'),
('Kurmannapalem Sachivalayam','కూర్మన్నపాలెం సచివాలయం','31-29-8/3, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.685,83.1675,'0891-2560410'),
('Nathayyapalem Sachivalayam (Kurmannapalem)','నాథయ్యపాలెం సచివాలయం (కూర్మన్నపాలెం)','Nathayyapalem, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.68,83.16,'0891-2560411'),
('Gopalapatnam Sachivalayam','గోపాలపట్నం సచివాలయం','Gopalapatnam, Visakhapatnam, Andhra Pradesh 530027','Visakhapatnam (Main City)','Visakhapatnam',17.735,83.215,'0891-2560501'),
('Malkapuram Sachivalayam','మల్కాపురం సచివాలయం','Malkapuram, Visakhapatnam, Andhra Pradesh 530011','Visakhapatnam (Main City)','Visakhapatnam',17.699,83.265,'0891-2560502'),
('Autonagar Sachivalayam','ఆటోనగర్ సచివాలయం','Autonagar, Visakhapatnam, Andhra Pradesh 530012','Gajuwaka','Visakhapatnam',17.67,83.245,'0891-2560503'),
('Duvvada Sachivalayam','దువ్వాడ సచివాలయం','Duvvada, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.655,83.145,'0891-2560504'),
('Simhachalam Sachivalayam','సింహాచలం సచివాలయం','Simhachalam, Visakhapatnam, Andhra Pradesh 530028','Visakhapatnam (Main City)','Visakhapatnam',17.765,83.245,'0891-2560505'),
('Marripalem Sachivalayam','మర్రిపాలెం సచివాలయం','Marripalem, Visakhapatnam, Andhra Pradesh 530018','Visakhapatnam (Main City)','Visakhapatnam',17.708,83.285,'0891-2560506'),
('Akkayyapalem Sachivalayam','అక్కయ్యపాలెం సచివాలయం','Akkayyapalem, Visakhapatnam, Andhra Pradesh 530016','Visakhapatnam (Main City)','Visakhapatnam',17.735,83.295,'0891-2560507'),
('Seethammadhara Sachivalayam','సీతమ్మధార సచివాలయం','Seethammadhara, Visakhapatnam, Andhra Pradesh 530013','Visakhapatnam (Main City)','Visakhapatnam',17.7365,83.312,'0891-2560508'),
('Maddilapalem Sachivalayam','మద్దిలపాలెం సచివాలయం','Maddilapalem, Visakhapatnam, Andhra Pradesh 530013','Visakhapatnam (Main City)','Visakhapatnam',17.7395,83.316,'0891-2560509'),
('Chinna Waltair Sachivalayam','చిన్న వాల్తేరు సచివాలయం','Chinna Waltair, Visakhapatnam, Andhra Pradesh 530017','Visakhapatnam (Main City)','Visakhapatnam',17.7215,83.328,'0891-2560510'),
('Pandurangapuram Sachivalayam','పాండురంగాపురం సచివాలయం','Pandurangapuram, Visakhapatnam, Andhra Pradesh 530003','Visakhapatnam (Main City)','Visakhapatnam',17.7145,83.325,'0891-2560511'),
('Jagadamba Center Sachivalayam','జగదాంబ సెంటర్ సచివాలయం','Jagadamba Junction, Visakhapatnam, Andhra Pradesh 530020','Visakhapatnam (Main City)','Visakhapatnam',17.7085,83.298,'0891-2560512'),
('Poorna Market Sachivalayam','పూర్ణా మార్కెట్ సచివాలయం','Poorna Market, Visakhapatnam, Andhra Pradesh 530001','Visakhapatnam (Main City)','Visakhapatnam',17.7055,83.295,'0891-2560513'),
('Kancharapalem Sachivalayam','కంచరపాలెం సచివాలయం','Kancharapalem, Visakhapatnam, Andhra Pradesh 530008','Visakhapatnam (Main City)','Visakhapatnam',17.716,83.276,'0891-2560514'),
('NAD Kotha Road Sachivalayam','ఎన్.ఏ.డి కొత్త రోడ్ సచివాలయం','NAD Kotha Road, Visakhapatnam, Andhra Pradesh 530009','Visakhapatnam (Main City)','Visakhapatnam',17.745,83.245,'0891-2560515'),
('Thatichetlapalem Sachivalayam','తాటిచెట్లపాలెం సచివాలయం','Thatichetlapalem, Visakhapatnam, Andhra Pradesh 530018','Visakhapatnam (Main City)','Visakhapatnam',17.712,83.288,'0891-2560516'),
('Madhurawada Sachivalayam','మధురవాడ సచివాలయం','Madhurawada, Visakhapatnam, Andhra Pradesh 530041','Madhurawada','Visakhapatnam',17.802,83.381,'0891-2560601'),
('Rushikonda Sachivalayam','రుషికొండ సచివాలయం','Rushikonda, Visakhapatnam, Andhra Pradesh 530045','Madhurawada','Visakhapatnam',17.784,83.383,'0891-2560602'),
('Yendada Sachivalayam','ఎండాడ సచివాలయం','Yendada, Visakhapatnam, Andhra Pradesh 530045','Madhurawada','Visakhapatnam',17.774,83.354,'0891-2560603'),
('Kommadi Sachivalayam','కొమ్మాడి సచివాలయం','Kommadi, Visakhapatnam, Andhra Pradesh 530048','Madhurawada','Visakhapatnam',17.812,83.365,'0891-2560604'),
('Arilova Sachivalayam','అరిలోవ సచివాలయం','Arilova, Visakhapatnam, Andhra Pradesh 530040','Madhurawada','Visakhapatnam',17.768,83.322,'0891-2560605'),
('Pendurthi Sachivalayam','పెందుర్తి సచివాలయం','Pendurthi, Visakhapatnam, Andhra Pradesh 531173','Pendurthi','Visakhapatnam',17.782,83.228,'0891-2560701'),
('Vepagunta Sachivalayam','వేపగుంట సచివాలయం','Vepagunta, Visakhapatnam, Andhra Pradesh 530047','Pendurthi','Visakhapatnam',17.765,83.225,'0891-2560702'),
('Bheemunipatnam Sachivalayam','భీమునిపట్నం సచివాలయం','Bheemunipatnam, Visakhapatnam, Andhra Pradesh 531163','Bheemunipatnam','Visakhapatnam',17.892,83.451,'08933-222001'),
('Sabbavaram Sachivalayam','సబ్బవరం సచివాలయం','Sabbavaram, Visakhapatnam, Andhra Pradesh 531036','Sabbavaram','Visakhapatnam',17.782,83.152,'0891-2870101'),
('Anandapuram Sachivalayam','ఆనందపురం సచివాలయం','Anandapuram, Visakhapatnam, Andhra Pradesh 531173','Anandapuram','Visakhapatnam',17.83,83.29,'0891-2560801'),
('Anakapalle Sachivalayam','అనకాపల్లి సచివాలయం','Anakapalle, Anakapalli District, Andhra Pradesh 531001','Anakapalle','Anakapalli',17.691,83.003,'08924-222001'),
('Chodavaram Sachivalayam','చోడవరం సచివాలయం','Chodavaram, Anakapalli District, Andhra Pradesh 531036','Chodavaram','Anakapalli',17.826,82.876,'08934-222001'),
('Narsipatnam Sachivalayam','నర్సీపట్నం సచివాలయం','Narsipatnam, Anakapalli District, Andhra Pradesh 531116','Narsipatnam','Anakapalli',17.667,82.617,'08931-222001'),
('Yelamanchili Sachivalayam','యలమంచిలి సచివాలయం','Yelamanchili, Anakapalli District, Andhra Pradesh 531055','Yelamanchili','Anakapalli',17.553,82.855,'08932-222001'),
('Paravada Sachivalayam','పరవాడ సచివాలయం','Paravada, Anakapalli District, Andhra Pradesh 531021','Paravada','Anakapalli',17.748,83.099,'08924-222501'),
('Atchutapuram Sachivalayam','అచ్యుతాపురం సచివాలయం','Atchutapuram, Anakapalli District, Andhra Pradesh 531011','Atchutapuram','Anakapalli',17.62,83.08,'08924-222601'),
('Nakkapalli Sachivalayam','నక్కపల్లి సచివాలయం','Nakkapalli, Anakapalli District, Andhra Pradesh 531081','Nakkapalli','Anakapalli',17.499,82.845,'08932-233001'),
('Butchayyapeta Sachivalayam','బుచ్చయ్యపేట సచివాలయం','Butchayyapeta, Anakapalli District, Andhra Pradesh 531011','Butchayyapeta','Anakapalli',17.63,83.13,'08924-222701'),
('Kasimkota Sachivalayam','కాశింకోట సచివాలయం','Kasimkota, Anakapalli District, Andhra Pradesh 531035','Kasimkota','Anakapalli',17.646,82.936,'08924-223001'),
('Munagapaka Sachivalayam','మునగపాక సచివాలయం','Munagapaka, Anakapalli District, Andhra Pradesh 531011','Munagapaka','Anakapalli',17.755,83.03,'08924-223101'),
('Padmanabham Sachivalayam','పద్మనాభం సచివాలయం','Padmanabham, Visakhapatnam, Andhra Pradesh 531019','Padmanabham','Visakhapatnam',17.85,83.24,'0891-2560901'),
('Rambilli Sachivalayam','రాంబిల్లి సచివాలయం','Rambilli, Anakapalli District, Andhra Pradesh 531061','Rambilli','Anakapalli',17.573,83.12,'08924-223201'),
('K Kotapadu Sachivalayam','కె. కొటపాడు సచివాలయం','K Kotapadu, Anakapalli District, Andhra Pradesh 531111','K Kotapadu','Anakapalli',17.72,82.75,'08931-223301'),
('Devarapalli Sachivalayam','దేవరపల్లి సచివాలయం','Devarapalli, Anakapalli District, Andhra Pradesh 531083','Devarapalli','Anakapalli',17.44,82.78,'08932-223401');

INSERT INTO public.meeseva_centers (name, name_telugu, address, area, district, latitude, longitude, phone, services) VALUES
('Siripuram MeeSeva','సిరిపురం మీసేవ','Siripuram Main Rd, Visakhapatnam 530003','Visakhapatnam','Visakhapatnam',17.7248,83.3040,'0891-2755001', ARRAY['Aadhaar','Income Certificate','Caste Certificate','Ration Card','Birth Certificate','Death Certificate']),
('Dwaraka Nagar MeeSeva','ద్వారకా నగర్ మీసేవ','Dwaraka Nagar, Visakhapatnam 530016','Visakhapatnam','Visakhapatnam',17.7268,83.3072,'0891-2755010', ARRAY['Aadhaar','Income Certificate','Land Records','Ration Card']),
('MVP Colony MeeSeva','ఎం.వి.పి. కాలనీ మీసేవ','MVP Colony Sector 5, Visakhapatnam 530017','Visakhapatnam','Visakhapatnam',17.7421,83.3201,'0891-2755020', ARRAY['Aadhaar','Passport','Income Certificate','Caste Certificate','Driving License']),
('Gajuwaka MeeSeva','గాజువాక మీసేవ','Main Rd, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6870,83.2100,'0891-2755030', ARRAY['Aadhaar','Ration Card','Income Certificate','EWS Certificate']),
('Madhurawada MeeSeva','మధురవాడ మీసేవ','Madhurawada, Visakhapatnam 530041','Madhurawada','Visakhapatnam',17.8100,83.3700,'0891-2755040', ARRAY['Aadhaar','Passport','Income Certificate','Land Records']),
('Anakapalle MeeSeva','అనకాపల్లి మీసేవ','Anakapalle Town, Andhra Pradesh 531001','Anakapalle','Anakapalle',17.6912,83.0000,'08924-227001', ARRAY['Aadhaar','Ration Card','Caste Certificate','Birth Certificate','Death Certificate']),
('Pendurthi MeeSeva','పెందుర్తి మీసేవ','Pendurthi, Visakhapatnam 531173','Pendurthi','Visakhapatnam',17.8180,83.2050,'0891-2755050', ARRAY['Aadhaar','Ration Card','Income Certificate']),
('Bheemili MeeSeva','భీమిలి మీసేవ','Bheemunipatnam, Visakhapatnam 531163','Bheemili','Visakhapatnam',17.8905,83.4470,'0891-2755060', ARRAY['Aadhaar','Land Records','Birth Certificate','Marriage Certificate']);

-- ─────────── v2 hardening (security fixes, storage bucket, OSM import columns) ───────────
-- ════════════════════════════════════════════════════════════════════════
-- SachiSeva v2 — run once on an EXISTING database (the existing hosted database or your own).
-- Safe to re-run. A brand-new Supabase project should run supabase/schema.sql
-- instead (it already includes this file).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Storage bucket for uploaded documents (was never created by the old migrations,
--    so uploads failed with "Bucket not found" on a fresh project).
insert into storage.buckets (id, name, public, file_size_limit)
values ('applications', 'applications', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

do $$ begin
  create policy "app upload own folder" on storage.objects for insert to authenticated
    with check (bucket_id = 'applications' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "app read own folder" on storage.objects for select to authenticated
    using (bucket_id = 'applications' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "app update own folder" on storage.objects for update to authenticated
    using (bucket_id = 'applications' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "app staff read all" on storage.objects for select to authenticated
    using (bucket_id = 'applications' and public.is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

-- 2. Centres: allow importing every AP centre from OpenStreetMap
--    (scripts/import-osm-centers.mjs). Names are not unique across a state.
alter table public.sachivalayam_centers drop constraint if exists sachivalayam_centers_name_key;
alter table public.sachivalayam_centers add column if not exists osm_id text;
alter table public.meeseva_centers add column if not exists osm_id text;
do $$ begin
  alter table public.sachivalayam_centers add constraint sachivalayam_centers_osm_id_key unique (osm_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meeseva_centers add constraint meeseva_centers_osm_id_key unique (osm_id);
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists idx_sach_latlng on public.sachivalayam_centers (latitude, longitude);
create index if not exists idx_mee_latlng on public.meeseva_centers (latitude, longitude);

-- Imported rows can't know a busy level yet; existing rows keep theirs.
alter table public.sachivalayam_centers alter column busy_updated_at drop not null;

-- 3. Citizens could insert an application already marked "approved".
create or replace function public.force_new_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(auth.uid()), false) then
    new.status := 'submitted';
    new.token_number := null;  -- always generated by trg_set_application_token
  end if;
  return new;
end $$;
drop trigger if exists trg_force_new_application_status on public.applications;
create trigger trg_force_new_application_status before insert on public.applications
  for each row execute function public.force_new_application_status();
-- Make sure this runs before the token trigger (triggers fire alphabetically).
drop trigger if exists trg_set_application_token on public.applications;
create trigger trg_set_application_token before insert on public.applications
  for each row execute function public.set_application_token();

-- 4. Citizens could post chat messages pretending to be staff.
drop policy if exists "citizen insert own thread" on public.application_messages;
create policy "citizen insert own thread" on public.application_messages for insert
  with check (
    sender_type = 'user'
    and coalesce(is_document_request, false) = false
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid())
  );

-- 5. Certificate requests were readable by anyone (names, emails, phones).
--    Now only staff can list them; citizens look one up by token through an RPC.
drop policy if exists "public read certs" on public.certificate_requests;
revoke select on public.certificate_requests from anon;

create or replace function public.lookup_certificate_by_token(_token text)
returns table (token_number text, certificate_type text, status text, citizen_name text, requested_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.token_number, c.certificate_type, c.status,
         split_part(c.citizen_name, ' ', 1) as citizen_name,
         c.requested_at, c.updated_at
    from public.certificate_requests c
   where upper(c.token_number) = upper(trim(_token))
   limit 1
$$;
revoke all on function public.lookup_certificate_by_token(text) from public;
grant execute on function public.lookup_certificate_by_token(text) to anon, authenticated;

-- Application lookup by number: case-insensitive, and only the first name is shown publicly.
create or replace function public.lookup_application_by_token(_token text)
returns table (token_number text, status text, scheme_id text, scheme_name text, applicant_name text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.token_number, a.status, a.scheme_id, s.name,
         split_part(coalesce(p.full_name, a.applicant_details->>'full_name', ''), ' ', 1),
         a.created_at, a.updated_at
    from public.applications a
    left join public.schemes s on s.id = a.scheme_id
    left join public.profiles p on p.id = a.user_id
   where upper(a.token_number) = upper(trim(_token))
   limit 1
$$;
revoke all on function public.lookup_application_by_token(text) from public;
grant execute on function public.lookup_application_by_token(text) to anon, authenticated;

-- Public status timeline for a tracked application (dates + statuses only).
create or replace function public.lookup_application_history(_token text)
returns table (status text, changed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.status, h.changed_at
    from public.application_status_history h
    join public.applications a on a.id = h.application_id
   where upper(a.token_number) = upper(trim(_token))
   order by h.changed_at
$$;
revoke all on function public.lookup_application_history(text) from public;
grant execute on function public.lookup_application_history(text) to anon, authenticated;

-- 6. One open grievance per application.
create unique index if not exists uniq_open_grievance on public.grievances (application_id)
  where status <> 'resolved';

-- 7. A citizen document can be recorded once per type.
delete from public.user_documents a using public.user_documents b
  where a.user_id = b.user_id and a.document_type = b.document_type and a.uploaded_at < b.uploaded_at;
create unique index if not exists uniq_user_doc_type on public.user_documents (user_id, document_type);

-- 8. Every auth user has a profile row (older sign-ups may be missing one).
insert into public.profiles (id, full_name, email)
select u.id, u.raw_user_meta_data->>'full_name', u.email
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- 9. Status history notes: staff can write a note when requesting documents.
create or replace function public.record_application_status_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare _by_staff boolean; _doc text;
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, status, changed_at, changed_by_staff)
      values (new.id, new.status, new.created_at, false);
    return new;
  end if;
  if new.status is distinct from old.status then
    _by_staff := coalesce(public.is_staff(auth.uid()), false);
    if new.status = 'documents_requested' then
      select requested_document_type into _doc from public.application_messages
        where application_id = new.id and is_document_request order by created_at desc limit 1;
    end if;
    insert into public.application_status_history (application_id, status, changed_at, changed_by_staff, document_requested)
      values (new.id, new.status, now(), _by_staff, _doc);
  end if;
  return new;
end $$;

-- 10. Realtime: centres (busy level), grievances, history.
do $$ begin alter publication supabase_realtime add table public.sachivalayam_centers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.grievances; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.application_status_history; exception when duplicate_object then null; end $$;
alter table public.applications replica identity full;

-- ══════════════════════════════════════════════════════════════════════════
-- SachiSeva v3 — full scheme & service catalogue + family profile.
-- Run once on an existing database (after 20261014000000_vercel_hardening.sql).
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. The family profile ("answer once") used for one-click eligibility.
alter table public.profiles add column if not exists eligibility_profile jsonb;
grant update (full_name, eligibility_profile) on public.profiles to authenticated;

-- 2. Every scheme and Sachivalayam service (generated from src/data/catalog.ts).
insert into public.schemes (id, name, name_telugu, description, required_documents) values
  ('ntr-bharosa-pension', 'NTR Bharosa Pension', 'ఎన్టీఆర్ భరోసా పింఛన్', 'Monthly pension for the elderly, widows, people with disabilities or chronic illness, and other vulnerable groups — paid on the 1st of every month.', array['Aadhaar card', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo', 'Age proof (SSC memo / birth certificate)', 'SADAREM disability certificate (disability pension)', 'Husband''s death certificate (widow pension)', 'Medical certificate (dialysis / thalassemia / CKDU)']::text[]),
  ('talliki-vandanam', 'Talliki Vandanam', 'తల్లికి వందనం', '₹15,000 a year to the mother for every child studying in Class 1 to 12 (government or private school / junior college).', array['Mother''s Aadhaar card', 'Child''s Aadhaar card', 'School / college study certificate', 'Mother''s bank passbook (Aadhaar-linked, NPCI-mapped)', 'Rice card (white / BPL)']::text[]),
  ('annadata-sukhibhava', 'Annadata Sukhibhava', 'అన్నదాత సుఖీభవ', '₹20,000 a year investment support for farmer families — ₹14,000 from the State plus ₹6,000 PM-Kisan — paid in instalments.', array['Aadhaar card', 'Pattadar passbook / land records (1-B, Adangal)', 'Tenancy (CCRC) card — tenant farmers', 'Bank passbook (account linked to Aadhaar)', 'Mobile number linked to Aadhaar']::text[]),
  ('deepam-2', 'Deepam 2.0 — free gas cylinders', 'దీపం 2.0 — ఉచిత గ్యాస్ సిలిండర్లు', 'Three free LPG cylinder refills a year (one every four months). You pay at delivery and the full amount comes back to your bank account.', array['Aadhaar card', 'Rice card (white / BPL)', 'LPG consumer number / gas book', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('free-bus-travel', 'Stree Shakti — free bus travel', 'స్త్రీ శక్తి — ఉచిత బస్సు ప్రయాణం', 'Free travel for girls, women and transgender persons of Andhra Pradesh in APSRTC Palle Velugu, Ultra Palle Velugu, City Ordinary, Metro Express and Express buses anywhere in the State.', array['Any valid photo ID showing an AP address (Aadhaar, voter ID, ration card)']::text[]),
  ('ntr-arogya-seva', 'Dr NTR Vaidya Seva (Aarogyasri)', 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ)', 'Cashless treatment in network hospitals for thousands of procedures. Rice-card families are covered up to ₹25 lakh; the State is extending cover to all families under its Universal Health Policy.', array['Aadhaar card', 'Rice card (white / BPL)', 'Vaidya Seva / Aarogyasri health card (see Services)', 'Referral from a doctor / PHC (for treatment)']::text[]),
  ('post-matric-rtf', 'Fee Reimbursement (Vidya Deevena)', 'ఫీజు రీయింబర్స్‌మెంట్ (విద్యా దీవెన)', 'Full tuition fee paid by the State for students in ITI, polytechnic, degree, engineering, medicine, PG and similar courses (convener-quota seats).', array['Student''s and parent''s Aadhaar', 'Rice card or income certificate', 'College admission / convener allotment order', 'Previous marks memos', 'Caste certificate', 'Mother''s bank passbook']::text[]),
  ('auto-driver-sevalo', 'Auto Driver Sevalo (Vahana Mitra)', 'ఆటో డ్రైవర్ల సేవలో (వాహన మిత్ర)', '₹15,000 a year to auto, taxi and maxi-cab drivers who own their passenger vehicle, for insurance, repairs and fitness.', array['Aadhaar card', 'Rice card (white / BPL)', 'Driving licence', 'Vehicle RC (registration certificate)', 'Fitness certificate & tax receipt (taxi / maxi cab)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('matsyakara-sevalo', 'Matsyakarula Sevalo', 'మత్స్యకారుల సేవలో', '₹20,000 to fishermen families during the annual sea fishing ban (April–June), paid to the bank account.', array['Aadhaar card', 'Fisherman ID / Fisheries registration', 'Boat registration (if any)', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('nethanna-bharosa', 'Nethanna Sevalo (handloom weavers)', 'నేతన్నల సేవలో (చేనేత కార్మికులు)', '₹25,000 a year to handloom weaver families who own a loom, plus free power for handlooms and power looms.', array['Aadhaar card', 'Weaver ID card / loom geo-tagging details', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('pmay-gramin', 'Housing for All (PMAY + State)', 'అందరికీ ఇళ్లు (PMAY + రాష్ట్రం)', 'Help to build a pucca house for families without one — central PMAY (Gramin / Urban) assistance with State support. New beneficiaries are taken in survey rounds.', array['Aadhaar card', 'Rice card (white / BPL)', 'House site patta / land document', 'Income certificate', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('pm-kisan', 'PM-Kisan Samman Nidhi', 'పీఎం-కిసాన్ సమ్మాన్ నిధి', 'Central support of ₹6,000 a year to land-owning farmer families in three instalments of ₹2,000. In AP it is paid together with Annadata Sukhibhava.', array['Aadhaar card', 'Pattadar passbook / land records (1-B, Adangal)', 'Bank passbook (account linked to Aadhaar)', 'Mobile number linked to Aadhaar']::text[]),
  ('post-matric-mtf', 'Hostel & mess charges (Vasathi Deevena)', 'హాస్టల్ & భోజన ఖర్చులు (వసతి దీవెన)', 'Yearly help with hostel and food costs for the same college / ITI / polytechnic students who get fee reimbursement.', array['Student''s and parent''s Aadhaar', 'Rice card or income certificate', 'College admission proof', 'Mother''s bank passbook']::text[]),
  ('adarana-3', 'Adarana 3.0 (tools for artisans)', 'ఆదరణ 3.0 (చేతివృత్తుల పనిముట్లు)', 'Subsidised modern tools and equipment (and two-wheelers for toddy tappers) for BC artisans — carpenters, goldsmiths, potters, barbers, washermen, weavers, fishermen and others.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Occupation proof / trade certificate', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('sc-corp-loan', 'SC / ST Corporation self-employment loans', 'SC / ST కార్పొరేషన్ స్వయం ఉపాధి రుణాలు', 'Bank loans with a large subsidy to start a small business, vehicle or unit, for SC and ST youth. Opened in rounds by the SC / Tribal Welfare corporations.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Project report / quotation', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('bc-corp-loan', 'BC / EWS Corporation self-employment loans', 'BC / EWS కార్పొరేషన్ స్వయం ఉపాధి రుణాలు', 'Subsidised bank loans for BC, Kapu, minority and EWS youth to start a business or buy equipment. Opened in rounds.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Project report / quotation', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('ntr-vidyonnathi', 'NTR Vidyonnathi (civil services coaching)', 'ఎన్టీఆర్ విద్యోన్నతి (సివిల్ సర్వీసెస్ కోచింగ్)', 'Free UPSC / APPSC coaching with a stipend for graduates from weaker sections. Notified every year on the Jnanabhumi portal.', array['Aadhaar card', 'Degree certificate', 'Income certificate', 'Caste certificate', 'Passport-size photo']::text[]),
  ('ambedkar-overseas', 'Ambedkar Overseas Vidya Nidhi', 'అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి', 'Financial help for SC / ST students admitted to a Masters or PhD at a recognised foreign university.', array['Aadhaar card', 'Caste certificate', 'Income certificate', 'Foreign university admission letter', 'Passport', 'Degree marks memos']::text[]),
  ('aadabidda-nidhi', 'Aadabidda Nidhi', 'ఆడబిడ్డ నిధి', '₹1,500 a month for women aged 18–59. Announced as one of the Super Six; beneficiary verification is in progress and payments have not started yet.', array['Aadhaar card', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('yuva-galam', 'Nirudyoga Bhruthi (unemployment allowance)', 'నిరుద్యోగ భృతి', '₹3,000 a month promised to unemployed youth. Announced; not paid yet. Meanwhile, Mega DSC and skilling programmes are running.', array['Aadhaar card', 'Educational certificates', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('chandranna-pelli-kanuka', 'Chandranna Pelli Kanuka (marriage gift)', 'చంద్రన్న పెళ్ళి కానుక', 'One-time marriage assistance for brides from SC, ST, BC, minority and disabled families. Not accepting applications now — check at your Sachivalayam before the wedding.', array['Bride''s and groom''s Aadhaar', 'Caste certificate', 'Age proof (SSC memo / birth certificate)', 'Wedding card / marriage certificate', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('svc-income-certificate', 'Income certificate', 'ఆదాయ ధృవపత్రం', 'Certifies your family’s annual income — needed for scholarships, fee reimbursement, loans and many schemes.', array['Income proof — pay slip, IT return, or self-declaration', 'Rice card, voter ID or Aadhaar card']::text[]),
  ('svc-integrated-certificate', 'Caste certificate (Integrated: caste, nativity & date of birth)', 'కుల ధృవపత్రం (ఇంటిగ్రేటెడ్: కులం, స్థానికత, పుట్టిన తేదీ)', 'One certificate showing your community, nativity and date of birth — used for admissions, reservations, jobs and SC/ST/BC schemes.', array['SSC marks memo, transfer certificate, or birth extract from municipality / panchayat', 'Earlier caste certificate of applicant, parent or family member (if any)', 'Aadhaar card']::text[]),
  ('svc-ews-certificate', 'EWS certificate', 'EWS ధృవపత్రం', 'For the 10% Economically Weaker Sections reservation in education and jobs (for communities not under SC/ST/BC).', array['Aadhaar card', 'Income certificate', 'Land / property self-declaration', 'SSC memo or date-of-birth proof', 'Rice card (white / BPL)']::text[]),
  ('svc-residence-certificate', 'Residence certificate', 'నివాస ధృవపత్రం', 'Proves where you live — for bank accounts, admissions, gas and other connections.', array['Aadhaar with current address', 'Rice card (white / BPL)', 'Electricity / water / property tax bill', 'Passport-size photo']::text[]),
  ('svc-family-member-certificate', 'Family member certificate', 'కుటుంబ సభ్యుల ధృవపత్రం', 'Lists the legal family members after the head of the family dies — needed for land mutation, bank claims, pensions and compassionate jobs.', array['Death certificate of the family head', 'Aadhaar of all family members', 'Rice card (white / BPL)', 'Self-declaration / affidavit listing family members']::text[]),
  ('svc-rice-card-new', 'New rice card', 'కొత్త రేషన్ కార్డు', 'Apply for a new family rice card (needed for subsidised rice and most welfare schemes).', array['Aadhaar numbers of all family members', 'Address proof', 'Income certificate', 'Age proof (women over 18, men over 21)', 'Death certificate of spouse (single-member widow cards)']::text[]),
  ('svc-rice-card-member', 'Add / remove a member on the rice card', 'రేషన్ కార్డులో సభ్యుని చేర్పు / తొలగింపు', 'Add a newborn or a new daughter-in-law, remove someone who has died or moved, or split a card.', array['Existing rice card', 'New member''s Aadhaar', 'Birth certificate (child) / marriage certificate (spouse) / death certificate (removal)']::text[]),
  ('svc-birth-certificate', 'Birth certificate', 'జనన ధృవపత్రం', 'Copy of a registered birth. Births should be registered within 21 days; late registration needs extra orders.', array['Hospital birth record / discharge summary', 'Parents'' Aadhaar', 'Affidavit & non-availability certificate (late registration)']::text[]),
  ('svc-death-certificate', 'Death certificate', 'మరణ ధృవపత్రం', 'Copy of a registered death — needed for pensions, insurance, property and the family member certificate.', array['Hospital / doctor death record', 'Deceased''s Aadhaar', 'Applicant''s Aadhaar']::text[]),
  ('svc-marriage-certificate', 'Marriage registration certificate', 'వివాహ నమోదు ధృవపత్రం', 'Registers a Hindu marriage and gives the certificate — needed for passports, visas, rice cards and spouse benefits.', array['Wedding invitation card', 'Age proof of both (SSC memo / passport / birth certificate)', 'Marriage photo', 'Residence proof of both', 'Witnesses'' Aadhaar (2)']::text[]),
  ('svc-health-card', 'Dr NTR Vaidya Seva (Aarogyasri) health card', 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ) హెల్త్ కార్డు', 'The card that lets your family get free treatment under Dr NTR Vaidya Seva.', array['Aadhaar cards of all members', 'Rice card (white / BPL)', 'Family photo']::text[]),
  ('svc-electricity-connection', 'New electricity connection', 'కొత్త విద్యుత్ కనెక్షన్', 'Apply for a new domestic power connection through the Sachivalayam.', array['ID proof (rice card, PAN, Aadhaar, passport or driving licence)', 'Proof of ownership / occupancy of the house', 'Caste certificate (mandatory for SC / ST free power)']::text[]),
  ('svc-water-connection', 'New water tap connection', 'కొత్త నీటి కుళాయి కనెక్షన్', 'Domestic drinking-water connection from the municipality / panchayat line.', array['Site plan showing the pipeline and connection point', 'Latest property tax receipt', 'Rice card + income certificate (BPL connection)']::text[]),
  ('svc-land-mutation', 'Land mutation & pattadar passbook (succession)', 'భూమి మ్యుటేషన్ & పట్టాదార్ పాస్‌బుక్ (వారసత్వం)', 'Change the land record (1-B) and passbook to the heirs'' names after the owner dies. Purchases are usually updated automatically after registration.', array['Death certificate of the owner', 'Family member certificate', 'Pattadar passbook / land records (1-B, Adangal)', 'Aadhaar of all heirs']::text[]),
  ('svc-land-records', 'Adangal / 1-B copy', 'అడంగల్ / 1-బి కాపీ', 'Certified copy of your land records — for bank loans, crop insurance and court cases. You can also view them free on MeeBhoomi.', array['Survey number and village name', 'Aadhaar card']::text[]),
  ('svc-encumbrance-certificate', 'Encumbrance certificate (EC)', 'ఎన్‌కంబరెన్స్ సర్టిఫికేట్ (EC)', 'Shows registered sales, mortgages and transactions on a property — check before buying land or taking a loan.', array['Property details (survey / door number, village, period to search)']::text[])
on conflict (id) do update set
  name = excluded.name,
  name_telugu = excluded.name_telugu,
  description = excluded.description,
  required_documents = excluded.required_documents;

-- ══════════════════════════════════════════════════════════════════════════
-- SachiSeva — staff key checked inside the database.
-- Staff must type the staff key to register AND to log in. The key lives in a
-- table nobody can read through the API; the app only calls claim_staff().
-- Default key: 4040. Change it any time in the SQL editor:
--   update public.app_secrets set value = 'new-key' where name = 'staff_key';
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value) values ('staff_key', '4040') on conflict (name) do nothing;

-- Failed attempts, so a 4-digit key can't be guessed by trying them all.
create table if not exists public.staff_key_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists staff_key_attempts_user_at on public.staff_key_attempts (user_id, at);
alter table public.staff_key_attempts enable row level security;
revoke all on public.staff_key_attempts from anon, authenticated;

-- true  → key correct; the signed-in account is (now) staff
-- false → wrong key (counted; 5 wrong tries in 15 minutes locks the account out for a while)
create or replace function public.claim_staff(_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _secret text;
begin
  if _uid is null then raise exception 'not signed in'; end if;
  if coalesce(btrim(_key), '') = '' then return null; end if;  -- used by the System check
  if (select count(*) from public.staff_key_attempts where user_id = _uid and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many attempts — try again in 15 minutes';
  end if;
  select value into _secret from public.app_secrets where name = 'staff_key';
  if _secret is null or coalesce(btrim(_key), '') <> _secret then
    insert into public.staff_key_attempts (user_id) values (_uid);
    return false;
  end if;
  delete from public.staff_key_attempts where user_id = _uid;
  update public.profiles set is_staff = true where id = _uid;
  if not found then
    insert into public.profiles (id, is_staff) values (_uid, true) on conflict (id) do update set is_staff = true;
  end if;
  return true;
end $$;

revoke execute on function public.claim_staff(text) from public, anon;
grant execute on function public.claim_staff(text) to authenticated;

-- Citizens could create their own profile row with is_staff = true if the
-- sign-up trigger hadn't made one yet; only allow the harmless columns.
revoke insert on public.profiles from authenticated;
grant insert (id, full_name, email) on public.profiles to authenticated;
revoke execute on function public.lookup_application_by_token(text) from public, anon;
revoke execute on function public.lookup_application_history(text) from public, anon;
revoke execute on function public.lookup_certificate_by_token(text) from public, anon;
grant execute on function public.lookup_application_by_token(text) to authenticated;
grant execute on function public.lookup_application_history(text) to authenticated;
grant execute on function public.lookup_certificate_by_token(text) to authenticated;

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted','under_review','documents_requested','approved','rejected'));

create or replace function public.message_on_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.application_messages (application_id, sender_type, message)
    values (
      new.id, 'staff',
      format(
        E'Your application is approved. Please visit your nearby Sachivalayam with your original documents and this application number (%s). Staff will guide you on the next steps.\nమీ దరఖాస్తు ఆమోదించబడింది. మీ అసలు పత్రాలు, ఈ దరఖాస్తు నంబర్ (%s)తో మీ సమీప సచివాలయానికి రండి. తదుపరి చర్యల గురించి సిబ్బంది మీకు వివరిస్తారు.',
        coalesce(new.token_number, ''), coalesce(new.token_number, '')
      )
    );
  end if;
  return new;
end $$;
revoke execute on function public.message_on_approval() from public, anon, authenticated;

drop trigger if exists trg_message_on_approval on public.applications;
create trigger trg_message_on_approval
  after update of status on public.applications
  for each row execute function public.message_on_approval();

create or replace function public.notify_application_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _email text;
  _scheme_name text;
  _label text;
begin
  if new.status is distinct from old.status then
    select email into _email from public.profiles where id = new.user_id;
    select name into _scheme_name from public.schemes where id = new.scheme_id;
    _label := case new.status
      when 'under_review' then 'Under review'
      when 'documents_requested' then 'Documents needed'
      when 'approved' then 'Approved — please visit your nearby Sachivalayam with your original documents; staff will guide you on the next steps'
      when 'rejected' then 'Rejected'
      else replace(new.status, '_', ' ') end;
    perform public.send_email(
      _email,
      'Your application status has changed',
      format(
        '<p>Your application for <strong>%s</strong> is now: <strong>%s</strong>.</p><p>Log in to SachiSeva to see details.</p>',
        coalesce(_scheme_name, 'your scheme'), _label
      )
    );
  end if;
  return new;
end $$;
