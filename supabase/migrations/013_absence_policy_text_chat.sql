-- 013 — kelmagan kunlar jarimasi va admin/operator matnli chat.
-- 012_sql muvaffaqiyatli bajarilgandan KEYIN 1 marta ishga tushiring.
begin;

-- Jarima miqdori faqat admin belgilagandan so'ng amal qiladi. Tarixni avtomatik jarimaga tortmaydi.
create table public.operator_absence_policy (
 id boolean primary key default true check (id),
 amount_uzs bigint not null default 0 check(amount_uzs>=0),
 effective_from date not null,
 updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.operator_absence_policy(id,amount_uzs,effective_from)
values(true,0,(now() at time zone 'Asia/Tashkent')::date);
alter table public.operator_absence_policy enable row level security;
revoke all on public.operator_absence_policy from public,anon,authenticated;

create or replace function public.get_operator_absence_policy()
returns table(amount_uzs bigint,effective_from date)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active_user() then raise exception 'Ruxsat yo‘q' using errcode='42501'; end if;
 return query select p.amount_uzs,p.effective_from from public.operator_absence_policy p where p.id=true;
end $$;
revoke all on function public.get_operator_absence_policy() from public,anon;
grant execute on function public.get_operator_absence_policy() to authenticated;

create or replace function public.admin_set_absence_policy(p_amount bigint,p_date date)
returns void language plpgsql volatile security definer set search_path=public as $$
declare v_start date;
begin
 if not public.is_admin() then raise exception 'Faqat admin o‘zgartira oladi' using errcode='42501'; end if;
 if p_amount is null or p_amount<0 or p_date is null then
   raise exception 'Miqdor va boshlanish sanasini kiriting' using errcode='22023';
 end if;
 select start_date into v_start from public.operator_wallet_policy where id=true;
 if p_date<v_start then
   raise exception 'Jarima boshlanish sanasi yangi hamyon boshlanishidan oldin bo‘lmasin' using errcode='22023';
 end if;
 update public.operator_absence_policy set amount_uzs=p_amount,effective_from=p_date,updated_by=auth.uid(),updated_at=now()
 where id=true;
end $$;
revoke all on function public.admin_set_absence_policy(bigint,date) from public,anon;
grant execute on function public.admin_set_absence_policy(bigint,date) to authenticated;

-- Oldingi kunning oxirigacha hisobot yuborilmagan bo'lsa, ishlamagan kun deb hisoblanadi.
-- "leave" va "day_off" admin tomonidan tasdiqlangan bo'lsa, o'sha kunga jarima yo'q.
-- "absent" hamda mutlaqo hisobot yo'q kunlar hisoblanadi.
create or replace function public.get_operator_missing_days(p_operator uuid,p_month date)
returns table(missing_date date,penalty_uzs bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active_user() or (not public.is_admin() and p_operator<>auth.uid()) then
   raise exception 'Ruxsat yo‘q' using errcode='42501';
 end if;
 return query
 with bounds as (
  select greatest(a.effective_from,w.start_date,(p.created_at at time zone 'Asia/Tashkent')::date,
                  coalesce(date_trunc('month',p_month)::date,a.effective_from)) as first_date,
         least(coalesce(((date_trunc('month',p_month)+interval '1 month')::date-1),
                        ((now() at time zone 'Asia/Tashkent')::date-1)),
                        ((now() at time zone 'Asia/Tashkent')::date-1)) as last_date,
         a.amount_uzs as fine
  from public.operator_absence_policy a cross join public.operator_wallet_policy w
  cross join public.profiles p where a.id=true and w.id=true and p.id=p_operator and p.role='operator'
 ), days as (
   select gs.day::date as d,b.fine
   from bounds b cross join lateral generate_series(b.first_date,b.last_date,interval '1 day') gs(day)
 )
 select d.d,d.fine from days d
 where not exists (select 1 from public.daily_reports r
   where r.operator_id=p_operator and r.report_date=d.d)
   and not exists (select 1 from public.attendance_records att
   where att.operator_id=p_operator and att.record_date=d.d and att.kind in ('leave','day_off'))
 order by d.d;
end $$;
revoke all on function public.get_operator_missing_days(uuid,date) from public,anon;
grant execute on function public.get_operator_missing_days(uuid,date) to authenticated;

-- 012'dagi hamyon modelini saqlaymiz, faqat "hisobot yo'q" kunlar jarimasini chiqaramiz.
-- Yangi funksiya nomi: mavjud RPC result-tipini buzmaslik uchun.
create or replace function public.get_operator_wallet_v2(p_operator uuid)
returns table(
 start_date date,accepted_orders bigint,reported_sales bigint,confirmed_sales bigint,
 pending_sales bigint,accepted_earnings bigint,sales_earnings bigint,bonus_earnings bigint,
 paid_uzs bigint,main_balance bigint,hold_balance bigint,missing_days bigint,penalty_uzs bigint
)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active_user() or (not public.is_admin() and p_operator<>auth.uid()) then
    raise exception 'Ruxsat yo‘q' using errcode='42501';
 end if;
 return query
 with w as (select * from public.get_operator_wallet(p_operator)),
 fine as (
  select count(*)::bigint as days,coalesce(sum(d.penalty_uzs),0)::bigint as amount
  from public.get_operator_missing_days(p_operator,null::date) d
 )
 select w.start_date,w.accepted_orders,w.reported_sales,w.confirmed_sales,
        w.pending_sales,w.accepted_earnings,w.sales_earnings,w.bonus_earnings,
        w.paid_uzs,greatest(0,w.main_balance-fine.amount)::bigint,w.hold_balance,
        fine.days,fine.amount
 from w cross join fine;
end $$;
revoke all on function public.get_operator_wallet_v2(uuid) from public,anon;
grant execute on function public.get_operator_wallet_v2(uuid) to authenticated;

-- Aylanma mablag' tekshiruvi jarimalardan keyingi REAL balansga asoslansin.
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
   select w.main_balance into v_balance from public.get_operator_wallet_v2(p_operator) w;
   if p_amount>coalesce(v_balance,0) then
     raise exception 'Jarimalar hisoblanganidan keyin Asosiy balansda mablag‘ yetarli emas' using errcode='22023';
   end if;
 end if;
 insert into public.wallet_movements(operator_id,action,amount_uzs,note,request_key,created_by)
 values(p_operator,p_action,p_amount,btrim(p_note),p_request_key,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.admin_wallet_movement(uuid,text,bigint,text,uuid) from public,anon;
grant execute on function public.admin_wallet_movement(uuid,text,bigint,text,uuid) to authenticated;

-- FAQAT matnli bitta-bitta operator/admin chat. Media/url uchun alohida kolonkalar yo'q.
create table public.support_threads (
 operator_id uuid primary key references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_threads_recent_idx on public.support_threads(updated_at desc);
alter table public.support_threads enable row level security;
create policy support_threads_read on public.support_threads for select to authenticated
 using(public.is_admin() or (operator_id=auth.uid() and public.is_active_user()));
create policy support_threads_operator_insert on public.support_threads for insert to authenticated
 with check(operator_id=auth.uid() and public.is_active_user() and
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='operator'));
revoke all on public.support_threads from public,anon,authenticated;
grant select,insert on public.support_threads to authenticated;

create table public.support_messages (
 id uuid primary key default gen_random_uuid(),
 operator_id uuid not null references public.support_threads(operator_id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index support_messages_thread_idx on public.support_messages(operator_id,created_at);
create index support_messages_unread_idx on public.support_messages(operator_id,read_at) where read_at is null;
alter table public.support_messages enable row level security;
create policy support_messages_read on public.support_messages for select to authenticated
 using(public.is_admin() or (operator_id=auth.uid() and public.is_active_user()));
create policy support_messages_send on public.support_messages for insert to authenticated
 with check(sender_id=auth.uid() and public.is_active_user() and
   (public.is_admin() or (operator_id=auth.uid() and
     exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='operator'))));
revoke all on public.support_messages from public,anon,authenticated;
grant select,insert on public.support_messages to authenticated;

create or replace function public.touch_support_thread()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.support_threads set updated_at=new.created_at where operator_id=new.operator_id;
 return new;
end $$;
create trigger support_message_touch after insert on public.support_messages
 for each row execute function public.touch_support_thread();

-- Faqat xabarni qabul qilgan tomon o'qilgan deb belgilaydi.
create or replace function public.mark_support_messages_read(p_operator uuid)
returns void language plpgsql volatile security definer set search_path=public as $$
begin
 if not public.is_active_user() or (not public.is_admin() and p_operator<>auth.uid()) then
   raise exception 'Ruxsat yo‘q' using errcode='42501';
 end if;
 update public.support_messages set read_at=now()
 where operator_id=p_operator and sender_id<>auth.uid() and read_at is null;
end $$;
revoke all on function public.mark_support_messages_read(uuid) from public,anon;
grant execute on function public.mark_support_messages_read(uuid) to authenticated;

commit;
