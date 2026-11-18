import { useState } from 'react';
import { CircleCheck, Clock3, ShieldCheck } from 'lucide-react';
import WalletAdmin from './WalletAdmin';
import { PageHeader, Card, Segmented } from '@/components/ui';

type Tab='wallet'|'rules';

export default function KpiPayroll(){
 const [tab,setTab]=useState<Tab>('wallet');
 return <div className="space-y-4">
  <PageHeader title="KPI va oyliklar" subtitle="Yangi tizim: qabul 1 000 so‘m + tasdiqlangan sotuv 5 000 so‘m, Hold va Asosiy balanslar."/>
  <Segmented<Tab> value={tab} onChange={setTab} options={[
   {value:'wallet',label:'Balanslarni boshqarish'},
   {value:'rules',label:'KPI mezonlari'}
  ]}/>
  {tab==='wallet'?<WalletAdmin/>:<KpiRules/>}
 </div>;
}

function KpiRules(){
 return <Card className="space-y-4 p-4 sm:p-5">
  <h2 className="font-bold">Kunlik KPI mezonlari</h2>
  <p className="text-sm text-neutral-600">Yangi qoidalar 012 SQL migratsiyasi orqali amaldagi umumiy va shaxsiy sozlamalarga yoziladi. Bu mezonlar faqat kunlik natija ranglari, reyting va badge'larni belgilaydi. Balansga jarima yoki bonus avtomatik qo‘shmaydi.</p>
  <div className="grid gap-2">
   <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3 text-green-800">
    <CircleCheck size={20}/><div className="flex-1"><b>Yashil kun</b><p className="text-sm">50 ta va undan ko‘p tasdiqlangan qabul</p></div><b>≥ 50</b>
   </div>
   <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-amber-800">
    <Clock3 size={20}/><div className="flex-1"><b>Sariq kun</b><p className="text-sm">40–49 ta tasdiqlangan qabul</p></div><b>40–49</b>
   </div>
   <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-red-800">
    <ShieldCheck size={20}/><div className="flex-1"><b>Qizil kun</b><p className="text-sm">40 tadan kam qabul</p></div><b>0–39</b>
   </div>
  </div>
  <p className="text-xs text-neutral-500">Eski 2 mln so‘mlik baza hamda KPI jarima/bonuslari yangi oylik balansini hisoblashda ishlatilmaydi. Tarixiy yozuvlar ma’lumotlar bazasida saqlanadi.</p>
 </Card>;
}
