-- 006: yopilgan (locked) oylik davrini himoyalash.
-- Davr "locked" bo‘lsa, unga tegishli tuzatish, hisob-kitob va ish kunlari soni o‘zgarmaydi
-- (faqat to‘lovlarni yozish davom etadi). Qayta hisoblash uchun administrator davrni avval ochishi kerak (audit yoziladi).

create or replace function guard_locked_period() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_status text;
begin
  v_pid := coalesce(case when tg_op = 'DELETE' then old.period_id else new.period_id end, null);
  select status into v_status from payroll_periods where id = v_pid;
  if v_status = 'locked' then
    raise exception 'Bu oylik davri yopilgan. Avval davrni oching' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger guard_adjustments_locked before insert or update or delete on salary_adjustments
  for each row execute function guard_locked_period();
create trigger guard_calculations_locked before insert or update or delete on payroll_calculations
  for each row execute function guard_locked_period();

create or replace function guard_period_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'locked' and new.status = 'locked'
     and (new.working_days is distinct from old.working_days or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date) then
    raise exception 'Yopilgan davrni o‘zgartirib bo‘lmaydi' using errcode = '42501';
  end if;
  if new.status = 'locked' and old.status <> 'locked' then new.locked_at := now(); end if;
  if new.status = 'open' then new.locked_at := null; end if;
  return new;
end $$;

create trigger guard_period_update before update on payroll_periods
  for each row execute function guard_period_update();
