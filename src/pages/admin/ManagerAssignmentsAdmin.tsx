import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { UsersRound } from 'lucide-react';
import { supabase,unwrap } from '@/lib/supabase';
import { Badge,Button,Card,ErrorState,Field,Input,LoadingBlock,Select,useToast } from '@/components/ui';
import { humanError } from '@/lib/uz';
import type { Profile } from '@/lib/types';
type Assignment={operator_id:string;manager_id:string};
type Team={manager_id:string;name:string;target_accepted:number};
export default function ManagerAssignmentsAdmin(){
 const toast=useToast(),qc=useQueryClient();
 const [manager,setManager]=useState(''),[operator,setOperator]=useState(''),[name,setName]=useState('Mening jamoam'),[target,setTarget]=useState('0'),[busy,setBusy]=useState(false);
 const people=useQuery({queryKey:['admin-manager-people'],queryFn:async()=>await unwrap(supabase.from('profiles').select('*').order('full_name')) as Profile[]});
 const assignments=useQuery({queryKey:['admin-manager-assignments'],queryFn:async()=>await unwrap(supabase.from('manager_assignments').select('operator_id,manager_id')) as Assignment[]});
 const teams=useQuery({queryKey:['admin-manager-teams'],queryFn:async()=>await unwrap(supabase.from('manager_teams').select('manager_id,name,target_accepted')) as Team[]});
 const managers=(people.data??[]).filter(p=>p.role==='manager'&&p.is_active),operators=(people.data??[]).filter(p=>p.role==='operator');
 const linked=(assignments.data??[]).filter(a=>a.manager_id===manager);
 const refresh=()=>{void qc.invalidateQueries({queryKey:['admin-manager-assignments']});void qc.invalidateQueries({queryKey:['admin-manager-teams']});};
 async function assign(){if(!manager||!operator)return;setBusy(true);try{await unwrap(supabase.from('manager_assignments').upsert({manager_id:manager,operator_id:operator},{onConflict:'operator_id'}));setOperator('');refresh();toast('success','Operator biriktirildi.');}catch(e){toast('error',humanError(e));}finally{setBusy(false);}}
 async function save(){if(!manager||name.trim().length<2||!/^[0-9]+$/.test(target))return;setBusy(true);try{await unwrap(supabase.from('manager_teams').upsert({manager_id:manager,name:name.trim(),target_accepted:Number(target)},{onConflict:'manager_id'}));refresh();toast('success','Jamoa saqlandi.');}catch(e){toast('error',humanError(e));}finally{setBusy(false);}}
 return <Card className="space-y-4 p-4">
  <h2 className="flex items-center gap-2 font-bold"><UsersRound size={21} className="text-yellow-600"/> Manager Hub · Jamoalarni biriktirish</h2>
  <p className="text-xs text-neutral-500">Bir operator bir vaqtning o‘zida bitta menejerga biriktiriladi. Bu amal faqat administratorga ruxsat.</p>
  {people.isLoading&&<LoadingBlock rows={1}/>}
  {(people.isError||assignments.isError||teams.isError)&&<ErrorState message="Menejer jadvallari yuklanmadi. Supabase 017 migratsiyasini tekshiring."/>}
  <Field label="Menejer"><Select value={manager} onChange={e=>{const id=e.target.value;setManager(id);const t=teams.data?.find(x=>x.manager_id===id);setName(t?.name??'Mening jamoam');setTarget(String(t?.target_accepted??0));}}>
   <option value="">Menejerni tanlang</option>{managers.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
  </Select></Field>
  {manager&&<>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Jamoa nomi"><Input value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Oylik maqsad (qabul)"><Input type="number" min="0" value={target} onChange={e=>setTarget(e.target.value)}/></Field></div>
    <Button onClick={()=>void save()} disabled={busy||name.trim().length<2||!/^[0-9]+$/.test(target)}>Jamoani saqlash</Button>
    <div className="flex items-end gap-2"><div className="flex-1"><Field label="Operatorni biriktirish"><Select value={operator} onChange={e=>setOperator(e.target.value)}>
      <option value="">Operatorni tanlang</option>{operators.map(p=><option key={p.id} value={p.id}>{p.full_name}{assignments.data?.some(a=>a.operator_id===p.id)?' (biriktirilgan)':''}</option>)}
    </Select></Field></div><Button disabled={!operator||busy} onClick={()=>void assign()}>Biriktirish</Button></div>
    <div className="divide-y divide-neutral-100">{linked.map(a=><div className="flex items-center justify-between gap-2 py-2" key={a.operator_id}><span className="text-sm">{operators.find(x=>x.id===a.operator_id)?.full_name??'Operator'}</span><Button variant="outline" size="sm" onClick={async()=>{try{await unwrap(supabase.from('manager_assignments').delete().eq('manager_id',manager).eq('operator_id',a.operator_id));refresh();toast('success','Operator ajratildi.');}catch(e){toast('error',humanError(e));}}}>Ajratish</Button></div>)}</div>
    {!linked.length&&<Badge>Operatorlar biriktirilmagan</Badge>}
  </>}
  {!managers.length&&people.data&&<p className="text-sm text-neutral-500">Avval xodimga Menejer rolini bering.</p>}
 </Card>;
}
