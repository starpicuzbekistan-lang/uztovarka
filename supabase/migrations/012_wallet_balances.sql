-- 012 — yangi natijaga asoslangan hamyon (UZTOVARKA).
-- Qabul: faqat tasdiqlangan, haqiqiy hisobot × 1 000 so'm.
-- Sotuv: admin kiritgan sotuv Hold'da; alohida tasdiqlangach × 5 000 so'm Asosiyga o'tadi.
-- Bonus/to'lov: faqat adminning imzolangan, takrorlanmaydigan RPC amali.
-- Eski payroll_calculations/payroll_payments tarixiga tegilmaydi.
BEGIN;

create table public.operator_wallet_policy (
  id boolean primary key default true check (id),
  start_date date not null
);
insert into public.operator_wallet_policy(id,start_date)
values(true,date_trunc('month',now() at time zone 'Asia/Tashkent')::date);
alter table public.operator_wallet_policy enable row level security;
revoke all on public.operator_wallet_policy from public,anon,authenticated;

create table public.wallet_sales_confirmations (
 operator_id uuid not null references public.profiles(id) on delete cascade,
 month_start date not null check (extract(day from month_start)=1),
 confirmed_orders integer not null default 0 check(confirmed_orders>=0),
 approved_by uuid references public.profiles(id) on delete set null,
 approved_at timestamptz,
 primary key(operator_id,month_start)
);
alter table public.wallet_sales_confirmations enable row level security;
create policy wallet_sales_read on public.wallet_sales_confirmations for select to authenticated
 using(public.is_admin() or (operator_id=auth.uid() and public.is_active_user()));
revoke all on public.wallet_sales_confirmations from public,anon,authenticated;
grant select on public.wallet_sales_confirmations to authenticated;

create table public.wallet_movements (
 id uuid primary key default gen_random_uuid(),
 operator_id uuid not null references public.profiles(id) on delete cascade,
 action text not null check(action in ('bonus','payment')),
 amount_uzs bigint not null check(amount_uzs>0),
 note text not null check(length(btrim(note))>0),
 request_key uuid not null,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(operator_id,request_key)
);
create index wallet_movements_operator_idx on public.wallet_movements(operator_id,created_at desc);
alter table public.wallet_movements enable row level security;
create policy wallet_movement_read on public.wallet_movements for select to authenticated
 using(public.is_admin() or (operator_id=auth.uid() and public.is_active_user()));
revoke all on public.wallet_movements from public,anon,authenticated;
grant select on public.wallet_movements to authenticated;

-- Oylik "sotilgan buyurtmalar" avval admin kiritadigan operator_sales_monthly da bor.
-- Sonni tasdiqlangan savdodan kamaytirish qat'iyan taqiqlanadi.
create or replace function public.guard_wallet_reported_sales()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_confirmed integer;
begin
  if tg_op='DELETE' then
    select confirmed_orders into v_confirmed from public.wallet_sales_confirmations
      where operator_id=old.operator_id and month_start=old.month_start;
    if coalesce(v_confirmed,0)>0 then
      raise exception 'Tasdiqlangan sotuvlar mavjud, bu satrni o‘chirish mumkin emas' using errcode='23514';
    end if;
    return old;
  end if;
  select confirmed_orders into v_confirmed from public.wallet_sales_confirmations
    where operator_id=new.operator_id and month_start=new.month_start;
  if new.sold_orders < coalesce(v_confirmed,0) then
    raise exception 'Tasdiqlangan sotuvlar sonidan kam son kirita olmaysiz' using errcode='23514';
  end if;
  return new;
end $;
create trigger wallet_reported_sales_guard before insert or update or delete on public.operator_sales_monthly
 for each row execute function public.guard_wallet_reported_sales();

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
   select coalesce(sum(r.accepted_orders),0)::bigint as n from public.daily_reports r
   cross join policy p
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
        a.n*1000,s.confirmed*5000,m.bonus,m.paid,
        (a.n*1000+s.confirmed*5000+m.bonus-m.paid)::bigint,
        greatest(0,s.reported-s.confirmed)*5000
 from policy p cross join a cross join s cross join m;
end $$;
revoke all on function public.get_operator_wallet(uuid) from public,anon;
grant execute on function public.get_operator_wallet(uuid) to authenticated;

