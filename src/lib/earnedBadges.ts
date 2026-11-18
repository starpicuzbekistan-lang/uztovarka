import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { isBadgeCode, type BadgeCode } from '@/lib/badgeCatalog';

export type Achievement = {
  code: BadgeCode;
  earnedAt: string | null;
  source: 'automatic' | 'admin';
  adminReason?: string;
};

type AutoBadgeResponse = {
  code: string;
  earned: boolean;
  earned_on: string | null;
};
export type SpecialBadgeRow = {
  operator_id: string;
  badge_code: string;
  reason: string;
  awarded_at: string;
  revoked_at: string | null;
};

export function useOperatorAchievements(operatorId?: string) {
  return useQuery({
    queryKey: ['operator-achievements', operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const [automatic, manual] = await Promise.all([
        unwrap(supabase.rpc('get_operator_badges', {p_operator: operatorId!})) as Promise<AutoBadgeResponse[]>,
        unwrap(supabase.from('operator_special_badges')
          .select('operator_id,badge_code,reason,awarded_at,revoked_at')
          .eq('operator_id', operatorId!)
          .is('revoked_at', null)) as Promise<SpecialBadgeRow[]>,
      ]);
      const earned: Achievement[] = automatic
        .filter(x => x.earned && isBadgeCode(x.code))
        .map(x => ({code:x.code as BadgeCode, earnedAt:x.earned_on,source:'automatic'}));
      for (const x of manual) {
        if (isBadgeCode(x.badge_code)) earned.push({
          code:x.badge_code as BadgeCode,
          earnedAt:x.awarded_at,
          adminReason:x.reason,
          source:'admin',
        });
      }
      return earned.sort((a,b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
    },
    staleTime: 20_000,
  });
}
