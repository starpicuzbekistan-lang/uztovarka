-- UZTOVARKA Operator Hub — 002: yordamchi funksiyalar, triggerlar, RPC
-- Muhim: bu yerdagi qoidalar src/lib/reports.ts dagi sinovdan o‘tgan qoidalar bilan bir xil.

-- ───────────── Rol tekshiruvlari ─────────────
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

create or replace function tashkent_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

-- ───────────── Yangi auth foydalanuvchi → profil ─────────────
-- Rol HECH QACHON metadatadan olinmaydi: har doim 'operator'. Adminlikni faqat mavjud admin
-- (Edge Function orqali) yoki birinchi admin uchun README dagi SQL beradi.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────── updated_at ─────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','products','sets','scripts','objections','articles'] loop
    execute format('create trigger touch_%1$s before update on %1$s for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ───────────── O‘z profilida rol/holatni o‘zgartirishni taqiqlash ─────────────
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role (Edge Function) auth.uid() = null; bunday chaqiruvlarga ruxsat.
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.employee_id is distinct from old.employee_id
       or new.position is distinct from old.position
       or new.allow_backdated_reports is distinct from old.allow_backdated_reports
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'Bu maydonlarni faqat administrator o‘zgartira oladi' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on profiles
  for each row execute function guard_profile_update();

-- ───────────── Audit ─────────────
create or replace function write_audit(p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after)
$$;
revoke all on function write_audit(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text; v_before jsonb; v_after jsonb;
begin
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after  := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_id := coalesce(v_after->>'id', v_before->>'id');
  if tg_op = 'UPDATE' then
    -- mahsulot/nabor uchun faqat narx o‘zgarishi, profil uchun faqat rol/holat o‘zgarishi yoziladi
    if tg_table_name in ('products','sets') then
      if (v_before->>'price_uzs') is not distinct from (v_after->>'price_uzs') then return new; end if;
    elsif tg_table_name = 'profiles' then
      if (v_before->>'role') = (v_after->>'role') and (v_before->>'is_active') = (v_after->>'is_active') then return new; end if;
    end if;
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_before, v_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['kpi_setting_versions','salary_adjustments','payroll_payments','payroll_calculations','profiles','products','sets','attendance_records','payroll_periods'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on %1$s for each row execute function audit_row()', t);
  end loop;
end $$;

-- ───────────── Operator: kunlik hisobot topshirish ─────────────
create or replace function submit_daily_report(p_count int, p_date date default null)
returns daily_reports
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_today date := tashkent_today();
  v_date date := coalesce(p_date, tashkent_today());
  v_row daily_reports;
begin
  select * into v_profile from profiles where id = auth.uid();
  if not found or not v_profile.is_active then
    raise exception 'Hisob faol emas' using errcode = '42501';
  end if;
  if p_count is null or p_count < 0 then
    raise exception 'Buyurtmalar soni manfiy bo‘lmagan butun son bo‘lishi kerak' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'Kelajak sanasiga hisobot topshirib bo‘lmaydi' using errcode = '22023';
  end if;
  if v_date < v_today and not v_profile.allow_backdated_reports then
    raise exception 'O‘tgan sana uchun hisobot topshirishga ruxsat yo‘q' using errcode = '42501';
  end if;
  if exists (select 1 from attendance_records where operator_id = auth.uid() and record_date = v_date) then
    raise exception 'Bu sana uchun davomat belgilangan' using errcode = '23505';
  end if;

  begin
    insert into daily_reports (operator_id, report_date, accepted_orders, original_orders)
    values (auth.uid(), v_date, p_count, p_count)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Bu sana uchun hisobot allaqachon topshirilgan' using errcode = '23505';
  end;

  insert into report_history (report_id, changed_by, action, new_value)
  values (v_row.id, auth.uid(), 'submitted', jsonb_build_object('accepted_orders', p_count));

  insert into notifications (user_id, kind, title, message, link)
  select id, 'report', 'Yangi hisobot', v_profile.full_name || ': ' || p_count || ' ta (' || v_date || ')', '/admin/hisobotlar'
  from profiles where role = 'admin' and is_active;

  return v_row;
end $$;

-- ───────────── Admin: hisobotni ko‘rib chiqish ─────────────
create or replace function review_report(p_id uuid, p_action text, p_note text default null)
returns daily_reports
language plpgsql security definer set search_path = public as $$
declare v_r daily_reports; v_next report_status; v_title text;
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  select * into v_r from daily_reports where id = p_id for update;
  if not found then raise exception 'Hisobot topilmadi' using errcode = 'P0002'; end if;
  if v_r.operator_id = auth.uid() then
    raise exception 'O‘z natijangizni tasdiqlay olmaysiz' using errcode = '42501';
  end if;
  if v_r.status <> 'pending' then
    raise exception 'Faqat kutilayotgan hisobotni ko‘rib chiqish mumkin' using errcode = '22023';
  end if;
  if p_action not in ('approve','reject','request_correction') then
    raise exception 'Noma’lum amal' using errcode = '22023';
  end if;
  if p_action <> 'approve' and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'Sabab ko‘rsatilishi shart' using errcode = '22023';
  end if;

  v_next := case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'correction_requested' end;
  update daily_reports set status = v_next, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id returning * into v_r;

  insert into report_history (report_id, changed_by, action, old_value, new_value, note)
  values (p_id, auth.uid(), p_action, jsonb_build_object('status', 'pending'), jsonb_build_object('status', v_next), p_note);
  perform write_audit('report_' || p_action, 'daily_reports', p_id::text, jsonb_build_object('status','pending'),
                      jsonb_build_object('status', v_next, 'accepted_orders', v_r.accepted_orders, 'note', p_note));

  v_title := case p_action when 'approve' then 'Hisobotingiz tasdiqlandi'
                           when 'reject' then 'Hisobotingiz rad etildi'
                           else 'Hisobotni tuzatish so‘ralmoqda' end;
  insert into notifications (user_id, kind, title, message, link)
  select v_r.operator_id, 'report', v_title,
         v_r.report_date || ' — ' || v_r.accepted_orders || ' ta' || coalesce('. Izoh: ' || p_note, ''), '/oylik'
  from profiles where id = v_r.operator_id and notify_reports;
  return v_r;
end $$;

-- ───────────── Admin: hisobotni tuzatish (asl qiymat saqlanadi) ─────────────
create or replace function correct_report(p_id uuid, p_count int, p_note text)
returns daily_reports
language plpgsql security definer set search_path = public as $$
declare v_r daily_reports; v_old int;
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  if p_count is null or p_count < 0 then raise exception 'Noto‘g‘ri son' using errcode = '22023'; end if;
  if p_note is null or length(trim(p_note)) = 0 then raise exception 'Sabab ko‘rsatilishi shart' using errcode = '22023'; end if;
  select * into v_r from daily_reports where id = p_id for update;
  if not found then raise exception 'Hisobot topilmadi' using errcode = 'P0002'; end if;
  if v_r.operator_id = auth.uid() then raise exception 'O‘z natijangizni o‘zgartira olmaysiz' using errcode = '42501'; end if;
  v_old := v_r.accepted_orders;
  update daily_reports set accepted_orders = p_count where id = p_id returning * into v_r;
  insert into report_history (report_id, changed_by, action, old_value, new_value, note)
  values (p_id, auth.uid(), 'corrected', jsonb_build_object('accepted_orders', v_old), jsonb_build_object('accepted_orders', p_count), p_note);
  perform write_audit('report_corrected', 'daily_reports', p_id::text,
                      jsonb_build_object('accepted_orders', v_old), jsonb_build_object('accepted_orders', p_count, 'note', p_note));
  insert into notifications (user_id, kind, title, message, link)
  values (v_r.operator_id, 'report', 'Hisobotingiz tuzatildi', v_r.report_date || ': ' || v_old || ' → ' || p_count || '. Izoh: ' || p_note, '/oylik');
  return v_r;
end $$;

-- Tuzatish so‘ralgan hisobotni operator qayta yuboradi (tarix saqlanadi).
create or replace function resubmit_report(p_id uuid, p_count int)
returns daily_reports
language plpgsql security definer set search_path = public as $$
declare v_r daily_reports; v_old int;
begin
  if p_count is null or p_count < 0 then raise exception 'Noto‘g‘ri son' using errcode = '22023'; end if;
  select * into v_r from daily_reports where id = p_id for update;
  if not found or v_r.operator_id <> auth.uid() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  if v_r.status <> 'correction_requested' then raise exception 'Bu hisobotni qayta yuborib bo‘lmaydi' using errcode = '22023'; end if;
  v_old := v_r.accepted_orders;
  update daily_reports set accepted_orders = p_count, status = 'pending', review_note = null, reviewed_by = null, reviewed_at = null
  where id = p_id returning * into v_r;
  insert into report_history (report_id, changed_by, action, old_value, new_value)
  values (p_id, auth.uid(), 'resubmitted', jsonb_build_object('accepted_orders', v_old), jsonb_build_object('accepted_orders', p_count));
  return v_r;
end $$;

-- ───────────── Admin: davomat belgilash ─────────────
create or replace function set_attendance(p_operator uuid, p_date date, p_kind attendance_kind, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  insert into attendance_records (operator_id, record_date, kind, note, created_by)
  values (p_operator, p_date, p_kind, p_note, auth.uid())
  on conflict (operator_id, record_date) do update set kind = excluded.kind, note = excluded.note, created_by = auth.uid();
end $$;

create or replace function clear_attendance(p_operator uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  delete from attendance_records where operator_id = p_operator and record_date = p_date;
end $$;

-- ───────────── Admin: oylikni yakunlash / tasdiqlash ─────────────
create or replace function finalize_payroll(p_period uuid, p_operator uuid, p_snapshot jsonb, p_payable bigint)
returns payroll_calculations language plpgsql security definer set search_path = public as $$
declare v_row payroll_calculations; v_pending int; v_p payroll_periods;
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  select * into v_p from payroll_periods where id = p_period;
  if not found then raise exception 'Davr topilmadi' using errcode = 'P0002'; end if;
  select count(*) into v_pending from daily_reports
   where operator_id = p_operator and report_date between v_p.start_date and v_p.end_date and status in ('pending','correction_requested');
  if v_pending > 0 then
    raise exception 'Kutilayotgan hisobotlar bor (%). Avval ularni ko‘rib chiqing', v_pending using errcode = '22023';
  end if;
  if exists (select 1 from payroll_calculations where period_id = p_period and operator_id = p_operator) then
    raise exception 'Bu oylik allaqachon yakunlangan' using errcode = '23505';
  end if;
  if p_payable < 0 then raise exception 'Noto‘g‘ri summa' using errcode = '22023'; end if;
  insert into payroll_calculations (period_id, operator_id, snapshot, payable_uzs, finalized_by)
  values (p_period, p_operator, p_snapshot, p_payable, auth.uid()) returning * into v_row;
  return v_row;
end $$;

create or replace function approve_payroll(p_calc uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  update payroll_calculations set approved = true where id = p_calc;
  insert into notifications (user_id, kind, title, message, link)
  select operator_id, 'system', 'Oylik tasdiqlandi', 'Oylik hisob-kitobingiz tasdiqlandi.', '/oylik' from payroll_calculations where id = p_calc;
end $$;

-- ───────────── Reyting (faqat tasdiqlangan hisobotlar; MAOSH KO‘RSATILMAYDI) ─────────────
create or replace function leaderboard(p_start date, p_end date)
returns table (operator_id uuid, full_name text, avatar_url text, total_orders bigint, worked_days bigint, green_days bigint)
language sql stable security definer set search_path = public as $$
  with s as (
    select daily_target from kpi_setting_versions
    where operator_id is null and effective_from <= p_end order by effective_from desc limit 1
  )
  select p.id, p.full_name, p.avatar_url,
         coalesce(sum(r.accepted_orders), 0)::bigint,
         count(r.id)::bigint,
         count(r.id) filter (where r.accepted_orders >= (select daily_target from s))::bigint
  from profiles p
  left join daily_reports r on r.operator_id = p.id and r.status = 'approved' and r.report_date between p_start and p_end
  where p.is_active and p.role = 'operator' and is_active_user()
  group by p.id
$$;

-- ───────────── E’lonni nashr qilish → bildirishnomalar ─────────────
create or replace function publish_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a announcements;
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  update announcements set status = 'published', published_at = coalesce(published_at, now())
   where id = p_id and status <> 'published' returning * into a;
  if not found then return; end if;
  insert into notifications (user_id, kind, title, message)
  select id, 'announcement', a.title, a.message from profiles where is_active and notify_announcements;
end $$;

-- ───────────── Demo ma’lumotlar ─────────────
create or replace function seed_demo_reports(p_operator uuid, p_days int default 20)
returns int language plpgsql security definer set search_path = public as $$
declare i int; n int := 0; v_date date; v_count int;
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  for i in 1..p_days loop
    v_date := tashkent_today() - i;
    v_count := 44 + ((i * 7 + 13) % 28);
    insert into daily_reports (operator_id, report_date, accepted_orders, original_orders, status, reviewed_by, reviewed_at, is_demo)
    values (p_operator, v_date, v_count, v_count, 'approved', auth.uid(), now(), true)
    on conflict (operator_id, report_date) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function purge_demo_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Ruxsat yo‘q' using errcode = '42501'; end if;
  delete from daily_reports where is_demo;
  delete from articles where is_demo;
  delete from objections where is_demo;
  delete from scripts where is_demo;
  delete from sets where is_demo;
  delete from products where is_demo;
  perform write_audit('purge_demo_data', 'system', null, null, null);
end $$;

-- RPC ruxsatlari: faqat tizimga kirgan foydalanuvchilar chaqira oladi (ichkarida rol tekshiriladi).
revoke execute on all functions in schema public from public, anon;
grant execute on function
  is_admin(), is_active_user(), tashkent_today(),
  submit_daily_report(int, date), resubmit_report(uuid, int), review_report(uuid, text, text), correct_report(uuid, int, text),
  set_attendance(uuid, date, attendance_kind, text), clear_attendance(uuid, date),
  finalize_payroll(uuid, uuid, jsonb, bigint), approve_payroll(uuid), leaderboard(date, date),
  publish_announcement(uuid), seed_demo_reports(uuid, int), purge_demo_data()
to authenticated;
