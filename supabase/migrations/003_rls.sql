-- UZTOVARKA Operator Hub — 003: Row Level Security
-- Tamoyil: hamma jadval yopiq (RLS yoqilgan). Operator faqat nashr etilgan kontentni va o‘z ma’lumotini o‘qiydi.
-- Admin — to‘liq boshqaruv. Maosh jadvallari (payroll_*, salary_adjustments) operatorga faqat O‘ZINIKI ko‘rinadi.

do $$ declare t text; begin
  foreach t in array array[
    'profiles','product_categories','products','product_images','sets','set_images','set_items',
    'scripts','script_stages','script_sets','objections','article_categories','articles','article_images',
    'article_bookmarks','kpi_setting_versions','daily_reports','report_history','attendance_records',
    'payroll_periods','salary_adjustments','payroll_calculations','payroll_payments',
    'announcements','notifications','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ───────────── profiles ─────────────
-- Operator faqat o‘z profilini o‘qiydi (boshqalarning ma’lumoti reyting RPC orqali, maoshsiz).
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());   -- rol/holat maydonlarini guard_profile_update trigger himoya qiladi
create policy profiles_admin_all on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- ───────────── Nashr etiladigan kontent: faol foydalanuvchi faqat 'published' ni o‘qiydi; admin hammasini boshqaradi ─────────────
do $$ declare t text; begin
  foreach t in array array['products','sets','scripts','articles'] loop
    execute format($f$create policy %1$s_read on %1$s for select to authenticated
                      using (is_admin() or (status = 'published' and is_active_user()))$f$, t);
    execute format($f$create policy %1$s_admin on %1$s for all to authenticated
                      using (is_admin()) with check (is_admin())$f$, t);
  end loop;
  -- Faqat o‘qish uchun ochiq (faol foydalanuvchiga) yordamchi jadvallar
  foreach t in array array['product_categories','article_categories','product_images','set_images','set_items','script_stages','script_sets','article_images'] loop
    execute format($f$create policy %1$s_read on %1$s for select to authenticated using (is_active_user())$f$, t);
    execute format($f$create policy %1$s_admin on %1$s for all to authenticated
                      using (is_admin()) with check (is_admin())$f$, t);
  end loop;
end $$;

create policy objections_read on objections for select to authenticated
  using (is_admin() or (status = 'published' and is_active_user()));
create policy objections_admin on objections for all to authenticated
  using (is_admin()) with check (is_admin());

-- Qoralama (draft) kontentga tegishli bolalar yozuvlari operatorga ko‘rinmasin:
drop policy product_images_read on product_images;
create policy product_images_read on product_images for select to authenticated
  using (is_admin() or exists (select 1 from products p where p.id = product_id and p.status = 'published' and is_active_user()));
drop policy set_images_read on set_images;
create policy set_images_read on set_images for select to authenticated
  using (is_admin() or exists (select 1 from sets s where s.id = set_id and s.status = 'published' and is_active_user()));
drop policy set_items_read on set_items;
create policy set_items_read on set_items for select to authenticated
  using (is_admin() or exists (select 1 from sets s where s.id = set_id and s.status = 'published' and is_active_user()));
drop policy script_stages_read on script_stages;
create policy script_stages_read on script_stages for select to authenticated
  using (is_admin() or exists (select 1 from scripts s where s.id = script_id and s.status = 'published' and is_active_user()));
drop policy script_sets_read on script_sets;
create policy script_sets_read on script_sets for select to authenticated
  using (is_admin() or exists (select 1 from scripts s where s.id = script_id and s.status = 'published' and is_active_user()));
drop policy article_images_read on article_images;
create policy article_images_read on article_images for select to authenticated
  using (is_admin() or exists (select 1 from articles a where a.id = article_id and a.status = 'published' and is_active_user()));

-- Sevimlilar: faqat o‘zining
create policy bookmarks_own on article_bookmarks for all to authenticated
  using (user_id = auth.uid() and is_active_user()) with check (user_id = auth.uid() and is_active_user());

-- ───────────── KPI sozlamalari ─────────────
-- Operator o‘ziga amal qiladigan (umumiy yoki shaxsiy) sozlamalarni o‘qiy oladi — kalendar/prognoz hisoblash uchun.
create policy kpi_versions_read on kpi_setting_versions for select to authenticated
  using (is_admin() or (is_active_user() and (operator_id is null or operator_id = auth.uid())));
create policy kpi_versions_admin on kpi_setting_versions for all to authenticated
  using (is_admin()) with check (is_admin());

-- ───────────── Kunlik hisobotlar ─────────────
-- Operatorga INSERT/UPDATE yo‘q: hisobot faqat submit_daily_report() / resubmit_report() RPC orqali.
create policy reports_read_own on daily_reports for select to authenticated
  using (operator_id = auth.uid() and is_active_user());
create policy reports_admin on daily_reports for all to authenticated
  using (is_admin()) with check (is_admin());

create policy report_history_read on report_history for select to authenticated
  using (is_admin() or exists (select 1 from daily_reports r where r.id = report_id and r.operator_id = auth.uid()));

create policy attendance_read_own on attendance_records for select to authenticated
  using (operator_id = auth.uid() and is_active_user());
create policy attendance_admin on attendance_records for all to authenticated
  using (is_admin()) with check (is_admin());

-- ───────────── Maosh ma’lumotlari: faqat o‘ziniki ─────────────
create policy periods_read on payroll_periods for select to authenticated using (is_active_user());
create policy periods_admin on payroll_periods for all to authenticated using (is_admin()) with check (is_admin());

create policy adjustments_read_own on salary_adjustments for select to authenticated
  using (operator_id = auth.uid() and is_active_user());
create policy adjustments_admin on salary_adjustments for all to authenticated using (is_admin()) with check (is_admin());

create policy calc_read_own on payroll_calculations for select to authenticated
  using (operator_id = auth.uid() and approved and is_active_user());   -- yakuniy summa tasdiqlangandan keyin ko‘rinadi
create policy calc_admin on payroll_calculations for all to authenticated using (is_admin()) with check (is_admin());

create policy payments_read_own on payroll_payments for select to authenticated
  using (operator_id = auth.uid() and is_active_user());
create policy payments_admin on payroll_payments for all to authenticated using (is_admin()) with check (is_admin());

-- ───────────── E’lonlar, bildirishnomalar, audit ─────────────
create policy announcements_read on announcements for select to authenticated
  using (is_admin() or (status = 'published' and is_active_user()));
create policy announcements_admin on announcements for all to authenticated using (is_admin()) with check (is_admin());

create policy notifications_own_read on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on notifications for delete to authenticated using (user_id = auth.uid());
create policy notifications_admin on notifications for all to authenticated using (is_admin()) with check (is_admin());

create policy audit_admin_read on audit_logs for select to authenticated using (is_admin());
-- audit_logs ga INSERT/UPDATE/DELETE siyosati yo‘q: faqat SECURITY DEFINER funksiyalar yozadi.

-- Operatorning notifications jadvalida faqat is_read ni o‘zgartirishi mumkin:
create or replace function guard_notification_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.user_id <> old.user_id or new.title <> old.title or new.message <> old.message or new.kind <> old.kind then
      raise exception 'Faqat o‘qilgan holatini o‘zgartirish mumkin' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_notification_update before update on notifications
  for each row execute function guard_notification_update();

-- Jadval darajasidagi huquqlar: anon hech narsa ko‘ra olmaydi.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on audit_logs from authenticated;
