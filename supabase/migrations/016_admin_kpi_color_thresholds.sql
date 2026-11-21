-- Admin kun ranglarini mustaqil boshqaradi. Payroll va wallet o‘zgarmaydi.
BEGIN;
CREATE TABLE public.kpi_color_thresholds (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  red_below integer NOT NULL DEFAULT 40 CHECK (red_below >= 0),
  yellow_below integer NOT NULL DEFAULT 50 CHECK (yellow_below <= 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_color_thresholds_order CHECK (yellow_below > red_below)
);
INSERT INTO public.kpi_color_thresholds(id,red_below,yellow_below)
VALUES (1,40,50) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.kpi_color_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_colors_read ON public.kpi_color_thresholds FOR SELECT TO authenticated
  USING (public.is_active_user() OR public.is_admin());
CREATE POLICY kpi_colors_admin ON public.kpi_color_thresholds FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.kpi_color_thresholds FROM PUBLIC,anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_color_thresholds TO authenticated;

-- Oldingi mezon orqali to‘lov hisoblash funksiyalari bu yerda ataylab o‘zgartirilmadi.
create or replace function public._gold_month_snapshot(p_operator uuid, p_month date)
returns table (
  month_start date, worked_days bigint, green_days bigint, accepted_orders bigint,
  covered_days bigint, unique_calls bigint, sold_orders bigint,
  green_percent numeric, daily_average numeric, acceptance_percent numeric,
  sales_percent numeric, eligible boolean
)
language sql stable security definer set search_path=public as $$
with period as (
  select date_trunc('month', p_month)::date as d,
         (date_trunc('month', p_month) + interval '1 month')::date as next_d
), day_rows as (
  select r.id, r.accepted_orders,
    (select yellow_below from public.kpi_color_thresholds where id=1) as target
  from public.daily_reports r cross join period p
  where r.operator_id = p_operator and r.status = 'approved'
    and r.is_demo = false and r.report_date >= p.d and r.report_date < p.next_d
), summary as (
  select count(*)::bigint as w,
         count(*) filter (where target is not null and accepted_orders >= target)::bigint as g,
         coalesce(sum(accepted_orders),0)::bigint as a
  from day_rows
), percentages as (
  select p.d, s.*, (case when m.operator_id is not null then s.w else 0 end)::bigint as covered,
    coalesce(m.unique_calls,0)::bigint as u, coalesce(m.sold_orders,0)::bigint as sold,
    case when w > 0 then round(g::numeric * 100 / w, 1) end as gp,
    case when w > 0 then round(a::numeric / w, 1) end as avg_q,
    case when m.operator_id is not null and m.unique_calls > 0 then round(a::numeric * 100 / m.unique_calls, 1) end as ap,
    case when m.operator_id is not null and a > 0 then round(m.sold_orders::numeric * 100 / a, 1) end as sp,
    m.operator_id is not null as has_metrics
  from summary s cross join period p
  left join public.operator_sales_monthly m on m.operator_id=p_operator and m.month_start=p.d
)
select d, w, g, a, covered, u, sold, gp, avg_q, ap, sp,
  (w >= 22 and g * 100 >= w * 80 and a >= w * 70
     and has_metrics and u > 0 and a * 100 >= u * 40
     and a > 0 and sold * 100 >= a * 40
     and a <= u and sold <= a)
from percentages;
$$;

create or replace function public.leaderboard(p_start date, p_end date)
returns table (operator_id uuid, full_name text, avatar_url text, total_orders bigint, worked_days bigint, green_days bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, coalesce(sum(r.accepted_orders), 0)::bigint,
    count(r.id)::bigint,
    count(r.id) filter (where r.accepted_orders >=
      (select yellow_below from public.kpi_color_thresholds where id=1))::bigint
  from public.profiles p
  left join public.daily_reports r on r.operator_id=p.id and r.status='approved'
    and r.report_date between p_start and p_end
  where p.is_active and p.role='operator' and public.is_active_user()
  group by p.id;
$$;

create or replace function public.get_team_dashboard(p_month date)
returns table(team_code text, operator_id uuid, full_name text, avatar_url text,
              accepted_orders bigint, worked_days bigint, green_days bigint,
              team_target integer)
language plpgsql stable security definer set search_path=public as $$
declare v_month date := date_trunc('month',p_month)::date;
begin
 if not public.is_active_user() then raise exception 'Ruxsat yo‘q' using errcode='42501'; end if;
 return query
 with teamlist(code) as (values ('alpha'::text),('beta'::text)),
 assignments as (
   select p.id,p.full_name,p.avatar_url,at.team_code
   from public.profiles p
   join lateral (
     select a.team_code from public.operator_team_assignments a
     where a.operator_id=p.id and a.effective_month<=v_month
     order by a.effective_month desc limit 1
   ) at on true
   where p.role='operator' and p.is_active
 ), month_reports as (
   select r.operator_id,sum(r.accepted_orders)::bigint as total,
          count(*)::bigint as days,
          count(*) filter (where r.accepted_orders>=(select yellow_below from public.kpi_color_thresholds where id=1))::bigint as greens
   from public.daily_reports r
   left join lateral (
     select v.daily_target from public.kpi_setting_versions v
     where v.effective_from<=r.report_date
       and (v.operator_id=r.operator_id or v.operator_id is null)
     order by (v.operator_id is not null) desc,v.effective_from desc limit 1
   ) k on true
   where r.status='approved' and r.is_demo=false
     and r.report_date>=v_month and r.report_date<(v_month+interval '1 month')::date
   group by r.operator_id
 )
 select t.code,a.id,a.full_name,a.avatar_url,
        coalesce(m.total,0),coalesce(m.days,0),coalesce(m.greens,0),g.target_orders
 from teamlist t
 left join assignments a on a.team_code=t.code
 left join month_reports m on m.operator_id=a.id
 left join public.team_monthly_goals g on g.team_code=t.code and g.month_start=v_month
 order by t.code,a.full_name;
end $$;

create or replace function public.get_operator_badges(p_operator uuid)
returns table(code text, earned boolean, progress numeric, target numeric, earned_on date)
language plpgsql stable security definer set search_path=public as $$
declare v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
 if not public.is_active_user() or (p_operator<>auth.uid() and not public.is_admin()) then
   raise exception 'Ruxsat yo‘q' using errcode='42501';
 end if;
 return query
 with reports as (
   select r.operator_id,r.report_date,r.accepted_orders,
     (r.accepted_orders>=(select yellow_below from public.kpi_color_thresholds where id=1)) as green
   from public.daily_reports r
   left join lateral (
     select v.daily_target from public.kpi_setting_versions v
       where v.effective_from<=r.report_date
         and (v.operator_id=r.operator_id or v.operator_id is null)
       order by (v.operator_id is not null) desc,v.effective_from desc limit 1
   ) k on true
   where r.status='approved' and r.is_demo=false and r.report_date<=v_today
 ), months as (
   select r.operator_id,date_trunc('month',r.report_date)::date as month_start,
     sum(r.accepted_orders)::numeric as orders,
     count(*) filter(where r.green)::numeric as greens
   from reports r group by r.operator_id,date_trunc('month',r.report_date)::date
 ), mymonth as (
   select m.* from months m where m.operator_id=p_operator
 ), career as (
   select coalesce(sum(m.orders),0)::numeric as orders from mymonth m
 ), goal_hits as (
   select m.month_start from mymonth m
   join public.operator_monthly_goals g on g.operator_id=p_operator and g.month_start=m.month_start
   where m.orders*100>=g.target_orders*150
 ), week_rank as (
   select date_trunc('week',r.report_date)::date as week_start,r.operator_id,
     sum(r.accepted_orders) as orders,count(*) filter(where r.green) as greens,
     row_number() over (partition by date_trunc('week',r.report_date)::date
       order by sum(r.accepted_orders) desc,count(*) filter(where r.green) desc,r.operator_id) as rk
   from reports r
   where r.report_date < date_trunc('week',v_today)::date
   group by date_trunc('week',r.report_date)::date,r.operator_id
 ), month_rank as (
   select m.*,row_number() over (partition by m.month_start
     order by m.orders desc,m.greens desc,m.operator_id) as rk
   from months m where m.month_start < date_trunc('month',v_today)::date
 ), team_reports as (
   select m.month_start,a.team_code,sum(m.orders)::numeric as orders
   from months m
   join lateral (
     select x.team_code from public.operator_team_assignments x
     where x.operator_id=m.operator_id and x.effective_month<=m.month_start
     order by x.effective_month desc limit 1
   ) a on true
   where m.month_start<date_trunc('month',v_today)::date
   group by m.month_start,a.team_code
 ), team_scores as (
   select g.month_start,g.team_code,coalesce(tm.orders,0)::numeric as orders,
     coalesce(tm.orders,0)::numeric*100/g.target_orders as rate
   from public.team_monthly_goals g
   left join team_reports tm on tm.month_start=g.month_start and tm.team_code=g.team_code
   where g.month_start<date_trunc('month',v_today)::date
     and exists(select 1 from public.team_monthly_goals other
       where other.month_start=g.month_start and other.team_code<>g.team_code)
 ), team_winners as (
   select t.month_start,t.team_code from team_scores t
   where not exists(select 1 from team_scores o
     where o.month_start=t.month_start and o.team_code<>t.team_code
       and (o.rate>t.rate or (o.rate=t.rate and o.orders>=t.orders)))
 ), my_champion as (
   select tw.month_start from team_winners tw
   join lateral (
     select a.team_code from public.operator_team_assignments a
       where a.operator_id=p_operator and a.effective_month<=tw.month_start
       order by a.effective_month desc limit 1
   ) a on a.team_code=tw.team_code
 )
 select b.code,
  case b.code
    when '100' then c.orders>=100
    when '1000' then c.orders>=1000
    when '10000' then c.orders>=10000
    when 'overachiever' then exists(select 1 from goal_hits)
    when 'green7' then exists(select 1 from mymonth where greens>=7)
    when 'green30' then exists(select 1 from mymonth where greens>=30)
    when 'team_champion' then exists(select 1 from my_champion)
    when 'week_operator' then exists(select 1 from week_rank where operator_id=p_operator and rk=1 and orders>0)
    when 'month_operator' then exists(select 1 from month_rank where operator_id=p_operator and rk=1 and orders>0)
  end as earned,
  case b.code
    when '100' then least(c.orders,100)
    when '1000' then least(c.orders,1000)
    when '10000' then least(c.orders,10000)
    when 'overachiever' then coalesce((select max(least(150,round(m.orders*100.0/g.target_orders,1)))
      from mymonth m join public.operator_monthly_goals g on g.operator_id=p_operator and g.month_start=m.month_start),0)
    when 'green7' then coalesce((select max(least(greens,7)) from mymonth),0)
    when 'green30' then coalesce((select max(least(greens,30)) from mymonth),0)
    when 'team_champion' then case when exists(select 1 from my_champion) then 1 else 0 end
    when 'week_operator' then case when exists(select 1 from week_rank where operator_id=p_operator and rk=1 and orders>0) then 1 else 0 end
    when 'month_operator' then case when exists(select 1 from month_rank where operator_id=p_operator and rk=1 and orders>0) then 1 else 0 end
  end as progress,
  b.required,
  case b.code
    when '100' then (select min(report_date) from reports r where r.operator_id=p_operator and
       (select sum(r2.accepted_orders) from reports r2 where r2.operator_id=p_operator and r2.report_date<=r.report_date)>=100)
    when '1000' then (select min(report_date) from reports r where r.operator_id=p_operator and
       (select sum(r2.accepted_orders) from reports r2 where r2.operator_id=p_operator and r2.report_date<=r.report_date)>=1000)
    when '10000' then (select min(report_date) from reports r where r.operator_id=p_operator and
       (select sum(r2.accepted_orders) from reports r2 where r2.operator_id=p_operator and r2.report_date<=r.report_date)>=10000)
    when 'overachiever' then (select min(month_start) from goal_hits)
    when 'green7' then (select min(month_start) from mymonth where greens>=7)
    when 'green30' then (select min(month_start) from mymonth where greens>=30)
    when 'team_champion' then (select min(month_start) from my_champion)
    when 'week_operator' then (select min(week_start) from week_rank where operator_id=p_operator and rk=1 and orders>0)
    when 'month_operator' then (select min(month_start) from month_rank where operator_id=p_operator and rk=1 and orders>0)
  end as earned_on
 from (values
   ('100'::text,100::numeric),('1000',1000),('10000',10000),
   ('overachiever',150),('green7',7),('green30',30),
   ('team_champion',1),('week_operator',1),('month_operator',1)
 ) b(code,required)
 cross join career c;
end $$;
COMMIT;
