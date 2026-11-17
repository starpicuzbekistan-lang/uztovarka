import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, ChevronDown, ChevronUp, Circle, Crown, Flame, Medal, Shield, Star, Target, Trophy, Zap } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useOperatorMonth } from '@/lib/useMonthData';
import { tashkentToday, parseIso } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { Card, ErrorState, LoadingBlock } from '@/components/ui';
import { humanError } from '@/lib/uz';

export type BadgeCode = '100' | '1000' | '10000' | 'overachiever' | 'green7' | 'green30' | 'team_champion' | 'week_operator' | 'month_operator';
export type OperatorBadge = { code: BadgeCode; earned: boolean; progress: number; target: number; earned_on: string | null };
const BADGES = {
  '100': { label: '100 ta qabul', about: 'Jami 100 ta tasdiqlangan qabul', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
  '1000': { label: '1 000 ta qabul', about: 'Jami 1 000 ta tasdiqlangan qabul', icon: Medal, color: 'text-amber-700', bg: 'bg-orange-50' },
  '10000': { label: '10 000 ta qabul', about: 'Jami 10 000 ta tasdiqlangan qabul', icon: Crown, color: 'text-violet-600', bg: 'bg-violet-50' },
  'overachiever': { label: 'Overachiever', about: 'Bir oyda shaxsiy maqsadning 150% ini bajarish', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
  'green7': { label: '7 Green Days', about: 'Bir oyda kamida 7 ta yashil kun', icon: Flame, color: 'text-green-600', bg: 'bg-green-50' },
  'green30': { label: '30 Green Days', about: 'Bir oyda 30 ta yashil kun', icon: Shield, color: 'text-green-700', bg: 'bg-green-50' },
  'team_champion': { label: 'Team Champion', about: 'Oy yakunida g‘olib jamoa a’zosi bo‘lish', icon: Trophy, color: 'text-yellow-700', bg: 'bg-yellow-50' },
  'week_operator': { label: 'Hafta operatori', about: 'Tugallangan haftada jami qabul bo‘yicha 1-o‘rin', icon: Star, color: 'text-blue-600', bg: 'bg-blue-50' },
  'month_operator': { label: 'Oy operatori', about: 'Tugallangan oyda jami qabul bo‘yicha 1-o‘rin', icon: Award, color: 'text-pink-600', bg: 'bg-pink-50' },
} as const;
export function useBadges(operatorId: string | undefined) {
  return useQuery({
    queryKey: ['operator-badges', operatorId],
    enabled: !!operatorId,
    queryFn: async () => (await unwrap(supabase.rpc('get_operator_badges', { p_operator: operatorId! }))) as OperatorBadge[],
  });
}
export default function OperatorMotivation({ operatorId }: { operatorId: string }) {
  const today = parseIso(tashkentToday());
  const monthStart = `${today.y}-${String(today.m).padStart(2, '0')}-01`;
  const reports = useOperatorMonth(operatorId, today.y, today.m);
  const badges = useBadges(operatorId);
  const goal = useQuery({
    queryKey: ['operator-month-goal', operatorId, monthStart],
    queryFn: async () => ((await unwrap(supabase.from('operator_monthly_goals')
      .select('target_orders').eq('operator_id',operatorId).eq('month_start',monthStart))) as {target_orders:number}[])[0] ?? null,
  });
  const [expanded,setExpanded] = useState(false);
  const accepted = reports.data?.result.approvedOrders ?? 0;
  const target = goal.data?.target_orders;
  const progress = target ? accepted / target * 100 : 0;
  const earned = (badges.data ?? []).filter(x => x.earned);
  const preview = (badges.data ?? []).slice(0, 5);
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
      <div className="flex items-center justify-between">
        <div><h2 className="font-bold">Badgelar</h2><p className="text-xs text-neutral-500">{earned.length}/9 ta yutuq qo‘lga kiritilgan</p></div>
        <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-neutral-100">
          {expanded?'Yopish':'Barchasi'}{expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
        </button>
      </div>
      {badges.isLoading ? <LoadingBlock rows={1}/> : badges.isError ?
        <ErrorState message={humanError(badges.error)} onRetry={()=>void badges.refetch()} /> :
        <>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {preview.map(b => {
              const meta = BADGES[b.code];
              if (!meta) return null;
              const Icon = meta.icon;
              return <div key={b.code} title={meta.about} className="flex min-w-0 flex-col items-center gap-1 text-center">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl sm:h-14 sm:w-14 ${b.earned?meta.bg:'bg-neutral-100'}`}>
                  <Icon size={22} className={b.earned?meta.color:'text-neutral-300'}/>
                </div>
                <span className="max-w-full text-[10px] font-semibold leading-tight text-neutral-600">{meta.label}</span>
              </div>;
            })}
          </div>
          {expanded && <div className="space-y-2 border-t border-neutral-100 pt-3" id="all-operator-badges">
            {(badges.data ?? []).map(b=>{
              const meta=BADGES[b.code];if(!meta)return null;
              const Icon=meta.icon;
              return <div key={b.code} className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3">
                <div className={`rounded-xl p-2.5 ${b.earned?meta.bg:'bg-neutral-100'}`}>
                  <Icon className={b.earned?meta.color:'text-neutral-300'} size={23}/>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-bold">{meta.label}{b.earned?<CheckCircle2 size={15} className="text-green-600"/>:<Circle size={15} className="text-neutral-400"/>}</div>
                  <p className="text-xs text-neutral-500">{meta.about}</p>
                  <p className="text-xs font-medium text-neutral-600">{b.earned
                    ? `Olingan${b.earned_on?' · '+b.earned_on:''}`
                    : b.target>1 ? `Progress: ${formatNumber(Number(b.progress))} / ${formatNumber(Number(b.target))}` : 'Hali olinmagan'}</p>
                </div>
              </div>;
            })}
          </div>}
        </>}
    </Card>
  </div>;
}
