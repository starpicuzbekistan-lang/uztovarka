import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from './supabase';
import type { DayStatus } from './kpi';
import { tashkentToday } from './dates';

export interface KpiColorThreshold {
  effective_from: string;
  red_below: number;
  green_from: number;
}
export const DEFAULT_COLOR_THRESHOLDS: KpiColorThreshold = {
  effective_from: '1900-01-01',
  red_below: 40,
  green_from: 50,
};

export function useDayColorRules() {
  return useQuery({
    queryKey: ['kpi-color-thresholds'],
    staleTime: 30_000,
    queryFn: async () => await unwrap(
      supabase.from('kpi_color_thresholds')
        .select('effective_from,red_below,green_from')
        .order('effective_from', { ascending: false }),
    ) as KpiColorThreshold[],
  });
}

export function thresholdsAt(date: string, versions: KpiColorThreshold[] | undefined): KpiColorThreshold {
  return versions?.filter(v => v.effective_from <= date)
    .sort((a,b) => b.effective_from.localeCompare(a.effective_from))[0]
    ?? DEFAULT_COLOR_THRESHOLDS;
}

/** Visual KPI only. Monetary acceptance limits remain independent. */
export function classifyColorDay(accepted: number, date: string, versions: KpiColorThreshold[] | undefined): DayStatus {
  const { red_below, green_from } = thresholdsAt(date, versions);
  if (accepted >= green_from) return 'green';
  if (accepted >= red_below) return 'yellow';
  return 'red';
}

export function countColorDays(
  reports: {report_date:string;accepted_orders:number;status:string;is_demo?:boolean}[],
  versions: KpiColorThreshold[] | undefined,
) {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const report of reports) {
    if (report.status === 'approved' && !report.is_demo) counts[classifyColorDay(report.accepted_orders,report.report_date,versions)]++;
  }
  return counts;
}

/** Current local rule is effective for newly submitted KPI days. */
export function currentColorThresholds(versions: KpiColorThreshold[] | undefined) {
  return thresholdsAt(tashkentToday(), versions);
}
