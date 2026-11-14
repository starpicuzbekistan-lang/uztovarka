\pset tuples_only on
reset role;
-- T8: operator edits own name; T11: operator cannot change report row
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
update profiles set full_name='Ali Valiyev' where id='00000000-0000-0000-0000-0000000000b1';
update daily_reports set accepted_orders=100, status='approved';
select 'T11 report value after op1 tried to edit: '||accepted_orders||' ('||status||')' from daily_reports;
reset role; reset request.jwt.claim.sub;
-- T15: deactivated operator cannot submit / read
update profiles set is_active=false where email='op1@x.uz';
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select 'T15 inactive reads reports: '||count(*) from daily_reports;
select submit_daily_report(1, current_date+0);
reset role; reset request.jwt.claim.sub;
update profiles set is_active=true where email='op1@x.uz';
-- T34/35 as admin on locked/unlocked
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
update payroll_periods set status='locked';
insert into payroll_payments(period_id,operator_id,kind,amount_uzs) values ((select id from payroll_periods limit 1),'00000000-0000-0000-0000-0000000000b1','advance',500000);
select 'T34 payments recorded on locked period: '||count(*) from payroll_payments;
update payroll_periods set status='open';
insert into salary_adjustments(operator_id,period_id,amount_uzs,reason) values ('00000000-0000-0000-0000-0000000000b1',(select id from payroll_periods limit 1),-1000,'sabab');
select 'T35 adjustments after unlock: '||count(*) from salary_adjustments;
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select 'T37 op2 sees others adjustments/payments: '||(select count(*) from salary_adjustments)||'/'||(select count(*) from payroll_payments);
select 'T39 op2 published articles visible: '||count(*) from articles;
select 'T40 op2 drafts visible: '||count(*) from articles where status<>'published';
