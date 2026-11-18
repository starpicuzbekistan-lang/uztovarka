-- 015: operatorning mustaqil ro'yxatdan o'tishi (admin tasdig'i) va
-- kunlik qabul me'yoriga yetgandagina 1 000 so'm/qabul hisoblanishi.
-- 001–014 SQL dan KEYIN 1 MARTA. Eski balans/to'lov tarixiga tegilmaydi.
BEGIN;

-- Yangi Auth foydalanuvchi ro'yxatdan o'tganda profil avval NOFAOL.
-- Admin taklif yuborsa, auth.users.invited_at orqali ajratiladi (client metadata emas).
ALTER TABLE public.profiles
 ADD COLUMN signup_requested_at timestamptz,
 ADD COLUMN signup_reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (
    id,email,full_name,role,is_active,signup_requested_at
  )
  VALUES(
    NEW.id,NEW.email,
    coalesce(nullif(NEW.raw_user_meta_data->>'full_name',''),split_part(NEW.email,'@',1)),
    'operator',
    (NEW.invited_at IS NOT NULL),
    CASE WHEN NEW.invited_at IS NULL THEN now() ELSE NULL END
  )
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END $$;

-- Profil yaratilgandan so'ng yangi operator o'z tasdig'ini qalbakilashtira olmaydi.
CREATE OR REPLACE FUNCTION public.guard_registration_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin()
    AND (NEW.signup_requested_at IS DISTINCT FROM OLD.signup_requested_at
      OR NEW.signup_reviewed_at IS DISTINCT FROM OLD.signup_reviewed_at) THEN
    RAISE EXCEPTION 'Ro‘yxatdan o‘tish tasdig‘ini faqat admin boshqaradi' USING ERRCODE='42501';
  END IF;
  IF NOT OLD.is_active AND NEW.is_active
    AND OLD.signup_requested_at IS NOT NULL
    AND OLD.signup_reviewed_at IS NULL THEN
    NEW.signup_reviewed_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_registration_review
 BEFORE UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.guard_registration_review();

-- Natijaga asoslangan qabul puli qoidalari, mustaqil KPI 50/40 dan.
-- Boshlang'ich me'yor: bugundan 50 qabul.
-- Oldingi kunlar eski hisobini saqlaydi (retroaktiv kamaytirish yo'q).
CREATE TABLE public.acceptance_payment_rules (
 effective_from date PRIMARY KEY,
 min_orders integer NOT NULL CHECK(min_orders BETWEEN 1 AND 100000),
 updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.acceptance_payment_rules(effective_from,min_orders)
VALUES ((now() AT TIME ZONE 'Asia/Tashkent')::date,50);
ALTER TABLE public.acceptance_payment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acceptance_payment_rules FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_acceptance_payment_threshold(p_date date)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_value integer;
BEGIN
 IF NOT public.is_active_user() THEN RAISE EXCEPTION 'Ruxsat yo‘q' USING ERRCODE='42501'; END IF;
 SELECT min_orders INTO v_value FROM public.acceptance_payment_rules
 WHERE effective_from<=coalesce(p_date,(now() at time zone 'Asia/Tashkent')::date)
 ORDER BY effective_from DESC LIMIT 1;
 RETURN coalesce(v_value,0); -- 0 = eski to'lov qoidasi (oldingi davr)
END $$;
REVOKE ALL ON FUNCTION public.get_acceptance_payment_threshold(date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_acceptance_payment_threshold(date) TO authenticated;

-- Admin yangi me'yorni kamida ERTANGI kundan belgilaydi:
-- allaqachon tasdiqlangan qabul pullari qayta hisoblanmaydi.
CREATE OR REPLACE FUNCTION public.admin_set_acceptance_payment_threshold(
 p_min integer,p_from date
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Faqat admin me’yor belgilaydi' USING ERRCODE='42501'; END IF;
 IF p_min IS NULL OR p_min<1 OR p_min>100000 OR p_from IS NULL OR p_from<=v_today THEN
   RAISE EXCEPTION 'Me’yor 1 dan katta bo‘lsin, boshlanish sanasi ertadan bo‘lsin' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.acceptance_payment_rules(effective_from,min_orders,updated_by)
 VALUES(p_from,p_min,auth.uid())
 ON CONFLICT(effective_from) DO UPDATE SET
 min_orders=excluded.min_orders,updated_by=excluded.updated_by,created_at=now();
END $$;
REVOKE ALL ON FUNCTION public.admin_set_acceptance_payment_threshold(integer,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_acceptance_payment_threshold(integer,date) TO authenticated;

-- Tanlangan oyda kunlik min. qabulga erishgan kunlardagina 1 000 so'm/qabul.
-- Natija/reyting uchun barcha tasdiqlangan qabullar saqlanadi.
CREATE OR REPLACE FUNCTION public.get_operator_acceptance_month(
 p_operator uuid,p_month date
) RETURNS TABLE (
 total_accepted bigint,payable_accepted bigint,unpaid_accepted bigint,accepted_earnings bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_active_user() OR (p_operator<>auth.uid() AND NOT public.is_admin()) THEN
  RAISE EXCEPTION 'Ruxsat yo‘q' USING ERRCODE='42501';
 END IF;
 IF p_month IS NULL THEN RAISE EXCEPTION 'Oy tanlanmagan' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH wallet_start AS (SELECT start_date AS d FROM public.operator_wallet_policy WHERE id=true),
 src AS (
   SELECT r.accepted_orders,coalesce(t.min_orders,0) AS min_orders
   FROM public.daily_reports r
   CROSS JOIN wallet_start w
   LEFT JOIN LATERAL (
     SELECT d.min_orders FROM public.acceptance_payment_rules d
     WHERE d.effective_from<=r.report_date ORDER BY d.effective_from DESC LIMIT 1
   ) t ON true
   WHERE r.operator_id=p_operator AND r.status='approved' AND NOT r.is_demo
     AND r.report_date>=greatest(date_trunc('month',p_month)::date,w.d)
     AND r.report_date<(date_trunc('month',p_month)+interval '1 month')::date
 )
 SELECT coalesce(sum(accepted_orders),0)::bigint,
   coalesce(sum(CASE WHEN accepted_orders>=min_orders THEN accepted_orders ELSE 0 END),0)::bigint,
   coalesce(sum(CASE WHEN accepted_orders<min_orders THEN accepted_orders ELSE 0 END),0)::bigint,
   coalesce(sum(CASE WHEN accepted_orders>=min_orders THEN accepted_orders*1000 ELSE 0 END),0)::bigint
 FROM src;
END $$;
REVOKE ALL ON FUNCTION public.get_operator_acceptance_month(uuid,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_operator_acceptance_month(uuid,date) TO authenticated;

-- Oldingi wallet-v2 bu RPC'ni chaqiradi: Hold va sotuv 5 000 hisobiga TEGMAYMIZ.
create or replace function public.get_operator_wallet(p_operator uuid)
returns table(
 start_date date,
 accepted_orders bigint,
 reported_sales bigint,
 confirmed_sales bigint,
 pending_sales bigint,
 accepted_earnings bigint,
 sales_earnings bigint,
 bonus_earnings bigint,
 paid_uzs bigint,
 main_balance bigint,
 hold_balance bigint
)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active_user() or (not public.is_admin() and p_operator<>auth.uid()) then
   raise exception 'Ruxsat yo‘q' using errcode='42501';
 end if;
 if not exists (select 1 from public.profiles p where p.id=p_operator) then
   raise exception 'Operator topilmadi' using errcode='22023';
 end if;
 return query
 with policy as (select w.start_date as d from public.operator_wallet_policy w where w.id=true),
 a as (
   select coalesce(sum(r.accepted_orders),0)::bigint as n,
     coalesce(sum(case when r.accepted_orders>=coalesce(t.min_orders,0)
                  then r.accepted_orders else 0 end),0)::bigint as payable
   from public.daily_reports r
   cross join policy p
   left join lateral (
     select d.min_orders from public.acceptance_payment_rules d
     where d.effective_from<=r.report_date
     order by d.effective_from desc limit 1
   ) t on true
   where r.operator_id=p_operator and r.status='approved' and not r.is_demo and r.report_date>=p.d
 ), s as (
   select coalesce(sum(sm.sold_orders),0)::bigint as reported,
     coalesce(sum(coalesce(sc.confirmed_orders,0)),0)::bigint as confirmed
   from public.operator_sales_monthly sm
   left join public.wallet_sales_confirmations sc
     on sc.operator_id=sm.operator_id and sc.month_start=sm.month_start
   cross join policy p
   where sm.operator_id=p_operator and sm.month_start>=date_trunc('month',p.d)::date
 ), m as (
   select coalesce(sum(v.amount_uzs) filter(where v.action='bonus'),0)::bigint as bonus,
     coalesce(sum(v.amount_uzs) filter(where v.action='payment'),0)::bigint as paid
   from public.wallet_movements v cross join policy p
   where v.operator_id=p_operator and (v.created_at at time zone 'Asia/Tashkent')::date >= p.d
 )
 select p.d,a.n,s.reported,s.confirmed,greatest(0,s.reported-s.confirmed),
        a.payable*1000,s.confirmed*5000,m.bonus,m.paid,
        (a.payable*1000+s.confirmed*5000+m.bonus-m.paid)::bigint,
        greatest(0,s.reported-s.confirmed)*5000
 from policy p cross join a cross join s cross join m;
end $$;

-- KPI 50/40, jarima va sotuv tasdig'i alohida qoladi.
COMMIT;
