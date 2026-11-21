-- UZTOVARKA Manager Hub: manager roles, scoped team membership and internal tasks.
-- Previous migrations 001–016 must be installed first.
-- New enum values need a transaction boundary before first use.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

BEGIN;
CREATE TABLE public.manager_teams (
 manager_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT 'Mening jamoam' CHECK (length(btrim(name)) BETWEEN 2 AND 100),
 target_accepted integer NOT NULL DEFAULT 0 CHECK (target_accepted >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.manager_assignments (
 operator_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(),
 assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX manager_assignments_manager_idx ON public.manager_assignments(manager_id);

CREATE OR REPLACE FUNCTION public.guard_manager_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.manager_id AND role='manager' AND is_active) THEN
  RAISE EXCEPTION 'Faol menejer tanlang' USING errcode='22023';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.operator_id AND role='operator') THEN
  RAISE EXCEPTION 'Operator tanlang' USING errcode='22023';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_manager_assignment BEFORE INSERT OR UPDATE ON public.manager_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_manager_assignment();

CREATE OR REPLACE FUNCTION public.is_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='manager' AND is_active);
$$;
CREATE OR REPLACE FUNCTION public.manager_has_operator(p_operator uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_manager() AND EXISTS (
  SELECT 1 FROM public.manager_assignments a
  JOIN public.profiles p ON p.id=a.operator_id
  WHERE a.manager_id=auth.uid() AND a.operator_id=p_operator AND p.role='operator'
 );
$$;
REVOKE ALL ON FUNCTION public.is_manager(), public.manager_has_operator(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_manager(), public.manager_has_operator(uuid) TO authenticated;

ALTER TABLE public.manager_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_teams_read ON public.manager_teams FOR SELECT TO authenticated
 USING (public.is_admin() OR (manager_id=auth.uid() AND public.is_manager()));
CREATE POLICY manager_teams_admin ON public.manager_teams FOR ALL TO authenticated
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY manager_assignments_read ON public.manager_assignments FOR SELECT TO authenticated
 USING (public.is_admin() OR (manager_id=auth.uid() AND public.is_manager()));
CREATE POLICY manager_assignments_admin ON public.manager_assignments FOR ALL TO authenticated
 USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.manager_assignments,public.manager_teams FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.manager_assignments,public.manager_teams TO authenticated;

CREATE TABLE public.manager_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
 description text NOT NULL DEFAULT '',
 category text NOT NULL DEFAULT 'general' CHECK (category IN ('training','improvement','general','meeting')),
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
 status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','completed')),
 due_at timestamptz NOT NULL,
 recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','weekly','monthly')),
 repeat_source uuid UNIQUE REFERENCES public.manager_tasks(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manager_tasks_manager_idx ON public.manager_tasks(manager_id,due_at DESC);
CREATE INDEX manager_tasks_operator_idx ON public.manager_tasks(operator_id,status);
CREATE TABLE public.manager_task_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES public.manager_tasks(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manager_task_comments_task_idx ON public.manager_task_comments(task_id,created_at);

ALTER TABLE public.manager_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_tasks_read ON public.manager_tasks FOR SELECT TO authenticated
 USING (public.is_admin() OR (manager_id=auth.uid() AND public.manager_has_operator(operator_id))
  OR (operator_id=auth.uid() AND public.is_active_user()));
CREATE POLICY manager_task_comments_read ON public.manager_task_comments FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.manager_tasks t WHERE t.id=task_id));
-- No client INSERT/UPDATE/DELETE on tasks/comments; all writes use checked RPCs.
REVOKE ALL ON public.manager_tasks, public.manager_task_comments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.manager_tasks,public.manager_task_comments TO authenticated;

-- Manager can only read aggregated KPI for assigned operators. No payments or customer data.
CREATE OR REPLACE FUNCTION public.manager_team_kpi(p_from date,p_to date)
RETURNS TABLE(
 operator_id uuid,full_name text,avatar_url text,employee_id text,is_active boolean,
 today_accepted bigint,period_accepted bigint,worked_days bigint,green_days bigint,
 yellow_days bigint,red_days bigint,pending_reports bigint,
 absent_days bigint,leave_days bigint,days_off bigint,
 last_report_date date,last_report_status text,gold_verified boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_manager() THEN RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'Noto‘g‘ri sana oralig‘i' USING errcode='22023';
 END IF;
 RETURN QUERY
 WITH limits AS (
  SELECT COALESCE((SELECT yellow_below FROM public.kpi_color_thresholds WHERE id=1),50) AS green_min,
         COALESCE((SELECT red_below FROM public.kpi_color_thresholds WHERE id=1),40) AS yellow_min
 )
 SELECT p.id,p.full_name,p.avatar_url,p.employee_id,p.is_active,
  COALESCE(sum(r.accepted_orders) FILTER (WHERE r.status='approved'
   AND r.report_date=(now() AT TIME ZONE 'Asia/Tashkent')::date),0)::bigint,
  COALESCE(sum(r.accepted_orders) FILTER (WHERE r.status='approved'),0)::bigint,
  count(r.id) FILTER (WHERE r.status='approved')::bigint,
  count(r.id) FILTER (WHERE r.status='approved' AND r.accepted_orders>=limits.green_min)::bigint,
  count(r.id) FILTER (WHERE r.status='approved' AND r.accepted_orders>=limits.yellow_min AND r.accepted_orders<limits.green_min)::bigint,
  count(r.id) FILTER (WHERE r.status='approved' AND r.accepted_orders<limits.yellow_min)::bigint,
  count(r.id) FILTER (WHERE r.status IN ('pending','correction_requested'))::bigint,
  (SELECT count(*) FROM public.attendance_records at WHERE at.operator_id=p.id
   AND at.record_date BETWEEN p_from AND p_to AND at.kind='absent')::bigint,
  (SELECT count(*) FROM public.attendance_records at WHERE at.operator_id=p.id
   AND at.record_date BETWEEN p_from AND p_to AND at.kind='leave')::bigint,
  (SELECT count(*) FROM public.attendance_records at WHERE at.operator_id=p.id
   AND at.record_date BETWEEN p_from AND p_to AND at.kind='day_off')::bigint,
  (SELECT max(d.report_date) FROM public.daily_reports d
   WHERE d.operator_id=p.id AND d.report_date BETWEEN p_from AND p_to AND NOT d.is_demo),
  (SELECT d.status::text FROM public.daily_reports d WHERE d.operator_id=p.id
   AND d.report_date BETWEEN p_from AND p_to AND NOT d.is_demo
   ORDER BY d.report_date DESC LIMIT 1),
  (SELECT bool_and(g.eligible) FROM generate_series(1,3) AS gs(month_n)
   CROSS JOIN LATERAL public._gold_month_snapshot(p.id,
      (date_trunc('month',(now() AT TIME ZONE 'Asia/Tashkent')::date)-make_interval(months=>gs.month_n))::date) g)
 FROM public.manager_assignments ma
 JOIN public.profiles p ON p.id=ma.operator_id AND p.role='operator'
 CROSS JOIN limits
 LEFT JOIN public.daily_reports r ON r.operator_id=p.id AND r.report_date BETWEEN p_from AND p_to AND NOT r.is_demo
 WHERE ma.manager_id=auth.uid()
 GROUP BY p.id,p.full_name,p.avatar_url,p.employee_id,p.is_active,limits.green_min,limits.yellow_min
 ORDER BY 7 DESC,p.full_name;
END $$;
REVOKE ALL ON FUNCTION public.manager_team_kpi(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_team_kpi(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_daily_trend(p_from date,p_to date)
RETURNS TABLE(day date,approved_accepted bigint,approved_reports bigint,awaiting_reports bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_manager() THEN RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'Noto‘g‘ri sana oralig‘i' USING errcode='22023';
 END IF;
 RETURN QUERY SELECT d.day::date,
  COALESCE(sum(r.accepted_orders) FILTER (WHERE r.status='approved'),0)::bigint,
  count(r.id) FILTER (WHERE r.status='approved')::bigint,
  count(r.id) FILTER (WHERE r.status IN ('pending','correction_requested'))::bigint
 FROM generate_series(p_from,p_to,interval '1 day') d(day)
 LEFT JOIN public.daily_reports r ON r.report_date=d.day AND NOT r.is_demo
  AND r.operator_id IN (SELECT a.operator_id FROM public.manager_assignments a WHERE a.manager_id=auth.uid())
 GROUP BY d.day ORDER BY d.day;
END $$;
REVOKE ALL ON FUNCTION public.manager_daily_trend(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_daily_trend(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_create_task(
 p_operator uuid,p_title text,p_description text,p_category text,p_priority text,
 p_due_at timestamptz,p_recurrence text DEFAULT 'none'
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.manager_has_operator(p_operator) THEN RAISE EXCEPTION 'Bu operator sizga biriktirilmagan' USING errcode='42501'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 160 OR
    length(coalesce(p_description,''))>2000 OR p_due_at IS NULL OR p_due_at<=now()
    OR p_category NOT IN ('training','improvement','general','meeting')
    OR p_priority NOT IN ('low','normal','high') OR p_recurrence NOT IN ('none','weekly','monthly') THEN
  RAISE EXCEPTION 'Vazifa ma’lumotlarini tekshiring' USING errcode='22023';
 END IF;
 INSERT INTO public.manager_tasks(manager_id,operator_id,title,description,category,priority,due_at,recurrence)
 VALUES(auth.uid(),p_operator,btrim(p_title),coalesce(p_description,''),p_category,p_priority,p_due_at,p_recurrence)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.manager_create_task(uuid,text,text,text,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_create_task(uuid,text,text,text,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.operator_update_task(p_task uuid,p_status text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.manager_tasks;
BEGIN
 SELECT * INTO t FROM public.manager_tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR t.operator_id<>auth.uid()
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND p.role='operator') THEN
  RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501';
 END IF;
 IF NOT ((t.status='todo' AND p_status='in_progress')
    OR (t.status='in_progress' AND p_status='review')
    OR (t.status='review' AND p_status='in_progress')) THEN
  RAISE EXCEPTION 'Bu holatga o‘tib bo‘lmaydi' USING errcode='22023';
 END IF;
 UPDATE public.manager_tasks SET status=p_status,updated_at=now() WHERE id=p_task;
END $$;
REVOKE ALL ON FUNCTION public.operator_update_task(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operator_update_task(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_review_task(p_task uuid,p_action text,p_comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.manager_tasks; next_due timestamptz;
BEGIN
 SELECT * INTO t FROM public.manager_tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR t.manager_id<>auth.uid() OR NOT public.manager_has_operator(t.operator_id) THEN
  RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501';
 END IF;
 IF p_action NOT IN ('complete','reopen') OR (p_action='complete' AND t.status NOT IN ('review','in_progress'))
    OR (p_action='reopen' AND t.status NOT IN ('review','completed')) THEN
  RAISE EXCEPTION 'Vazifa holati noto‘g‘ri' USING errcode='22023';
 END IF;
 IF p_comment IS NOT NULL AND length(btrim(p_comment)) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Izoh noto‘g‘ri' USING errcode='22023';
 END IF;
 UPDATE public.manager_tasks
 SET status=CASE WHEN p_action='complete' THEN 'completed' ELSE 'in_progress' END,
 completed_at=CASE WHEN p_action='complete' THEN now() ELSE NULL END,updated_at=now()
 WHERE id=t.id;
 IF p_comment IS NOT NULL THEN
  INSERT INTO public.manager_task_comments(task_id,author_id,body) VALUES(t.id,auth.uid(),btrim(p_comment));
 END IF;
 IF p_action='complete' AND t.recurrence<>'none' THEN
  next_due:=CASE WHEN t.recurrence='weekly' THEN t.due_at+interval '7 days'
                 ELSE t.due_at+interval '1 month' END;
  WHILE next_due<=now() LOOP
   next_due:=CASE WHEN t.recurrence='weekly' THEN next_due+interval '7 days'
                  ELSE next_due+interval '1 month' END;
  END LOOP;
  INSERT INTO public.manager_tasks(manager_id,operator_id,title,description,category,priority,due_at,recurrence,repeat_source)
  VALUES(t.manager_id,t.operator_id,t.title,t.description,t.category,t.priority,next_due,t.recurrence,t.id)
  ON CONFLICT (repeat_source) DO NOTHING;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.manager_review_task(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_review_task(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_comment_task(p_task uuid,p_comment text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.manager_tasks;
BEGIN
 SELECT * INTO t FROM public.manager_tasks WHERE id=p_task;
 IF NOT FOUND OR t.manager_id<>auth.uid() OR NOT public.manager_has_operator(t.operator_id) THEN
  RAISE EXCEPTION 'Ruxsat yo‘q' USING errcode='42501';
 END IF;
 IF length(btrim(coalesce(p_comment,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Izoh kiriting' USING errcode='22023'; END IF;
 INSERT INTO public.manager_task_comments(task_id,author_id,body) VALUES(p_task,auth.uid(),btrim(p_comment));
END $$;
REVOKE ALL ON FUNCTION public.manager_comment_task(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_comment_task(uuid,text) TO authenticated;

COMMIT;
