import { calculateMonth, type DayEntry, type KpiSettings, type MonthResult } from './kpi';

export interface PayrollSnapshot {
  operatorId: string;
  period: { start: string; end: string; workingDays: number };
  settings: KpiSettings; // o‘sha paytdagi sozlamalar nusxasi
  manualAdjustmentsUzs: number[];
  result: MonthResult;
  payableUzs: number;
  finalizedAt: string;
}

export type FinalizeError = 'pending_reports' | 'already_finalized';

/**
 * Oylikni yakunlaydi. Natija — sozlamalarning to‘liq nusxasi bilan muhrlangan "snapshot":
 * keyinchalik KPI sozlamalari o‘zgarsa ham yakunlangan oylik o‘zgarmaydi.
 * Kutilayotgan (tasdiqlanmagan) hisobotlar bo‘lsa yakunlash bloklanadi.
 */
export function finalizePayroll(input: {
  operatorId: string;
  period: { start: string; end: string; workingDays: number };
  entries: DayEntry[];
  settings: KpiSettings;
  manualAdjustmentsUzs?: number[];
  alreadyFinalized?: boolean;
  now?: string;
}): { ok: true; snapshot: Readonly<PayrollSnapshot> } | { ok: false; code: FinalizeError; pending?: number } {
  if (input.alreadyFinalized) return { ok: false, code: 'already_finalized' };
  const settings: KpiSettings = { ...input.settings, workingDays: input.period.workingDays };
  const manual = [...(input.manualAdjustmentsUzs ?? [])];
  const result = calculateMonth(input.entries, settings, manual);
  if (result.counts.pending > 0) return { ok: false, code: 'pending_reports', pending: result.counts.pending };
  const snapshot: PayrollSnapshot = {
    operatorId: input.operatorId,
    period: { ...input.period },
    settings,
    manualAdjustmentsUzs: manual,
    result,
    payableUzs: result.projectedUzs,
    finalizedAt: input.now ?? new Date().toISOString(),
  };
  return { ok: true, snapshot: Object.freeze(snapshot) };
}

export type PaymentStatus = 'calculating' | 'pending_approval' | 'approved' | 'partially_paid' | 'paid';

export function paymentStatus(payableUzs: number | null, paidUzs: number, approved: boolean): PaymentStatus {
  if (payableUzs === null) return 'calculating';
  if (!approved) return 'pending_approval';
  if (paidUzs <= 0) return 'approved';
  return paidUzs >= payableUzs ? 'paid' : 'partially_paid';
}
