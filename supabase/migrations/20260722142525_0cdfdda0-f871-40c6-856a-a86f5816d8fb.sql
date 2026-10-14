CREATE SEQUENCE IF NOT EXISTS public.application_token_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.application_token_seq TO authenticated, service_role;