import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, Field, Input, LoadingBlock, Notice, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';

type TeamCode='alpha'|'beta';
type Op={id:string;full_name:string};
type Goal={operator_id:string;month_start:string;target_orders:number};
type TeamGoal={team_code:TeamCode;month_start:string;target_orders:number};
type Assignment={operator_id:string;effective_month:string;team_code:TeamCode};
const valid=(v:string)=>/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)>0;

export default function TeamGoalsAdmin() {
 const [month,setMonth]=useState(tashkentToday().slice(0,7));
 const [operator,setOperator]=useState('');
 const [opTarget,setOpTarget]=useState('');
 const [aTarget,setATarget]=useState('');
 const [bTarget,setBTarget]=useState('');
 const [team,setTeam]=useState<TeamCode>('alpha');
 const [saving,setSaving]=useState('');
 const {profile}=useAuth();const toast=useToast();const qc=useQueryClient();
 const start=`${month}-01`;
 const ops=useQuery({queryKey:['team-admin-operators'],queryFn:async()=>
  await unwrap(supabase.from('profiles').select('id,full_name').eq('role','operator').order('full_name')) as Op[]});
 const goals=useQuery({queryKey:['team-admin-op-goals',start],queryFn:async()=>
  await unwrap(supabase.from('operator_monthly_goals').select('operator_id,month_start,target_orders').eq('month_start',start)) as Goal[]});
 const teamGoals=useQuery({queryKey:['team-admin-goals',start],queryFn:async()=>
  await unwrap(supabase.from('team_monthly_goals').select('team_code,month_start,target_orders').eq('month_start',start)) as TeamGoal[]});
 const assigns=useQuery({queryKey:['team-admin-assign',operator,start],enabled:!!operator,queryFn:async()=>
  await unwrap(supabase.from('operator_team_assignments').select('operator_id,effective_month,team_code')
    .eq('operator_id',operator).lte('effective_month',start).order('effective_month',{ascending:false}).limit(1)) as Assignment[]});
 useEffect(()=>setOpTarget(goals.data?.find(x=>x.operator_id===operator)?.target_orders?.toString()??''),[goals.data,operator,month]);
 useEffect(()=>{setATarget(teamGoals.data?.find(x=>x.team_code==='alpha')?.target_orders?.toString()??'');
   setBTarget(teamGoals.data?.find(x=>x.team_code==='beta')?.target_orders?.toString()??'');},[teamGoals.data,month]);
 useEffect(()=>{setTeam(assigns.data?.[0]?.team_code??'alpha');},[assigns.data,operator]);
 async function saveOperator(e:FormEvent) {
   e.preventDefault();if(!operator||!valid(opTarget))return toast('error','Operatorni tanlab, maqsadni musbat butun son bilan kiriting.');
   setSaving('operator');
   try {
    await unwrap(supabase.from('operator_monthly_goals').upsert({operator_id:operator,month_start:start,target_orders:Number(opTarget),updated_by:profile?.id,updated_at:new Date().toISOString()},{onConflict:'operator_id,month_start'}));
    await Promise.all([qc.invalidateQueries({queryKey:['team-admin-op-goals']}),qc.invalidateQueries({queryKey:['operator-month-goal']}),qc.invalidateQueries({queryKey:['operator-badges']})]);
    toast('success','Operatorning oylik maqsadi saqlandi.');
   }catch(err){toast('error',humanError(err));}finally{setSaving('');}
 }
 async function saveTeams(e:FormEvent) {
   e.preventDefault();if(!valid(aTarget)||!valid(bTarget))return toast('error','Ikkala jamoa uchun musbat oylik maqsad belgilang.');
   setSaving('teams');
   try {
    await unwrap(supabase.from('team_monthly_goals').upsert([
      {team_code:'alpha',month_start:start,target_orders:Number(aTarget),updated_by:profile?.id,updated_at:new Date().toISOString()},
      {team_code:'beta',month_start:start,target_orders:Number(bTarget),updated_by:profile?.id,updated_at:new Date().toISOString()}
     ],{onConflict:'team_code,month_start'}));
    await Promise.all([qc.invalidateQueries({queryKey:['team-admin-goals']}),qc.invalidateQueries({queryKey:['team-dashboard']}),qc.invalidateQueries({queryKey:['operator-badges']})]);
    toast('success','Jamoa maqsadlari saqlandi.');
   }catch(err){toast('error',humanError(err));}finally{setSaving('');}
 }
 async function assign(e:FormEvent) {
  e.preventDefault();if(!operator)return toast('error','Operator tanlang.');
  setSaving('assign');
  try {
    await unwrap(supabase.from('operator_team_assignments').upsert({operator_id:operator,effective_month:start,team_code:team,assigned_by:profile?.id,updated_at:new Date().toISOString()},{onConflict:'operator_id,effective_month'}));
    await Promise.all([qc.invalidateQueries({queryKey:['team-admin-assign']}),qc.invalidateQueries({queryKey:['team-dashboard']}),qc.invalidateQueries({queryKey:['operator-badges']})]);
    toast('success','Operator jamoasi saqlandi.');
  }catch(err){toast('error',humanError(err));}finally{setSaving('');}
 }
 return <Card className="space-y-4 p-4 sm:p-5">
  <h2 className="font-bold">Oylik maqsadlar va jamoalar</h2>
  <Notice tone="info">Alpha — qizil, Beta — ko‘k. Bu maqsadlar motivatsiya uchun; mavjud KPI va maosh hisoblash qoidalarini o‘zgartirmaydi.</Notice>
  <Field label="Oy"><Input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></Field>
  {ops.isError && <ErrorState message={humanError(ops.error)} onRetry={()=>void ops.refetch()}/>}
  {(goals.isLoading||teamGoals.isLoading) && <LoadingBlock rows={1}/>}
  {(goals.isError||teamGoals.isError)&&<ErrorState message={humanError(goals.error??teamGoals.error)} onRetry={()=>{void goals.refetch();void teamGoals.refetch();}}/>}
  <div className="space-y-3 border-t border-neutral-100 pt-3">
   <h3 className="text-sm font-bold">Shaxsiy oylik maqsad</h3>
   <Field label="Operator"><Select value={operator} onChange={e=>setOperator(e.target.value)}>
    <option value="">Operatorni tanlang</option>
    {(ops.data??[]).map(o=><option key={o.id} value={o.id}>{o.full_name}</option>)}
   </Select></Field>
   <form onSubmit={saveOperator} className="flex flex-wrap items-end gap-2">
    <div className="min-w-[140px] flex-1"><Field label="Maqsad (qabul)"><Input type="number" min="1" value={opTarget} onChange={e=>setOpTarget(e.target.value)}/></Field></div>
    <Button type="submit" disabled={!operator} loading={saving==='operator'}>Saqlash</Button>
   </form>
  </div>
  <form onSubmit={saveTeams} className="space-y-3 border-t border-neutral-100 pt-3">
   <h3 className="text-sm font-bold">Jamoalarning oylik maqsadlari</h3>
   <div className="grid grid-cols-2 gap-3">
    <Field label="🔴 Team Alpha"><Input type="number" min="1" value={aTarget} onChange={e=>setATarget(e.target.value)}/></Field>
    <Field label="🔵 Team Beta"><Input type="number" min="1" value={bTarget} onChange={e=>setBTarget(e.target.value)}/></Field>
   </div>
   <Button type="submit" loading={saving==='teams'}>Jamoa maqsadlarini saqlash</Button>
  </form>
  <form onSubmit={assign} className="space-y-3 border-t border-neutral-100 pt-3">
   <h3 className="text-sm font-bold">Operatorni jamoaga biriktirish</h3>
   <p className="text-xs text-neutral-500">Yuqorida tanlangan operator uchun belgilangan oydan boshlab jamoa tanlanadi. Oldingi oylar o‘zgarmaydi.</p>
   <Field label="Jamoa"><Select value={team} onChange={e=>setTeam(e.target.value as TeamCode)}>
    <option value="alpha">🔴 Team Alpha</option><option value="beta">🔵 Team Beta</option>
   </Select></Field>
   <Button type="submit" disabled={!operator||assigns.isLoading} loading={saving==='assign'}>Jamoani saqlash</Button>
  </form>
 </Card>;
}
