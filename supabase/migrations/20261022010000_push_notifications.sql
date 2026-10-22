-- Phone notifications (Web Push) for application updates, plus a daily reminder
-- for documents staff asked for that have not been uploaded yet.
--
-- How it works: a trigger calls the `send-push` Edge Function through pg_net with a
-- shared secret; the function looks up the citizen's subscriptions and sends the push.
-- Set once (values are not stored in this file; generate the VAPID pair with `npx web-push generate-vapid-keys`):
--   insert into public.app_secrets (name, value) values
--     ('push_hook_secret', '<random string>'),
--     ('push_function_url', 'https://<project-ref>.supabase.co/functions/v1/send-push'),
--     ('vapid_public_key', '<public key, also in src/lib/push.ts>'),
--     ('vapid_private_key', '<private key>'),
--     ('vapid_subject', 'mailto:<contact email>')
--   on conflict (name) do update set value = excluded.value;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en' check (lang in ('en', 'te')),
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

revoke all on public.push_subscriptions from anon, public;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sends one notification to every phone/browser of a user. Never blocks the change that caused it.
create or replace function public.queue_push(_user uuid, _title_en text, _body_en text, _title_te text, _body_te text, _url text, _tag text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret text;
  _fn text;
begin
  if _user is null or not exists (select 1 from public.push_subscriptions where user_id = _user) then return; end if;
  select value into _secret from public.app_secrets where name = 'push_hook_secret';
  select value into _fn from public.app_secrets where name = 'push_function_url';
  if _secret is null or _fn is null then return; end if;
  begin
    perform net.http_post(
      url := _fn,
      headers := jsonb_build_object('content-type', 'application/json', 'x-hook-secret', _secret),
      body := jsonb_build_object('user_id', _user, 'url', _url, 'tag', _tag,
        'en', jsonb_build_object('title', _title_en, 'body', _body_en),
        'te', jsonb_build_object('title', _title_te, 'body', _body_te)),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'push not sent: %', sqlerrm;
  end;
end $$;
revoke all on function public.queue_push(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Status changed → notify the applicant.
create or replace function public.push_on_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _en text; _te text; _s_en text; _s_te text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select coalesce(name, 'your application'), coalesce(name_telugu, name, 'మీ దరఖాస్తు') into _s_en, _s_te from public.schemes where id = new.scheme_id;
  _en := case new.status
    when 'under_review' then 'is now under review.'
    when 'documents_requested' then 'needs a document — open it to upload.'
    when 'approved' then 'is approved. Please visit your nearby Sachivalayam with your original documents.'
    when 'rejected' then 'was not approved. Please visit your nearby Sachivalayam to know why and what to do next.'
    else 'has a new status.' end;
  _te := case new.status
    when 'under_review' then 'పరిశీలనలో ఉంది.'
    when 'documents_requested' then 'కోసం ఒక పత్రం కావాలి — తెరిచి అప్‌లోడ్ చేయండి.'
    when 'approved' then 'ఆమోదించబడింది. అసలు పత్రాలతో మీ సమీప సచివాలయానికి వెళ్లండి.'
    when 'rejected' then 'ఆమోదించబడలేదు. కారణం, తదుపరి చర్య తెలుసుకోవడానికి సమీప సచివాలయానికి వెళ్లండి.'
    else 'స్థితి మారింది.' end;
  perform public.queue_push(new.user_id,
    'Application update', format('%s %s', _s_en, _en),
    'దరఖాస్తు అప్‌డేట్', format('%s %s', _s_te, _te),
    '/my-applications/' || new.id, 'app-' || new.id);
  return new;
end $$;
drop trigger if exists trg_push_status on public.applications;
create trigger trg_push_status after update of status on public.applications
  for each row execute function public.push_on_status_change();

-- Staff message or document request → notify the applicant.
create or replace function public.push_on_staff_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _user uuid;
begin
  if new.sender_type <> 'staff' then return new; end if;
  select user_id into _user from public.applications where id = new.application_id;
  if coalesce(new.is_document_request, false) then
    perform public.queue_push(_user,
      'Document needed', format('Staff need: %s. Open your application to upload it.', coalesce(new.requested_document_type, 'a document')),
      'పత్రం కావాలి', format('సిబ్బందికి కావలసింది: %s. అప్‌లోడ్ చేయడానికి మీ దరఖాస్తు తెరవండి.', coalesce(new.requested_document_type, 'ఒక పత్రం')),
      '/my-applications/' || new.application_id, 'msg-' || new.application_id);
  else
    perform public.queue_push(_user,
      'Message from Sachivalayam staff', left(coalesce(new.message, ''), 140),
      'సచివాలయ సిబ్బంది నుండి సందేశం', left(coalesce(new.message, ''), 140),
      '/my-applications/' || new.application_id, 'msg-' || new.application_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_push_message on public.application_messages;
create trigger trg_push_message after insert on public.application_messages
  for each row execute function public.push_on_staff_message();

-- Daily reminder: a document was requested 2–7 days ago and the citizen has not replied since.
create or replace function public.send_document_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id, a.user_id, coalesce(s.name, 'your application') s_en, coalesce(s.name_telugu, s.name, 'మీ దరఖాస్తు') s_te,
           req.requested_document_type doc
      from public.applications a
      left join public.schemes s on s.id = a.scheme_id
      join lateral (select m.requested_document_type, m.created_at from public.application_messages m
                     where m.application_id = a.id and m.is_document_request
                     order by m.created_at desc limit 1) req on true
     where a.status = 'documents_requested'
       and req.created_at < now() - interval '2 days'
       and req.created_at > now() - interval '7 days' -- remind daily for up to 5 days, then stop
       and not exists (select 1 from public.application_messages m
                        where m.application_id = a.id and m.sender_type = 'user' and m.created_at > req.created_at)
  loop
    perform public.queue_push(r.user_id,
      'Reminder: document still needed', format('%s is waiting for %s. Upload it to continue.', r.s_en, coalesce(r.doc, 'a document')),
      'గుర్తు: పత్రం ఇంకా కావాలి', format('%s కోసం %s కావాలి. కొనసాగించడానికి అప్‌లోడ్ చేయండి.', r.s_te, coalesce(r.doc, 'ఒక పత్రం')),
      '/my-applications/' || r.id, 'remind-' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.send_document_reminders() from public, anon, authenticated;

-- Every day at 10:00 IST (04:30 UTC), where pg_cron is available.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sachiseva-document-reminders';
    perform cron.schedule('sachiseva-document-reminders', '30 4 * * *', 'select public.send_document_reminders()');
  end if;
end $$;

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.push_on_status_change() from public, anon, authenticated;
revoke execute on function public.push_on_staff_message() from public, anon, authenticated;
revoke execute on function public.guard_agent_report() from public, anon, authenticated;
