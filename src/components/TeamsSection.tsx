import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Crown, Target, Trophy, Users } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { formatNumber } from '@/lib/format';
import { parseIso, tashkentToday } from '@/lib/dates';
import { Card, ErrorState, LoadingBlock, Notice } from '@/components/ui';
import { MonthNav } from '@/components/MonthNav';

type TeamCode='alpha'|'beta';
type TeamRow = {
 team_code:TeamCode;operator_id:string|null;full_name:string|null;avatar_url:string|null;
 accepted_orders:number;worked_days:number;green_days:number;team_target:number|null;
};
const TEAM:Record<TeamCode,{name:string;accent:string;bar:string;light:string;ring:string}> = {
 alpha:{name:'Team Alpha',accent:'text-rose-600',bar:'bg-rose-500',light:'bg-rose-50',ring:'border-rose-300'},
 beta:{name:'Team Beta',accent:'text-blue-600',bar:'bg-blue-600',light:'bg-blue-50',ring:'border-blue-300'},
};
type TeamSummary={code:TeamCode;members:TeamRow[];total:number;target:number|null};
const monthStart=(y:number,m:number)=>`${y}-${String(m).padStart(2,'0')}-01`;
const percent=(t:TeamSummary)=>t.target?100*t.total/t.target:null;
const pctLabel=(v:number|null)=>v==null?'—':`${v.toFixed(1)}%`;

