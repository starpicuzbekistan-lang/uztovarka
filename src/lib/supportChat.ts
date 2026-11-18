import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';

export type ChatMessage = {
 id:string; operator_id:string; sender_id:string; body:string;
 created_at:string; read_at:string|null;
};
export type ChatThread = {operator_id:string;created_at:string;updated_at:string};

export function useChatUnread() {
 const {profile}=useAuth();
 return useQuery({
   queryKey:['chat-unread',profile?.id],
   enabled:!!profile,
   refetchInterval:12_000,
   queryFn:async()=>{
     const {count,error}=await supabase.from('support_messages')
       .select('id',{count:'exact',head:true})
       .neq('sender_id',profile!.id).is('read_at',null);
     if(error)throw error;
     return count??0;
   }
 });
}
