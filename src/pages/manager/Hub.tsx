import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, Crown, Flag, ListChecks, Megaphone, Plus, Search, ShieldCheck, TrendingUp, UserRound, Users } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { formatDateUz, periodForMonth, tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Select, Textarea, useToast } from '@/components/ui';

type Operator = {id:string;full_name:string;avatar_url:string|null;position:string;employee_id:string|null;is_active:boolean};
type Daily = {operator_id:string;report_date:string;accepted_orders:number;report_status:string;day_color:'green'|'yellow'|'red'|null;manual_color:boolean};
type Task = {id:string;manager_id:string;operator_id:string;title:string;description:string;category:string;priority:string;due_date:string;status:string;feedback:string|null;created_at:string};
type Team = {manager_id:string;team_code:string};
type Goal = {team_code:string;month_start:string;target_orders:number};
type Attendance = {operator_id:string;record_date:string;kind:string};
const STATUS: Record<'green'|'yellow'|'red',string>={green:'Yashil',yellow:'Sariq',red:'Qizil'};
const COLOR: Record<'green'|'yellow'|'red',string>={green:'bg-emerald-500',yellow:'bg-amber-400',red:'bg-rose-500'};
const TONE: Record<'green'|'yellow'|'red','green'|'yellow'|'red'>={green:'green',yellow:'yellow',red:'red'};
const fmt=(n:number)=>Math.round(n).toLocaleString('en-US').replaceAll(',',' ');
const monthNow=()=>tashkentToday().slice(0,7);

