-- 014: UZTOVARKA: faqat administrator beradigan maxsus badgelar
-- 011 dan keyin, mavjud avtomatik badge tizimini o'zgartirmaydi.
BEGIN;
CREATE TABLE public.operator_special_badges (
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_code text NOT NULL CHECK (badge_code IN (
    'sales_machine','rising_star','unstopable','trust_builder',
    'objection_slayer','deal_closer','early_bird','team_hero',
    'team_lagend','bull'
  )),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  awarded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  PRIMARY KEY (operator_id,badge_code)
);
CREATE INDEX special_badges_active_operator_idx
  ON public.operator_special_badges(operator_id,awarded_at DESC)
  WHERE revoked_at IS NULL;
ALTER TABLE public.operator_special_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY special_badges_read ON public.operator_special_badges
 FOR SELECT TO authenticated USING (
   public.is_admin() OR (operator_id=auth.uid() AND revoked_at IS NULL AND public.is_active_user())
 );
REVOKE ALL ON public.operator_special_badges FROM public, anon, authenticated;
GRANT SELECT ON public.operator_special_badges TO authenticated;

-- Biror operatorga maxsus badge berish / qaytarib olish FAQAT admin RPC orqali.
-- Shu orqali oddiy operatorga yozish imkoniyati berilmaydi.
CREATE OR REPLACE FUNCTION public.admin_manage_special_badge(
  p_operator uuid,
  p_badge_code text,
  p_reason text,
  p_action text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_current public.operator_special_badges%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Faqat administrator badge bera oladi' USING ERRCODE='42501';
  END IF;
  IF p_badge_code IS NULL OR p_badge_code NOT IN (
     'sales_machine','rising_star','unstopable','trust_builder',
     'objection_slayer','deal_closer','early_bird','team_hero',
     'team_lagend','bull'
  ) OR p_action IS NULL OR p_action NOT IN ('grant','revoke') THEN
    RAISE EXCEPTION 'Badge yoki amal noto‘g‘ri' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.profiles
    WHERE id=p_operator AND role='operator' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operator topilmadi' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_current FROM public.operator_special_badges
    WHERE operator_id=p_operator AND badge_code=p_badge_code FOR UPDATE;

  IF p_action='grant' THEN
    IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
      RAISE EXCEPTION 'Mukofot sababi 3–500 ta belgidan iborat bo‘lsin' USING ERRCODE='22023';
    END IF;
    IF FOUND AND v_current.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Bu badge operatorga allaqachon berilgan' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.operator_special_badges (
      operator_id,badge_code,reason,awarded_by,awarded_at,revoked_at,revoked_by
    ) VALUES (p_operator,p_badge_code,btrim(p_reason),auth.uid(),now(),NULL,NULL)
    ON CONFLICT (operator_id,badge_code) DO UPDATE SET
      reason=excluded.reason,awarded_by=excluded.awarded_by,
      awarded_at=now(),revoked_at=NULL,revoked_by=NULL;
  ELSE
    IF NOT FOUND OR v_current.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Bu operatorning faol badge ro‘yxatida yo‘q' USING ERRCODE='22023';
    END IF;
    UPDATE public.operator_special_badges SET
      revoked_at=now(),revoked_by=auth.uid()
    WHERE operator_id=p_operator AND badge_code=p_badge_code;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_manage_special_badge(uuid,text,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_special_badge(uuid,text,text,text) TO authenticated;
COMMIT;
