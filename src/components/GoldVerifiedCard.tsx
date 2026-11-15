import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import { Card, ErrorState, LoadingBlock } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { humanError } from '@/lib/uz';
import GoldVerifiedIcon from './GoldVerifiedIcon';

export interface GoldMonth {
  month_start: string; worked_days: number; green_days: number; accepted_orders: number;
  covered_days: number; unique_calls: number; sold_orders: number;
  green_percent: number | null; daily_average: number | null;
  acceptance_percent: number | null; sales_percent: number | null;
  eligible: boolean; is_completed: boolean; is_verified: boolean;
}
export function useGoldProgress(operatorId: string | undefined) {
  return useQuery({
    queryKey: ['gold-progress', operatorId], enabled: !!operatorId,
    queryFn: async () => (await unwrap(supabase.rpc('get_operator_gold_progress', { p_operator: operatorId! }))) as GoldMonth[],
  });
}
const safe = (n: number | null) => n === null ? '—' : `${Number(n).toLocaleString('uz-UZ')}%`;

export default function GoldVerifiedCard({ operatorId }: { operatorId: string }) {
  const q = useGoldProgress(operatorId);
  if (q.isLoading) return <Card><LoadingBlock rows={3} /></Card>;
  if (q.isError) return <Card className="space-y-2"><h2 className="font-semibold">Gold Verified</h2><ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} /></Card>;
  const months = q.data ?? [];
  const current = months.find(m => !m.is_completed) ?? months[0];
  const done = months.filter(m => m.is_completed);
  if (!current) return null;
  const checks = [
    { name: 'Ishlangan kunlar', actual: `${current.worked_days} / 22`, good: current.worked_days >= 22 },
    { name: 'Yashil kunlar', actual: `${safe(current.green_percent)} / 80%`, good: (current.green_percent ?? 0) >= 80 },
    { name: 'Kunlik o‘rtacha qabul', actual: `${current.daily_average ?? '—'} / 70`, good: (current.daily_average ?? 0) >= 70 },
    { name: 'Qabul konversiyasi', actual: `${safe(current.acceptance_percent)} / 40%`, good: (current.acceptance_percent ?? 0) >= 40 },
    { name: 'Sotuv konversiyasi', actual: `${safe(current.sales_percent)} / 40%`, good: (current.sales_percent ?? 0) >= 40 },
  ];
  const completed = checks.filter(c => c.good).length;
  const actualStreak = (() => { let n=0; for (const m of done) { if (!m.eligible) break; n++; } return n; })();
  const verified = current.is_verified;
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-50 p-3">{verified ? <GoldVerifiedIcon size={30} /> : <Award className="h-7 w-7 text-amber-500" />}</div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 font-bold">Gold Verified {verified && <GoldVerifiedIcon size={18} />}</h2>
          <p className="text-xs text-neutral-500">{verified ? 'Oltin maqomga egasiz!' : 'Eng yuqori operator maqomini qo‘lga kiriting'}</p>
        </div>
        {!verified && <LockKeyhole size={18} className="text-neutral-400" />}
      </div>
      <div>
        <div className="mb-2 flex justify-between text-sm"><span>Joriy oy talablari</span><b>{completed}/5</b></div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${completed/5*100}%` }} /></div>
      </div>
      <div className="space-y-2">
        {checks.map(c => <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 p-2.5 text-xs">
          <span className="flex items-center gap-2">{c.good ? <CheckCircle2 size={17} className="text-green-600" /> : <Circle size={17} className="text-neutral-400" />}{c.name}</span>
          <b className="whitespace-nowrap tabular-nums">{c.actual}</b>
        </div>)}
      </div>
      {current.covered_days < current.worked_days && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">Unique Calls va Sotuv ma’lumotlari hali kiritilmagan. Administrator oylik natijani kiritishi kerak.</p>}
      <div className="space-y-2 border-t border-neutral-100 pt-3">
        <div className="flex justify-between text-sm"><b>3 oy ketma-ket natija</b><span>{actualStreak}/3</span></div>
        <div className="grid grid-cols-3 gap-2">
          {[...done].reverse().map(m => <div key={m.month_start} className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 p-2 text-xs">
            {m.eligible ? <CheckCircle2 size={18} className="text-green-600" /> : <Circle size={18} className="text-neutral-400" />}
            <span>{m.month_start.slice(0,7)}</span>
          </div>)}
        </div>
        <p className="text-xs text-neutral-500">Faqat 3 ta to‘liq tugallangan oyda barcha talab bajarilganda oltin belgi avtomatik beriladi.</p>
      </div>
      {!verified && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{checks.find(c => !c.good) ? `Keyingi maqsad: ${checks.find(c => !c.good)!.name} talabini bajaring.` : 'Joriy oy talablari bajarildi. Oy yakunida natija hisobga olinadi.'}</p>}
    </Card>
  );
}
