
create extension if not exists pgcrypto;

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

create extension if not exists pg_net with schema extensions;

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
