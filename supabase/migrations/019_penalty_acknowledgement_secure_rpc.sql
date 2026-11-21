-- 019: secure, idempotent penalty acknowledgement.
-- Operator identity and current policy are checked on the server.
BEGIN;
CREATE OR REPLACE FUNCTION public.acknowledge_operator_penalty()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_operator uuid:=auth.uid();
        v_amount bigint;
        v_date date;
BEGIN
 IF v_operator IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.profiles
   WHERE id=v_operator AND role='operator' AND is_active
 ) THEN
   RAISE EXCEPTION 'Faqat faol operator tasdiqlay oladi' USING errcode='42501';
 END IF;
 SELECT p.amount_uzs,p.effective_from INTO v_amount,v_date
 FROM public.operator_absence_policy p WHERE p.id=true;
 IF v_amount IS NULL OR v_amount<=0 OR v_date IS NULL THEN
   RAISE EXCEPTION 'Jarima qoidasi topilmadi' USING errcode='22023';
 END IF;
 INSERT INTO public.operator_penalty_acknowledgements(operator_id,amount_uzs,effective_from)
 VALUES(v_operator,v_amount,v_date)
 ON CONFLICT(operator_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_operator_penalty() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_operator_penalty() TO authenticated;
REVOKE INSERT ON public.operator_penalty_acknowledgements FROM authenticated;
DROP POLICY IF EXISTS operator_penalty_acknowledgements_insert ON public.operator_penalty_acknowledgements;
COMMIT;
