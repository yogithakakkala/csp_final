
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

alter publication supabase_realtime add table public.applications;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.is_staff(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.is_staff(uuid) to service_role;
grant execute on function public.is_staff(uuid) to authenticated;
