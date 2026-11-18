import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CalendarClock, Target } from 'lucide-react';
import { useAcceptanceThreshold } from '@/lib/acceptance';
import { supabase, unwrap } from '@/lib/supabase';
import { tashkentToday, parseIso } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Button, Card, ErrorState, Field, Input, LoadingBlock, Notice, useToast } from '@/components/ui';

const today=tashkentToday();
const t=parseIso(today);
const tomorrow=new Date(Date.UTC(t.y,t.m-1,t.d+1)).toISOString().slice(0,10);
export default function AcceptancePaymentAdmin(){
 const qc=useQueryClient(),toast=useToast();
 const current=useAcceptanceThreshold(tashkentToday());
 const [minimum,setMinimum]=useState('50');
 const [effective,setEffective]=useState(tomorrow);
 const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();
  const val=Number(minimum);
  if(!Number.isSafeInteger(val)||val<1||val>100000||effective<=tashkentToday()){
   toast('error','Me’yor 1–100 000 oralig‘ida bo‘lsin va sana ertadan boshlansin.');
   return;
  }
  setBusy(true);
  try{
   await unwrap(supabase.rpc('admin_set_acceptance_payment_threshold',{p_min:val,p_from:effective}));
   await Promise.all([
    qc.invalidateQueries({queryKey:['acceptance-threshold']}),
    qc.invalidateQueries({queryKey:['acceptance-month']}),
    qc.invalidateQueries({queryKey:['operator-wallet']}),
   ]);
   toast('success',`Kunlik qabul to‘lovi me’yori ${effective} sanadan ${val} ta qilib belgilandi.`);
  }catch(err){toast('error',humanError(err));}finally{setBusy(false);}
 }
 return <Card className="space-y-3 p-4 sm:p-5">
  <h2 className="flex items-center gap-2 font-bold"><Target size={20} className="text-amber-600"/>Qabul puli uchun kunlik me’yor</h2>
  <Notice tone="info">
    Operator bir kunda belgilangan son yoki undan ko‘p <b>tasdiqlangan qabul</b> qilsa,
    shu kundagi <b>barcha qabullari × 1 000 so‘m</b> Asosiy balansga qo‘shiladi.
    Kam bo‘lsa, qabul uchun 0 so‘m. Sotuv uchun 5 000 so‘m va Hold balans bunga bog‘liq emas.
  </Notice>
  {current.isLoading?<LoadingBlock rows={1}/>:
   current.isError?<ErrorState message="Kunlik to‘lov me’yorini yuklab bo‘lmadi. 015 SQL migratsiyasini tekshiring." onRetry={()=>void current.refetch()}/>:
   <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-3">
      <span className="text-sm font-medium text-amber-950">Hozirgi qabul puli me’yori</span>
      <strong className="text-2xl text-ink">{current.data===0?'Eski qoida':`${current.data} ta`}</strong>
    </div>}
  <form onSubmit={submit} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Yangi minimum qabul (ta)">
        <Input type="number" min="1" max="100000" value={minimum} onChange={e=>setMinimum(e.target.value)}/>
      </Field>
      <Field label="Qaysi sanadan kuchga kiradi?">
        <Input type="date" min={tomorrow} value={effective} onChange={e=>setEffective(e.target.value)}/>
      </Field>
    </div>
    <div className="flex items-start gap-2 text-xs text-neutral-600">
      <CalendarClock size={16} className="shrink-0 text-amber-700"/>
      Qoidani faqat ertangi yoki kelajak sanadan o‘zgartirish mumkin. Oldin ishlab topilgan pul kamaymaydi.
    </div>
    <Button type="submit" loading={busy} disabled={current.isError}>
      <CheckCircle2 size={17}/>Yangi me’yorni saqlash
    </Button>
  </form>
 </Card>;
}
