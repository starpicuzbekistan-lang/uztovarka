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
}

export interface WalletMovement {
  id: string;
  operator_id: string;
  action: 'bonus' | 'payment';
  amount_uzs: number;
  note: string;
  created_at: string;
}

export function useWallet(operatorId?: string) {
  return useQuery({
    queryKey: ['operator-wallet', operatorId],
    enabled: Boolean(operatorId),
    refetchInterval: 45_000,
    queryFn: async () => {
      const rows = await unwrap(supabase.rpc('get_operator_wallet', { p_operator: operatorId! })) as WalletSummary[];
      if (!rows.length) throw new Error('Balansni olishning imkoni bo‘lmadi.');
      return rows[0];
    },
  });
}
