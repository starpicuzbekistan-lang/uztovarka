import { useState } from 'react';
import { CircleCheck, Clock3, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { currentColorThresholds, useDayColorRules } from '@/lib/dayColors';
import WalletAdmin from './WalletAdmin';
import AbsencePolicyAdmin from './AbsencePolicyAdmin';
import AcceptancePaymentAdmin from './AcceptancePaymentAdmin';
import { PageHeader, Card, Segmented } from '@/components/ui';

type Tab='wallet'|'rules';

export default function KpiPayroll(){
 const [tab,setTab]=useState<Tab>('wallet');
 return <div className="space-y-4">
  <PageHeader title="KPI va oyliklar" subtitle="Kunlik me’yor bajarilganda qabul × 1 000, tasdiqlangan sotuv × 5 000; Asosiy va Hold balanslar."/>
  <Segmented<Tab> value={tab} onChange={setTab} options={[
   {value:'wallet',label:'Balanslarni boshqarish'},
   {value:'rules',label:'KPI mezonlari'}
  ]}/>
  {tab==='wallet'?<WalletAdmin/>:<KpiRules/>}
 </div>;
}

function KpiRules(){
 const q=useDayColorRules();
 const {red_below,green_from}=currentColorThresholds(q.data);
 return <div className="space-y-4"><AcceptancePaymentAdmin/><AbsencePolicyAdmin/><Card className="space-y-4 p-4 sm:p-5">
  <h2 className="font-bold">Kunlik KPI rang limitlari</h2>
  <p className="text-sm text-neutral-600">Yashil, sariq va qizil kunlar uchun sonli chegaralarni administrator o‘rnatadi. Oylik balansidagi qabul puli me’yori bundan mustaqil boshqariladi.</p>
  {q.isError&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">018 SQL migratsiyasi o‘rnatilmagan bo‘lishi mumkin. Hozircha avvalgi 40/50 qiymatlari ko‘rsatilmoqda.</p>}
  <div className="grid gap-2">
   <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3 text-green-800">
    <CircleCheck size={20}/><div className="flex-1"><b>Yashil kun</b><p className="text-sm">{green_from} ta va undan ko‘p tasdiqlangan qabul</p></div><b>≥ {green_from}</b>
   </div>
   <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-amber-800">
    <Clock3 size={20}/><div className="flex-1"><b>Sariq kun</b><p className="text-sm">{red_below}–{green_from-1} ta tasdiqlangan qabul</p></div><b>{red_below}–{green_from-1}</b>
   </div>
   <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-red-800">
    <ShieldCheck size={20}/><div className="flex-1"><b>Qizil kun</b><p className="text-sm">{red_below} tadan kam qabul</p></div><b>0–{red_below-1}</b>
   </div>
  </div>
  <Link to="/admin/kun-ranglari" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-ink">Rang limitlarini o‘zgartirish</Link>
  <p className="text-xs text-neutral-500">Ranglar reyting, badge va nazorat uchun. Qabul/Sotuv balansi hisoblash qoidalari alohida saqlanadi.</p>
 </Card></div>;
}
