import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Users } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { humanError } from '@/lib/uz';

type User={id:string;full_name:string;email:string|null;is_active:boolean};
type Assignment={manager_id:string;team_code:'alpha'|'beta'};
export default function ManagersAdmin(){
 const {profile}=useAuth(),toast=useToast(),qc=useQueryClient();
 const managers=useQuery({queryKey:['admin-managers'],queryFn:async()=>await unwrap(supabase.from('profiles').select('id,full_name,email,is_active').eq('role','manager').order('full_name')) as User[]});
 const assigns=useQuery({queryKey:['admin-manager-teams'],queryFn:async()=>await unwrap(supabase.from('manager_team_assignments').select('manager_id,team_code')) as Assignment[]});
 const operators=useQuery({queryKey:['admin-manager-team-counts'],queryFn:async()=>await unwrap(supabase.from('operator_team_assignments').select('operator_id,effective_month,team_code').order('effective_month',{ascending:false})) as {operator_id:string;effective_month:string;team_code:string}[]});
 const save=useMutation({mutationFn:async({id,code,enabled}:{id:string;code:'alpha'|'beta';enabled:boolean})=>{
   if(enabled)await unwrap(supabase.from('manager_team_assignments').upsert({manager_id:id,team_code:code,assigned_by:profile?.id},{onConflict:'manager_id,team_code'}).select());
   else await unwrap(supabase.from('manager_team_assignments').delete().eq('manager_id',id).eq('team_code',code).select());
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:['admin-manager-teams']});toast('success','Jamoa biriktirildi.');},onError:e=>toast('error',humanError(e))});
 const activeMonth=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tashkent'}).slice(0,7)+'-01';
 const latest=new Map<string,{team_code:string;effective_month:string}>();
 for(const a of operators.data??[]){if(a.effective_month<=activeMonth&&!latest.has(a.operator_id))latest.set(a.operator_id,a);}
 const teamSize=(code:string)=>[...latest.values()].filter(v=>v.team_code===code).length;
 const dbError=managers.error??assigns.error;
 const code=(dbError as {code?:string;message?:string}|null)?.code;
 const details=(dbError as {code?:string;message?:string}|null)?.message??'';
 const migrationMissing=['42P01','42883','42703','PGRST205'].includes(code??'')||/manager_team_assignments|manager role|schema cache/i.test(details);
 const errorMessage=migrationMissing
   ? "Menejerlar moduli uchun Supabase bazasi hali tayyor emas. SQL Editor’da 016_manager_role.sql va 017_manager_hub.sql migratsiyalarini ketma-ket bajaring, keyin qayta urinib ko‘ring."
   : humanError(dbError);

 return <div className="space-y-4">
   <PageHeader title="Menejerlar" subtitle="Menejerlarni Operatorlar sahifasida taklif qiling va shu yerda Alpha/Beta jamoalarini biriktiring."/>
   <Card className="space-y-2 p-4">
     <p className="flex items-center gap-2 font-bold"><BriefcaseBusiness size={18}/> Menejer vakolatlari</p>
     <p className="text-sm text-neutral-600">Menejer faqat o‘z jamoasining operatorlari, tasdiqlangan natijalari, davomati va topshiriqlarini ko‘radi. Oylik, balans va umumiy admin sozlamalariga kira olmaydi.</p>
     <p className="text-xs text-neutral-500">Menejer yaratish: Admin → Operatorlar → Yangi xodim → Menejer. Yoki mavjud xodimning rolini Menejerga o‘zgartiring.</p>
   </Card>
   {(managers.isLoading||assigns.isLoading)&&<LoadingBlock rows={3}/>}
   {dbError&&<ErrorState message={errorMessage} onRetry={()=>{void managers.refetch();void assigns.refetch();}}/>}
   {managers.isSuccess&&assigns.isSuccess&&!managers.data?.length&&<EmptyState title="Menejerlar topilmadi" hint="Operatorlar bo‘limida yangi menejer taklif qiling."/>}
   {(managers.data??[]).map(m=><Card key={m.id} className="space-y-3 p-4">
     <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Users size={20}/></div>
       <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.full_name}</p><p className="truncate text-xs text-neutral-500">{m.email}</p></div>
       <Badge tone={m.is_active?'green':'red'}>{m.is_active?'Faol':'Nofaol'}</Badge>
     </div>
     <div className="grid gap-2 sm:grid-cols-2">
       {(['alpha','beta'] as const).map(code=>{
         const checked=!!assigns.data?.some(a=>a.manager_id===m.id&&a.team_code===code);
         return <label key={code} className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-3">
           <span className="text-sm font-semibold">Team {code.toUpperCase()} <span className="text-xs font-normal text-neutral-500">· {teamSize(code)} operator</span></span>
           <input type="checkbox" className="h-5 w-5 accent-yellow-400" disabled={save.isPending} checked={checked} onChange={e=>save.mutate({id:m.id,code,enabled:e.target.checked})}/>
         </label>;
       })}
     </div>
   </Card>)}
 </div>;
}
