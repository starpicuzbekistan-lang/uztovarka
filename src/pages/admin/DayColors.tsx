import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { classifyDay, DEFAULT_SETTINGS, pickSettings, type DayStatus } from '@/lib/kpi';
import { rowToVersion, type SettingsRow } from '@/lib/types';
import { formatDateUz, periodForMonth, tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea, useToast } from '@/components/ui';

type Daily={id:string;operator_id:string;report_date:string;accepted_orders:number;operator:{full_name:string}|null};
type Override={operator_id:string;report_date:string;color:DayStatus;reason:string};
const WORD:Record<DayStatus,string>={green:'Yashil',yellow:'Sariq',red:'Qizil'};
export default function AdminDayColors(){
 const {profile}=useAuth(),toast=useToast(),qc=useQueryClient();
 const [month,setMonth]=useState(tashkentToday().slice(0,7)),[operator,setOperator]=useState('');
 const [edit,setEdit]=useState<Daily|null>(null),[color,setColor]=useState<DayStatus>('green'),[reason,setReason]=useState('');
 const [year,mo]=month.split('-').map(Number);
 const start=month+'-01',end=periodForMonth(year,mo).end;
 const operators=useQuery({queryKey:['day-color-ops'],queryFn:async()=>await unwrap(supabase.from('profiles').select('id,full_name').eq('role','operator').order('full_name')) as {id:string;full_name:string}[]});
 const reports=useQuery({queryKey:['day-color-reports',month,operator],queryFn:async()=>{
   let q=supabase.from('daily_reports').select('id,operator_id,report_date,accepted_orders,operator:profiles!daily_reports_operator_id_fkey(full_name)').eq('status','approved').eq('is_demo',false).gte('report_date',start).lte('report_date',end).order('report_date',{ascending:false}).limit(500);
   if(operator)q=q.eq('operator_id',operator);
   return await unwrap(q) as unknown as Daily[];
 }});
 const versions=useQuery({queryKey:['day-color-settings'],queryFn:async()=>await unwrap(supabase.from('kpi_setting_versions').select('*')) as SettingsRow[]});
 const overrides=useQuery({queryKey:['day-color-overrides',month],queryFn:async()=>await unwrap(supabase.from('operator_day_colors').select('operator_id,report_date,color,reason').gte('report_date',start).lte('report_date',end)) as Override[]});
 const refresh=()=>{for(const key of ['day-color-overrides','day-color-reports','manager-reports','manager-operators'])void qc.invalidateQueries({queryKey:[key]});};
 const save=useMutation({mutationFn:async()=>{
   if(!edit||!profile)return;
   if(reason.trim().length<3)throw Error('Rang o‘zgarish sababini kamida 3 belgi bilan kiriting.');
   await unwrap(supabase.from('operator_day_colors').upsert({
     operator_id:edit.operator_id,report_date:edit.report_date,color,reason:reason.trim(),updated_by:profile.id
   },{onConflict:'operator_id,report_date'}).select());
 },onSuccess:()=>{refresh();setEdit(null);toast('success','Kun rangi saqlandi. Oylik hisobi o‘zgarmadi.');},onError:e=>toast('error',e instanceof Error?e.message:humanError(e))});
 const reset=useMutation({mutationFn:async(row:Daily)=>await unwrap(supabase.from('operator_day_colors').delete().eq('operator_id',row.operator_id).eq('report_date',row.report_date).select()),onSuccess:()=>{refresh();toast('success','Avtomatik rang qayta tiklandi.');},onError:e=>toast('error',humanError(e))});
 const idx=new Map((overrides.data??[]).map(o=>[o.operator_id+'|'+o.report_date,o]));
 const settings=(versions.data??[]).map(rowToVersion);
 function open(row:Daily){const old=idx.get(row.operator_id+'|'+row.report_date);setEdit(row);setColor(old?.color??classifyDay(row.accepted_orders,pickSettings(settings,row.report_date,row.operator_id)??DEFAULT_SETTINGS));setReason(old?.reason??'');}
 return <div className="space-y-4">
   <PageHeader title="KPI kun ranglari" subtitle="Tasdiqlangan kunlarni yashil, sariq yoki qizil deb belgilash. Rang faqat ko‘rsatkichlar nazorati uchun: oylik va balansga ta’sir qilmaydi."/>
   <Card className="space-y-3 p-4">
     <div className="grid gap-3 sm:grid-cols-2"><Field label="Oy"><Input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></Field>
       <Field label="Operator"><Select value={operator} onChange={e=>setOperator(e.target.value)}><option value="">Barcha operatorlar</option>{(operators.data??[]).map(o=><option key={o.id} value={o.id}>{o.full_name}</option>)}</Select></Field>
     </div>
     <p className="text-xs text-neutral-500">Rangni o‘zgartirganda sabab yoziladi va audit tarixida saqlanadi. Tasdiqlanmagan hisobotlarga rang qo‘yilmaydi.</p>
   </Card>
   {reports.isLoading?<LoadingBlock rows={4}/>:reports.isError?<ErrorState message={humanError(reports.error)} onRetry={()=>void reports.refetch()}/>:null}
   {overrides.isError&&<ErrorState message={humanError(overrides.error)} onRetry={()=>void overrides.refetch()}/>}
   {!reports.isLoading&&!reports.data?.length&&<EmptyState title="Tasdiqlangan kunlar topilmadi" hint="Oy yoki operator filtrini o‘zgartiring."/>}
   <div className="space-y-2">
     {(reports.data??[]).map(r=>{
       const old=idx.get(r.operator_id+'|'+r.report_date);
       const auto=classifyDay(r.accepted_orders,pickSettings(settings,r.report_date,r.operator_id)??DEFAULT_SETTINGS);
       const active=old?.color??auto;
       return <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
         <div className="min-w-0"><p className="font-semibold">{r.operator?.full_name??'Operator'}</p>
           <p className="text-xs text-neutral-500">{formatDateUz(r.report_date)} · {r.accepted_orders} ta qabul</p>
         </div>
         <div className="flex flex-wrap items-center gap-2">
           <Badge tone={active}>{WORD[active]}</Badge>
           {old&&<span title={old.reason} className="text-[11px] text-neutral-500">Admin belgisi</span>}
           <Button size="sm" variant="outline" onClick={()=>open(r)}>Belgilash</Button>
           {old&&<Button size="sm" variant="ghost" loading={reset.isPending} onClick={()=>reset.mutate(r)} aria-label="Avtomatik rangga qaytarish"><RotateCcw size={16}/></Button>}
         </div>
       </Card>;
     })}
   </div>
   <Modal open={!!edit} title="Kun rangini belgilash" onClose={()=>setEdit(null)}>
     <div className="space-y-3">
       <p className="text-sm text-neutral-600">{edit?.operator?.full_name} · {edit&&formatDateUz(edit.report_date)} · {edit?.accepted_orders} ta qabul</p>
       <Field label="KPI rangi"><Select value={color} onChange={e=>setColor(e.target.value as DayStatus)}>
         <option value="green">Yashil</option><option value="yellow">Sariq</option><option value="red">Qizil</option>
       </Select></Field>
       <Field label="Sabab (majburiy)"><Textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Rangni o‘zgartirish sababi..."/></Field>
       <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Diqqat: bu nazorat rangidir. Qabul soni, bonus va boshqa moliyaviy hisoblar o‘zgarmaydi.</p>
       <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEdit(null)}>Bekor qilish</Button><Button loading={save.isPending} onClick={()=>save.mutate()}><Save size={16}/> Saqlash</Button></div>
     </div>
   </Modal>
 </div>;
}
