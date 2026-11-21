-- 018 — One-time operator notification and signed main balance.
-- Apply after 013; existing reports and penalties are unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_operator_wallet_v2(p_operator uuid)
RETURNS TABLE(
 start_date date, accepted_orders bigint, reported_sales bigint, confirmed_sales bigint,
 pending_sales bigint, accepted_earnings bigint, sales_earnings bigint, bonus_earnings bigint,
 paid_uzs bigint, main_balance bigint, hold_balance bigint, missing_days bigint, penalty_uzs bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_active_user() OR (NOT public.is_admin() AND p_operator<>auth.uid()) THEN
   RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501';
 END IF;
 RETURN QUERY
 WITH w AS (SELECT * FROM public.get_operator_wallet(p_operator)),
 fine AS (
   SELECT count(*)::bigint AS days,coalesce(sum(d.penalty_uzs),0)::bigint AS amount
   FROM public.get_operator_missing_days(p_operator,null::date) d
 )
 SELECT w.start_date,w.accepted_orders,w.reported_sales,w.confirmed_sales,
        w.pending_sales,w.accepted_earnings,w.sales_earnings,w.bonus_earnings,
        w.paid_uzs,(w.main_balance-fine.amount)::bigint,w.hold_balance,
        fine.days,fine.amount
 FROM w CROSS JOIN fine;
END $$;
REVOKE ALL ON FUNCTION public.get_operator_wallet_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_operator_wallet_v2(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.operator_penalty_acknowledgements (
 operator_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 effective_from date NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operator_penalty_acknowledgements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_penalty_acknowledgements_select ON public.operator_penalty_acknowledgements;
CREATE POLICY operator_penalty_acknowledgements_select ON public.operator_penalty_acknowledgements
 FOR SELECT TO authenticated USING (operator_id=(select auth.uid()) AND public.is_active_user());
DROP POLICY IF EXISTS operator_penalty_acknowledgements_insert ON public.operator_penalty_acknowledgements;
CREATE POLICY operator_penalty_acknowledgements_insert ON public.operator_penalty_acknowledgements
 FOR INSERT TO authenticated
 WITH CHECK (
   operator_id=(select auth.uid()) AND public.is_active_user()
   AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.role='operator')
   AND EXISTS(SELECT 1 FROM public.operator_absence_policy a
      WHERE a.id=true AND a.amount_uzs>0 AND a.amount_uzs=amount_uzs AND a.effective_from=effective_from)
 );
REVOKE ALL ON public.operator_penalty_acknowledgements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.operator_penalty_acknowledgements TO authenticated;
COMMIT;
