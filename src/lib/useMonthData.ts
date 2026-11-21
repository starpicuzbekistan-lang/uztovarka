import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from './supabase';
import { periodForMonth } from './dates';
import { loadColorThresholds } from './kpiColors';
import { calculateMonth, pickSettings, DEFAULT_SETTINGS, type KpiSettings } from './kpi';
import { buildEntries } from './entries';
import { rowToVersion, type Adjustment, type Attendance, type Payment, type PayrollPeriod, type Report, type SettingsRow } from './types';

export interface PayrollCalcRow { id: string; payable_uzs: number; approved: boolean; snapshot: any; finalized_at: string }

/** Bitta operatorning bir oylik to‘liq ma’lumoti. RLS operatorga faqat o‘zinikini beradi; admin — istalganini. */
export function useOperatorMonth(operatorId: string | undefined, y: number, m: number) {
  const period = periodForMonth(y, m);
  return useQuery({
    queryKey: ['month', operatorId, y, m],
    enabled: !!operatorId,
    queryFn: async () => {
      const [versions, reports, attendance, periods, colors] = await Promise.all([
        unwrap(supabase.from('kpi_setting_versions').select('*')) as Promise<SettingsRow[]>,
        unwrap(supabase.from('daily_reports').select('*').eq('operator_id', operatorId!).gte('report_date', period.start).lte('report_date', period.end)) as Promise<Report[]>,
        unwrap(supabase.from('attendance_records').select('*').eq('operator_id', operatorId!).gte('record_date', period.start).lte('record_date', period.end)) as Promise<Attendance[]>,
        unwrap(supabase.from('payroll_periods').select('*').eq('start_date', period.start).eq('end_date', period.end)) as Promise<PayrollPeriod[]>,
        loadColorThresholds(),
      ]);
      const pp = periods[0] ?? null;
      const [adjustments, calcs, payments] = pp
        ? await Promise.all([
            unwrap(supabase.from('salary_adjustments').select('*').eq('operator_id', operatorId!).eq('period_id', pp.id).order('created_at')) as Promise<Adjustment[]>,
            unwrap(supabase.from('payroll_calculations').select('*').eq('operator_id', operatorId!).eq('period_id', pp.id)) as Promise<PayrollCalcRow[]>,
            unwrap(supabase.from('payroll_payments').select('*').eq('operator_id', operatorId!).eq('period_id', pp.id).order('paid_on')) as Promise<Payment[]>,
          ])
        : [[] as Adjustment[], [] as PayrollCalcRow[], [] as Payment[]];

      const base: KpiSettings = pickSettings(versions.map(rowToVersion), period.end, operatorId) ?? DEFAULT_SETTINGS;
      const settings: KpiSettings = { ...base, workingDays: pp?.working_days ?? base.workingDays };
      const entries = buildEntries(reports, attendance);
      const manual = adjustments.map((a) => Number(a.amount_uzs));
      const result = calculateMonth(entries, settings, manual, colors);
      return { period, payrollPeriod: pp, settings, colors, reports, attendance, entries, adjustments, calc: calcs[0] ?? null, payments, result };
    },
  });
}
