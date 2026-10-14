
-- 1) Sequence + column
CREATE SEQUENCE IF NOT EXISTS public.application_token_seq START 1;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS token_number text UNIQUE;

-- 2) Trigger to auto-generate token_number
CREATE OR REPLACE FUNCTION public.set_application_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.token_number IS NULL OR NEW.token_number = '' THEN
    NEW.token_number := 'APP-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.application_token_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_application_token ON public.applications;
CREATE TRIGGER trg_set_application_token
BEFORE INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_application_token();

-- 3) Backfill existing rows
UPDATE public.applications
SET token_number = 'APP-' || to_char(created_at, 'YYYY') || '-' ||
    lpad(nextval('public.application_token_seq')::text, 6, '0')
WHERE token_number IS NULL;

-- 4) Public lookup RPC (bypasses RLS via security definer, returns non-sensitive fields)
CREATE OR REPLACE FUNCTION public.lookup_application_by_token(_token text)
RETURNS TABLE (
  token_number text,
  status text,
  scheme_id text,
  scheme_name text,
  applicant_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.token_number,
         a.status,
         a.scheme_id,
         s.name AS scheme_name,
         COALESCE(p.full_name, a.applicant_details->>'full_name') AS applicant_name,
         a.created_at,
         a.updated_at
    FROM public.applications a
    LEFT JOIN public.schemes s  ON s.id = a.scheme_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
   WHERE a.token_number = _token
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_application_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_application_by_token(text) TO anon, authenticated;
