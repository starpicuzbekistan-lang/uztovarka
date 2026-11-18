import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/auth/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { formatDateTimeUz } from '@/lib/dates';
import { Avatar, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import SupportChatPanel from '@/components/SupportChatPanel';
import type { ChatThread } from '@/lib/supportChat';

type ProfileSummary={id:string;full_name:string;avatar_url:string|null};
type Unread={operator_id:string};

export default function AdminSupportChat(){
 const {profile}=useAuth();
 const [selected,setSelected]=useState<string|null>(null);
 const threads=useQuery({
  queryKey:['support-chat-threads'],
  queryFn:async()=>await unwrap(supabase.from('support_threads')
    .select('operator_id,created_at,updated_at').order('updated_at',{ascending:false})) as ChatThread[],
  refetchInterval:8000,
 });
 const profiles=useQuery({
  queryKey:['support-chat-operator-profiles'],
  queryFn:async()=>await unwrap(supabase.from('profiles')
   .select('id,full_name,avatar_url').eq('role','operator')) as ProfileSummary[],
 });
 const unread=useQuery({
  queryKey:['support-chat-unread-by-user',profile?.id],
  enabled:!!profile,
  queryFn:async()=>await unwrap(supabase.from('support_messages')
   .select('operator_id').neq('sender_id',profile!.id).is('read_at',null)) as Unread[],
  refetchInterval:8000,
 });
 useEffect(()=>{
  if(!selected && (threads.data?.length??0)>0)setSelected(threads.data![0].operator_id);
 },[selected,threads.data]);
 const names=new Map((profiles.data??[]).map(p=>[p.id,p]));
 const unreadCounts=new Map<string,number>();
 (unread.data??[]).forEach(m=>unreadCounts.set(m.operator_id,(unreadCounts.get(m.operator_id)??0)+1));
 const person=selected?names.get(selected):undefined;
 return <div className="space-y-4">
  <PageHeader title="Operatorlar chati" subtitle="Operatorlardan kelgan matnli xabarlar. Rasm, video va fayllar qo‘llab-quvvatlanmaydi."/>
  <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
   <Card className="h-fit space-y-3 p-3">
    <div className="flex items-center gap-2 px-2"><Users size={18}/><h2 className="font-semibold">Suhbatlar</h2>
     {(unread.data?.length??0)>0&&<span className="ml-auto rounded-full bg-brand px-2 text-xs font-bold">{unread.data!.length} yangi</span>}
    </div>
    {threads.isLoading&&<LoadingBlock rows={2}/>}
    {threads.isError&&<ErrorState message="Chatlar yuklanmadi. 013 SQL migratsiyasini tekshiring." onRetry={()=>void threads.refetch()}/>}
    {threads.data?.length===0&&<p className="px-2 py-4 text-sm text-neutral-500">Operatorlardan hali xabar yo‘q.</p>}
    <div className="max-h-96 space-y-1 overflow-y-auto">
     {(threads.data??[]).map(t=>{
      const p=names.get(t.operator_id);
      const n=unreadCounts.get(t.operator_id)??0;
      return <button key={t.operator_id} type="button" onClick={()=>setSelected(t.operator_id)}
       className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-neutral-100',
         selected===t.operator_id&&'bg-amber-50 ring-1 ring-brand')}>
       <Avatar name={p?.full_name??'Operator'} path={p?.avatar_url} size={38}/>
       <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p?.full_name??'Operator'}</span>
        <span className="text-[11px] text-neutral-500">{formatDateTimeUz(t.updated_at)}</span></span>
       {n>0&&<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold">{n}</span>}
      </button>;
     })}
    </div>
   </Card>
   <div className="min-w-0">
    {selected?<SupportChatPanel operatorId={selected} operatorName={person?.full_name??'Operator'}/>:
     <Card className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-neutral-500">
       <MessageCircle className="h-10 w-10"/><p className="text-sm">Operator chatini tanlang.</p>
     </Card>}
   </div>
  </div>
 </div>;
}
