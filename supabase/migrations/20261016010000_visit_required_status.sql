-- New application status: staff ask the citizen to visit the Sachivalayam with
-- original documents for verification. The status e-mail uses friendly wording.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted','under_review','documents_requested','visit_required','approved','rejected'));

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
      when 'visit_required' then 'Please visit your Sachivalayam with your original documents for verification'
      when 'approved' then 'Approved'
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
