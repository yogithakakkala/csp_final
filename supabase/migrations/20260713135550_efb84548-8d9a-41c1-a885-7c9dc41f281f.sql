
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
