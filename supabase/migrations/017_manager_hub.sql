-- 017: Manager Hub + administrator-defined visual KPI day colors + tasks.
-- Run AFTER 016_manager_role.sql has committed. No payroll/balance formula changes.
begin;

create table public.manager_team_assignments (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  team_code text not null check(team_code in ('alpha','beta')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(manager_id,team_code)
);

-- This SECURITY DEFINER helper checks the actual manager role and historical team assignment.
-- It bypasses RLS recursion, but NEVER grants data outside a manager's assigned teams.
create or replace function public.manager_has_operator(p_operator uuid, p_day date default public.tashkent_today())
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.profiles m
    join public.manager_team_assignments mt on mt.manager_id=m.id
    join lateral (
      select a.team_code
      from public.operator_team_assignments a
      where a.operator_id=p_operator
        and a.effective_month<=date_trunc('month',p_day)::date
      order by a.effective_month desc limit 1
    ) team on team.team_code=mt.team_code
    where m.id=auth.uid() and m.role='manager' and m.is_active
      and exists (select 1 from public.profiles o
                  where o.id=p_operator and o.role='operator')
  );
$$;
revoke all on function public.manager_has_operator(uuid,date) from public,anon;
grant execute on function public.manager_has_operator(uuid,date) to authenticated;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and role='manager' and is_active);
$$;
revoke all on function public.is_manager() from public,anon;
grant execute on function public.is_manager() to authenticated;

alter table public.manager_team_assignments enable row level security;
create policy manager_teams_admin on public.manager_team_assignments
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy manager_teams_own on public.manager_team_assignments
  for select to authenticated using(manager_id=auth.uid() and public.is_manager());

-- Manager can see only profiles, reports and attendance for their own teams.
-- No payroll, wallet, salary adjustments, or unrestricted system permissions.
create policy profiles_manager_team_read on public.profiles for select to authenticated
  using(public.manager_has_operator(id, public.tashkent_today()));
create policy reports_manager_team_read on public.daily_reports for select to authenticated
  using(public.manager_has_operator(operator_id,report_date));
create policy attendance_manager_team_read on public.attendance_records for select to authenticated
  using(public.manager_has_operator(operator_id,record_date));

-- Show manager only the team assignment history of the operators they supervise.
create policy operator_assignments_manager_read on public.operator_team_assignments
  for select to authenticated
  using(public.manager_has_operator(operator_id,effective_month));

-- Manually adjusted colors are a separate VISUAL classification, never a salary override.
-- The operator's actual approved counts and payroll calculations are untouched.
create table public.operator_day_colors (
  operator_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null,
  color text not null check(color in ('green','yellow','red')),
  reason text not null check(length(btrim(reason))>=3),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(operator_id,report_date)
);
create index operator_day_colors_date_idx on public.operator_day_colors(report_date);
alter table public.operator_day_colors enable row level security;
create policy day_colors_admin on public.operator_day_colors
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy day_colors_operator_read on public.operator_day_colors
  for select to authenticated using(operator_id=auth.uid() and public.is_active_user());
create policy day_colors_manager_read on public.operator_day_colors
  for select to authenticated using(public.manager_has_operator(operator_id,report_date));

create or replace function public.validate_operator_day_color()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then
    raise exception 'Faqat administrator KPI rangini belgilaydi' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.daily_reports r
     where r.operator_id=new.operator_id and r.report_date=new.report_date
       and r.status='approved' and r.is_demo=false
  ) then
    raise exception 'Faqat tasdiqlangan haqiqiy hisobot uchun rang belgilang' using errcode='22023';
  end if;
  new.updated_by:=auth.uid();
  new.updated_at:=now();
  return new;
end $$;
create trigger validate_operator_day_color
  before insert or update on public.operator_day_colors
  for each row execute function public.validate_operator_day_color();

-- Report counts, configured daily target, and optional admin color; exposed only to assigned manager.
create or replace function public.get_manager_team_reports(p_start date, p_end date)
returns table(
  operator_id uuid, report_date date, accepted_orders integer,
  report_status text, day_color text, manual_color boolean
) language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_manager() then raise exception 'Ruxsat yo‘q' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_end < p_start or p_end > p_start+interval '370 days' then
    raise exception 'Sana oralig‘i noto‘g‘ri' using errcode='22023';
  end if;
  return query
  select r.operator_id, r.report_date, r.accepted_orders, r.status::text,
    case when r.status='approved' then
      coalesce(oc.color,
        case when r.accepted_orders>=coalesce(ks.daily_target,50) then 'green'
             when r.accepted_orders>=coalesce(ks.min_threshold,40) then 'yellow'
             else 'red' end)
    else null::text end as day_color,
    (r.status='approved' and oc.color is not null) as manual_color
  from public.daily_reports r
  left join public.operator_day_colors oc
    on oc.operator_id=r.operator_id and oc.report_date=r.report_date
  left join lateral (
    select v.daily_target,v.min_threshold
    from public.kpi_setting_versions v
    where v.effective_from<=r.report_date
      and (v.operator_id=r.operator_id or v.operator_id is null)
    order by (v.operator_id is not null) desc,v.effective_from desc limit 1
  ) ks on true
  where r.report_date between p_start and p_end and r.is_demo=false
    and public.manager_has_operator(r.operator_id,r.report_date)
  order by r.report_date desc,r.operator_id;
