import type { KpiSettings, KpiSettingsVersion, ReportStatus } from './kpi';
import { DEFAULT_SETTINGS } from './kpi';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  position: string;
  employee_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'operator';
  is_active: boolean;
  signup_requested_at?: string | null;
  signup_reviewed_at?: string | null;
  notify_reports: boolean;
  notify_announcements: boolean;
  allow_backdated_reports: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  operator_id: string;
  report_date: string;
  accepted_orders: number;
  original_orders: number;
  status: ReportStatus;
  review_note: string | null;
  submitted_at: string;
  is_demo: boolean;
}

export interface Attendance {
  id: string;
  operator_id: string;
  record_date: string;
  kind: 'absent' | 'leave' | 'day_off';
  note: string | null;
}

export interface SettingsRow {
  id: string;
  operator_id: string | null;
  effective_from: string;
  monthly_target_uzs: number;
  working_days: number;
  daily_target: number;
  min_threshold: number;
  shortfall_coef_uzs: number;
  bonus_coef_uzs: number;
  absence_rule: KpiSettings['absenceRule'];
  absence_fixed_uzs: number;
  leave_policy: KpiSettings['leavePolicy'];
  note: string | null;
  created_at: string;
}

export const rowToVersion = (r: SettingsRow): KpiSettingsVersion => ({
  effectiveFrom: r.effective_from,
  operatorId: r.operator_id,
  monthlyTargetUzs: Number(r.monthly_target_uzs),
  workingDays: r.working_days,
  dailyTarget: r.daily_target,
  minThreshold: r.min_threshold,
  shortfallCoefUzs: Number(r.shortfall_coef_uzs),
  bonusCoefUzs: Number(r.bonus_coef_uzs),
  absenceRule: r.absence_rule,
  absenceFixedUzs: Number(r.absence_fixed_uzs),
  leavePolicy: r.leave_policy,
});

export const FALLBACK_SETTINGS: KpiSettings = DEFAULT_SETTINGS;

export interface PayrollPeriod {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: 'open' | 'locked';
}

export interface Payment {
  id: string;
  period_id: string;
  operator_id: string;
  kind: 'advance' | 'partial' | 'final';
  amount_uzs: number;
  paid_on: string;
  note: string | null;
}

export interface Adjustment {
  id: string;
  operator_id: string;
  period_id: string;
  amount_uzs: number;
  reason: string;
  created_at: string;
}
