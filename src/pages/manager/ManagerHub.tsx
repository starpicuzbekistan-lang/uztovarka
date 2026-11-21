import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Bell, House, UsersRound, ChartNoAxesColumnIncreasing, ListTodo, UserRound, Search, SlidersHorizontal, Plus, ArrowUpRight, ArrowDownRight, ChevronRight, CheckCircle2, AlertTriangle, CalendarDays, Clock3, Trophy, LogOut, LockKeyhole, Megaphone, X, CircleCheck, ClipboardList, Activity, ShieldCheck, Target, RefreshCcw, Send, MessageSquare, TrendingUp, FileCheck2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Notice, Select, Segmented, Textarea, useToast } from '@/components/ui';
import { useKpiColorThresholds } from '@/lib/kpiColors';
import { supabase,unwrap } from '@/lib/supabase';
import { humanError, validatePassword } from '@/lib/uz';
import { categories, dateTime, dates, managerToday, overdue, priorities, statuses, useTasks, useTeam, useTeamSetting, useTrend, useNotices, type Task, type TeamOperator, type Period } from '@/lib/manager';
import clsx from 'clsx';

const nav=[{path:'/manager',label:'Home',icon:House},{path:'/manager/jamoa',label:'Jamoa',icon:UsersRound},{path:'/manager/kpi',label:'KPI',icon:ChartNoAxesColumnIncreasing},{path:'/manager/vazifalar',label:'Vazifalar',icon:ListTodo},{path:'/manager/profil',label:'Profil',icon:UserRound}] as const;
type Tab='home'|'team'|'kpi'|'tasks'|'profile';
const sum=(items:TeamOperator[],key:keyof TeamOperator)=>items.reduce((n,x)=>n+Number(x[key]||0),0);
const metric=(title:string,value:number|string,note?:string)=> <Card className="min-w-0 p-3.5 sm:p-4"><p className="text-xs font-medium text-neutral-500">{title}</p><p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>{note&&<p className="mt-1 text-xs text-neutral-500">{note}</p>}</Card>;
const percent=(num:number,den:number)=>den>0?Math.round(num/den*100):0;
function Bar({value,tone='green'}:{value:number;tone?:'green'|'yellow'|'red'}){
 return <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className={clsx('h-full rounded-full transition-all duration-300',tone==='green'?'bg-green-500':tone==='yellow'?'bg-amber-400':'bg-red-500')} style={{width:`${Math.min(100,Math.max(0,value))}%`}}/></div>;
}
function Title({children,subtitle}:{children:React.ReactNode;subtitle?:string}){return <div><h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{children}</h1>{subtitle&&<p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}</div>}
function Loading({query}:{query:{isLoading:boolean;isError:boolean;error:unknown;refetch:()=>unknown}}){return <>{query.isLoading&&<LoadingBlock rows={3}/>} {query.isError&&<ErrorState message={humanError(query.error)} onRetry={()=>void query.refetch()}/>}</>}
function EmptyTeam(){return <EmptyState title="Jamoa hali biriktirilmagan" hint="Administrator → Operatorlar bo‘limida menejerga operatorlarni biriktirishi kerak." icon={<UsersRound size={34}/>}/>}