function useManager(month:string){
  const [year,mo]=month.split('-').map(Number);
  const start=month+'-01',end=periodForMonth(year,mo).end;
  const operators=useQuery({queryKey:['manager-operators'],queryFn:async()=>await unwrap(supabase.from('profiles').select('id,full_name,avatar_url,position,employee_id,is_active').eq('role','operator').eq('is_active',true).order('full_name')) as Operator[]});
  const reports=useQuery({queryKey:['manager-reports',month],queryFn:async()=>await unwrap(supabase.rpc('get_manager_team_reports',{p_start:start,p_end:end})) as Daily[]});
  const attendance=useQuery({queryKey:['manager-attendance',month],queryFn:async()=>await unwrap(supabase.from('attendance_records').select('operator_id,record_date,kind').gte('record_date',start).lte('record_date',end)) as Attendance[]});
  const teams=useQuery({queryKey:['manager-teams'],queryFn:async()=>await unwrap(supabase.from('manager_team_assignments').select('manager_id,team_code')) as Team[]});
  const goals=useQuery({queryKey:['manager-goals',month],queryFn:async()=>await unwrap(supabase.from('team_monthly_goals').select('team_code,month_start,target_orders').eq('month_start',start)) as Goal[]});
  const gold=useQuery({queryKey:['manager-gold'],queryFn:async()=>await unwrap(supabase.rpc('get_gold_verified_operators')) as {operator_id:string}[]});
  return {operators,reports,attendance,teams,goals,gold,start,end};
}
function useTasks(){
  return useQuery({queryKey:['manager-tasks'],queryFn:async()=>await unwrap(supabase.from('manager_tasks').select('*').order('due_date',{ascending:true}).limit(500)) as Task[]});
}
const card='rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm';
const tagColor=(c:Daily['day_color'])=>c==='green'?'bg-emerald-50 text-emerald-800':c==='yellow'?'bg-amber-50 text-amber-800':'bg-rose-50 text-rose-800';
function Heading({title,description,action}:{title:string;description:string;action?:React.ReactNode}){
 return <div className="mb-5 flex items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold tracking-tight text-[#15191F]">{title}</h1><p className="mt-1 text-sm text-neutral-500">{description}</p></div>{action}</div>;
}
function ErrorOrLoading({loading,error,onRetry}:{loading:boolean;error:unknown;onRetry:()=>void}){
 return loading?<LoadingBlock rows={3}/>:error?<ErrorState message={humanError(error)} onRetry={onRetry}/>:null;
}
function Stat({label,value,hint}:{label:string;value:string|number;hint?:string}){
 return <div className={card}><p className="text-xs font-medium text-neutral-500">{label}</p><p className="mt-1 text-[28px] font-extrabold tracking-tight tabular-nums">{value}</p>{hint&&<p className="mt-1 text-[11px] text-neutral-500">{hint}</p>}</div>;
}
function ColorBar({rows}:{rows:Daily[]}){
 const approved=rows.filter(r=>r.report_status==='approved'&&r.day_color);
 const count=(c:Daily['day_color'])=>approved.filter(r=>r.day_color===c).length;
 const total=Math.max(1,approved.length);
 return <div className={card}>
   <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">KPI kunlari</h2><span className="text-xs text-neutral-500">{approved.length} ta tasdiqlangan kun</span></div>
   <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
     {(['green','yellow','red'] as const).map(c=><div key={c} className={COLOR[c]} style={{width:count(c)/total*100+'%'}}/>)}
   </div>
   <div className="mt-3 flex flex-wrap gap-3 text-xs">
     {(['green','yellow','red'] as const).map(c=><span key={c} className="inline-flex items-center gap-1.5"><span className={'h-2.5 w-2.5 rounded-full '+COLOR[c]}/>{STATUS[c]}: <b>{count(c)}</b></span>)}
   </div>
 </div>;
}
export function ManagerHome(){
 const [month]=useState(monthNow());
 const d=useManager(month),tasks=useTasks();
 const today=tashkentToday();
 const ops=d.operators.data??[],reports=d.reports.data??[];
 const todayReports=reports.filter(r=>r.report_date===today&&r.report_status==='approved');
 const total=todayReports.reduce((a,b)=>a+b.accepted_orders,0);
 const green=todayReports.filter(r=>r.day_color==='green').length;
 const alerts=ops.length-green;
 const announced=useQuery({queryKey:['manager-announcements'],queryFn:async()=>await unwrap(supabase.from('announcements').select('id,title,body,created_at').eq('status','published').order('created_at',{ascending:false}).limit(1)) as {id:string;title:string;body:string|null;created_at:string}[]});
 const late=(tasks.data??[]).filter(t=>t.status!=='completed'&&t.due_date<today);
 return <div className="space-y-4">
   <Heading title="Bosh sahifa" description="Jamoangizning bugungi natijalari va muhim vazifalar"/>
   <ErrorOrLoading loading={d.reports.isLoading||d.operators.isLoading} error={d.reports.error??d.operators.error} onRetry={()=>{void d.reports.refetch();void d.operators.refetch();}}/>
   <div className="overflow-hidden rounded-3xl bg-[#20242D] p-5 text-white">
     <p className="text-sm text-neutral-300">Bugungi jamoa natijasi</p>
     <p className="mt-2 text-4xl font-extrabold tabular-nums">{fmt(total)} <span className="text-2xl">ta qabul</span></p>
     <div className="mt-5 flex items-center gap-2 text-sm text-neutral-300"><TrendingUp className="text-[#F5C542]" size={18}/> Faqat admin tasdiqlagan hisobotlar</div>
   </div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
     <Stat label="Operatorlar" value={ops.length}/>
     <Stat label="Yashil kun" value={green} hint="Bugun tasdiqlangan"/>
     <Stat label="Qabul natijasi yo‘q" value={alerts} hint="Hali tasdiqlanmagan yoki norma bajarilmagan"/>
     <Stat label="Kutilayotgan hisobot" value={reports.filter(r=>r.report_date===today&&r.report_status==='pending').length}/>
   </div>
   <ColorBar rows={todayReports}/>
   <section className={card}>
     <div className="flex items-center gap-2"><Megaphone size={18} className="text-amber-600"/><h2 className="font-bold">Admin e’loni</h2></div>
     {announced.data?.length?<div className="mt-2"><p className="font-semibold">{announced.data[0].title}</p><p className="mt-1 line-clamp-3 text-sm text-neutral-500">{announced.data[0].body}</p></div>:<p className="mt-2 text-sm text-neutral-500">Hozircha e’lonlar yo‘q.</p>}
   </section>
   <section className={card}>
     <h2 className="flex items-center gap-2 font-bold"><AlertTriangle size={18} className="text-amber-500"/> Muhim ogohlantirishlar</h2>
     <div className="mt-3 space-y-2 text-sm">
       <Link to="/manager/jamoa" className="flex min-h-11 items-center justify-between rounded-xl bg-rose-50 px-3">KPI natijasi yetarli bo‘lmaganlar <b>{alerts} nafar</b></Link>
       <Link to="/manager/vazifalar" className="flex min-h-11 items-center justify-between rounded-xl bg-amber-50 px-3">Muddati o‘tgan vazifalar <b>{late.length} ta</b></Link>
     </div>
   </section>
   <Link to="/manager/vazifalar" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-ink"><ListChecks size={18}/> Jamoaga vazifa berish <ArrowRight size={16}/></Link>
 </div>;
}
export function ManagerTeam(){
 const [month,setMonth]=useState(monthNow());
 const d=useManager(month),[params,setParams]=useSearchParams(),[search,setSearch]=useState('');
 const operators=(d.operators.data??[]).filter(o=>o.full_name.toLowerCase().includes(search.toLowerCase()));
 const reports=d.reports.data??[];
 const selected=operators.find(o=>o.id===params.get('operator'));
 const gold=new Set((d.gold.data??[]).map(x=>x.operator_id));
 const score=(id:string)=>reports.filter(r=>r.operator_id===id&&r.report_status==='approved').reduce((a,b)=>a+b.accepted_orders,0);
 const days=(id:string)=>reports.filter(r=>r.operator_id===id&&r.report_status==='approved');
 return <div className="space-y-4">
   <Heading title="Jamoa" description="Operatorlar, davomati va shaxsiy rivojlanishi"
     action={<input type="month" aria-label="Oy" value={month} onChange={e=>setMonth(e.target.value)} className="w-34 rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs"/>}/>
   <ErrorOrLoading loading={d.operators.isLoading||d.reports.isLoading} error={d.operators.error??d.reports.error} onRetry={()=>{void d.operators.refetch();void d.reports.refetch();}}/>
   {selected&&<div className={card+' space-y-3'}>
     <button onClick={()=>setParams({})} className="text-xs font-bold text-neutral-500">← Jamoaga qaytish</button>
     <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-xl font-extrabold">{selected.full_name.slice(0,1)}</div>
       <div><h2 className="font-bold">{selected.full_name} {gold.has(selected.id)&&<Crown className="inline text-amber-500" size={16}/>}</h2><p className="text-xs text-neutral-500">{selected.position||'Operator'} · {selected.employee_id||'ID kiritilmagan'}</p></div>
     </div>
     <div className="grid grid-cols-3 gap-2"><Stat label="Qabul" value={fmt(score(selected.id))}/><Stat label="Ish kunlari" value={days(selected.id).length}/><Stat label="O‘rtacha" value={fmt(score(selected.id)/Math.max(1,days(selected.id).length))}/></div>
     <ColorBar rows={days(selected.id)}/>
     <h3 className="font-bold">Kunlik natijalar</h3>
     {days(selected.id).slice(0,14).map(r=><div key={r.report_date} className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm"><span>{formatDateUz(r.report_date)}</span><span className="flex items-center gap-2">{r.accepted_orders} ta <Badge tone={TONE[r.day_color??'red']}>{STATUS[r.day_color??'red']}</Badge></span></div>)}
     <Link to={'/manager/vazifalar?operator='+selected.id} className="block rounded-xl bg-brand px-4 py-3 text-center text-sm font-bold">Vazifa berish</Link>
   </div>}
   <section className={card}>
     <div className="flex items-center justify-between"><h2 className="font-bold">Mening jamoam</h2><span className="text-xs text-neutral-500">{operators.length} operator</span></div>
     <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 px-3"><Search size={17} className="text-neutral-400"/><input className="h-11 w-full outline-none text-sm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Operatorni qidirish..."/></div>
     <div className="mt-2 divide-y divide-neutral-100">
       {operators.map((o,i)=>{const r=days(o.id),last=r[0],value=score(o.id);return <button key={o.id} onClick={()=>setParams({operator:o.id})} className="flex min-h-16 w-full items-center gap-3 py-2 text-left hover:bg-neutral-50">
         <span className="w-5 text-center text-xs font-bold text-neutral-400">{i+1}</span>
         <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">{o.full_name.slice(0,1)}</span>
         <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{o.full_name} {gold.has(o.id)&&'✓'}</span><span className="block text-xs text-neutral-500">{r.length} ishlangan kun · {fmt(value)} ta qabul</span></span>
         {last&&last.day_color&&<span className={'rounded-lg px-2 py-1 text-[11px] font-semibold '+tagColor(last.day_color)}>{STATUS[last.day_color]}</span>}
         <ArrowRight size={16} className="text-neutral-400"/>
       </button>})}
       {!operators.length&&<EmptyState title="Jamoa bo‘sh" hint="Admin sizga jamoa biriktirishi kerak."/>}
     </div>
   </section>
 </div>;
}
export function ManagerKpi(){
 const [month,setMonth]=useState(monthNow());
 const d=useManager(month),reports=(d.reports.data??[]).filter(r=>r.report_status==='approved');
 const ops=d.operators.data??[],total=reports.reduce((a,b)=>a+b.accepted_orders,0);
 const byDay=new Map<string,number>();for(const r of reports)byDay.set(r.report_date,(byDay.get(r.report_date)??0)+r.accepted_orders);
 const entries=[...byDay].sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
 const max=Math.max(1,...entries.map(x=>x[1]));
 const ranking=ops.map(o=>({...o,total:reports.filter(r=>r.operator_id===o.id).reduce((a,b)=>a+b.accepted_orders,0),days:reports.filter(r=>r.operator_id===o.id).length})).sort((a,b)=>b.total-a.total);
 return <div className="space-y-4">
   <Heading title="KPI" description="Jamoaning tasdiqlangan natijalari va tahlil"
      action={<input type="month" aria-label="Hisobot oyi" value={month} onChange={e=>setMonth(e.target.value)} className="w-34 rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs"/>}/>
   <ErrorOrLoading loading={d.reports.isLoading||d.operators.isLoading} error={d.reports.error??d.operators.error} onRetry={()=>{void d.reports.refetch();void d.operators.refetch();}}/>
   <div className="grid grid-cols-2 gap-3"><Stat label="Oylik qabul" value={fmt(total)}/><Stat label="Operatorga o‘rtacha" value={fmt(total/Math.max(1,ops.length))}/><Stat label="Ishlangan kunlar" value={reports.length}/><Stat label="Yashil kunlar" value={reports.filter(r=>r.day_color==='green').length}/></div>
   <ColorBar rows={reports}/>
   <section className={card}>
     <h2 className="font-bold">Kunlik qabul dinamikasi</h2>
     {entries.length?<div className="mt-5 flex h-40 items-end gap-1.5 border-b border-neutral-200 pb-1">
       {entries.map(([date,n])=><div key={date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={formatDateUz(date)+': '+n+' ta'}>
         <span className="text-[9px] text-neutral-500">{n}</span><div className="w-full rounded-t-md bg-[#F5C542]" style={{height:Math.max(4,n/max*100)+'%'}}/><span className="text-[9px] text-neutral-400">{date.slice(-2)}</span>
       </div>)}
     </div>:<p className="mt-3 text-sm text-neutral-500">Bu oy uchun tasdiqlangan hisobotlar yo‘q.</p>}
   </section>
   <section className={card}>
     <h2 className="mb-3 font-bold">Operatorlar reytingi</h2>
     {ranking.map((o,i)=><div key={o.id} className="flex items-center gap-3 border-t border-neutral-100 py-3"><span className="w-7 font-extrabold text-neutral-400">{i+1}</span>
       <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{o.full_name}</p><p className="text-xs text-neutral-500">{o.days} ta tasdiqlangan kun</p></div>
       <b className="tabular-nums">{fmt(o.total)}</b>
     </div>)}
   </section>
   <p className="text-xs leading-relaxed text-neutral-500">Ranglar admin belgilagan nazorat rangini hisobga oladi. Pul, balans va oylik hisob-kitobi bundan o‘zgarmaydi.</p>
 </div>;
}
export function ManagerTasks(){
 const q=useTasks(),ops=useManager(monthNow()).operators,toast=useToast(),qc=useQueryClient();
 const [params]=useSearchParams(),[open,setOpen]=useState(false),[filter,setFilter]=useState('all');
 const [operator,setOperator]=useState(params.get('operator')??'');
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[due,setDue]=useState(tashkentToday()),[priority,setPriority]=useState('normal'),[category,setCategory]=useState('general');
 const create=useMutation({mutationFn:async()=>await unwrap(supabase.rpc('manager_create_task',{p_operator:operator,p_title:title,p_description:description,p_category:category,p_priority:priority,p_due:due})),
   onSuccess:()=>{void qc.invalidateQueries({queryKey:['manager-tasks']});setOpen(false);setTitle('');setDescription('');toast('success','Vazifa yuborildi.');},onError:e=>toast('error',humanError(e))});
 const review=useMutation({mutationFn:async({id,approve}:{id:string;approve:boolean})=>await unwrap(supabase.rpc('manager_review_task',{p_task:id,p_approve:approve,p_feedback:approve?null:'Qayta ishlab yuboring.'})),
   onSuccess:()=>{void qc.invalidateQueries({queryKey:['manager-tasks']});toast('success','Vazifa holati yangilandi.');},onError:e=>toast('error',humanError(e))});
 const tasks=(q.data??[]).filter(t=>filter==='all'||(filter==='late'?t.status!=='completed'&&t.due_date<tashkentToday():t.status===filter));
 const names=new Map((ops.data??[]).map(o=>[o.id,o.full_name]));
 function submit(e:FormEvent){e.preventDefault();if(!operator||title.trim().length<3)return toast('error','Operator va vazifa nomini kiriting.');create.mutate();}
 return <div className="space-y-4">
   <Heading title="Vazifalar" description="Topshiriqlar, muddatlar va tekshiruv"
      action={<Button size="sm" onClick={()=>setOpen(v=>!v)}><Plus size={16}/> Yangi</Button>}/>
   {open&&<form onSubmit={submit} className={card+' space-y-3'}>
     <h2 className="font-bold">Yangi vazifa</h2>
     <Field label="Operator"><Select required value={operator} onChange={e=>setOperator(e.target.value)}><option value="">Tanlang</option>{(ops.data??[]).map(o=><option key={o.id} value={o.id}>{o.full_name}</option>)}</Select></Field>
     <Field label="Vazifa nomi"><Input required minLength={3} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Misol: yangi skriptni o‘rganish"/></Field>
     <Field label="Izoh"><Textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></Field>
     <div className="grid grid-cols-2 gap-3">
       <Field label="Toifa"><Select value={category} onChange={e=>setCategory(e.target.value)}><option value="general">Umumiy</option><option value="training">O‘qish</option><option value="performance">Natija</option><option value="meeting">Yig‘ilish</option></Select></Field>
       <Field label="Muhimlik"><Select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Past</option><option value="normal">O‘rta</option><option value="high">Yuqori</option></Select></Field>
     </div>
     <Field label="Muddat"><Input type="date" min={tashkentToday()} value={due} onChange={e=>setDue(e.target.value)} required/></Field>
     <Button type="submit" loading={create.isPending}>Vazifani yuborish</Button>
   </form>}
   <div className="flex gap-2 overflow-x-auto pb-1">
     {[['all','Barchasi'],['todo','Yangi'],['in_progress','Jarayonda'],['submitted','Tekshirish'],['completed','Bajarilgan'],['late','Kechikkan']].map(([k,label])=><button key={k} onClick={()=>setFilter(k)} className={'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold '+(filter===k?'border-neutral-800 bg-neutral-800 text-white':'border-neutral-200 bg-white text-neutral-600')}>{label}</button>)}
   </div>
   <ErrorOrLoading loading={q.isLoading} error={q.error} onRetry={()=>void q.refetch()}/>
   {!tasks.length&&!q.isLoading?<EmptyState title="Vazifalar mavjud emas" hint="Yangi vazifa qo‘shing yoki filtrni o‘zgartiring."/>:null}
   {tasks.map(t=><div key={t.id} className={card+' space-y-2'}>
     <div className="flex items-start justify-between gap-2"><h2 className="font-bold">{t.title}</h2><Badge tone={t.status==='completed'?'green':t.status==='submitted'?'yellow':'neutral'}>{t.status==='completed'?'Bajarilgan':t.status==='submitted'?'Tekshirilmoqda':t.status==='in_progress'?'Qayta ishlash':'Yangi'}</Badge></div>
     <p className="text-xs text-neutral-500"><Users className="mr-1 inline" size={13}/>{names.get(t.operator_id)??'Operator'} · <CalendarDays className="mr-1 inline" size={13}/>{formatDateUz(t.due_date)} · {t.priority==='high'?'Muhim':'Oddiy'}</p>
     {t.description&&<p className="text-sm text-neutral-600">{t.description}</p>}
     {t.feedback&&<p className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">Izoh: {t.feedback}</p>}
     {t.status!=='completed'&&t.due_date<tashkentToday()&&<p className="flex items-center gap-1 text-xs font-semibold text-rose-600"><Clock size={14}/> Muddat o‘tgan</p>}
     {t.status==='submitted'&&<div className="flex gap-2"><Button size="sm" loading={review.isPending} onClick={()=>review.mutate({id:t.id,approve:true})}>Tasdiqlash</Button><Button size="sm" variant="outline" onClick={()=>review.mutate({id:t.id,approve:false})}>Qaytarish</Button></div>}
   </div>)}
 </div>;
}
export function ManagerProfile(){
 const {profile,refreshProfile,signOut}=useAuth(),[name,setName]=useState(profile?.full_name??''),[phone,setPhone]=useState(profile?.phone??'');
 const toast=useToast(),d=useManager(monthNow()),tasks=useTasks();
 const save=useMutation({mutationFn:async()=>{if(!profile||!name.trim())throw new Error('Ism kiriting.');await unwrap(supabase.from('profiles').update({full_name:name.trim(),phone:phone.trim()||null}).eq('id',profile.id).select());},
 onSuccess:()=>{void refreshProfile();toast('success','Profil saqlandi.');},onError:e=>toast('error',humanError(e))});
 const teamCodes=(d.teams.data??[]).map(t=>'Team '+t.team_code.toUpperCase());
 return <div className="space-y-4">
   <Heading title="Profil" description="Menejer ma’lumotlari va sozlamalari"/>
   <div className={card+' flex items-center gap-4'}>
     <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-100 text-2xl font-extrabold text-yellow-800">{profile?.full_name.slice(0,1)}</div>
     <div><h2 className="text-xl font-extrabold">{profile?.full_name}</h2><p className="text-sm text-neutral-500">{profile?.position||'Menejer'}</p><div className="mt-1"><Badge tone="yellow"><ShieldCheck size={13}/> Menejer</Badge></div></div>
   </div>
   <div className="grid grid-cols-2 gap-3"><Stat label="Operatorlar" value={d.operators.data?.length??'—'}/><Stat label="Bajarilgan vazifalar" value={(tasks.data??[]).filter(t=>t.status==='completed').length}/></div>
   <section className={card}><h2 className="mb-2 font-bold">Mening jamoalarim</h2><p className="text-sm text-neutral-600">{teamCodes.length?teamCodes.join(', '):'Admin hali jamoa biriktirmagan.'}</p><p className="mt-2 text-xs text-neutral-500">Xodim ID: {profile?.employee_id??'—'}</p></section>
   <form onSubmit={e=>{e.preventDefault();save.mutate();}} className={card+' space-y-3'}>
     <h2 className="font-bold">Shaxsiy ma’lumotlar</h2><Field label="Ism-familiya"><Input value={name} onChange={e=>setName(e.target.value)}/></Field>
     <Field label="Telefon"><Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></Field>
     <Button type="submit" loading={save.isPending}>Saqlash</Button>
   </form>
   <button onClick={()=>void signOut()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white font-bold text-rose-700"><UserRound size={18}/> Hisobdan chiqish</button>
 </div>;
}
