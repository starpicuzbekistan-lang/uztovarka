import type { KpiColorThresholds } from './kpiColors';

/**
 * KPI oylik hisoblash mexanizmi (sof funksiyalar, tarmoqsiz).
 * Barcha pul qiymatlari butun so‘mda (UZS). Yaxlitlash faqat yakuniy yig‘indida bajariladi.
 */

export type AbsenceRule = 'prorata' | 'fixed' | 'none';
export type LeavePolicy = 'neutral' | 'same_as_absence';
export type ReportStatus = 'pending' | 'approved' | 'rejected' | 'correction_requested';
export type DayStatus = 'green' | 'yellow' | 'red';

export interface KpiSettings {
  monthlyTargetUzs: number;
  workingDays: number;
  dailyTarget: number;
  minThreshold: number;
  /** Ichki hisob koeffitsiyenti (operatorga "buyurtma narxi" sifatida ko‘rsatilmaydi). */
  shortfallCoefUzs: number;
  bonusCoefUzs: number;
  absenceRule: AbsenceRule;
  /** Faqat absenceRule === 'fixed' bo‘lganda. */
  absenceFixedUzs: number;
  leavePolicy: LeavePolicy;
}

export const DEFAULT_SETTINGS: KpiSettings = {
  monthlyTargetUzs: 2_000_000,
  workingDays: 30,
  dailyTarget: 50,
  minThreshold: 40,
  shortfallCoefUzs: 1_000,
  bonusCoefUzs: 2_000,
  absenceRule: 'prorata',
  absenceFixedUzs: 0,
  leavePolicy: 'neutral',
};

export type DayEntry =
  | { date: string; kind: 'worked'; accepted: number; status: ReportStatus }
  | { date: string; kind: 'absence' }
  | { date: string; kind: 'leave' }
  | { date: string; kind: 'day_off' };

export function isValidCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

export function assertCount(n: unknown): asserts n is number {
  if (!isValidCount(n)) throw new RangeError('accepted orders must be a non-negative integer');
}

export function classifyDay(accepted: number, s: KpiSettings = DEFAULT_SETTINGS, colors?: KpiColorThresholds): DayStatus {
  assertCount(accepted);
  if (accepted >= (colors?.yellowBelow ?? s.dailyTarget)) return 'green';
  if (accepted >= (colors?.redBelow ?? s.minThreshold)) return 'yellow';
  return 'red';
}

/** Tasdiqlangan ish kuni uchun kunlik tuzatma (manfiy = kamayish, musbat = bonus). */
export function dailyAdjustment(accepted: number, s: KpiSettings = DEFAULT_SETTINGS): number {
  assertCount(accepted);
  let v = 0;
  if (accepted < s.dailyTarget) v = -(s.dailyTarget - accepted) * s.shortfallCoefUzs;
  else if (accepted > s.dailyTarget) v = (accepted - s.dailyTarget) * s.bonusCoefUzs;
  return v === 0 ? 0 : v;
}

/** `n` ta kun uchun sozlangan qoida bo‘yicha jami kamayish (manfiy son). Yaxlitlash oxirida. */
export function absenceTotal(n: number, s: KpiSettings): number {
  if (n <= 0 || s.absenceRule === 'none') return 0;
  if (s.absenceRule === 'fixed') return -n * s.absenceFixedUzs;
  const v = -Math.round((s.monthlyTargetUzs * n) / s.workingDays);
  return v === 0 ? 0 : v;
}

/**
 * Bir sana uchun bir nechta yozuv bo‘lsa, ikki marta hisoblanmasligi uchun bittasi tanlanadi:
 * admin davomat yozuvlari hisobotdan ustun; ikki hisobotdan tasdiqlangani ustun.
 */
