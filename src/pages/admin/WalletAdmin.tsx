import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDollarSign, Gift, Wallet } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useWallet, type WalletMovement } from '@/lib/wallet';
import { formatNumber, formatUzs } from '@/lib/format';
import { formatDateTimeUz, tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Card, Button, ErrorState, Field, Input, LoadingBlock, Notice, Select, useToast } from '@/components/ui';
import { WalletOverview } from '@/components/WalletBalances';

type Op={id:string;full_name:string};
type Sales={sold_orders:number;unique_calls:number};
type Approved={confirmed_orders:number};
const validPositive=(v:string)=>/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)>0;

export default function WalletAdmin() {
 const [op,setOp]=useState('');
 const [month,setMonth]=useState(tashkentToday().slice(0,7));
 const [confirmCount,setConfirmCount]=useState('');
 const [payment,setPayment]=useState('');
 const [paymentNote,setPaymentNote]=useState('');
 const [bonus,setBonus]=useState('');
 const [bonusNote,setBonusNote]=useState('');
 const [busy,setBusy]=useState<'sales'|'payment'|'bonus'|null>(null);
 const toast=useToast();const qc=useQueryClient();
 const start=`${month}-01`;
 const ops=useQuery({queryKey:['wallet-admin-operators'],queryFn:async()=>await unwrap(supabase.from('profiles')
   .select('id,full_name').eq('role','operator').order('full_name')) as Op[]});
 const wallet=useWallet(op||undefined);
 const sales=useQuery({queryKey:['wallet-admin-sales',op,start],enabled:!!op,queryFn:async()=>
   ((await unwrap(supabase.from('operator_sales_monthly').select('sold_orders,unique_calls')
     .eq('operator_id',op).eq('month_start',start))) as Sales[])[0]??null});
 const approved=useQuery({queryKey:['wallet-admin-approved-sales',op,start],enabled:!!op,queryFn:async()=>
   ((await unwrap(supabase.from('wallet_sales_confirmations').select('confirmed_orders')
     .eq('operator_id',op).eq('month_start',start))) as Approved[])[0]??null});
 const monthReports=useQuery({queryKey:['wallet-admin-accepted-month',op,start],enabled:!!op,queryFn:async()=>await unwrap(supabase.from('daily_reports')
   .select('accepted_orders').eq('operator_id',op).eq('status','approved').eq('is_demo',false)
   .gte('report_date',start).lt('report_date',new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)))
   as {accepted_orders:number}[]});
 const movements=useQuery({queryKey:['wallet-admin-movements',op],enabled:!!op,queryFn:async()=>await unwrap(supabase.from('wallet_movements')
  .select('id,operator_id,action,amount_uzs,note,created_at').eq('operator_id',op)
  .order('created_at',{ascending:false}).limit(30)) as WalletMovement[]});
 const reported=Number(sales.data?.sold_orders??0);
 const confirmed=Number(approved.data?.confirmed_orders??0);
 const pending=Math.max(0,reported-confirmed);
 const accepted=(monthReports.data??[]).reduce((s,r)=>s+Number(r.accepted_orders),0);
 const selectable=ops.data?.find(o=>o.id===op)?.full_name??'Operator';
 const refresh=async()=>{
  await Promise.all([
   qc.invalidateQueries({queryKey:['operator-wallet']}),
   qc.invalidateQueries({queryKey:['wallet-admin-approved-sales']}),
   qc.invalidateQueries({queryKey:['wallet-admin-movements']}),
   qc.invalidateQueries({queryKey:['sales-metrics']})
  ]);
 };
 useEffect(()=>setConfirmCount(''),[op,month]);
 async function confirmSales(e:FormEvent) {
  e.preventDefault();
  if(!op||!validPositive(confirmCount))return toast('error','Tasdiqlash sonini kiriting.');
  if(Number(confirmCount)>pending)return toast('error','Hold balansda yetarli sotuv yo‘q.');
  if(confirmed+Number(confirmCount)>accepted)return toast('error','Sotuv soni tasdiqlangan qabullardan ko‘p bo‘la olmaydi.');
  setBusy('sales');
  try {
   await unwrap(supabase.rpc('admin_confirm_wallet_sales',{p_operator:op,p_month:start,p_count:Number(confirmCount)}));
   setConfirmCount(''); await refresh();
   toast('success','Sotuv tasdiqlandi: Hold → Asosiy balans.');
  }catch(err){toast('error',humanError(err));}finally{setBusy(null);}
 }
 async function submitMovement(e:FormEvent,action:'bonus'|'payment') {
  e.preventDefault();
  const amount=action==='bonus'?bonus:payment;
  const note=action==='bonus'?bonusNote:paymentNote;
  if(!op||!validPositive(amount)||!note.trim())return toast('error','Musbat summa va sababni kiriting.');
  if(action==='payment'&&Number(amount)>Number(wallet.data?.main_balance??0))return toast('error','Asosiy balansda buncha mablag‘ yo‘q.');
  setBusy(action);
  const requestKey=crypto.randomUUID();
  try {
   await unwrap(supabase.rpc('admin_wallet_movement',{
     p_operator:op,p_action:action,p_amount:Number(amount),p_note:note.trim(),p_request_key:requestKey
   }));
   if(action==='bonus'){setBonus('');setBonusNote('');}
   else{setPayment('');setPaymentNote('');}
   await refresh();
   toast('success',action==='bonus'?'Bonus balansga qo‘shildi.':'To‘lov balansdan ayrildi va tarixga yozildi.');
  }catch(err){toast('error',humanError(err));}finally{setBusy(null);}
 }
 return <div className="space-y-4">
  <Notice tone="info">Yangi tizim: tasdiqlangan qabul uchun 1 000 so‘m, tasdiqlangan sotuv uchun qo‘shimcha 5 000 so‘m. Sotuv tasdiqlanmaguncha Hold’da turadi. “To‘lovni qayd etish” bank orqali haqiqiy o‘tkazma qilmaydi.</Notice>
  <Card className="space-y-3 p-4">
   <Field label="Operator"><Select value={op} onChange={e=>setOp(e.target.value)}>
    <option value="">Operatorni tanlang</option>
    {(ops.data??[]).map(x=><option value={x.id} key={x.id}>{x.full_name}</option>)}
   </Select></Field>
   {ops.isError&&<ErrorState message={humanError(ops.error)} onRetry={()=>void ops.refetch()}/>}
   {op&&wallet.isLoading&&<LoadingBlock rows={2}/>}
   {op&&wallet.isError&&<ErrorState message={humanError(wallet.error)} onRetry={()=>void wallet.refetch()}/>}
   {wallet.data&&<WalletOverview wallet={wallet.data}/>}
  </Card>
  {op&&<>
   <Card className="space-y-3 p-4">
    <h2 className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-green-600"/>Sotuvlarni tasdiqlash</h2>
    <Field label="Hisobot oyi"><Input type="month" max={tashkentToday().slice(0,7)} value={month} onChange={e=>setMonth(e.target.value)} /></Field>
    {(sales.isLoading||approved.isLoading||monthReports.isLoading)&&<LoadingBlock rows={1}/>}
    {(sales.isError||approved.isError||monthReports.isError)&&<ErrorState message={humanError(sales.error??approved.error??monthReports.error)} onRetry={()=>{void sales.refetch();void approved.refetch();void monthReports.refetch();}}/>}
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
     <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-500">Tasdiqlangan qabul</p><b>{formatNumber(accepted)}</b></div>
     <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-500">Kiritilgan sotuv</p><b>{formatNumber(reported)}</b></div>
     <div className="rounded-xl bg-green-50 p-3"><p className="text-xs text-green-700">Tasdiqlangan sotuv</p><b>{formatNumber(confirmed)}</b></div>
     <div className="rounded-xl bg-yellow-50 p-3"><p className="text-xs text-yellow-800">Hold</p><b>{formatNumber(pending)} ta</b></div>
    </div>
    {!sales.data&&<Notice tone="warn">Sotuv soni hali kiritilmagan. Admin → Sozlamalar → “Oylik savdo ko‘rsatkichlari”da Unique Calls va Sotuv sonini kiriting.</Notice>}
    <form onSubmit={confirmSales} className="space-y-3">
     <Field label={`Tasdiqlanadigan yangi sotuv soni (maks. ${pending})`}>
      <Input inputMode="numeric" value={confirmCount} onChange={e=>setConfirmCount(e.target.value.replace(/\D/g,''))} placeholder="Masalan, 15" />
     </Field>
     {validPositive(confirmCount)&&<p className="text-sm text-green-700">Asosiy balansga +{formatUzs(Number(confirmCount)*5000)} o‘tadi.</p>}
     <Button type="submit" disabled={!validPositive(confirmCount)||Number(confirmCount)>pending||confirmed+Number(confirmCount)>accepted||busy!==null}
       loading={busy==='sales'} className="w-full">Sotuvni tasdiqlash</Button>
    </form>
   </Card>
   <Card className="space-y-3 p-4">
    <h2 className="flex items-center gap-2 font-bold"><Gift className="h-5 w-5 text-amber-500"/>Qo‘shimcha bonus</h2>
    <form onSubmit={e=>void submitMovement(e,'bonus')} className="space-y-3">
     <Field label="Bonus summasi (so‘m)"><Input inputMode="numeric" value={bonus} onChange={e=>setBonus(e.target.value.replace(/\D/g,''))} /></Field>
     <Field label="Sababi"><Input value={bonusNote} onChange={e=>setBonusNote(e.target.value)} placeholder="Masalan, eng yaxshi natija" /></Field>
     <Button type="submit" className="w-full" disabled={busy!==null} loading={busy==='bonus'}>Asosiy balansga bonus qo‘shish</Button>
    </form>
   </Card>
   <Card className="space-y-3 p-4">
    <h2 className="flex items-center gap-2 font-bold"><CircleDollarSign className="h-5 w-5 text-neutral-600"/>Pul to‘langanini qayd etish</h2>
    <p className="text-xs text-neutral-500">Operatorga tashqi usulda pul berganingizdan keyin qayd eting. Bu amal Asosiy balansni kamaytiradi, KPI statistikasi saqlanadi.</p>
    <form onSubmit={e=>void submitMovement(e,'payment')} className="space-y-3">
     <Field label="To‘langan summa (so‘m)"><Input inputMode="numeric" value={payment} onChange={e=>setPayment(e.target.value.replace(/\D/g,''))} /></Field>
     <Field label="To‘lov izohi"><Input value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="Masalan, karta orqali avans" /></Field>
     <Button type="submit" className="w-full" disabled={busy!==null||!wallet.data} loading={busy==='payment'}><Wallet size={16}/>To‘lovni qayd etish</Button>
    </form>
   </Card>
   <Card className="space-y-3 p-4">
    <h2 className="font-bold">Balans harakatlari · {selectable}</h2>
    {movements.isError&&<ErrorState message={humanError(movements.error)} onRetry={()=>void movements.refetch()}/>}
    {movements.isLoading&&<LoadingBlock rows={2}/>}
    {movements.data?.length===0&&<p className="text-sm text-neutral-500">Bonus yoki to‘lov hali qayd etilmagan.</p>}
    <ul className="divide-y divide-neutral-100">
     {(movements.data??[]).map(m=><li key={m.id} className="flex items-center justify-between gap-2 py-2.5">
       <div className="min-w-0"><p className="truncate text-sm font-semibold">{m.note}</p><p className="text-xs text-neutral-500">{m.action==='bonus'?'Bonus':'To‘lov'} · {formatDateTimeUz(m.created_at)}</p></div>
       <b className={m.action==='bonus'?'text-green-700':'text-neutral-700'}>{m.action==='bonus'?'+':'−'}{formatUzs(Number(m.amount_uzs))}</b>
     </li>)}
    </ul>
   </Card>
  </>}
 </div>;
}
