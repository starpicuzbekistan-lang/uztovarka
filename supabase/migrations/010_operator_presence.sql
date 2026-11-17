-- 010 — Operator online/oxirgi login. 009'dan keyin bir marta Supabase SQL Editor'da bajariladi.
-- Online holat: oxirgi 90 soniya ichida faol sahifadan kelgan signal va "online" bayrog'i.
-- Faqat operatorning o'zi yozadi (RPC), faqat admin o'qiydi (RLS).
begin;

create table if not exists public.operator_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  online boolean not null default false
);
create index if not exists operator_presence_active_idx
  on public.operator_presence (last_seen_at desc);
alter table public.operator_presence enable row level security;

create policy presence_admin_read on public.operator_presence for select to authenticated
  using (public.is_admin());

-- Barcha yozish faqat auth.uid() uchun server RPC orqali; brauzerdan to'g'ridan-to'g'ri UPDATE yo'q.
revoke all on public.operator_presence from public, anon, authenticated;
grant select on public.operator_presence to authenticated;

create or replace function public.record_operator_presence(p_action text default 'heartbeat')
returns void
language plpgsql volatile security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user is null or not public.is_active_user() then
    raise exception 'Ruxsat yo‘q' using errcode='42501';
  end if;
  if p_action not in ('login', 'heartbeat', 'away', 'logout') then
    raise exception 'Noto‘g‘ri holat' using errcode='22023';
  end if;
  -- Adminlar emas, faqat faol operatorlar kuzatiladi.
  if not exists (select 1 from public.profiles p where p.id=v_user and p.is_active and p.role='operator') then
    return;
  end if;
  insert into public.operator_presence (user_id, last_login_at, last_seen_at, online)
  values (
    v_user,
    case when p_action='login' then v_now else null end,
    v_now,
    p_action in ('login', 'heartbeat')
  )
  on conflict (user_id) do update set
    last_login_at = case when p_action='login' then v_now else operator_presence.last_login_at end,
    last_seen_at = v_now,
    online = p_action in ('login', 'heartbeat');
end $$;

revoke all on function public.record_operator_presence(text) from public, anon;
grant execute on function public.record_operator_presence(text) to authenticated;
commit;
