/**
 * Kunlik hisobot qoidalari. Bu yerdagi mantiq UI uchun oldindan tekshiruv;
 * yakuniy hakam — Postgres RPC funksiyalari (supabase/migrations/002_functions.sql), ular aynan shu qoidalarni bajaradi.
 */
import { isValidCount, type ReportStatus } from './kpi';

export type SubmitError = 'invalid_count' | 'duplicate' | 'backdated' | 'future' | 'inactive';

export function validateSubmission(input: {
  count: unknown;
  reportDate: string;
  today: string;
  alreadyExists: boolean;
  allowBackdate?: boolean;
  isActive?: boolean;
}): { ok: true } | { ok: false; code: SubmitError } {
  if (input.isActive === false) return { ok: false, code: 'inactive' };
  if (!isValidCount(input.count)) return { ok: false, code: 'invalid_count' };
  if (input.reportDate > input.today) return { ok: false, code: 'future' };
  if (input.reportDate < input.today && !input.allowBackdate) return { ok: false, code: 'backdated' };
  if (input.alreadyExists) return { ok: false, code: 'duplicate' };
  return { ok: true };
}

export type ReviewAction = 'approve' | 'reject' | 'request_correction';
export type ReviewError = 'not_admin' | 'self_review' | 'not_pending' | 'note_required';

export function reviewReport(input: {
  status: ReportStatus;
  operatorId: string;
  reviewerId: string;
  reviewerRole: 'admin' | 'operator';
  action: ReviewAction;
  note?: string;
}): { ok: true; next: ReportStatus } | { ok: false; code: ReviewError } {
  if (input.reviewerRole !== 'admin') return { ok: false, code: 'not_admin' };
  if (input.reviewerId === input.operatorId) return { ok: false, code: 'self_review' };
  if (input.status !== 'pending') return { ok: false, code: 'not_pending' };
  if (input.action !== 'approve' && !(input.note && input.note.trim())) return { ok: false, code: 'note_required' };
  const next: ReportStatus =
    input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'correction_requested';
  return { ok: true, next };
}

export interface HistoryEntry {
  at: string;
  by: string;
  from: number;
  to: number;
  note: string;
}

/** Admin tuzatishi: asl qiymat saqlanadi, sabab majburiy. */
export function correctReport(
  report: { acceptedOrders: number; originalOrders: number; history: HistoryEntry[] },
  newCount: number,
  by: string,
  note: string,
  at: string,
): { ok: true; report: typeof report } | { ok: false; code: 'invalid_count' | 'note_required' } {
  if (!isValidCount(newCount)) return { ok: false, code: 'invalid_count' };
  if (!note.trim()) return { ok: false, code: 'note_required' };
  return {
    ok: true,
    report: {
      acceptedOrders: newCount,
      originalOrders: report.originalOrders,
      history: [...report.history, { at, by, from: report.acceptedOrders, to: newCount, note }],
    },
  };
}
