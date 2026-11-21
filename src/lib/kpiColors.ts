import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from './supabase';

/** Rang chegaralari — oylik/bonus normasi bilan bog‘liq emas. */
export interface KpiColorThresholds { redBelow: number; yellowBelow: number }
export const DEFAULT_COLOR_THRESHOLDS: KpiColorThresholds = { redBelow: 40, yellowBelow: 50 };

export const validColorThresholds = (v: KpiColorThresholds): boolean =>
  Number.isInteger(v.redBelow) && Number.isInteger(v.yellowBelow) &&
  v.redBelow >= 0 && v.redBelow < v.yellowBelow && v.yellowBelow <= 1_000_000;

export async function loadColorThresholds(): Promise<KpiColorThresholds> {
  const row = (await unwrap(supabase.from('kpi_color_thresholds')
    .select('red_below,yellow_below').eq('id', 1).single())) as { red_below: number; yellow_below: number };
  const result = { redBelow: Number(row.red_below), yellowBelow: Number(row.yellow_below) };
  if (!validColorThresholds(result)) throw new Error('Kun ranglari chegaralari noto‘g‘ri.');
  return result;
}

export function useKpiColorThresholds() {
  return useQuery({ queryKey: ['kpi-color-thresholds'], queryFn: loadColorThresholds,
    staleTime: 30_000, refetchOnWindowFocus: true, refetchInterval: 30_000 });
}
