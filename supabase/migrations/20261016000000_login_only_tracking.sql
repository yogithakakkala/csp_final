-- The app now needs a login for every page, so tracking by application number
-- is no longer open to logged-out visitors.
revoke execute on function public.lookup_application_by_token(text) from public, anon;
revoke execute on function public.lookup_application_history(text) from public, anon;
revoke execute on function public.lookup_certificate_by_token(text) from public, anon;
grant execute on function public.lookup_application_by_token(text) to authenticated;
grant execute on function public.lookup_application_history(text) to authenticated;
grant execute on function public.lookup_certificate_by_token(text) to authenticated;
