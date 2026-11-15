import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Button, Card, ErrorState, Field, Input, LoadingBlock, Notice, Select, useToast } from '@/components/ui';

interface RankPrizes { month_start: string; first_uzs: number; second_uzs: number; third_uzs: number }
interface SalesMonth { operator_id: string; month_start: string; unique_calls: number; sold_orders: number }
const positiveWhole = (v: string) => /^\d+$/.test(v.trim()) && Number.isSafeInteger(Number(v)) && Number(v) >= 0;

export default function OperatorRewardsSales() {
  return <div className="space-y-4"><PrizeEditor /><SalesEditor /></div>;
}

function PrizeEditor() {
  const today = tashkentToday();
  const [month,setMonth] = useState(today.slice(0,7));
  const [first,setFirst] = useState(''); const [second,setSecond] = useState(''); const [third,setThird] = useState('');
  const [busy,setBusy] = useState(false);
  const { profile } = useAuth();
  const toast = useToast(); const qc = useQueryClient();
  const monthStart = `${month}-01`;
  const q = useQuery({queryKey:['monthly-prizes',monthStart],queryFn:async()=> (
    (await unwrap(supabase.from('monthly_rank_prizes').select('*').eq('month_start',monthStart))) as RankPrizes[])[0]??null});
  useEffect(()=>{setFirst(q.data ? String(q.data.first_uzs):'');setSecond(q.data ? String(q.data.second_uzs):'');setThird(q.data ? String(q.data.third_uzs):'');},[q.data,month]);
  async function save(e:FormEvent) {
    e.preventDefault();
    if (![first,second,third].every(positiveWhole)) return toast('error','Uchala mukofot summasini manfiy bo‘lmagan butun son bilan kiriting.');
    setBusy(true);
    try {
      await unwrap(supabase.from('monthly_rank_prizes').upsert({month_start:monthStart,first_uzs:Number(first),second_uzs:Number(second),third_uzs:Number(third),updated_by:profile?.id,updated_at:new Date().toISOString()},{onConflict:'month_start'}));
      await qc.invalidateQueries({queryKey:['monthly-prizes']});toast('success','Oylik mukofotlar saqlandi.');
    } catch(e){toast('error',humanError(e));}finally{setBusy(false);}
  }
  return <Card className="space-y-3 p-4">
    <h2 className="font-bold">🏆 TOP-3 pul mukofotlari</h2>
    <p className="text-xs text-neutral-500">Operatorlar reytingining yuqorisida ko‘rinadi. Har oy uchun alohida summa belgilang.</p>
    <Field label="Mukofot oyi"><Input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></Field>
    {q.isLoading && <LoadingBlock rows={2}/>}
    {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
    {!q.isLoading && !q.isError && <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
      <Field label="🥇 1-o‘rin (so‘m)"><Input inputMode="numeric" value={first} onChange={e=>setFirst(e.target.value)} placeholder="500000" /></Field>
      <Field label="🥈 2-o‘rin (so‘m)"><Input inputMode="numeric" value={second} onChange={e=>setSecond(e.target.value)} placeholder="300000" /></Field>
      <Field label="🥉 3-o‘rin (so‘m)"><Input inputMode="numeric" value={third} onChange={e=>setThird(e.target.value)} placeholder="150000" /></Field>
      <Button type="submit" className="sm:col-span-3" loading={busy}>Mukofotlarni saqlash</Button>
    </form>}
  </Card>;
}

function SalesEditor() {
  const [operator,setOperator] = useState('');
  const [salesMonth,setSalesMonth] = useState(tashkentToday().slice(0,7));
  const salesMonthStart = `${salesMonth}-01`;
  const [calls,setCalls] = useState(''); const [sold,setSold] = useState('');
  const [busy,setBusy] = useState(false);
  const { profile } = useAuth(); const qc = useQueryClient();const toast = useToast();
  const ops = useQuery({queryKey:['sales-operators'],queryFn:async()=>await unwrap(
    supabase.from('profiles').select('id,full_name').eq('role','operator').eq('is_active',true).order('full_name')) as {id:string;full_name:string}[]});
  const q=useQuery({queryKey:['sales-month',operator,salesMonthStart],enabled:!!operator,queryFn:async()=> (
    (await unwrap(supabase.from('operator_sales_monthly').select('*').eq('operator_id',operator).eq('month_start',salesMonthStart))) as SalesMonth[])[0]??null});
  useEffect(()=>{setCalls(q.data?String(q.data.unique_calls):'');setSold(q.data?String(q.data.sold_orders):'');},[q.data,operator,salesMonthStart]);
  async function save(e:FormEvent) {
    e.preventDefault();
    if(!operator||!salesMonth)return toast('error','Operator va sanani tanlang.');
    if(!positiveWhole(calls)||!positiveWhole(sold))return toast('error','Unique Calls va Sotuvga manfiy bo‘lmagan butun son kiriting.');
    setBusy(true);
    try {
      await unwrap(supabase.from('operator_sales_monthly').upsert({operator_id:operator,month_start:salesMonthStart,unique_calls:Number(calls),sold_orders:Number(sold),entered_by:profile?.id,updated_at:new Date().toISOString()},{onConflict:'operator_id,month_start'}));
      await Promise.all([
        qc.invalidateQueries({queryKey:['sales-month']}),
        qc.invalidateQueries({queryKey:['sales-metrics']}),
        qc.invalidateQueries({queryKey:['gold-progress']}),
        qc.invalidateQueries({queryKey:['gold-verified-operators']}),
      ]);
      toast('success','Oylik Unique Calls va Sotuv saqlandi.');
    } catch(e){toast('error',humanError(e));}finally{setBusy(false);}
  }
  return <Card className="space-y-3 p-4">
    <h2 className="font-bold">Oylik savdo ko‘rsatkichlari — Admin</h2>
    <Notice tone="info">Unique Calls — shu oy bog‘langan takrorlanmagan mijozlar. Sotuv — shu oyning qabul qilingan buyurtmalaridan sotilganlari. Operatorning Qabul natijasi faqat tasdiqlangan hisobotdan olinadi.</Notice>
    {ops.isError && <ErrorState message={humanError(ops.error)} onRetry={()=>void ops.refetch()}/>}
    <form onSubmit={save} className="space-y-3">
      <Field label="Operator"><Select value={operator} onChange={e=>setOperator(e.target.value)}><option value="">Operatorni tanlang</option>{(ops.data??[]).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</Select></Field>
      <Field label="Hisobot oyi"><Input type="month" max={tashkentToday().slice(0,7)} value={salesMonth} onChange={e=>setSalesMonth(e.target.value)} /></Field>
      {q.isLoading && <LoadingBlock rows={1} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unique Calls"><Input inputMode="numeric" value={calls} onChange={e=>setCalls(e.target.value)} placeholder="0" /></Field>
        <Field label="Sotilgan buyurtmalar"><Input inputMode="numeric" value={sold} onChange={e=>setSold(e.target.value)} placeholder="0" /></Field>
      </div>
      <Button type="submit" className="w-full" disabled={!operator||q.isLoading||q.isError} loading={busy}>Oylik savdo natijasini saqlash</Button>
    </form>
    <p className="text-xs text-neutral-500">Har bir operator uchun oy yakunidagi Unique Calls va Sotuv jami kiritiladi. 0 ham aniq kiritilgan natija. Oldingi oy qiymatini qayta saqlash orqali tuzatish mumkin.</p>
  </Card>;
}
