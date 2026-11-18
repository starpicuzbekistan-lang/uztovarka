import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { formatDateTimeUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';
import { Button, Card, ErrorState, LoadingBlock, Notice, Textarea, useToast } from '@/components/ui';
import type { ChatMessage } from '@/lib/supportChat';

export default function SupportChatPanel({operatorId,operatorName}:{operatorId:string;operatorName?:string}){
 const {profile}=useAuth();
 const qc=useQueryClient();
 const toast=useToast();
 const [draft,setDraft]=useState('');
 const bottom=useRef<HTMLDivElement>(null);
 const admin=profile?.role==='admin';
 const messages=useQuery({
  queryKey:['support-chat-messages',operatorId],
  enabled:!!profile&&!!operatorId,
  refetchInterval:5_000,
  queryFn:async()=>await unwrap(supabase.from('support_messages')
    .select('id,operator_id,sender_id,body,created_at,read_at')
    .eq('operator_id',operatorId).order('created_at',{ascending:true}).limit(250)) as ChatMessage[],
 });
 useEffect(()=>{
  if(!profile||!messages.data?.some(m=>m.sender_id!==profile.id&&!m.read_at))return;
  let active=true;
  void supabase.rpc('mark_support_messages_read',{p_operator:operatorId}).then(({error})=>{
   if(!error&&active){
     void qc.invalidateQueries({queryKey:['chat-unread']});
     void qc.invalidateQueries({queryKey:['support-chat-threads']});
   }
  });
  return ()=>{active=false;};
 },[messages.data,profile?.id,operatorId,qc]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[operatorId,messages.data?.length]);
 const send=useMutation({
  mutationFn:async(body:string)=>{
    if(!profile)throw new Error('Seans yo‘q');
    if(!admin){
      const {data,error}=await supabase.from('support_threads').select('operator_id')
        .eq('operator_id',operatorId).maybeSingle();
      if(error)throw error;
      if(!data){
        const {error:insertError}=await supabase.from('support_threads').insert({operator_id:operatorId});
        if(insertError && insertError.code!=='23505')throw insertError;
      }
    }
    await unwrap(supabase.from('support_messages').insert({
      operator_id:operatorId,sender_id:profile.id,body:body.trim()
    }));
  },
  onSuccess:()=>{
    setDraft('');
    void qc.invalidateQueries({queryKey:['support-chat-messages',operatorId]});
    void qc.invalidateQueries({queryKey:['support-chat-threads']});
    void qc.invalidateQueries({queryKey:['chat-unread']});
  },
  onError:(e)=>toast('error',humanError(e)),
 });
 function submit(e:FormEvent){
  e.preventDefault();
  const value=draft.trim();
  if(!value||value.length>2000||send.isPending)return;
  send.mutate(value);
 }
 return <Card className="flex min-h-[540px] flex-col overflow-hidden p-0">
   <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
     <span className="rounded-full bg-brand-soft p-2.5"><MessageCircle className="h-5 w-5"/></span>
     <div><h2 className="font-bold">{admin?(operatorName??'Operator'):'Administrator'}</h2>
       <p className="text-xs text-neutral-500">Faqat matnli xabarlar · Rasm yoki video yuborilmaydi</p></div>
     <ShieldCheck className="ml-auto h-5 w-5 text-neutral-400"/>
   </div>
   <div className="max-h-[52vh] min-h-[300px] flex-1 space-y-3 overflow-y-auto bg-neutral-50/60 px-3 py-4 sm:px-4">
     {messages.isLoading&&<LoadingBlock rows={2}/>}
     {messages.isError&&<ErrorState message="Chat ma’lumotlarini yuklab bo‘lmadi. Supabase'da 013 SQL migratsiyasini tekshiring." onRetry={()=>void messages.refetch()}/>}
     {messages.data?.length===0&&<div className="mx-auto max-w-xs py-12 text-center text-sm text-neutral-500">
       <MessageCircle className="mx-auto mb-3 h-8 w-8 text-neutral-300"/>
       Suhbat hali boshlanmagan. {admin?'Operator yozishini kuting.':'Adminga xabaringizni yuboring.'}
     </div>}
     {(messages.data??[]).map(m=>{
       const mine=m.sender_id===profile?.id;
       return <div key={m.id} className={`flex ${mine?'justify-end':'justify-start'}`}>
         <div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 ${mine?'rounded-br-sm bg-ink text-white':'rounded-bl-sm border border-neutral-200 bg-white text-ink'}`}>
           <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
           <p className={`mt-1 text-right text-[10px] ${mine?'text-neutral-300':'text-neutral-400'}`}>{formatDateTimeUz(m.created_at)}</p>
         </div>
       </div>;
     })}
     <div ref={bottom}/>
   </div>
   <form onSubmit={submit} className="border-t border-neutral-200 bg-white p-3">
     {messages.isError&&<Notice tone="warn">Xabar yuborishdan oldin 013 SQL ishlaganini tekshiring.</Notice>}
     <div className="flex items-end gap-2">
       <Textarea aria-label="Xabar matni" value={draft} maxLength={2000} rows={2}
         placeholder="Xabaringizni yozing…" onChange={e=>setDraft(e.target.value)} className="min-h-[48px] max-h-36 flex-1 resize-none" />
       <Button type="submit" size="sm" aria-label="Yuborish" disabled={!draft.trim()||send.isPending||messages.isError} loading={send.isPending}>
         <Send size={17}/><span className="hidden sm:inline">Yuborish</span>
       </Button>
     </div>
     <p className="mt-1.5 text-right text-[11px] text-neutral-400">{draft.length}/2000 belgi · Faqat matn</p>
   </form>
 </Card>;
}