end $$;
revoke all on function public.get_manager_team_reports(date,date) from public,anon;
grant execute on function public.get_manager_team_reports(date,date) to authenticated;

create table public.manager_tasks (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  operator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(btrim(title)) between 3 and 160),
  description text not null default '',
  category text not null default 'general'
    check(category in ('general','training','performance','meeting')),
  priority text not null default 'normal'
    check(priority in ('low','normal','high')),
  due_date date not null,
  status text not null default 'todo'
    check(status in ('todo','in_progress','submitted','completed')),
  feedback text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index manager_tasks_manager_idx on public.manager_tasks(manager_id,due_date);
create index manager_tasks_operator_idx on public.manager_tasks(operator_id,status,due_date);
alter table public.manager_tasks enable row level security;
create policy manager_tasks_admin_read on public.manager_tasks
  for select to authenticated using(public.is_admin());
create policy manager_tasks_manager_read on public.manager_tasks
  for select to authenticated using(manager_id=auth.uid() and public.is_manager()
    and public.manager_has_operator(operator_id,due_date));
create policy manager_tasks_operator_read on public.manager_tasks
  for select to authenticated using(operator_id=auth.uid() and public.is_active_user());

-- All task writes use narrow RPCs, not generic browser UPDATE privileges.
create or replace function public.manager_create_task(
  p_operator uuid,p_title text,p_description text,p_category text,p_priority text,p_due date
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.manager_has_operator(p_operator,public.tashkent_today())
   then raise exception 'Operator jamoangizga tegishli emas' using errcode='42501'; end if;
 if p_title is null or length(btrim(p_title)) not between 3 and 160
   or p_due is null or p_due < public.tashkent_today()
   or p_category not in ('general','training','performance','meeting')
   or p_priority not in ('low','normal','high') then
   raise exception 'Vazifa ma’lumotlarini tekshiring' using errcode='22023';
 end if;
 insert into public.manager_tasks(manager_id,operator_id,title,description,category,priority,due_date)
 values(auth.uid(),p_operator,btrim(p_title),left(coalesce(p_description,''),4000),p_category,p_priority,p_due)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.operator_submit_task(p_task uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.manager_tasks set status='submitted',submitted_at=now()
 where id=p_task and operator_id=auth.uid() and status in ('todo','in_progress')
   and public.is_active_user();
 if not found then raise exception 'Vazifa topilmadi yoki allaqachon topshirilgan' using errcode='42501'; end if;
end $$;

create or replace function public.manager_review_task(p_task uuid,p_approve boolean,p_feedback text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_task public.manager_tasks;
begin
 select * into v_task from public.manager_tasks where id=p_task for update;
 if not found or v_task.manager_id<>auth.uid()
   or not public.manager_has_operator(v_task.operator_id,public.tashkent_today())
   then raise exception 'Ruxsat yo‘q' using errcode='42501'; end if;
 if v_task.status<>'submitted' then raise exception 'Faqat topshirilgan vazifani tekshiring' using errcode='22023'; end if;
 if not p_approve and length(btrim(coalesce(p_feedback,'')))<3 then
   raise exception 'Qaytarish sababini kiriting' using errcode='22023';
 end if;
 update public.manager_tasks set status=case when p_approve then 'completed' else 'in_progress' end,
   feedback=nullif(btrim(coalesce(p_feedback,'')),''),
   completed_at=case when p_approve then now() else null end
 where id=p_task;
end $$;
revoke all on function public.manager_create_task(uuid,text,text,text,text,date),
 public.operator_submit_task(uuid),public.manager_review_task(uuid,boolean,text) from public,anon;
grant execute on function public.manager_create_task(uuid,text,text,text,text,date),
 public.operator_submit_task(uuid),public.manager_review_task(uuid,boolean,text) to authenticated;

-- Record who set a visual classification. Do not overwrite previous audit events.
create or replace function public.audit_manager_day_color()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.audit_logs(actor_id,action,entity,entity_id,before_data,after_data)
 values(auth.uid(),case when tg_op='DELETE' then 'day_color_reset' else 'day_color_set' end,
   'operator_day_colors',coalesce(new.operator_id,old.operator_id)::text||':'||coalesce(new.report_date,old.report_date)::text,
   case when tg_op<>'INSERT' then to_jsonb(old) else null end,
   case when tg_op<>'DELETE' then to_jsonb(new) else null end);
 return coalesce(new,old);
end $$;
create trigger audit_manager_day_color after insert or update or delete on public.operator_day_colors
  for each row execute function public.audit_manager_day_color();

revoke all on public.manager_team_assignments,public.manager_tasks,public.operator_day_colors from anon;
grant select,insert,update,delete on public.manager_team_assignments,public.operator_day_colors to authenticated;
grant select on public.manager_tasks to authenticated;
commit;
