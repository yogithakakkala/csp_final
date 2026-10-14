
-- =========================================================
-- FEATURE 2: application_status_history
-- =========================================================
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_staff boolean NOT NULL DEFAULT false,
  note text,
  document_requested text
);
CREATE INDEX IF NOT EXISTS idx_ash_app ON public.application_status_history(application_id, changed_at);

GRANT SELECT ON public.application_status_history TO authenticated;
GRANT ALL ON public.application_status_history TO service_role;

ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citizen see own history" ON public.application_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.applications a
            WHERE a.id = application_status_history.application_id AND a.user_id = auth.uid())
  );
CREATE POLICY "staff see all history" ON public.application_status_history
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert history" ON public.application_status_history
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Trigger to auto-insert history rows
CREATE OR REPLACE FUNCTION public.record_application_status_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _by_staff boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_status_history (application_id, status, changed_at, changed_by_staff)
      VALUES (NEW.id, NEW.status, NEW.created_at, false);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _by_staff := coalesce(public.is_staff(auth.uid()), false);
    INSERT INTO public.application_status_history (application_id, status, changed_at, changed_by_staff)
      VALUES (NEW.id, NEW.status, now(), _by_staff);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_app_status_history_ins ON public.applications;
CREATE TRIGGER trg_app_status_history_ins
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_status_history();

DROP TRIGGER IF EXISTS trg_app_status_history_upd ON public.applications;
CREATE TRIGGER trg_app_status_history_upd
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_status_history();

-- Backfill for existing applications
INSERT INTO public.application_status_history (application_id, status, changed_at)
SELECT a.id, a.status, a.created_at FROM public.applications a
WHERE NOT EXISTS (SELECT 1 FROM public.application_status_history h WHERE h.application_id = a.id);

-- =========================================================
-- FEATURE 3: application_drafts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.application_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id text NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_percentage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheme_id)
);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON public.application_drafts(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_drafts TO authenticated;
GRANT ALL ON public.application_drafts TO service_role;

ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own drafts all" ON public.application_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_drafts_updated_at ON public.application_drafts;
CREATE TRIGGER trg_drafts_updated_at BEFORE UPDATE ON public.application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-delete draft when application submitted
CREATE OR REPLACE FUNCTION public.delete_draft_on_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.application_drafts
    WHERE user_id = NEW.user_id AND scheme_id = NEW.scheme_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_delete_draft_on_app ON public.applications;
CREATE TRIGGER trg_delete_draft_on_app
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.delete_draft_on_application_insert();

-- =========================================================
-- FEATURE 4: sachivalayam_centers busy indicator
-- =========================================================
ALTER TABLE public.sachivalayam_centers
  ADD COLUMN IF NOT EXISTS busy_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS busy_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS busy_note text;

DO $$ BEGIN
  ALTER TABLE public.sachivalayam_centers
    ADD CONSTRAINT sachivalayam_busy_level_chk CHECK (busy_level IN ('low','moderate','busy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- FEATURE 5: grievances
-- =========================================================
CREATE TABLE IF NOT EXISTS public.grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'raised' CHECK (status IN ('raised','acknowledged','resolved')),
  raised_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  admin_response text
);
CREATE INDEX IF NOT EXISTS idx_griev_app ON public.grievances(application_id);
CREATE INDEX IF NOT EXISTS idx_griev_user ON public.grievances(user_id);

GRANT SELECT, INSERT ON public.grievances TO authenticated;
GRANT UPDATE ON public.grievances TO authenticated;
GRANT ALL ON public.grievances TO service_role;

ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citizen see own grievances" ON public.grievances
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "citizen insert own grievances" ON public.grievances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff see all grievances" ON public.grievances
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update grievances" ON public.grievances
  FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Email notification trigger on grievance status changes
CREATE OR REPLACE FUNCTION public.notify_grievance_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _scheme text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT p.email INTO _email FROM public.profiles p WHERE p.id = NEW.user_id;
    SELECT s.name INTO _scheme FROM public.applications a
      LEFT JOIN public.schemes s ON s.id = a.scheme_id WHERE a.id = NEW.application_id;
    IF NEW.status = 'acknowledged' THEN
      PERFORM public.send_email(_email, 'Your grievance has been acknowledged',
        format('<p>Your grievance for <strong>%s</strong> has been acknowledged. Staff will review your application shortly.</p>', coalesce(_scheme, 'your application')));
    ELSIF NEW.status = 'resolved' THEN
      PERFORM public.send_email(_email, 'Your grievance has been resolved',
        format('<p>Your grievance for <strong>%s</strong> has been resolved.</p><p>%s</p>',
          coalesce(_scheme, 'your application'), coalesce(NEW.admin_response, '')));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_grievance ON public.grievances;
CREATE TRIGGER trg_notify_grievance
  AFTER UPDATE ON public.grievances
  FOR EACH ROW EXECUTE FUNCTION public.notify_grievance_status();

-- =========================================================
-- Realtime
-- =========================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.application_status_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sachivalayam_centers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.grievances;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Scheduled: daily 9 AM stale application reminder
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_stale_applications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.id, a.user_id, s.name AS scheme_name, s.name_telugu AS scheme_name_te, p.email
      FROM public.applications a
      LEFT JOIN public.schemes s ON s.id = a.scheme_id
      LEFT JOIN public.profiles p ON p.id = a.user_id
     WHERE a.status IN ('submitted','under_review')
       AND a.updated_at < now() - interval '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.grievances g
          WHERE g.application_id = a.id AND g.status <> 'resolved'
       )
       AND p.email IS NOT NULL
  LOOP
    PERFORM public.send_email(
      r.email,
      'Your application has not been updated in 7 days',
      format('<p>Your application for <strong>%s</strong> has not been updated in 7 days.</p><p>You can raise a grievance through SachiSeva to escalate this. / మీ %s దరఖాస్తు 7 రోజులుగా అప్‌డేట్ కాలేదు.</p>',
        coalesce(r.scheme_name, 'your scheme'), coalesce(r.scheme_name_te, ''))
    );
  END LOOP;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('notify_stale_applications_daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'notify_stale_applications_daily',
  '0 9 * * *',
  $$ SELECT public.notify_stale_applications(); $$
);