export function dedupeEntries(entries: DayEntry[]): DayEntry[] {
  const byDate = new Map<string, DayEntry>();
  for (const e of entries) {
    const cur = byDate.get(e.date);
    if (!cur) {
      byDate.set(e.date, e);
      continue;
    }
    if (cur.kind === 'worked' && e.kind !== 'worked') byDate.set(e.date, e);
    else if (cur.kind === 'worked' && e.kind === 'worked' && cur.status !== 'approved' && e.status === 'approved') {
      byDate.set(e.date, e);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthResult {
  baseUzs: number;
  shortfallUzs: number; // <= 0
  bonusUzs: number; // >= 0
  absenceUzs: number; // <= 0
  manualUzs: number;
  rawUzs: number;
  /** Taxminiy oylik (manfiy bo‘lmaydi). Yakuniy emas! */
  projectedUzs: number;
  /** Tasdiqlanmagan (kutilayotgan) hisobotlarning taxminiy ta’siri — hisobga kiritilmaydi. */
  pendingImpactUzs: number;
  approvedOrders: number;
  workedDays: number;
  avgPerWorkedDay: number;
  counts: {
    reported: number;
    approved: number;
    pending: number;
    rejected: number;
    green: number;
    yellow: number;
    red: number;
    absences: number;
    leaves: number;
    daysOff: number;
  };
}

export function calculateMonth(
  rawEntries: DayEntry[],
  s: KpiSettings = DEFAULT_SETTINGS,
  manualAdjustmentsUzs: number[] = [],
  colors?: KpiColorThresholds,
): MonthResult {
  const entries = dedupeEntries(rawEntries);
  const c = { reported: 0, approved: 0, pending: 0, rejected: 0, green: 0, yellow: 0, red: 0, absences: 0, leaves: 0, daysOff: 0 };
  let shortfall = 0;
  let bonus = 0;
  let pendingImpact = 0;
  let orders = 0;

  for (const e of entries) {
    if (e.kind === 'absence') c.absences++;
    else if (e.kind === 'leave') c.leaves++;
    else if (e.kind === 'day_off') c.daysOff++;
    else {
      c.reported++;
      if (e.status === 'approved') {
        c.approved++;
        orders += e.accepted;
        c[classifyDay(e.accepted, s, colors)]++;
        const adj = dailyAdjustment(e.accepted, s);
        if (adj < 0) shortfall += adj;
        else bonus += adj;
      } else if (e.status === 'pending') {
        c.pending++;
        pendingImpact += dailyAdjustment(e.accepted, s);
      } else if (e.status === 'rejected') c.rejected++;
    }
  }

  const absenceDays = c.absences + (s.leavePolicy === 'same_as_absence' ? c.leaves : 0);
  const absence = absenceTotal(absenceDays, s);
  const manual = manualAdjustmentsUzs.reduce((a, b) => a + b, 0);
  const raw = s.monthlyTargetUzs + shortfall + bonus + absence + manual;

  return {
    baseUzs: s.monthlyTargetUzs,
    shortfallUzs: shortfall,
    bonusUzs: bonus,
    absenceUzs: absence,
    manualUzs: manual,
    rawUzs: raw,
    projectedUzs: Math.max(0, raw),
    pendingImpactUzs: pendingImpact,
    approvedOrders: orders,
    workedDays: c.approved,
    avgPerWorkedDay: c.approved > 0 ? orders / c.approved : 0,
    counts: c,
  };
}

/** Bitta kun uchun kalendar/tafsilot ma’lumoti. */
export function describeDay(e: DayEntry | undefined, s: KpiSettings, colors?: KpiColorThresholds) {
  if (!e) return { state: 'none' as const, adjustment: 0 };
  if (e.kind === 'absence') return { state: 'absence' as const, adjustment: absenceTotal(1, s) };
  if (e.kind === 'leave') {
    return { state: 'leave' as const, adjustment: s.leavePolicy === 'same_as_absence' ? absenceTotal(1, s) : 0 };
  }
  if (e.kind === 'day_off') return { state: 'day_off' as const, adjustment: 0 };
  if (e.status === 'approved') {
    return { state: classifyDay(e.accepted, s, colors), adjustment: dailyAdjustment(e.accepted, s), accepted: e.accepted };
  }
  return { state: e.status, adjustment: 0, accepted: e.accepted };
}

/** Tanlangan sanaga amal qiladigan sozlamalar versiyasini topadi (operatorga xos > umumiy). */
export interface KpiSettingsVersion extends KpiSettings {
  effectiveFrom: string; // YYYY-MM-DD
  operatorId?: string | null;
}

export function pickSettings(
  versions: KpiSettingsVersion[],
  date: string,
  operatorId?: string,
): KpiSettings | undefined {
  const eligible = versions.filter((v) => v.effectiveFrom <= date);
  const latest = (list: KpiSettingsVersion[]) =>
    list.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const own = operatorId ? latest(eligible.filter((v) => v.operatorId === operatorId)) : undefined;
  const global = latest(eligible.filter((v) => !v.operatorId));
  const v = own ?? global;
  if (!v) return undefined;
  const { effectiveFrom: _e, operatorId: _o, ...settings } = v;
  return settings;
}
