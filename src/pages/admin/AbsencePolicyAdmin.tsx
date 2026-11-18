import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Save } from 'lucide-react';
import { Card, Field, Input, Button, ErrorState, LoadingBlock, Notice, useToast } from '@/components/ui';
import { useAbsencePolicy } from '@/lib/wallet';
import { supabase, unwrap } from '@/lib/supabase';
import { tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';

export default function AbsencePolicyAdmin() {
 const q=useAbsencePolicy();
 const qc=useQueryClient();
 const toast=useToast();
 const [amount,setAmount]=useState('0');
 const [from,setFrom]=useState(tashkentToday());
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   if(q.data?.[0]){
     setAmount(String(q.data[0].amount_uzs));
     setFrom(q.data[0].effective_from);
   }
 },[q.data]);
 async function save(e:FormEvent) {
  e.preventDefault();
  if(!/^\d+$/.test(amount)||!Number.isSafeInteger(Number(amount))||!from)
    return toast('error','Jarima miqdori va boshlanish sanasini kiriting.');
  setBusy(true);
  try {
    await unwrap(supabase.rpc('admin_set_absence_policy',{p_amount:Number(amount),p_date:from}));
    await Promise.all([
      qc.invalidateQueries({queryKey:['operator-absence-policy']}),
      qc.invalidateQueries({queryKey:['operator-missing-days']}),
      qc.invalidateQueries({queryKey:['operator-wallet']})
    ]);
    toast('success','Ishlanmagan kunlar jarimasi saqlandi.');
  }catch(err){toast('error',humanError(err));}finally{setBusy(false);}
 }
 return <Card className="space-y-3 p-4 sm:p-5">
   <h2 className="flex items-center gap-2 font-bold"><CalendarOff size={20} className="text-red-500"/>Kunlik hisobot bo‘lmasa — jarima</h2>
   <Notice tone="info">Hisobot topshirilmagan avvalgi kun ishlanmagan hisoblanadi. Admin qayd etgan ta’til va dam olish kuni uchun jarima yo‘q. Jarima balansdan avtomatik ayriladi; qabul natijalari va KPI tarixi o‘chirilmaydi.</Notice>
   {q.isLoading&&<LoadingBlock rows={1}/>}
   {q.isError&&<ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/>}
   <form onSubmit={save} className="space-y-3">
     <div className="grid gap-3 sm:grid-cols-2">
       <Field label="Bitta kun jarimasi (so‘m)">
         <Input type="number" min="0" step="1000" value={amount} onChange={e=>setAmount(e.target.value)} />
       </Field>
       <Field label="Qaysi kundan hisoblash">
         <Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
       </Field>
     </div>
     <p className="text-xs text-neutral-500">0 so‘m — jarimasiz rejim. Boshlanish sanasini o‘tmishga o‘zgartirish oldingi ishlanmagan kunlar uchun ham jarima hisoblaydi.</p>
     <Button type="submit" loading={busy} disabled={q.isError}><Save size={17}/>Jarima qoidasini saqlash</Button>
   </form>
 </Card>;
}
