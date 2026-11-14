-- UZTOVARKA Operator Hub — 001: jadvallar
-- Pul: butun so‘m (bigint). Identifikatorlar: uuid. Vaqt: timestamptz (UTC), "bugun" Asia/Tashkent bo‘yicha.

create extension if not exists pgcrypto;

-- ───────────── Enumlar ─────────────
create type app_role as enum ('admin', 'operator');
create type publish_status as enum ('draft', 'published', 'archived');
create type availability as enum ('available', 'limited', 'unavailable');
create type report_status as enum ('pending', 'approved', 'rejected', 'correction_requested');
create type attendance_kind as enum ('absent', 'leave', 'day_off');
create type script_category as enum ('general', 'sets', 'objections', 'standards');
create type absence_rule as enum ('prorata', 'fixed', 'none');
create type leave_policy as enum ('neutral', 'same_as_absence');
create type payroll_status as enum ('calculating', 'pending_approval', 'approved', 'partially_paid', 'paid');
create type payment_kind as enum ('advance', 'partial', 'final');

-- ───────────── Foydalanuvchilar ─────────────
-- "Rollar" jadvali o‘rniga app_role enumi (rol faqat shu ikkita). Rolni faqat admin o‘zgartira oladi (trigger, 003).
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text not null default '',
  position      text not null default 'Operator',
  employee_id   text,
  phone         text,
  avatar_url    text,
  role          app_role not null default 'operator',
  is_active     boolean not null default true,
  notify_reports       boolean not null default true,
  notify_announcements boolean not null default true,
  allow_backdated_reports boolean not null default false, -- admin ruxsati bilan orqaga sanali topshirish
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index profiles_employee_id_key on profiles(employee_id) where employee_id is not null;

-- ───────────── Mahsulotlar ─────────────
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid references product_categories(id) on delete set null,
  description text,
  price_uzs bigint check (price_uzs is null or price_uzs >= 0),
  quantity_info text,
  colors text[] not null default '{}',
  material text,
  dimensions text,
  specs jsonb not null default '[]',        -- [{"label":"..","value":".."}]
  benefits text[] not null default '{}',
  intended_use text,
  usage_steps text[] not null default '{}',
  compatibility text,                        -- faqat admin tasdiqlagan ma’lumot; bo‘sh bo‘lsa UI "kiritilmagan" deydi
  warnings text,
  faqs jsonb not null default '[]',          -- [{"q":"..","a":".."}]
  concerns text[] not null default '{}',
  availability availability not null default 'available',
  status publish_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on products(status);
create index products_category_idx on products(category_id);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  path text not null,             -- storage "content" bucketidagi yo‘l
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on product_images(product_id, position);

-- ───────────── Naborlar ─────────────
create table sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- SET-01
  name text not null,
  description text,
  price_uzs bigint check (price_uzs is null or price_uzs >= 0),
  promo text,
  benefits text[] not null default '{}',
  usage_info text,
  delivery_info text,
  payment_info text,
  availability availability not null default 'available',
  faqs jsonb not null default '[]',
  status publish_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sets_status_idx on sets(status);

create table set_images (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  path text not null,
  position int not null default 0,   -- 0 = asosiy rasm
  created_at timestamptz not null default now()
);
create index set_images_set_idx on set_images(set_id, position);

