-- UZTOVARKA — 009: Gold Verified, TOP 3 mukofotlari, savdo samaradorligi
-- 001-008 migratsiyalardan KEYIN bir marta bajariladi; mavjud KPI va hisobotlarga tegmaydi.
BEGIN;

create table if not exists public.operator_sales_monthly (
  operator_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check(extract(day from month_start) = 1),
  unique_calls integer not null check (unique_calls >= 0),
  sold_orders integer not null check (sold_orders >= 0),
  entered_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (operator_id, month_start)
);
create index if not exists operator_sales_monthly_date_idx on public.operator_sales_monthly(month_start);
alter table public.operator_sales_monthly enable row level security;
create policy operator_sales_monthly_read on public.operator_sales_monthly for select to authenticated
  using (public.is_admin() or (operator_id = auth.uid() and public.is_active_user()));
create policy operator_sales_monthly_admin on public.operator_sales_monthly for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.monthly_rank_prizes (
  month_start date primary key check (extract(day from month_start) = 1),
  first_uzs bigint not null default 0 check(first_uzs >= 0),
  second_uzs bigint not null default 0 check(second_uzs >= 0),
  third_uzs bigint not null default 0 check(third_uzs >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.monthly_rank_prizes enable row level security;
create policy monthly_rank_prizes_read on public.monthly_rank_prizes for select to authenticated
  using (public.is_active_user());
create policy monthly_rank_prizes_admin on public.monthly_rank_prizes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.operator_sales_monthly, public.monthly_rank_prizes to authenticated;
revoke all on public.operator_sales_monthly, public.monthly_rank_prizes from anon;

-- Ichki hisoblash. DEMO hisobotlar Gold maqomiga kirmaydi.
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
    (select v.daily_target from public.kpi_setting_versions v
       where v.effective_from <= r.report_date and (v.operator_id = p_operator or v.operator_id is null)
       order by (v.operator_id is not null) desc, v.effective_from desc limit 1) as target
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
revoke all on function public._gold_month_snapshot(uuid,date) from public, anon, authenticated;

-- Operator faqat o'zini, admin xohlagan operatorni tekshiradi.
-- Joriy oy + avvalgi 3 ta TUGALLANGAN oy; Verified faqat oxirgi 3 tugallangan oy o'tilganda.
create or replace function public.get_operator_gold_progress(p_operator uuid)
returns table (
 month_start date, worked_days bigint, green_days bigint, accepted_orders bigint,
 covered_days bigint, unique_calls bigint, sold_orders bigint,
 green_percent numeric, daily_average numeric, acceptance_percent numeric,
 sales_percent numeric, eligible boolean, is_completed boolean, is_verified boolean
)
language plpgsql stable security definer set search_path=public as $$
declare current_month date := date_trunc('month', now() at time zone 'Asia/Tashkent')::date;
begin
  if not public.is_active_user() or (p_operator <> auth.uid() and not public.is_admin()) then
    raise exception 'Ruxsat yo‘q' using errcode='42501';
  end if;
  return query
    with series as (
      select (current_month - make_interval(months => n))::date as m
      from generate_series(0,3) n
    ), months as (
      select g.*, (g.month_start < current_month) as completed
      from series s cross join lateral public._gold_month_snapshot(p_operator,s.m) g
    ), verified as (
      select count(*) filter (where m.eligible and m.completed) = 3 as yes
      from months m
    )
    select m.month_start, m.worked_days, m.green_days, m.accepted_orders,
      m.covered_days, m.unique_calls, m.sold_orders, m.green_percent,
      m.daily_average, m.acceptance_percent, m.sales_percent,
      m.eligible, m.completed, v.yes
    from months m cross join verified v order by m.month_start desc;
end $$;

-- Reyting uchun FAQAT tasdiqlangan oltin maqomga ega operatorlar UUID'lari.
create or replace function public.get_gold_verified_operators()
returns table(operator_id uuid)
language plpgsql stable security definer set search_path=public as $$
declare current_month date := date_trunc('month', now() at time zone 'Asia/Tashkent')::date;
begin
  if not public.is_active_user() then raise exception 'Ruxsat yo‘q' using errcode='42501'; end if;
  return query
    select p.id
    from public.profiles p
    where p.role='operator' and p.is_active
      and (select count(*) from generate_series(1,3) n
             cross join lateral public._gold_month_snapshot(p.id, (current_month - make_interval(months=>n))::date) m
             where m.eligible) = 3;
end $$;

grant execute on function public.get_operator_gold_progress(uuid), public.get_gold_verified_operators() to authenticated;
revoke all on function public.get_operator_gold_progress(uuid), public.get_gold_verified_operators() from anon;
COMMIT;
