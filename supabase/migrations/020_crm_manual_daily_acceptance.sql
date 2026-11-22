-- 020 - Admin-only manual CRM accepted totals, not operator reports.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_daily_acceptance (
  report_date date PRIMARY KEY,
  accepted_count integer NOT NULL CHECK (accepted_count >= 0 AND accepted_count <= 10000000),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_daily_acceptance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_daily_acceptance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.crm_daily_acceptance TO authenticated;
DROP POLICY IF EXISTS crm_daily_acceptance_admin_select ON public.crm_daily_acceptance;
DROP POLICY IF EXISTS crm_daily_acceptance_admin_insert ON public.crm_daily_acceptance;
DROP POLICY IF EXISTS crm_daily_acceptance_admin_update ON public.crm_daily_acceptance;
CREATE POLICY crm_daily_acceptance_admin_select ON public.crm_daily_acceptance
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY crm_daily_acceptance_admin_insert ON public.crm_daily_acceptance
 FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND updated_by=(SELECT auth.uid()));
CREATE POLICY crm_daily_acceptance_admin_update ON public.crm_daily_acceptance
 FOR UPDATE TO authenticated USING ((SELECT public.is_admin()))
 WITH CHECK ((SELECT public.is_admin()) AND updated_by=(SELECT auth.uid()));
COMMIT;
