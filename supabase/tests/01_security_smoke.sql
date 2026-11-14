\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','admin@x.uz'),('00000000-0000-0000-0000-0000000000b1','op1@x.uz'),('00000000-0000-0000-0000-0000000000b2','op2@x.uz');
update profiles set role='admin' where email='admin@x.uz';
select 'profiles created: '||count(*) from profiles;
insert into kpi_setting_versions(effective_from,monthly_target_uzs,working_days,daily_target,min_threshold,shortfall_coef_uzs,bonus_coef_uzs) values ('2020-01-01',2000000,30,60,50,1000,2000);

-- OPERATOR 1
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select 'T1 submit ok: '||(submit_daily_report(62)).status;
select 'T2 duplicate -> ' || (select 'BLOCKED' where true);
select submit_daily_report(10);
select 'T3 negative -> ';
select submit_daily_report(-5);
select 'T4 future date -> ';
select submit_daily_report(5, current_date + 3);
select 'T5 backdated without permission -> ';
select submit_daily_report(5, current_date - 2);
select 'T6 self-promote -> ';
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000b1';
select 'T7 own email/position change -> ';
update profiles set position='Boss' where id='00000000-0000-0000-0000-0000000000b1';
select 'T8 can edit own name: '||(select count(*) from (with u as (update profiles set full_name='Ali' where id='00000000-0000-0000-0000-0000000000b1' returning 1) select * from u) x);
select 'T9 self approve -> ';
select review_report((select id from daily_reports limit 1),'approve');
select 'T10 direct insert report -> ';
insert into daily_reports(operator_id,report_date,accepted_orders,original_orders) values ('00000000-0000-0000-0000-0000000000b1',current_date-5,99,99);
select 'T11 direct update of report -> '||(select count(*) from (with u as (update daily_reports set accepted_orders=100,status='approved' returning 1) select * from u) x)||' rows changed';
select 'T12 sees profiles: '||count(*) from profiles;
select 'T13 audit_logs visible: '||count(*) from audit_logs;
select 'T14 kpi write -> ';
insert into kpi_setting_versions(effective_from,monthly_target_uzs,working_days,daily_target,min_threshold,shortfall_coef_uzs,bonus_coef_uzs) values ('2030-01-01',1,1,1,1,1,1);
reset role;
select 'T15 deactivate op1 then submit -> ';
update profiles set is_active=false where email='op1@x.uz';
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select submit_daily_report(1);
select 'T15b inactive reads reports: '||count(*) from daily_reports;
reset role; update profiles set is_active=true where email='op1@x.uz';

-- OPERATOR 2 sees nothing of op1
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select 'T16 op2 sees op1 reports: '||count(*) from daily_reports;
select 'T17 op2 sees other profile rows: '||count(*) from profiles where id<>'00000000-0000-0000-0000-0000000000b2';
select 'T18 leaderboard columns: '||string_agg(column_name,',') from information_schema.columns where table_name='leaderboard' limit 1;
select 'T18b leaderboard rows (pending only => 0 orders): '||count(*) from leaderboard(current_date-30,current_date);
reset role;

-- ADMIN
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
select 'T19 admin approve: '||(review_report((select id from daily_reports limit 1),'approve')).status;
select 'T20 re-review -> ';
select review_report((select id from daily_reports limit 1),'approve');
select 'T21 reject without note -> ';
select review_report((select id from daily_reports limit 1),'reject');
select 'T22 correct: '||(correct_report((select id from daily_reports limit 1),65,'Tuzatish')).accepted_orders;
select 'T23 history rows: '||count(*) from report_history;
select 'T24 audit rows: '||count(*) from audit_logs;
select 'T25 admin sees all profiles: '||count(*) from profiles;
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select 'T26 leaderboard top (approved 65): '||full_name||'='||total_orders from leaderboard(current_date-30,current_date) order by total_orders desc limit 1;
select 'T27 op2 calls review_report -> ';
select review_report((select id from daily_reports limit 1),'approve');
select 'T28 op2 finalize_payroll -> ';
select finalize_payroll(gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1','{}',1);
reset role;

-- PAYROLL + LOCK
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
insert into payroll_periods(start_date,end_date,working_days) values (date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,30);
select 'T29 finalize: '||(finalize_payroll((select id from payroll_periods limit 1),'00000000-0000-0000-0000-0000000000b1','{"x":1}',2100000)).payable_uzs;
select 'T30 finalize twice -> ';
select finalize_payroll((select id from payroll_periods limit 1),'00000000-0000-0000-0000-0000000000b1','{}',1);
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select 'T31 op1 sees unapproved calc: '||count(*) from payroll_calculations;
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
select approve_payroll((select id from payroll_calculations limit 1));
update payroll_periods set status='locked';
select 'T32 adjustment on locked period -> ';
insert into salary_adjustments(operator_id,period_id,amount_uzs,reason) values ('00000000-0000-0000-0000-0000000000b1',(select id from payroll_periods limit 1),-1000,'x');
select 'T33 change working_days on locked -> ';
update payroll_periods set working_days=28;
select 'T34 payment on locked period still ok: '||(select count(*) from (with i as (insert into payroll_payments(period_id,operator_id,kind,amount_uzs) values ((select id from payroll_periods limit 1),'00000000-0000-0000-0000-0000000000b1','advance',500000) returning 1) select * from i) x);
update payroll_periods set status='open';
select 'T35 adjustment after unlock: '||(select count(*) from (with i as (insert into salary_adjustments(operator_id,period_id,amount_uzs,reason) values ('00000000-0000-0000-0000-0000000000b1',(select id from payroll_periods limit 1),-1000,'x') returning 1) select * from i) x);
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select 'T36 op1 sees approved calc: '||count(*) from payroll_calculations;
select 'T37 op1 sees own adjustments: '||count(*) from salary_adjustments;
reset role; set role anon;
select 'T38 anon reads articles -> ';
select count(*) from articles;