export default function TeamsSection() {
 const {profile}=useAuth();
 const t=parseIso(tashkentToday());
 const [ym,setYm]=useState({y:t.y,m:t.m});
 const [selected,setSelected]=useState<TeamCode>('alpha');
 const start=monthStart(ym.y,ym.m);
 const q=useQuery({
   queryKey:['team-dashboard',start],
   queryFn:async()=>(await unwrap(supabase.rpc('get_team_dashboard',{p_month:start}))) as TeamRow[],
 });
 const all:TeamSummary[]=(['alpha','beta'] as TeamCode[]).map(code=>{
   const rows=(q.data??[]).filter(r=>r.team_code===code);
   const members=rows.filter(r=>!!r.operator_id);
   return {code,members,total:members.reduce((a,r)=>a+Number(r.accepted_orders),0),
     target:rows.find(r=>r.team_target!=null)?.team_target??null};
 });
 const myTeam=all.find(t=>t.members.some(m=>m.operator_id===profile?.id))??null;
 const [a,b]=all;
 const scoreA=percent(a),scoreB=percent(b);
 const winner:TeamCode|null=scoreA!==null&&scoreB!==null
   ? scoreA===scoreB?(a.total===b.total?null:a.total>b.total?'alpha':'beta')
   : scoreA>scoreB?'alpha':'beta'
   : null;
 const selectedTeam=all.find(t=>t.code===selected)!;
 const sorted=[...selectedTeam.members].sort((x,y)=>Number(y.accepted_orders)-Number(x.accepted_orders)||String(x.full_name).localeCompare(String(y.full_name)));
 const compareText=scoreA===null||scoreB===null?'Administrator ikki jamoa maqsadini ham belgilashi kerak.'
  : winner===null?'Jamoalar hozircha teng natijada.'
  : `${TEAM[winner].name} ${Math.abs(scoreA-scoreB).toFixed(1)} foiz punkt oldinda`;
 return <div className="space-y-4">
   <MonthNav y={ym.y} m={ym.m} onChange={(y,m)=>setYm({y,m})}/>
   {q.isLoading&&<LoadingBlock rows={3}/>}
   {q.isError&&<ErrorState message={String((q.error as Error)?.message??'Jamoa ma’lumotlarini yuklab bo‘lmadi.')} onRetry={()=>void q.refetch()}/>}
   {q.data&&<>
     <Card className="space-y-4 p-4 sm:p-5">
       <div className="flex items-center justify-between"><h2 className="font-bold">Mening jamoam</h2>
         <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase">Sizning jamoa</span>
       </div>
       {!myTeam?<Notice tone="info">Siz hali hech bir jamoaga biriktirilmagansiz. Administrator Alpha yoki Beta jamoasini tanlaydi.</Notice>:<>
         <div className="flex items-center gap-3">
           <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full',TEAM[myTeam.code].light)}>
             <Users className={TEAM[myTeam.code].accent} size={25}/></div>
           <div><h3 className={clsx('text-lg font-extrabold',TEAM[myTeam.code].accent)}>{TEAM[myTeam.code].name}</h3>
             <p className="text-xs text-neutral-500">{myTeam.members.length} a’zo · jami {formatNumber(myTeam.total)} qabul</p>
           </div>
         </div>
         <div className="flex items-center justify-between gap-2 text-xs text-neutral-600">
           <span>Oylik maqsad: {myTeam.target?formatNumber(myTeam.target):'Belgilanmagan'}</span>
           <b>{pctLabel(percent(myTeam))}</b>
         </div>
         <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
           <div className={clsx('h-full rounded-full',TEAM[myTeam.code].bar)} style={{width:`${Math.min(100,percent(myTeam)??0)}%`}} />
         </div>
       </>}
     </Card>
     <Card className="space-y-4 p-4 sm:p-5">
       <div className="flex items-center gap-2"><ArrowLeftRight size={18} className="text-neutral-700"/><h2 className="font-bold">Teams Battle</h2></div>
       <div className="grid grid-cols-2 gap-2">
         {all.map(team=><div key={team.code} className={clsx('relative space-y-2 rounded-xl border-2 p-3',winner===team.code?TEAM[team.code].ring:'border-neutral-200',TEAM[team.code].light)}>
           {winner===team.code&&<div className="absolute -top-3 right-1 rounded-full bg-yellow-300 px-2 py-1 text-[9px] font-bold"><Trophy size={11} className="mr-1 inline"/>YETAKCHI</div>}
           <div className={clsx('text-sm font-extrabold',TEAM[team.code].accent)}>{team.code==='alpha'?'🔴':'🔵'} {TEAM[team.code].name}</div>
           <div className="text-2xl font-extrabold tabular-nums">{formatNumber(team.total)}</div>
           <p className="text-[11px] text-neutral-500">Maqsad: {team.target?formatNumber(team.target):'—'}</p>
           <div className="h-2.5 overflow-hidden rounded-full bg-neutral-200">
             <div className={clsx('h-full rounded-full',TEAM[team.code].bar)} style={{width:`${Math.min(100,percent(team)??0)}%`}}/>
           </div>
           <p className="text-sm font-bold">{pctLabel(percent(team))}</p>
           <p className="text-[11px] text-neutral-500">Jami {team.members.length} a’zo</p>
         </div>)}
       </div>
       <p className="text-center text-sm font-semibold">{compareText}</p>
       <p className="text-center text-xs text-neutral-500">G‘olib oylik maqsad bajarilish foizi bo‘yicha belgilanadi, teng foizda ko‘proq qabul qilgan jamoa oldinda.</p>
     </Card>
     <Card className="space-y-3 p-4 sm:p-5">
       <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Jamoa a’zolari reytingi</h2><Crown size={18} className="text-amber-500"/></div>
       <div className="flex items-center gap-2">
         {all.map(team=><button key={team.code} type="button" onClick={()=>setSelected(team.code)}
           className={clsx('flex-1 rounded-xl px-3 py-2 text-sm font-semibold',selected===team.code?
             team.code==='alpha'?'bg-rose-600 text-white':'bg-blue-600 text-white':'bg-neutral-100 text-neutral-700')}>
             {TEAM[team.code].name}</button>)}
       </div>
       {sorted.length===0&&<p className="py-3 text-sm text-neutral-500">Bu jamoada hali operator yo‘q.</p>}
       <div className="divide-y divide-neutral-100">
         {sorted.map((p,i)=><div key={p.operator_id} className="flex items-center gap-3 py-3">
           <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',selected==='alpha'?'bg-rose-100 text-rose-700':'bg-blue-100 text-blue-700')}>
             {i+1}</span>
           <div className="min-w-0 flex-1">
             <p className="truncate text-sm font-semibold">{p.full_name}{p.operator_id===profile?.id?' (siz)':''}</p>
             <p className="text-xs text-neutral-500">Ishlagan: {p.worked_days} kun · Yashil: {p.green_days} kun</p>
           </div>
           <b className="shrink-0 tabular-nums">{formatNumber(Number(p.accepted_orders))}</b>
         </div>)}
       </div>
     </Card>
   </>}
 </div>;
}
