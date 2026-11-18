import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';

export interface WalletSummary {
  start_date: string;
  accepted_orders: number;
  reported_sales: number;
  confirmed_sales: number;
  pending_sales: number;
  accepted_earnings: number;
  sales_earnings: number;
  bonus_earnings: number;
  paid_uzs: number;
  main_balance: number;
  hold_balance: number;
  missing_days: number;
  penalty_uzs: number;
}

export interface WalletMovement {
  id: string;
  operator_id: string;
  action: 'bonus' | 'payment';
  amount_uzs: number;
  note: string;
  created_at: string;
}
export interface MissedDay {
 missing_date: string;
 penalty_uzs: number;
}
export interface AbsencePolicy {
 amount_uzs: number;
 effective_from: string;
}
export function useAbsencePolicy() {
  return useQuery({
    queryKey: ['operator-absence-policy'],
    queryFn: async () => (await unwrap(supabase.rpc('get_operator_absence_policy'))) as AbsencePolicy[],
    refetchInterval: 60_000,
  });
}
export function useMissingDays(operatorId: string | undefined, start: string) {
  return useQuery({
    queryKey: ['operator-missing-days',operatorId,start],
    enabled: !!operatorId,
    queryFn: async () => (await unwrap(supabase.rpc('get_operator_missing_days',{
      p_operator:operatorId!, p_month:start
    }))) as MissedDay[],
    refetchInterval: 60_000,
  });
}
export function useWallet(operatorId?: string) {
  return useQuery({
    queryKey: ['operator-wallet', operatorId],
    enabled: Boolean(operatorId),
    refetchInterval: 45_000,
    queryFn: async () => {
      const rows = await unwrap(supabase.rpc('get_operator_wallet_v2', { p_operator: operatorId! })) as WalletSummary[];
      if (!rows.length) throw new Error('Balansni olishning imkoni bo‘lmadi.');
      return rows[0];
    },
  });
}