export default function ManagerHub(){
 const {pathname}=useLocation(),{profile,signOut,refreshProfile}=useAuth(),qc=useQueryClient(),toast=useToast();
 const [alerts,setAlerts]=useState(false),[period,setPeriod]=useState<Period>('week'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [taskFilter,setTaskFilter]=useState('all'),[creating,setCreating]=useState(false),[taskDetail,setTaskDetail]=useState<Task|null>(null);
 const [taskForm,setTaskForm]=useState({operator:'',title:'',description:'',priority:'normal',category:'general',due:'',recurrence:'none'});
 const [feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);
 const [newPass,setNewPass]=useState(''),[confirmPass,setConfirmPass]=useState(''),[prefsBusy,setPrefsBusy]=useState(false);
 const today=managerToday();
 const month=dates('month',today),day=dates('day',today),range=dates(period,today);
 const duration=Math.round((new Date(range.to+'T12:00:00Z').getTime()-new Date(range.from+'T12:00:00Z').getTime())/86400000)+1;
 const previousEnd=new Date(new Date(range.from+'T12:00:00Z').getTime()-86400000);
 const previousStart=new Date(previousEnd.getTime()-(duration-1)*86400000);
 const prev={from:previousStart.toISOString().slice(0,10),to:previousEnd.toISOString().slice(0,10)};
 const teamMonth=useTeam(month.from,month.to),teamToday=useTeam(day.from,day.to),teamRange=useTeam(range.from,range.to),teamPrev=useTeam(prev.from,prev.to);
 const trend=useTrend(range.from,range.to),tasks=useTasks(),teamSetting=useTeamSetting(profile?.id),notices=useNotices(),colors=useKpiColorThresholds();
 const tab:Tab=pathname.endsWith('/jamoa')?'team':pathname.endsWith('/kpi')?'kpi':pathname.endsWith('/vazifalar')?'tasks':pathname.endsWith('/profil')?'profile':'home';
 const monthPeople=teamMonth.data??[],todayPeople=teamToday.data??[],periodPeople=teamRange.data??[];
 const operator=monthPeople.find(x=>x.operator_id===selected);
 const current=tasks.data?.find(t=>t.id===taskDetail?.id)??taskDetail;
 const comments=useQuery({queryKey:['manager-task-comments',current?.id],enabled:!!current,
  queryFn:async()=>await unwrap(supabase.from('manager_task_comments').select('id,task_id,author_id,body,created_at').eq('task_id',current!.id).order('created_at')) as {id:string;task_id:string;author_id:string;body:string;created_at:string}[]});
 const refreshTasks=()=>{void qc.invalidateQueries({queryKey:['manager-tasks']});void qc.invalidateQueries({queryKey:['manager-task-comments']});};
 const approvedToday=todayPeople.filter(x=>Number(x.worked_days)>0);
 const greenToday=sum(todayPeople,'green_days'),yellowToday=sum(todayPeople,'yellow_days'),redToday=sum(todayPeople,'red_days');
 const pendingToday=sum(todayPeople,'pending_reports'),todayAccepted=sum(todayPeople,'today_accepted');
 const monthTotal=sum(monthPeople,'period_accepted'),target=Number(teamSetting.data?.target_accepted??0);
 const ranked=[...monthPeople].sort((a,b)=>Number(b.period_accepted)-Number(a.period_accepted));
 const periodAccepted=sum(periodPeople,'period_accepted'),previousAccepted=sum(teamPrev.data??[],'period_accepted');
 const delta=previousAccepted>0?Math.round((periodAccepted-previousAccepted)/previousAccepted*100):null;
 const filteredTasks=(tasks.data??[]).filter(t=>taskFilter==='all'||(taskFilter==='overdue'?overdue(t):t.status===taskFilter));
 const selectedCount=tasks.data?.filter(t=>t.status==='completed').length??0;
 const donePct=percent(selectedCount,tasks.data?.length??0);
 async function createTask(e:FormEvent){
  e.preventDefault();if(!taskForm.operator||taskForm.title.trim().length<3||!taskForm.due)return toast('error','Operator, vazifa va muddatni kiriting.');
  const at=new Date(taskForm.due);if(!Number.isFinite(at.getTime())||at.getTime()<=Date.now())return toast('error','Kelajakdagi muddatni tanlang.');
  setBusy(true);try{await unwrap(supabase.rpc('manager_create_task',{p_operator:taskForm.operator,p_title:taskForm.title.trim(),p_description:taskForm.description,p_category:taskForm.category,p_priority:taskForm.priority,p_due_at:at.toISOString(),p_recurrence:taskForm.recurrence}));
   setCreating(false);setTaskForm({operator:'',title:'',description:'',priority:'normal',category:'general',due:'',recurrence:'none'});refreshTasks();toast('success','Vazifa yuborildi.');
  }catch(err){toast('error',humanError(err));}finally{setBusy(false);}
 }
 async function taskAction(action:'complete'|'reopen'){if(!current)return;setBusy(true);try{
  await unwrap(supabase.rpc('manager_review_task',{p_task:current.id,p_action:action,p_comment:feedback.trim()||null}));
  toast('success',action==='complete'?'Vazifa tasdiqlandi.':'Vazifa qayta ishlashga qaytarildi.');
  setFeedback('');setTaskDetail(null);refreshTasks();
 }catch(e){toast('error',humanError(e));}finally{setBusy(false);}}
 async function sendComment(){if(!current||!feedback.trim())return;setBusy(true);try{
  await unwrap(supabase.rpc('manager_comment_task',{p_task:current.id,p_comment:feedback.trim()}));setFeedback('');
  void qc.invalidateQueries({queryKey:['manager-task-comments',current.id]});toast('success','Izoh yuborildi.');
 }catch(e){toast('error',humanError(e));}finally{setBusy(false);}}
 const navItems=nav.map(({path,label,icon:Icon})=>{
  const active=pathname===path;
  return <Link key={path} to={path} aria-current={active?'page':undefined} className="flex min-h-[66px] flex-col items-center justify-center gap-0.5 px-1">
   <span className={clsx('flex h-8 w-12 items-center justify-center rounded-xl transition-colors',active?'bg-amber-100':'')}><Icon size={21} className={active?'text-neutral-950':'text-neutral-500'} strokeWidth={active?2.5:1.9}/></span>
   <span className={clsx('text-[11px]',active?'font-bold text-neutral-950':'text-neutral-500')}>{label}</span>
  </Link>;
 });
 return <div className="min-h-screen bg-[#F7F8FA] text-[#171A20]">
  <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-[#F7F8FA]/95 backdrop-blur-lg">
   <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between px-4">
    <Link to="/manager" className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] text-xl font-black">U</span><span><b className="block text-[15px] tracking-tight">UZTOVARKA</b><span className="block text-[11px] text-neutral-500">Manager Hub</span></span></Link>
    <button onClick={()=>setAlerts(!alerts)} className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white" aria-label="E’lonlar"><Bell size={20}/>{(notices.data?.length??0)>0&&<span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"/>}</button>
   </div>
  </header>
  {alerts&&<div className="fixed inset-x-3 top-[77px] z-50 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
   <div className="mb-2 flex items-center justify-between"><b>E’lonlar</b><button className="min-h-10 min-w-10" aria-label="Yopish" onClick={()=>setAlerts(false)}><X size={18}/></button></div>
   {notices.isError&&<p className="text-sm text-red-600">E’lonlar yuklanmadi.</p>}
   {notices.data?.length===0&&<p className="text-sm text-neutral-500">Yangi e’lon yo‘q.</p>}
   {notices.data?.map(n=><div key={n.id} className="border-t border-neutral-100 py-2"><b className="text-sm">{n.title}</b><p className="text-xs text-neutral-600">{n.message}</p></div>)}
  </div>}
  <main className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-5">
   {tab==='home'&&<>
    <Title subtitle="Jamoa nazorati · faqat biriktirilgan operatorlar">Assalomu alaykum{profile?.full_name?', '+profile.full_name.split(' ')[0]:''}!</Title>
    <Loading query={teamToday}/>{teamToday.data&&todayPeople.length===0&&<EmptyTeam/>}
    {todayPeople.length>0&&<>
     <div className="rounded-[20px] border border-amber-200/70 bg-[#FFF8DF] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><Activity size={19} className="text-amber-600"/> Bugungi jamoa natijasi</div>
      <div className="mt-3 flex items-end justify-between"><div><p className="text-4xl font-extrabold tabular-nums">{todayAccepted.toLocaleString('uz-UZ')}</p><p className="mt-1 text-xs text-neutral-600">Admin tasdiqlagan qabul</p></div><div className="text-right"><p className="text-xl font-bold">{percent(greenToday,todayPeople.length)}%</p><p className="text-xs text-neutral-600">Yashil kunlar</p></div></div>
      <div className="mt-4"><Bar value={percent(greenToday,todayPeople.length)}/></div>
     </div>
     <div className="grid grid-cols-2 gap-3">{metric('Biriktirilgan operatorlar',todayPeople.length)}{metric('Maqsadga erishganlar',greenToday,'Tasdiqlangan natija')}{metric('Maqsaddan past',yellowToday+redToday,'Yuborilgan va tasdiqlangan')}{metric('Kutilayotgan hisobotlar',pendingToday,'Admin tasdig‘ida')}</div>
     <Card className="space-y-3"><h2 className="font-bold">KPI taqsimoti</h2><div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-green-50 p-3"><b className="block text-xl text-green-700">{greenToday}</b><span className="text-xs">Yashil</span></div>
      <div className="rounded-xl bg-amber-50 p-3"><b className="block text-xl text-amber-700">{yellowToday}</b><span className="text-xs">Sariq</span></div>
      <div className="rounded-xl bg-red-50 p-3"><b className="block text-xl text-red-700">{redToday}</b><span className="text-xs">Qizil</span></div>
     </div><p className="text-xs text-neutral-500">Ranglar admin belgilagan limitlar bo‘yicha. Hisobotsiz operatorlar alohida ko‘rsatiladi: {todayPeople.length-approvedToday.length} ta.</p></Card>
    </>}
    <div className="grid gap-3 sm:grid-cols-2">
     <Card><h2 className="mb-3 flex items-center gap-2 font-bold"><Megaphone size={18}/> Administrator e’lonlari</h2>{notices.isError&&<ErrorState message="E’lonlar yuklanmadi." onRetry={()=>void notices.refetch()}/>}
      {(notices.data??[]).slice(0,3).map(n=><div key={n.id} className="border-t border-neutral-100 py-3"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 line-clamp-2 text-xs text-neutral-600">{n.message}</p></div>)}{notices.data?.length===0&&<p className="text-sm text-neutral-500">E’lonlar yo‘q.</p>}</Card>
     <Card><h2 className="mb-3 flex items-center gap-2 font-bold"><AlertTriangle size={18}/> Muhim ogohlantirishlar</h2>
      {(pendingToday>0||yellowToday+redToday>0)?<div className="space-y-2 text-sm">
       {yellowToday+redToday>0&&<Link to="/manager/jamoa" className="block rounded-xl bg-red-50 p-3 text-red-800">{yellowToday+redToday} operator yashil normaga erishmagan</Link>}
       {pendingToday>0&&<div className="rounded-xl bg-amber-50 p-3 text-amber-900">{pendingToday} ta hisobot admin tasdig‘ida</div>}
      </div>:<p className="text-sm text-neutral-500">Hozircha ogohlantirish yo‘q.</p>}</Card>
    </div>
    <Card className="space-y-3"><h2 className="font-bold">Jamoaning oylik maqsadi</h2>{target>0?<><div className="flex justify-between text-sm"><span>{monthTotal.toLocaleString('uz-UZ')} / {target.toLocaleString('uz-UZ')} qabul</span><b>{percent(monthTotal,target)}%</b></div><Bar value={percent(monthTotal,target)}/></>:<p className="text-sm text-neutral-500">Administrator hali oylik jamoa maqsadini belgilamagan.</p>}</Card>
    <div><h2 className="mb-3 font-bold">Tezkor amallar</h2><div className="grid grid-cols-3 gap-3">{[{to:'/manager/jamoa',label:'Jamoa',icon:UsersRound},{to:'/manager/kpi',label:'KPI tahlili',icon:ChartNoAxesColumnIncreasing},{to:'/manager/vazifalar',label:'Vazifalar',icon:ListTodo}].map(({to,label,icon:Icon})=><Link key={to} to={to} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white text-center text-xs font-semibold shadow-sm"><span className="rounded-xl bg-amber-100 p-2"><Icon size={21}/></span>{label}</Link>)}</div></div>
   </>}
   {tab==='team'&&<>
    <Title subtitle="Faqat sizga biriktirilgan operatorlar">Jamoa</Title>
    <Card className="border-amber-200 bg-amber-50/40"><p className="text-xs text-neutral-500">{teamSetting.data?.name??'Mening jamoam'}</p><div className="mt-2 flex items-center justify-between"><div><p className="text-2xl font-extrabold">{monthPeople.length}</p><p className="text-xs text-neutral-500">Operator</p></div><div className="text-right"><p className="text-2xl font-extrabold">{monthTotal.toLocaleString('uz-UZ')}</p><p className="text-xs text-neutral-500">Oylik tasdiqlangan qabul</p></div></div>{target>0&&<div className="mt-4"><Bar value={percent(monthTotal,target)}/><p className="mt-1 text-right text-xs text-neutral-500">Maqsad: {target.toLocaleString('uz-UZ')}</p></div>}</Card>
    <div className="flex items-center gap-2"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-3 text-neutral-400"/><Input className="pl-10" placeholder="Operator qidirish" value={query} onChange={e=>setQuery(e.target.value)}/></div><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white"><SlidersHorizontal size={19}/></span></div>
    <Loading query={teamMonth}/>
    {teamMonth.data&&monthPeople.length===0&&<EmptyTeam/>}
    {ranked.filter(p=>p.full_name.toLowerCase().includes(query.trim().toLowerCase())).map((p,i)=><button key={p.operator_id} onClick={()=>setSelected(p.operator_id)}
     className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition hover:border-amber-300">
     <span className="w-7 shrink-0 text-xs font-bold text-neutral-500">#{i+1}</span><Avatar name={p.full_name} path={p.avatar_url} size={42}/>
     <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.full_name}</span><span className="mt-1 flex flex-wrap items-center gap-1">{p.gold_verified&&<Badge tone="yellow"><ShieldCheck size={11}/> Gold</Badge>}<Badge tone={p.is_active?'green':'neutral'}>{p.is_active?'Faol':'Nofaol'}</Badge></span><span className="mt-2 block text-[11px] text-neutral-500">Bugun: {Number(p.today_accepted)} · Oy: {Number(p.period_accepted)} · {Number(p.worked_days)} kun</span></span>
     <span className="text-right"><b className="block tabular-nums">{p.green_days} <span className="text-green-600">●</span></b><span className="block text-[11px] text-neutral-500">{p.pending_reports} kutilmoqda</span></span><ChevronRight size={17} className="shrink-0 text-neutral-400"/>
    </button>)}
    {operator&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" onClick={()=>setSelected(null)}>
     <div onClick={e=>e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-t-[24px] bg-white p-5 shadow-xl sm:rounded-[24px]">
      <div className="flex items-center justify-between"><b>Operator natijalari</b><button className="h-10 w-10" onClick={()=>setSelected(null)} aria-label="Yopish"><X/></button></div>
      <div className="flex items-center gap-3"><Avatar name={operator.full_name} path={operator.avatar_url} size={55}/><div><b>{operator.full_name}</b><p className="text-xs text-neutral-500">Xodim ID: {operator.employee_id??'—'}</p>{operator.gold_verified&&<Badge tone="yellow">Gold Verified</Badge>}</div></div>
      <div className="grid grid-cols-2 gap-2">{metric('Bugungi qabul',operator.today_accepted)}{metric('Oylik qabul',operator.period_accepted)}{metric('Ishlangan kunlar',operator.worked_days)}{metric('Tasdiq kutilmoqda',operator.pending_reports)}</div>
      <div className="grid grid-cols-3 gap-2">{metric('Yashil',operator.green_days)}{metric('Sariq',operator.yellow_days)}{metric('Qizil',operator.red_days)}</div>
      <p className="text-xs text-neutral-500">Davomat: {operator.absent_days} kelmagan · {operator.leave_days} ta’til · {operator.days_off} dam olish.</p>
      <Button variant="outline" className="w-full" onClick={()=>setSelected(null)}>Yopish</Button>
     </div>
    </div>}
   </>}
   {tab==='kpi'&&<>
    <Title subtitle="Tasdiqlangan hisobotlar asosida tahlil">KPI analitika</Title>
    <Segmented<Period> value={period} onChange={setPeriod} options={[{value:'day',label:'Kunlik'},{value:'week',label:'Haftalik'},{value:'month',label:'Oylik'}]}/>
    <Loading query={teamRange}/>{teamRange.data&&periodPeople.length===0&&<EmptyTeam/>}
    {periodPeople.length>0&&<>
     <Card className="border-amber-200 bg-amber-50/40"><p className="text-sm font-medium text-neutral-600">Jami tasdiqlangan qabul</p><div className="mt-1 flex items-center gap-3"><b className="text-4xl font-extrabold">{periodAccepted.toLocaleString('uz-UZ')}</b>{delta!==null&&<Badge tone={delta>=0?'green':'red'}>{delta>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {delta>0?'+':''}{delta}%</Badge>}</div><p className="mt-2 text-xs text-neutral-500">Oldingi davr bilan taqqoslash · {range.from} – {range.to}</p></Card>
     <div className="grid grid-cols-2 gap-3">{metric('Operatorga o‘rtacha',Math.round(periodAccepted/periodPeople.length))}{metric('Yashil kunlar ulushi',percent(sum(periodPeople,'green_days'),sum(periodPeople,'worked_days'))+'%')}{metric('Ishlangan kunlar',sum(periodPeople,'worked_days'))}{metric('Kutilayotgan hisobot',sum(periodPeople,'pending_reports'))}</div>
     <Card className="space-y-3"><div className="flex items-center justify-between"><b>Natijalar dinamikasi</b><TrendingUp size={19} className="text-neutral-500"/></div>
      {trend.isLoading&&<LoadingBlock rows={1}/>}
      {trend.isError&&<ErrorState message={humanError(trend.error)} onRetry={()=>void trend.refetch()}/>}
      {trend.data&&<div className="h-40 w-full">
       <svg viewBox="0 0 320 130" className="h-full w-full" role="img" aria-label="Tasdiqlangan qabullar bo‘yicha trend chizig‘i" preserveAspectRatio="none">
        {[25,65,105].map(y=><line key={y} x1="5" x2="315" y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="4 5"/>)}
        <polyline fill="none" stroke="#EAB308" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={(trend.data??[]).map((v,i,a)=>{
         const max=Math.max(1,...a.map(x=>Number(x.approved_accepted)));
         return `${5+i*310/Math.max(1,a.length-1)},${117-Number(v.approved_accepted)/max*103}`;
        }).join(' ')}/>
       </svg></div>}
      <p className="text-xs text-neutral-500">Kunlar kesimida faqat administrator tasdiqlagan natijalar.</p>
     </Card>
     <Card className="space-y-3"><b>KPI ranglari taqsimoti</b><div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-green-50 p-3"><p className="text-2xl font-extrabold text-green-700">{sum(periodPeople,'green_days')}</p><span className="text-xs">Yashil</span></div>
      <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-extrabold text-amber-700">{sum(periodPeople,'yellow_days')}</p><span className="text-xs">Sariq</span></div>
      <div className="rounded-xl bg-red-50 p-3"><p className="text-2xl font-extrabold text-red-700">{sum(periodPeople,'red_days')}</p><span className="text-xs">Qizil</span></div>
     </div><p className="text-xs text-neutral-500">Admin rang chegaralari: qizil &lt; {colors.data?.redBelow??'—'}, sariq &lt; {colors.data?.yellowBelow??'—'}, yashil ≥ {colors.data?.yellowBelow??'—'}.</p></Card>
     <Card className="space-y-3"><b>Operatorlar reytingi</b>{[...periodPeople].sort((a,b)=>Number(b.period_accepted)-Number(a.period_accepted)).slice(0,5).map((p,i)=><div key={p.operator_id} className="flex items-center gap-3 border-t border-neutral-100 pt-3"><span className="w-6 text-sm font-bold text-neutral-400">#{i+1}</span><Avatar name={p.full_name} path={p.avatar_url} size={34}/><span className="min-w-0 flex-1 truncate text-sm">{p.full_name}</span><b>{p.period_accepted}</b></div>)}</Card>
     <Card><b>Davomat</b><p className="mt-2 text-sm text-neutral-600">Ishlangan: {sum(periodPeople,'worked_days')} · Kelmagan: {sum(periodPeople,'absent_days')} · Ta’til: {sum(periodPeople,'leave_days')} · Dam olish: {sum(periodPeople,'days_off')}</p></Card>
     <Notice tone="info">Qo‘lda yuborilgan hisobotlar administrator tomonidan tasdiqlanmaguncha umumiy KPI va reytingga kiritilmaydi.</Notice>
    </>}
   </>}
   {tab==='tasks'&&<>
    <div className="flex items-start justify-between gap-3"><Title subtitle="Ichki vazifalarni nazorat qilish">Vazifalar</Title><Button size="sm" onClick={()=>setCreating(true)}><Plus size={16}/> Vazifa</Button></div>
    <Loading query={tasks}/>
    {tasks.data&&<>
     <Card className="space-y-3 border-amber-200 bg-amber-50/30"><div className="flex justify-between"><b>Vazifalar bajarilishi</b><b>{donePct}%</b></div><Bar value={donePct}/><p className="text-xs text-neutral-600">{selectedCount} bajarilgan · {tasks.data.filter(x=>x.status==='review').length} tekshiruvda · {tasks.data.filter(overdue).length} muddati o‘tgan</p></Card>
     <div className="flex gap-2 overflow-x-auto pb-1">{[['all','Barchasi'],['todo','Boshlanmagan'],['in_progress','Jarayonda'],['review','Tekshiruvda'],['completed','Bajarildi'],['overdue','Muddati o‘tgan']].map(([key,label])=><button key={key} onClick={()=>setTaskFilter(key)} className={clsx('min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold',taskFilter===key?'border-black bg-neutral-900 text-white':'border-neutral-200 bg-white text-neutral-600')}>{label}</button>)}</div>
     {filteredTasks.length===0&&<EmptyState title="Vazifalar mavjud emas" hint="Filtrni almashtiring yoki yangi vazifa yarating."/>}
     {filteredTasks.map(t=><button key={t.id} onClick={()=>{setTaskDetail(t);setFeedback('');}} className="w-full space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-2"><b className="min-w-0 flex-1 text-sm">{t.title}</b><Badge tone={overdue(t)?'red':t.status==='completed'?'green':t.status==='review'?'yellow':'neutral'}>{overdue(t)?'Muddati o‘tgan':statuses[t.status]}</Badge></div>
      <div className="flex flex-wrap items-center gap-2"><Badge>{categories[t.category]}</Badge><Badge tone={t.priority==='high'?'red':'neutral'}>{priorities[t.priority]}</Badge>{t.recurrence!=='none'&&<Badge>Takrorlanuvchi</Badge>}</div>
      <p className="flex items-center gap-1.5 text-xs text-neutral-500"><UsersRound size={13}/> {monthPeople.find(p=>p.operator_id===t.operator_id)?.full_name??'Biriktirilgan operator'} <CalendarDays size={13} className="ml-2"/>{dateTime(t.due_at)}</p>
      {t.description&&<p className="line-clamp-2 text-xs text-neutral-500">{t.description}</p>}
     </button>)}
    </>}
    {creating&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onClick={()=>setCreating(false)}><div onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
     <div className="mb-4 flex items-center justify-between"><b className="text-lg">Yangi vazifa</b><button className="h-10 w-10" aria-label="Yopish" onClick={()=>setCreating(false)}><X/></button></div>
     <form onSubmit={e=>void createTask(e)} className="space-y-3">
      <Field label="Operator"><Select required value={taskForm.operator} onChange={e=>setTaskForm(x=>({...x,operator:e.target.value}))}><option value="">Tanlang</option>{monthPeople.map(p=><option key={p.operator_id} value={p.operator_id}>{p.full_name}</option>)}</Select></Field>
      <Field label="Vazifa nomi"><Input required minLength={3} maxLength={160} value={taskForm.title} onChange={e=>setTaskForm(x=>({...x,title:e.target.value}))}/></Field>
      <Field label="Tavsif"><Textarea value={taskForm.description} maxLength={2000} onChange={e=>setTaskForm(x=>({...x,description:e.target.value}))}/></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Kategoriya"><Select value={taskForm.category} onChange={e=>setTaskForm(x=>({...x,category:e.target.value}))}>{Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></Field><Field label="Muhimlik"><Select value={taskForm.priority} onChange={e=>setTaskForm(x=>({...x,priority:e.target.value}))}>{Object.entries(priorities).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></Field></div>
      <Field label="Muddat"><Input type="datetime-local" required value={taskForm.due} onChange={e=>setTaskForm(x=>({...x,due:e.target.value}))}/></Field>
      <Field label="Takrorlash"><Select value={taskForm.recurrence} onChange={e=>setTaskForm(x=>({...x,recurrence:e.target.value}))}><option value="none">Takrorlanmaydi</option><option value="weekly">Har hafta</option><option value="monthly">Har oy</option></Select></Field>
      <Button className="w-full" type="submit" loading={busy}>Vazifani biriktirish</Button>
     </form>
    </div></div>}
    {current&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onClick={()=>setTaskDetail(null)}>
     <div onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
      <div className="flex items-center justify-between"><b>Vazifa tafsilotlari</b><button className="h-10 w-10" aria-label="Yopish" onClick={()=>setTaskDetail(null)}><X/></button></div>
      <h2 className="text-lg font-bold">{current.title}</h2><div className="flex flex-wrap gap-2"><Badge>{categories[current.category]}</Badge><Badge>{priorities[current.priority]}</Badge><Badge tone={overdue(current)?'red':current.status==='completed'?'green':'yellow'}>{overdue(current)?'Muddati o‘tgan':statuses[current.status]}</Badge></div>
      <p className="text-sm text-neutral-600">{current.description||'Tavsif kiritilmagan'}</p><p className="text-xs text-neutral-500">Muddat: {dateTime(current.due_at)}</p>
      <div className="space-y-2 rounded-xl bg-neutral-50 p-3"><b className="text-sm">Izohlar</b>{comments.isLoading&&<p className="text-xs">Yuklanmoqda...</p>}{comments.isError&&<p className="text-xs text-red-700">Izohlar yuklanmadi.</p>}{comments.data?.length===0&&<p className="text-xs text-neutral-500">Hozircha izoh yo‘q.</p>}
       {comments.data?.map(c=><div key={c.id} className="border-t border-neutral-200 py-2 text-sm"><p>{c.body}</p><span className="text-[11px] text-neutral-500">{dateTime(c.created_at)}</span></div>)}</div>
      <Field label="Menejer izohi"><Textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Fikr yoki ko‘rsatma yozing"/></Field>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!feedback.trim()||busy} onClick={()=>void sendComment()}><MessageSquare size={16}/> Izoh yuborish</Button>
       {(current.status==='review'||current.status==='in_progress')&&<Button disabled={busy} onClick={()=>void taskAction('complete')}><CheckCircle2 size={16}/> Bajarilgan deb tasdiqlash</Button>}
       {(current.status==='review'||current.status==='completed')&&<Button variant="outline" disabled={busy} onClick={()=>void taskAction('reopen')}>Qayta ishlash</Button>}
      </div>
     </div>
    </div>}
   </>}
   {tab==='profile'&&<>
    <Title subtitle="Shaxsiy boshqaruv va xavfsizlik">Profil</Title>
    <Card className="border-amber-200 bg-amber-50/40"><div className="flex items-center gap-4"><Avatar name={profile?.full_name??'M'} path={profile?.avatar_url} size={64}/><div className="min-w-0"><h2 className="truncate text-lg font-bold">{profile?.full_name}</h2><p className="text-xs text-neutral-500">Xodim ID: {profile?.employee_id??'—'}</p><Badge tone="yellow">Jamoa menejeri</Badge></div></div></Card>
    <Card><p className="text-xs text-neutral-500">Biriktirilgan jamoa</p><div className="mt-1 flex justify-between"><b>{teamSetting.data?.name??'Mening jamoam'}</b><span className="text-sm">{monthPeople.length} operator</span></div></Card>
    <h2 className="font-bold">Boshqaruv natijalari</h2><div className="grid grid-cols-2 gap-3">{metric('Nazoratdagi operatorlar',monthPeople.length)}{metric('Oylik tasdiqlangan qabul',monthTotal.toLocaleString('uz-UZ'))}{metric('Yakunlangan vazifalar',selectedCount)}{metric('Tekshiruvdagi vazifalar',tasks.data?.filter(t=>t.status==='review').length??0)}</div>
    <Card className="space-y-2"><h2 className="flex items-center gap-2 font-bold"><Trophy size={19}/> Jamoa yutuqlari</h2>{target>0?<><p className="text-sm">{percent(monthTotal,target)}% oylik maqsad bajarildi</p><Bar value={percent(monthTotal,target)}/></>:<p className="text-sm text-neutral-500">Jamoa maqsadi hali belgilanmagan.</p>}</Card>
    <Card className="space-y-3"><h2 className="flex items-center gap-2 font-bold"><Activity size={19}/> Faoliyat yozuvlari</h2>{tasks.data?.filter(t=>t.status==='completed').sort((a,b)=>(b.completed_at??'').localeCompare(a.completed_at??'')).slice(0,4).map(t=><div key={t.id} className="border-t border-neutral-100 pt-2"><b className="text-sm">{t.title}</b><p className="text-xs text-neutral-500">Bajarildi · {t.completed_at?dateTime(t.completed_at):'—'}</p></div>)}{tasks.data?.filter(t=>t.status==='completed').length===0&&<p className="text-sm text-neutral-500">Hozircha yakunlangan vazifalar yo‘q.</p>}</Card>
    <Card className="space-y-3"><h2 className="flex items-center gap-2 font-bold"><Bell size={18}/> Bildirishnomalar</h2><label className="flex items-center justify-between gap-2 text-sm">Administrator e’lonlari<input type="checkbox" checked={!!profile?.notify_announcements} onChange={async e=>{if(!profile)return;setPrefsBusy(true);try{await unwrap(supabase.from('profiles').update({notify_announcements:e.target.checked}).eq('id',profile.id));await refreshProfile();toast('success','Sozlama saqlandi.');}catch(err){toast('error',humanError(err));}finally{setPrefsBusy(false);}}} disabled={prefsBusy}/></label></Card>
    <Card className="space-y-3"><h2 className="flex items-center gap-2 font-bold"><LockKeyhole size={18}/> Parolni o‘zgartirish</h2><Field label="Yangi parol"><Input type="password" autoComplete="new-password" value={newPass} onChange={e=>setNewPass(e.target.value)}/></Field><Field label="Yangi parolni tasdiqlash"><Input type="password" autoComplete="new-password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}/></Field><Button variant="outline" disabled={busy||!newPass||!confirmPass} onClick={async()=>{
      if(newPass!==confirmPass)return toast('error','Parollar mos kelmaydi.');
      const err=validatePassword(newPass);if(err)return toast('error',err);
      setBusy(true);try{const {error}=await supabase.auth.updateUser({password:newPass});if(error)throw error;setNewPass('');setConfirmPass('');toast('success','Parol o‘zgartirildi.');}catch(e){toast('error',humanError(e));}finally{setBusy(false);}
     }}>Parolni saqlash</Button></Card>
    <Notice tone="info">Moliyaviy sozlamalar va tizim bo‘yicha umumiy ruxsatlar faqat Administrator Panelida boshqariladi.</Notice>
    <Button variant="outline" className="w-full border-red-200 text-red-700" onClick={()=>void signOut()}><LogOut size={18}/> Tizimdan chiqish</Button>
   </>}
  </main>
  <nav aria-label="Manager Hub menyusi" className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 shadow-sm backdrop-blur-lg safe-bottom">
   <div className="mx-auto grid max-w-md grid-cols-5">{navItems}</div>
  </nav>
 </div>;
}
