import type { DayEntry, ReportStatus } from './kpi';

export interface ReportLike { report_date: string; accepted_orders: number; status: ReportStatus }
export interface AttendanceLike { record_date: string; kind: 'absent' | 'leave' | 'day_off' }

/** DB qatorlarini hisoblash mexanizmi tushunadigan kunlik yozuvlarga aylantiradi. */
export function buildEntries(reports: ReportLike[], attendance: AttendanceLike[]): DayEntry[] {
  const out: DayEntry[] = reports.map((r) => ({
    date: r.report_date, kind: 'worked', accepted: r.accepted_orders, status: r.status,
  }));
  for (const a of attendance) {
    out.push({ date: a.record_date, kind: a.kind === 'absent' ? 'absence' : a.kind === 'leave' ? 'leave' : 'day_off' });
  }
  return out;
}
