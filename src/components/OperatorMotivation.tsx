import { Link } from 'react-router-dom';
import { ChevronRight, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { useOperatorMonth } from '@/lib/useMonthData';
import { useOperatorAchievements } from '@/lib/earnedBadges';
import { BadgeExplanation, BadgePreviewIcon } from '@/components/BadgeVisuals';
import { tashkentToday, parseIso } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { Card, ErrorState, LoadingBlock } from '@/components/ui';
import { humanError } from '@/lib/uz';

export default function OperatorMotivation({ operatorId }: { operatorId: string }) {
  const today = parseIso(tashkentToday());
  const monthStart = `${today.y}-${String(today.m).padStart(2, '0')}-01`;
  const reports = useOperatorMonth(operatorId, today.y, today.m);
  const badges = useOperatorAchievements(operatorId);
  const goal = useQuery({
    queryKey: ['operator-month-goal', operatorId, monthStart],
    queryFn: async () => ((await unwrap(supabase.from('operator_monthly_goals')
      .select('target_orders').eq('operator_id',operatorId).eq('month_start',monthStart))) as {target_orders:number}[])[0] ?? null,
  });
  const accepted = reports.data?.result.approvedOrders ?? 0;
  const target = goal.data?.target_orders;
  const progress = target ? accepted / target * 100 : 0;
  const earned = badges.data?.items ?? [];

  return <div className="space-y-4">
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-500" /><h2 className="font-bold">Oylik maqsad</h2></div>
        {target && <span className="text-sm font-bold tabular-nums">{Number(progress.toFixed(1))}%</span>}
      </div>
      {goal.isLoading || reports.isLoading ? <LoadingBlock rows={1} /> : goal.isError || reports.isError ?
        <ErrorState message={humanError(goal.error ?? reports.error)} onRetry={() => {void goal.refetch();void reports.refetch();}} /> :
        !target ? <p className="text-sm text-neutral-500">Administrator bu oy uchun maqsadni hali belgilamagan.</p> :
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold tabular-nums">{formatNumber(accepted)} <span className="text-sm font-normal text-neutral-500">qabul</span></span>
            <span className="text-xs text-neutral-500">Maqsad: {formatNumber(target)}</span>
          </div>
          <div role="progressbar" aria-valuenow={Math.min(100,Math.round(progress))} aria-valuemin={0} aria-valuemax={100}
            className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-brand transition-all" style={{width:`${Math.min(100,progress)}%`}} />
          </div>
          <p className="text-xs text-neutral-500">{progress>=150?'Overachiever! Maqsadning 150% ga erishdingiz.':progress>=100?'Oylik maqsad bajarildi!':`Maqsadga yana ${formatNumber(Math.max(0,target-accepted))} ta qabul qoldi.`}</p>
        </>}
    </Card>
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-bold">Badgelar</h2>
          <p className="text-xs text-neutral-500">{badges.isLoading?'Yuklanmoqda…':`${earned.length} ta qo‘lga kiritilgan badge`}</p>
        </div>
        <Link to="/profil/badgelar" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-bold text-ink hover:bg-neutral-100">
          Barchasi <ChevronRight size={17}/>
        </Link>
      </div>
      <BadgeExplanation/>
      {badges.data?.autoWarning&&<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{badges.data.autoWarning}</p>}
      {badges.data?.specialWarning&&<p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">{badges.data.specialWarning}</p>}
      {badges.isLoading?<LoadingBlock rows={1}/>:
       badges.isError?<ErrorState message={humanError(badges.error)} onRetry={()=>void badges.refetch()}/>:
       earned.length===0?<div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
         Hozircha badge yo‘q. Birinchi g‘alaba sizni kutmoqda!
       </div>:
       <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
         {earned.slice(0,5).map(item=><BadgePreviewIcon key={item.code} item={item}/>)}
       </div>}
    </Card>
  </div>;
}
