import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { formatDateUz, tashkentToday } from '@/lib/dates';
import { humanError } from '@/lib/uz';

type Task={id:string;title:string;description:string;category:string;priority:string;due_date:string;status:string;feedback:string|null};
export default function OperatorTasks(){
 const toast=useToast(),qc=useQueryClient();
 const q=useQuery({queryKey:['operator-tasks'],queryFn:async()=>await unwrap(supabase.from('manager_tasks').select('id,title,description,category,priority,due_date,status,feedback').order('due_date',{ascending:true}).limit(200)) as Task[]});
 const done=useMutation({mutationFn:async(id:string)=>await unwrap(supabase.rpc('operator_submit_task',{p_task:id})),
   onSuccess:()=>{void qc.invalidateQueries({queryKey:['operator-tasks']});toast('success','Menejer tekshiruviga yuborildi.');},onError:e=>toast('error',humanError(e))});
 return <div className="space-y-4">
   <PageHeader title="Mening vazifalarim" subtitle="Menejer tomonidan berilgan topshiriqlar"/>
   {q.isLoading&&<LoadingBlock rows={3}/>}
   {q.isError&&<ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/>}
   {q.data?.length===0&&<EmptyState title="Vazifalar mavjud emas" hint="Menejer topshiriq bersa shu yerda ko‘rinadi."/>}
   {(q.data??[]).map(t=><Card key={t.id} className="space-y-3 p-4">
     <div className="flex justify-between gap-2"><h2 className="font-bold">{t.title}</h2><Badge tone={t.status==='completed'?'green':t.status==='submitted'?'yellow':'neutral'}>{t.status==='completed'?'Bajarildi':t.status==='submitted'?'Tekshirilmoqda':t.status==='in_progress'?'Tuzatish kerak':'Yangi'}</Badge></div>
     <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500"><Clock size={15}/> {formatDateUz(t.due_date)} · {t.category==='training'?'O‘quv vazifasi':'Ish vazifasi'} {t.priority==='high'?'· Muhim':''}</p>
     {t.description&&<p className="text-sm text-neutral-600">{t.description}</p>}
     {t.feedback&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Menejer izohi: {t.feedback}</p>}
     {t.due_date<tashkentToday()&&t.status!=='completed'&&<p className="text-xs font-bold text-rose-600">Muddat o‘tgan</p>}
     {['todo','in_progress'].includes(t.status)&&<Button size="sm" loading={done.isPending} onClick={()=>done.mutate(t.id)}><CheckCircle2 size={16}/> Bajarildi — tekshiruvga yuborish</Button>}
   </Card>)}
 </div>;
}