create or replace function public.admin_confirm_wallet_sales(
 p_operator uuid,p_month date,p_count integer
) returns void language plpgsql volatile security definer set search_path=public as $$
declare v_reported integer;v_confirmed integer;v_accepted bigint;v_start date;
begin
 if not public.is_admin() then raise exception 'Faqat admin tasdiqlaydi' using errcode='42501'; end if;
 if p_count is null or p_count<=0 or p_month is null or extract(day from p_month)<>1 then
   raise exception 'Oy va tasdiqlash sonini to‘g‘ri kiriting' using errcode='22023';
 end if;
 select start_date into v_start from public.operator_wallet_policy where id=true;
 if p_month<date_trunc('month',v_start)::date then
   raise exception 'Yangi hamyon boshlanishidan oldingi sotuv tasdiqlanmaydi' using errcode='22023';
 end if;
 -- Barcha wallet amallari bitta operator qatori bo‘yicha ketma-ket yuradi.
 perform 1 from public.profiles p where p.id=p_operator and p.role='operator' for update;
 if not found then raise exception 'Operator topilmadi' using errcode='22023'; end if;
 select sold_orders into v_reported from public.operator_sales_monthly
   where operator_id=p_operator and month_start=p_month for update;
 if v_reported is null then raise exception 'Avval sotuv sonini kiriting' using errcode='22023'; end if;
 select coalesce(confirmed_orders,0) into v_confirmed
   from public.wallet_sales_confirmations where operator_id=p_operator and month_start=p_month for update;
 v_confirmed:=coalesce(v_confirmed,0);
 select coalesce(sum(accepted_orders),0) into v_accepted
 from public.daily_reports where operator_id=p_operator and status='approved'
   and not is_demo and report_date>=greatest(p_month,v_start)
   and report_date<(p_month+interval '1 month')::date;
 if v_confirmed+p_count>v_reported then
   raise exception 'Hold balansda bunday miqdorda sotuv yo‘q' using errcode='22023';
 end if;
 if v_confirmed+p_count>v_accepted then
   raise exception 'Tasdiqlangan sotuv soni tasdiqlangan qabullardan oshmasligi kerak' using errcode='22023';
 end if;
 insert into public.wallet_sales_confirmations(operator_id,month_start,confirmed_orders,approved_by,approved_at)
 values(p_operator,p_month,p_count,auth.uid(),now())
 on conflict(operator_id,month_start) do update set
   confirmed_orders=wallet_sales_confirmations.confirmed_orders+excluded.confirmed_orders,
   approved_by=excluded.approved_by,approved_at=excluded.approved_at;
end $$;
revoke all on function public.admin_confirm_wallet_sales(uuid,date,integer) from public,anon;
grant execute on function public.admin_confirm_wallet_sales(uuid,date,integer) to authenticated;

create or replace function public.admin_wallet_movement(
 p_operator uuid,p_action text,p_amount bigint,p_note text,p_request_key uuid
) returns uuid language plpgsql volatile security definer set search_path=public as $$
declare v_balance bigint;v_existing uuid;v_id uuid;
begin
 if not public.is_admin() then raise exception 'Faqat admin to‘lov kiritadi' using errcode='42501'; end if;
 if p_action not in ('bonus','payment') or p_amount is null or p_amount<=0 or p_request_key is null
   or p_note is null or length(btrim(p_note))=0 then
    raise exception 'Amal, summa, sabab va so‘rov ID ni kiriting' using errcode='22023';
 end if;
 perform 1 from public.profiles p where p.id=p_operator and p.role='operator' for update;
 if not found then raise exception 'Operator topilmadi' using errcode='22023'; end if;
 select id into v_existing from public.wallet_movements
   where operator_id=p_operator and request_key=p_request_key;
 if v_existing is not null then return v_existing; end if;
 if p_action='payment' then
   select w.main_balance into v_balance from public.get_operator_wallet(p_operator) w;
   if p_amount>v_balance then raise exception 'Asosiy balansda mablag‘ yetarli emas' using errcode='22023'; end if;
 end if;
 insert into public.wallet_movements(operator_id,action,amount_uzs,note,request_key,created_by)
 values(p_operator,p_action,p_amount,btrim(p_note),p_request_key,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.admin_wallet_movement(uuid,text,bigint,text,uuid) from public,anon;
grant execute on function public.admin_wallet_movement(uuid,text,bigint,text,uuid) to authenticated;

-- Yangi yashil/sariq/qizil KPI chegaralari: shu oydan 50/40.
-- Avvalgi oylardagi KPI tarixini, qabul va payroll hujjatlarini qayta yozmaydi.
do $$
declare v_month date:=date_trunc('month',now() at time zone 'Asia/Tashkent')::date;
begin
  insert into public.kpi_setting_versions (
    operator_id,effective_from,monthly_target_uzs,working_days,daily_target,min_threshold,
    shortfall_coef_uzs,bonus_coef_uzs,absence_rule,absence_fixed_uzs,leave_policy,note
  )
  select v.operator_id,v_month,v.monthly_target_uzs,v.working_days,50,40,
    v.shortfall_coef_uzs,v.bonus_coef_uzs,v.absence_rule,v.absence_fixed_uzs,v.leave_policy,
    '012: KPI 50 yashil / 40 sariq'
  from (
    select distinct on (operator_id) * from public.kpi_setting_versions
    where effective_from<=v_month order by operator_id,effective_from desc,created_at desc
  ) v
  where not exists (
    select 1 from public.kpi_setting_versions e
    where e.operator_id is not distinct from v.operator_id and e.effective_from=v_month
  );
  update public.kpi_setting_versions set daily_target=50,min_threshold=40
    where effective_from>=v_month;
end $$;

COMMIT;
