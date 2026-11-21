import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Clock3, ShieldCheck, Save, History } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { currentColorThresholds, thresholdsAt, useDayColorRules } from '@/lib/dayColors';
import { tashkentToday } from '@/lib/dates';
import { Badge, Button, Card, ErrorState, Field, Input, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { humanError } from '@/lib/uz';

const numberString=(v:number)=>String(v);
export default function AdminDayColors(){
  const {profile}=useAuth(),qc=useQueryClient(),toast=useToast();
  const today=tashkentToday(),rules=useDayColorRules();
  const current=currentColorThresholds(rules.data);
  const [effective,setEffective]=useState(today);
  const [red,setRed]=useState('40');
  const [green,setGreen]=useState('50');
  useEffect(()=>{
    if (!rules.data) return;
    const active=thresholdsAt(effective,rules.data);
    // If a version for the chosen date exists, display its saved values.
    const exact=rules.data.find(r=>r.effective_from===effective);
    setRed(numberString((exact??active).red_below));
    setGreen(numberString((exact??active).green_from));
  },[rules.data,effective]);
  const validation=()=>{
    const r=Number(red),g=Number(green);
    if(!Number.isSafeInteger(r)||r<1||r>=100000) return 'Sariq boshlanishi 1 dan 99 999 gacha butun son bo‘lishi kerak.';
    if(!Number.isSafeInteger(g)||g<=r||g>100000) return 'Yashil boshlanishi sariq boshlanishidan katta bo‘lishi kerak.';
    if(effective<today) return 'O‘tgan sanaga yangi limit kiritib bo‘lmaydi.';
    return null;
  };
  const save=useMutation({
    mutationFn:async()=>{
      if(!profile)throw Error('Admin hisob topilmadi.');
      const e=validation();
      if(e)throw Error(e);
      await unwrap(supabase.from('kpi_color_thresholds').upsert({
        effective_from:effective,red_below:Number(red),green_from:Number(green),updated_by:profile.id,
      },{onConflict:'effective_from'}).select());
    },
    onSuccess:()=>{
      for(const key of ['kpi-color-thresholds','manager-reports','manager-prev-month','team-dashboard','leaderboard','operator-badges','operator-gold','month','admin-reports'])void qc.invalidateQueries({queryKey:[key]});
      toast('success','KPI rang limitlari saqlandi. Tasdiqlangan natijalar shu sanadan boshlab yangi chegaralar bilan baholanadi.');
    },
    onError:e=>toast('error',e instanceof Error?e.message:humanError(e)),
  });
  const redLimit=Number(red),greenLimit=Number(green),valid=!validation();
  function submit(e:FormEvent){e.preventDefault();save.mutate();}
  return <div className="space-y-4">
    <PageHeader title="KPI rang limitlari" subtitle="Admin barcha operatorlar uchun qabul soniga qarab yashil, sariq va qizil kun chegaralarini o‘rnatadi."/>
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Hozirgi chegara</h2>
        <Badge tone="yellow">Global sozlama</Badge>
      </div>
      {rules.isLoading&&<LoadingBlock rows={2}/>}
      {rules.isError&&<ErrorState message="KPI limitlari bazadan yuklanmadi. Supabase SQL Editor’da 018_configurable_kpi_color_thresholds.sql migratsiyasini bajaring." onRetry={()=>void rules.refetch()}/>}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-red-800"><ShieldCheck size={20}/><div><p className="text-xs">Qizil kun</p><b>0–{current.red_below-1}</b></div></div>
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-amber-800"><Clock3 size={20}/><div><p className="text-xs">Sariq kun</p><b>{current.red_below}–{current.green_from-1}</b></div></div>
        <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3 text-green-800"><CircleCheck size={20}/><div><p className="text-xs">Yashil kun</p><b>≥ {current.green_from}</b></div></div>
      </div>
    </Card>
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold">Chegaralarni o‘zgartirish</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sariq boshlanadi (ta)"><Input type="number" min="1" max="99999" step="1" inputMode="numeric" value={red} onChange={e=>setRed(e.target.value)} required/></Field>
        <Field label="Yashil boshlanadi (ta)"><Input type="number" min="2" max="100000" step="1" inputMode="numeric" value={green} onChange={e=>setGreen(e.target.value)} required/></Field>
        <Field label="Qaysi kundan amal qiladi"><Input type="date" min={today} value={effective} onChange={e=>setEffective(e.target.value)} required/></Field>
      </div>
      <p className="text-sm text-neutral-600">Misol: sariq <b>30</b>, yashil <b>50</b> bo‘lsa, qizil 0–29, sariq 30–49, yashil 50 va undan yuqori bo‘ladi.</p>
      {valid&&<div className="grid gap-2 sm:grid-cols-3 text-center text-sm font-bold">
        <div className="rounded-xl bg-red-50 px-3 py-3 text-red-800">Qizil: 0–{redLimit-1}</div>
        <div className="rounded-xl bg-amber-50 px-3 py-3 text-amber-800">Sariq: {redLimit}–{greenLimit-1}</div>
        <div className="rounded-xl bg-green-50 px-3 py-3 text-green-800">Yashil: {greenLimit}+</div>
      </div>}
      {!valid&&<p role="alert" className="text-sm text-rose-700">{validation()}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-xs text-neutral-500">Chegaralar barcha operatorlar, menejer KPI, reyting va badge'larda ushbu sanadan hisoblanadi. Qabul puli va sotuv balansi formulalari mustaqil.</p>
        <Button type="submit" loading={save.isPending} disabled={!valid||rules.isError||rules.isLoading}><Save size={16}/> Saqlash</Button>
      </div>
    </form>
    <Card className="space-y-2 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-bold"><History size={18}/> O‘zgarishlar tarixi</h2>
      {(rules.data??[]).filter(x=>x.effective_from!=='1900-01-01').length===0&&<p className="text-sm text-neutral-500">Hozircha admin yangi chegaralar kiritmagan.</p>}
      {(rules.data??[]).filter(x=>x.effective_from!=='1900-01-01').map(r=><div key={r.effective_from} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 py-2 text-sm">
        <span>{r.effective_from} dan</span>
        <span className="text-neutral-600">Qizil &lt;{r.red_below} · Sariq {r.red_below}–{r.green_from-1} · Yashil ≥{r.green_from}</span>
      </div>)}
    </Card>
  </div>;
}
