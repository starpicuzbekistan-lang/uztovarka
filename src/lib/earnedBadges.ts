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

export type OperatorAchievementsData = {
  items: Achievement[];
  autoWarning: string | null;
  specialWarning: string | null;
};

function isMissingSpecialBadgesTable(error: unknown): boolean {
  const e=error as {code?:string;message?:string}|null;
  const message=e?.message??'';
  return (e?.code==='42P01'||e?.code==='PGRST205'||e?.code==='PGRST200'
    ||/schema cache|does not exist|could not find the table/i.test(message))
    && /operator_special_badges/i.test(message);
}

/** Sources are independent: an unavailable 014 table must not hide earned auto badges. */
export function useOperatorAchievements(operatorId?: string) {
  return useQuery({
    queryKey: ['operator-achievements', operatorId],
    enabled: !!operatorId,
    queryFn: async (): Promise<OperatorAchievementsData> => {
      const [automatic, special] = await Promise.allSettled([
        unwrap(supabase.rpc('get_operator_badges', {p_operator: operatorId!})) as Promise<AutoBadgeResponse[]>,
        unwrap(supabase.from('operator_special_badges')
          .select('operator_id,badge_code,reason,awarded_at,revoked_at')
          .eq('operator_id', operatorId!)
          .is('revoked_at', null)) as Promise<SpecialBadgeRow[]>,
      ]);

      // Errors are handled separately so admins can enable the new table
      // without taking down the existing automatically-earned badge list.
      if (automatic.status==='rejected' && special.status==='rejected') {
        const needs014=isMissingSpecialBadgesTable(special.reason);
        throw new Error(needs014
          ? 'Badge ma’lumotlari to‘liq yuklanmadi. Admin avval 011, so‘ng 014 SQL sozlamalarini tekshirsin.'
          : 'Badge ma’lumotlarini yuklab bo‘lmadi. Administrator Supabase ulanishini tekshirsin.');
      }
      const autoWarning=automatic.status==='rejected'
        ? 'Avtomatik badgelar vaqtincha yuklanmadi. Administrator 011 badge funksiyasini tekshirsin.'
        : null;
      const specialWarning=special.status==='rejected'
        ? isMissingSpecialBadgesTable(special.reason)
          ? 'Maxsus badgelar uchun 014 SQL hali o‘rnatilmagan. Avtomatik badgelar ishlayveradi.'
          : 'Admin beradigan maxsus badgelar vaqtincha yuklanmadi. Qayta urinib ko‘ring.'
        : null;

      const items: Achievement[] = automatic.status==='fulfilled'
        ? (automatic.value??[])
            .filter(x => x.earned && isBadgeCode(x.code))
            .map(x => ({code:x.code as BadgeCode,earnedAt:x.earned_on,source:'automatic' as const}))
        : [];
      if (special.status==='fulfilled') {
        for (const b of special.value??[]) {
          if (isBadgeCode(b.badge_code)) items.push({
            code:b.badge_code as BadgeCode,
            earnedAt:b.awarded_at,
            source:'admin',
            adminReason:b.reason,
          });
        }
      }
      items.sort((a,b)=>(b.earnedAt??'').localeCompare(a.earnedAt??''));
      return {items,autoWarning,specialWarning};
    },
    staleTime:20_000,
    refetchOnWindowFocus:true,
  });
}
