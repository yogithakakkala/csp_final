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
