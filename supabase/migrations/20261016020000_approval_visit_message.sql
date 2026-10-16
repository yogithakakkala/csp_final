-- After an application is approved or rejected, the applicant automatically gets a
-- message asking them to visit their nearby Sachivalayam, where staff advise on next steps.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted','under_review','documents_requested','approved','rejected'));

create or replace function public.message_on_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.application_messages (application_id, sender_type, message)
    values (new.id, 'staff', format(
      E'Your application is approved. Please visit your nearby Sachivalayam with your original documents and this application number (%s). Staff will guide you on the next steps.\nమీ దరఖాస్తు ఆమోదించబడింది. మీ అసలు పత్రాలు, ఈ దరఖాస్తు నంబర్ (%s)తో మీ సమీప సచివాలయానికి రండి. తదుపరి చర్యల గురించి సిబ్బంది మీకు వివరిస్తారు.',
      coalesce(new.token_number, ''), coalesce(new.token_number, '')));
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.application_messages (application_id, sender_type, message)
    values (new.id, 'staff', format(
      E'Your application was not approved. Please visit your nearby Sachivalayam with this application number (%s). Staff will explain the reason and what you can do next.\nమీ దరఖాస్తు ఆమోదించబడలేదు. ఈ దరఖాస్తు నంబర్ (%s)తో మీ సమీప సచివాలయానికి రండి. కారణం, తర్వాత ఏమి చేయాలో సిబ్బంది వివరిస్తారు.',
      coalesce(new.token_number, ''), coalesce(new.token_number, '')));
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
      when 'rejected' then 'Not approved — please visit your nearby Sachivalayam; staff will explain the reason and what you can do next'
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
