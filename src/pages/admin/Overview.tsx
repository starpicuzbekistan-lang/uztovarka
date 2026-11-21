import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { Badge, Card, ErrorState, LoadingBlock, Notice, PageHeader, Select, StatCard } from '@/components/ui';
import { MonthNav } from '@/components/MonthNav';
import { calculateMonth, DEFAULT_SETTINGS, pickSettings } from '@/lib/kpi';
import { DEFAULT_COLOR_THRESHOLDS, useKpiColorThresholds } from '@/lib/kpiColors';
import { buildEntries } from '@/lib/entries';
import { rowToVersion, type Attendance, type PayrollPeriod, type Report, type SettingsRow } from '@/lib/types';
import { formatDateTimeUz, parseIso, periodForMonth, tashkentToday } from '@/lib/dates';
import { formatAvg, formatNumber, formatUzs } from '@/lib/format';
import { humanError, REPORT_STATUS_UZ } from '@/lib/uz';

interface Recent { id: string; report_date: string; accepted_orders: number; status: keyof typeof REPORT_STATUS_UZ; submitted_at: string; operator: { full_name: string } | null }

export default function Overview() {
  const t = parseIso(tashkentToday());
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const [operator, setOperator] = useState('');
  const period = periodForMonth(ym.y, ym.m);
  const colorQuery = useKpiColorThresholds();
  // 016 migratsiyasi hali o‘rnatilmagan bo‘lsa ham boshqa dashboard statistikasi ochilsin.
  const colors = colorQuery.data ?? DEFAULT_COLOR_THRESHOLDS;

  const q = useQuery({
    queryKey: ['admin-overview', ym.y, ym.m, operator, colors.redBelow, colors.yellowBelow],
    queryFn: async () => {
      const [profiles, versions, reports, attendance, pps, pendingCount, recent, logs, anns] = await Promise.all([
        unwrap(supabase.from('profiles').select('id,full_name,is_active,role').eq('role', 'operator')) as Promise<{ id: string; full_name: string; is_active: boolean }[]>,
        unwrap(supabase.from('kpi_setting_versions').select('*')) as Promise<SettingsRow[]>,
        unwrap(supabase.from('daily_reports').select('*').gte('report_date', period.start).lte('report_date', period.end).limit(10000)) as Promise<Report[]>,
        unwrap(supabase.from('attendance_records').select('*').gte('record_date', period.start).lte('record_date', period.end).limit(10000)) as Promise<Attendance[]>,
        unwrap(supabase.from('payroll_periods').select('*').eq('start_date', period.start).eq('end_date', period.end)) as Promise<PayrollPeriod[]>,
        supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        unwrap(supabase.from('daily_reports').select('id,report_date,accepted_orders,status,submitted_at,operator:profiles!daily_reports_operator_id_fkey(full_name)').order('submitted_at', { ascending: false }).limit(6)) as unknown as Promise<Recent[]>,
        unwrap(supabase.from('audit_logs').select('id,action,entity,created_at').order('created_at', { ascending: false }).limit(5)) as Promise<{ id: string; action: string; entity: string; created_at: string }[]>,
        unwrap(supabase.from('announcements').select('id,title,status,published_at,created_at').order('created_at', { ascending: false }).limit(3)) as Promise<{ id: string; title: string; status: string; published_at: string | null; created_at: string }[]>,
      ]);
      const pp = pps[0] ?? null;
      const calcs = pp ? ((await unwrap(supabase.from('payroll_calculations').select('operator_id,payable_uzs,approved').eq('period_id', pp.id))) as { operator_id: string; payable_uzs: number; approved: boolean }[]) : [];
      const adjs = pp ? ((await unwrap(supabase.from('salary_adjustments').select('operator_id,amount_uzs').eq('period_id', pp.id))) as { operator_id: string; amount_uzs: number }[]) : [];

      const vs = versions.map(rowToVersion);
      const active = profiles.filter((p) => p.is_active && (!operator || p.id === operator));
      let orders = 0, greenDays = 0, workedDays = 0, finalized = 0;
      for (const p of active) {
        const base = pickSettings(vs, period.end, p.id) ?? DEFAULT_SETTINGS;
        const s = { ...base, workingDays: pp?.working_days ?? base.workingDays };
        const res = calculateMonth(buildEntries(reports.filter((r) => r.operator_id === p.id), attendance.filter((a) => a.operator_id === p.id)), s, adjs.filter((a) => a.operator_id === p.id).map((a) => Number(a.amount_uzs)), colors);
        orders += res.approvedOrders; greenDays += res.counts.green; workedDays += res.workedDays;
        const c = calcs.find((x) => x.operator_id === p.id);
        if (c?.approved) finalized += Number(c.payable_uzs);
      }
      return { total: profiles.length, active: profiles.filter((p) => p.is_active).length, pending: pendingCount.count ?? 0, orders, greenDays, workedDays, finalized, recent, logs, anns, operators: profiles.filter((p) => p.is_active), allOperatorIds: profiles.map(p => p.id) };
    },
  });
  const d = q.data;

  // Barcha operatorlarning joriy Asosiy balansi. Oylik filtriga bog‘liq emas,
  // Hold balansi qo‘shilmaydi. Serverdagi get_operator_wallet_v2 asosiy manba.
  const payable = useQuery({
    queryKey: ['admin-main-balances', d?.allOperatorIds],
    enabled: !!d,
    queryFn: async () => {
      const ids = d?.allOperatorIds ?? [];
      let total = 0;
      // Supabase RPC larni kichik guruh bilan o‘qib, juda ko‘p parallel so‘rov yubormaymiz.
      for (let i = 0; i < ids.length; i += 8) {
        const sums = await Promise.all(ids.slice(i, i + 8).map(async (id) => {
          const rows = (await unwrap(supabase.rpc('get_operator_wallet_v2', { p_operator: id }))) as { main_balance: number }[];
          if (!rows.length) throw new Error('Operator balansini yuklab bo‘lmadi.');
          const amount = Number(rows[0].main_balance);
          if (!Number.isFinite(amount)) throw new Error('Operator balansi noto‘g‘ri.');
          return amount;
        }));
        total += sums.reduce((a, b) => a + b, 0);
      }
      return total;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Boshqaruv paneli" />
      <div className="grid gap-2 sm:grid-cols-2"><MonthNav y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
        <Select value={operator} onChange={(e) => setOperator(e.target.value)} aria-label="Operator"><option value="">Barcha operatorlar</option>{(d?.operators ?? []).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</Select></div>
      {colorQuery.isError && <Notice tone="warn">Kun ranglari sozlamasi yuklanmadi. Supabase SQL Editor'da 016 migratsiyasini ishga tushiring. Boshqa ma’lumotlar vaqtincha avvalgi 40/50 chegaralari bilan ko‘rsatiladi.</Notice>}
      {q.isLoading && <LoadingBlock rows={4} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      {payable.isError && <Notice tone="warn">Operatorlarning umumiy Asosiy balansini yuklab bo‘lmadi. Supabase wallet funksiyalarini (012, 013, 015 SQL) tekshiring.</Notice>}
      {d && (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Jami operatorlar" value={d.total} hint={`${d.active} tasi faol`} />
          <Link to="/admin/hisobotlar"><StatCard label="Tasdiqlash kutilmoqda" value={d.pending} tone={d.pending ? 'yellow' : undefined} hint="Barcha sanalar bo‘yicha" /></Link>
          <StatCard label="Oylik tasdiqlangan qabul" value={formatNumber(d.orders)} />
          <StatCard label="Norma bajarilishi" value={d.workedDays ? `${formatAvg((d.greenDays / d.workedDays) * 100)}%` : '—'} hint="Yashil kunlar / ishlangan kunlar" />
          <StatCard label="Umumiy to‘lanishi kerak bo‘lgan pul" value={payable.isLoading ? '…' : payable.isError ? '—' : formatUzs(payable.data ?? 0)} hint="Barcha operatorlarning Asosiy balansi · Hold kirmaydi" />
          <StatCard label="Yakunlangan oyliklar" value={formatUzs(d.finalized)} hint="Tasdiqlangan summalar" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-2 p-4 lg:col-span-2"><h2 className="font-bold">So‘nggi hisobotlar</h2>
            {d.recent.length === 0 && <p className="text-sm text-neutral-500">Hisobotlar hali yo‘q.</p>}
            <ul className="divide-y divide-neutral-100">{d.recent.map((r) => <li key={r.id} className="flex items-center justify-between py-2 text-sm"><span>{r.operator?.full_name} <span className="text-neutral-400">· {r.report_date}</span></span><span className="flex items-center gap-2"><b className="tabular-nums">{r.accepted_orders}</b><Badge tone={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'yellow' : r.status === 'rejected' ? 'red' : 'blue'}>{REPORT_STATUS_UZ[r.status]}</Badge></span></li>)}</ul></Card>
          <div className="space-y-4">
            <Card className="space-y-2 p-4"><h2 className="font-bold">So‘nggi e’lonlar</h2>{d.anns.length === 0 && <p className="text-sm text-neutral-500">E’lonlar yo‘q.</p>}<ul className="space-y-1 text-sm">{d.anns.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title}</span><span className="text-xs text-neutral-400">{a.status === 'published' ? 'nashr' : 'qoralama'}</span></li>)}</ul></Card>
            <Card className="space-y-2 p-4"><h2 className="font-bold">So‘nggi amallar</h2>{d.logs.length === 0 && <p className="text-sm text-neutral-500">Amallar yo‘q.</p>}<ul className="space-y-1 text-xs text-neutral-600">{d.logs.map((l) => <li key={l.id}>{formatDateTimeUz(l.created_at)} · {l.entity}</li>)}</ul><Link to="/admin/tarix" className="text-xs font-semibold underline">Hammasini ko‘rish</Link></Card>
          </div>
        </div>
      </>)}
    </div>
  );
}
