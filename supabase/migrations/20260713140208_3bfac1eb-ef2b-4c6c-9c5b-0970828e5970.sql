
revoke execute on function public.send_email(text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_application_status_change() from public, anon, authenticated;
revoke execute on function public.notify_application_message() from public, anon, authenticated;
revoke execute on function public.notify_certificate_status_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
