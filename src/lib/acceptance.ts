import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';

export type MonthlyAcceptance = {
  total_accepted:number;
  payable_accepted:number;
  unpaid_accepted:number;
  accepted_earnings:number;
};

/** 0 = eski davr uchun barcha tasdiqlangan qabullar to'lanadi. */
export function useAcceptanceThreshold(day:string) {
  return useQuery({
    queryKey:['acceptance-threshold',day],
    enabled:!!day,
    queryFn:async()=>Number(await unwrap(supabase.rpc('get_acceptance_payment_threshold',{p_date:day}))),
    staleTime:30_000,
  });
}

export function useAcceptanceMonth(operatorId:string|undefined,monthStart:string) {
  return useQuery({
    queryKey:['acceptance-month',operatorId,monthStart],
    enabled:!!operatorId&&!!monthStart,
    queryFn:async()=>{
      const rows=(await unwrap(supabase.rpc('get_operator_acceptance_month',{
        p_operator:operatorId!,p_month:monthStart
      }))) as MonthlyAcceptance[];
      if(!rows.length)throw new Error('Qabul bo‘yicha to‘lovlarni olib bo‘lmadi.');
      return rows[0];
    },
    refetchInterval:60_000,
  });
}
