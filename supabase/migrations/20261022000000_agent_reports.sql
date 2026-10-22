-- Fake-agent reports: citizens report anyone asking for money to apply for a scheme.
-- Citizens can file and see their own reports; staff see and update all of them.

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_name text,
  agent_phone text,
  place text,
  amount_asked integer check (amount_asked is null or amount_asked >= 0),
  scheme_id text,
  details text not null check (char_length(details) between 5 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- lets staff screens show the reporter's name next to the report
do $$ begin
  alter table public.agent_reports add constraint agent_reports_user_id_profiles_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;
create index if not exists idx_agent_reports_user on public.agent_reports(user_id);
create index if not exists idx_agent_reports_status on public.agent_reports(status, created_at desc);

revoke all on public.agent_reports from anon, public;
grant select, insert, update on public.agent_reports to authenticated;
grant all on public.agent_reports to service_role;
alter table public.agent_reports enable row level security;

drop policy if exists "citizen sees own reports" on public.agent_reports;
create policy "citizen sees own reports" on public.agent_reports
  for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "citizen files own reports" on public.agent_reports;
create policy "citizen files own reports" on public.agent_reports
  for insert to authenticated with check (user_id = auth.uid() and status = 'new' and staff_note is null);

drop policy if exists "staff update reports" on public.agent_reports;
create policy "staff update reports" on public.agent_reports
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Only staff may change status / note; nobody may change who filed it or what they said.
create or replace function public.guard_agent_report() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.user_id <> old.user_id or new.details <> old.details or new.created_at <> old.created_at then
    raise exception 'a report cannot be rewritten';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_agent_report on public.agent_reports;
create trigger trg_guard_agent_report before update on public.agent_reports
  for each row execute function public.guard_agent_report();

do $$ begin alter publication supabase_realtime add table public.agent_reports; exception when duplicate_object then null; end $$;
