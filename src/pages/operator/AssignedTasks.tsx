import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ListTodo, Play, Send } from 'lucide-react';
import { supabase,unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Badge,Button,Card,EmptyState,ErrorState,LoadingBlock,PageHeader,useToast } from '@/components/ui';
import { categories, statuses, dateTime, overdue, type Task } from '@/lib/manager';
import { humanError } from '@/lib/uz';
export default function AssignedTasks(){
 const {profile}=useAuth(),toast=useToast(),qc=useQueryClient();
 const tasks=useQuery({queryKey:['operator-assigned-tasks',profile?.id],enabled:!!profile,
  queryFn:async()=>await unwrap(supabase.from('manager_tasks').select('*').eq('operator_id',profile!.id).order('due_at')) as Task[],refetchInterval:45000});
 async function update(id:string,status:'in_progress'|'review') {
  try{await unwrap(supabase.rpc('operator_update_task',{p_task:id,p_status:status}));
   void qc.invalidateQueries({queryKey:['operator-assigned-tasks']});
   toast('success',status==='review'?'Menejer tekshiruviga yuborildi.':'Vazifa jarayonga o‘tkazildi.');
  }catch(e){toast('error',humanError(e));}
 }
 return <div className="space-y-4">
  <Link to="/profil" className="inline-flex min-h-10 items-center gap-2 text-sm text-neutral-600"><ArrowLeft size={17}/> Profilga qaytish</Link>
  <PageHeader title="Mening vazifalarim" subtitle="Menejer biriktirgan ichki vazifalar." />
  <p className="text-xs text-neutral-500">Vazifani yakunlab tekshiruvga yuborasiz. Menejer tasdiqlagandan keyin “Bajarildi” bo‘ladi.</p>
  {tasks.isLoading&&<LoadingBlock rows={3}/>}
  {tasks.isError&&<ErrorState message={humanError(tasks.error)} onRetry={()=>void tasks.refetch()}/>}
  {tasks.data?.length===0&&<EmptyState title="Sizga vazifa biriktirilmagan" hint="Yangi vazifa berilsa shu sahifada ko‘rinadi." icon={<ListTodo size={32}/>}/>}
  {(tasks.data??[]).map(t=><Card key={t.id} className="space-y-3">
   <div className="flex items-start justify-between gap-2"><h2 className="font-bold">{t.title}</h2><Badge tone={t.status==='completed'?'green':overdue(t)?'red':t.status==='review'?'yellow':'neutral'}>{overdue(t)?'Muddati o‘tgan':statuses[t.status]}</Badge></div>
   {t.description&&<p className="text-sm text-neutral-600">{t.description}</p>}
   <div className="flex flex-wrap gap-2"><Badge>{categories[t.category]}</Badge><span className="inline-flex items-center gap-1 text-xs text-neutral-500"><CalendarDays size={14}/>{dateTime(t.due_at)}</span></div>
   {t.status==='todo'&&<Button className="w-full" onClick={()=>void update(t.id,'in_progress')}><Play size={16}/> Boshlash</Button>}
   {t.status==='in_progress'&&<Button className="w-full" onClick={()=>void update(t.id,'review')}><Send size={16}/> Menejerga tekshiruvga yuborish</Button>}
   {t.status==='review'&&<p className="flex items-center gap-2 text-sm text-amber-700"><Clock3 size={16}/> Menejer tasdiqlashi kutilmoqda.</p>}
   {t.status==='completed'&&<p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16}/> Vazifa tasdiqlangan.</p>}
  </Card>)}
 </div>;
}