-- Mahsulot bir nechta naborga kirishi mumkin: ma’lumot takrorlanmaydi, faqat havola.
create table set_items (
  set_id uuid not null references sets(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  is_bonus boolean not null default false,
  position int not null default 0,
  primary key (set_id, product_id)
);
create index set_items_product_idx on set_items(product_id);

-- ───────────── Skriptlar ─────────────
create table scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category script_category not null default 'general',
  description text,
  status publish_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table script_stages (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references scripts(id) on delete cascade,
  position int not null default 0,
  title text not null,
  objective text,
  body text not null default '',  -- {{nabor_nomi}}, {{narx}}, {{yetkazib_berish}}, {{tarkib}} o‘rinbosarlari
  notes text
);
create index script_stages_script_idx on script_stages(script_id, position);

create table script_sets (
  script_id uuid not null references scripts(id) on delete cascade,
  set_id uuid not null references sets(id) on delete cascade,
  primary key (script_id, set_id)
);
create index script_sets_set_idx on script_sets(set_id);

create table objections (
  id uuid primary key default gen_random_uuid(),
  objection text not null,
  response text not null,
  explanation text,
  category text,
  product_id uuid references products(id) on delete set null,
  set_id uuid references sets(id) on delete set null,
  status publish_status not null default 'published',
  position int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Maqolalar ─────────────
create table article_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  content text not null default '',     -- tozalangan HTML (DOMPurify)
  cover_path text,
  category_id uuid references article_categories(id) on delete set null,
  status publish_status not null default 'draft',
  pinned boolean not null default false,
  sort_order int not null default 0,
  read_minutes int,
  published_at timestamptz,
  author_id uuid references profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_feed_idx on articles(status, pinned desc, sort_order desc, published_at desc);

create table article_images (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table article_bookmarks (
  user_id uuid not null references profiles(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- ───────────── KPI ─────────────
-- Sozlamalar versiyalanadi: effective_from dan boshlab amal qiladi. operator_id null = hamma uchun.
create table kpi_setting_versions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references profiles(id) on delete cascade,
  effective_from date not null,
  monthly_target_uzs bigint not null check (monthly_target_uzs >= 0),
  working_days int not null check (working_days > 0),
  daily_target int not null check (daily_target >= 0),
  min_threshold int not null check (min_threshold >= 0),
  shortfall_coef_uzs bigint not null check (shortfall_coef_uzs >= 0),
  bonus_coef_uzs bigint not null check (bonus_coef_uzs >= 0),
  absence_rule absence_rule not null default 'prorata',
  absence_fixed_uzs bigint not null default 0 check (absence_fixed_uzs >= 0),
  leave_policy leave_policy not null default 'neutral',
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (min_threshold <= daily_target)
);
create unique index kpi_versions_unique on kpi_setting_versions(coalesce(operator_id, '00000000-0000-0000-0000-000000000000'::uuid), effective_from);

create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references profiles(id) on delete cascade,
  report_date date not null,
  accepted_orders int not null check (accepted_orders >= 0),
  original_orders int not null check (original_orders >= 0), -- operator kiritgan asl qiymat
  status report_status not null default 'pending',
  review_note text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  is_demo boolean not null default false,
  unique (operator_id, report_date)       -- bir sanaga bitta hisobot
);
create index daily_reports_date_idx on daily_reports(report_date, status);

create table report_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  changed_by uuid references profiles(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references profiles(id) on delete cascade,
  record_date date not null,
  kind attendance_kind not null,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (operator_id, record_date)
);

create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  working_days int not null check (working_days > 0),
  status text not null default 'open' check (status in ('open', 'locked')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (start_date, end_date),
  check (end_date >= start_date)
);

create table salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references profiles(id) on delete cascade,
  period_id uuid not null references payroll_periods(id) on delete cascade,
  amount_uzs bigint not null check (amount_uzs <> 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index salary_adjustments_idx on salary_adjustments(period_id, operator_id);

create table payroll_calculations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references payroll_periods(id) on delete cascade,
  operator_id uuid not null references profiles(id) on delete cascade,
  snapshot jsonb not null,                  -- sozlamalar nusxasi + hisob-kitob tafsiloti (o‘zgarmas)
  payable_uzs bigint not null check (payable_uzs >= 0),
  approved boolean not null default false,
  finalized_by uuid references profiles(id) on delete set null,
  finalized_at timestamptz not null default now(),
  unique (period_id, operator_id)
);

create table payroll_payments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references payroll_periods(id) on delete cascade,
  operator_id uuid not null references profiles(id) on delete cascade,
  kind payment_kind not null,
  amount_uzs bigint not null check (amount_uzs > 0),
  paid_on date not null default current_date,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payroll_payments_idx on payroll_payments(period_id, operator_id);

-- ───────────── E’lonlar, bildirishnomalar, audit ─────────────
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  status publish_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'announcement', -- announcement | report | system
  title text not null,
  message text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, is_read, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_idx on audit_logs(created_at desc);
