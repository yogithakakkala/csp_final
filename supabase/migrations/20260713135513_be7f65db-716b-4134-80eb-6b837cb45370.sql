
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

alter publication supabase_realtime add table public.application_messages;

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
