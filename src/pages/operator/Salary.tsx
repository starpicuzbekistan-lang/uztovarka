import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Info } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useOperatorMonth } from '@/lib/useMonthData';
import { KpiCalendar, STATE_META } from '@/components/KpiCalendar';
import { MonthNav } from '@/components/MonthNav';
import {
  Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, LoadingBlock, Modal, Notice, PageHeader, StatCard, useToast, EmptyState,
} from '@/components/ui';
import { formatAvg, formatNumber, formatSigned, formatUzs } from '@/lib/format';
import { formatDateUz, parseIso, tashkentToday } from '@/lib/dates';
import { classifyDay, dailyAdjustment, describeDay, isValidCount, type KpiSettings } from '@/lib/kpi';
import { validateSubmission } from '@/lib/reports';
import { paymentStatus } from '@/lib/payroll';
import { humanError, ATTENDANCE_UZ, PAYMENT_KIND_UZ, PAYMENT_STATUS_UZ, REPORT_STATUS_UZ } from '@/lib/uz';
import type { Report } from '@/lib/types';

const SUBMIT_ERR: Record<string, string> = {
  invalid_count: 'Buyurtmalar soni manfiy bo‘lmagan butun son bo‘lishi kerak.',
  duplicate: 'Bu sana uchun hisobot allaqachon topshirilgan.',
  backdated: 'O‘tgan sana uchun hisobot topshirishga ruxsat yo‘q.',
  future: 'Kelajak sanasiga hisobot topshirib bo‘lmaydi.',
  inactive: 'Hisobingiz faol emas.',
};

const TONE = { green: 'green', yellow: 'yellow', red: 'red' } as const;
const KPI_WORD = { green: 'Yashil', yellow: 'Sariq', red: 'Qizil' } as const;

function TodayCard({ today, report, settings, attendanceToday, onDone }: {
  today: string; report: Report | undefined; settings: KpiSettings; attendanceToday?: string; onDone: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const resubmit = report?.status === 'correction_requested';

  const send = useMutation({
    mutationFn: async (count: number) => {
      if (resubmit) await unwrap(supabase.rpc('resubmit_report', { p_id: report!.id, p_count: count }));
      else await unwrap(supabase.rpc('submit_daily_report', { p_count: count }));
    },
    onSuccess: () => { setValue(''); setConfirm(false); toast('success', 'Natijangiz yuborildi. Administrator tasdiqlashini kuting.'); onDone(); },
    onError: (e) => { setConfirm(false); setError(humanError(e)); },
  });

  const parsed = value.trim() === '' ? NaN : Number(value);
  function validate(): number | null {
    const v = validateSubmission({ count: parsed, reportDate: today, today, alreadyExists: !!report && !resubmit });
    if (!v.ok) { setError(SUBMIT_ERR[v.code]); return null; }
    setError(null);
    return parsed;
  }

  const showForm = !report || resubmit;
  const draftOk = isValidCount(parsed);

  return (
    <Card>
      <h2 className="text-lg font-bold">Bugungi qabul natijasi</h2>
      <p className="text-sm text-neutral-500">{formatDateUz(today)}</p>

      {attendanceToday && <div className="mt-3"><Notice tone="info">Bugun uchun davomat belgilangan: {attendanceToday}.</Notice></div>}

      {report && !resubmit && (
        <div className="mt-3 space-y-3">
          {report.status === 'pending' && <Notice tone="warn">Hisobotingiz tasdiqlanishi kutilmoqda.</Notice>}
          {report.status === 'approved' && <Notice tone="success">Hisobotingiz tasdiqlandi.</Notice>}
          {report.status === 'rejected' && <Notice tone="error">Hisobotingiz rad etildi.{report.review_note ? ` Sabab: ${report.review_note}` : ''}</Notice>}
          <div className="flex items-baseline justify-between rounded-xl bg-neutral-50 p-3">
            <span className="text-sm text-neutral-600">Yuborilgan natija</span>
            <span className="text-2xl font-bold tabular-nums">{report.accepted_orders} ta</span>
          </div>
          {report.status === 'pending' && (
            <p className="text-sm text-neutral-600">
              <Badge tone={TONE[classifyDay(report.accepted_orders, settings)]}>{KPI_WORD[classifyDay(report.accepted_orders, settings)]} kun</Badge>{' '}
              Tasdiqlansa, oylikka taxminiy ta’siri: <strong>{formatSigned(dailyAdjustment(report.accepted_orders, settings))}</strong>
            </p>
          )}
        </div>
      )}

      {resubmit && <div className="mt-3"><Notice tone="warn">Administrator natijani tuzatishni so‘radi.{report?.review_note ? ` Izoh: ${report.review_note}` : ''}</Notice></div>}

      {showForm && !attendanceToday && (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (validate() !== null) setConfirm(true); }} noValidate>
          {!resubmit && <p className="text-sm text-neutral-600">Bugun nechta buyurtma qabul qildingiz?</p>}
          <Field label="Qabul qilingan buyurtmalar soni" error={error}>
            <Input inputMode="numeric" pattern="[0-9]*" placeholder="Masalan, 62" value={value}
              onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setError(null); }} className="text-lg font-semibold" />
          </Field>
          {draftOk && (
            <p className="text-sm text-neutral-600">
              <Badge tone={TONE[classifyDay(parsed, settings)]}>{KPI_WORD[classifyDay(parsed, settings)]} kun</Badge>{' '}
              Tasdiqlansa, oylikka taxminiy ta’siri: <strong>{formatSigned(dailyAdjustment(parsed, settings))}</strong>
            </p>
          )}
          <Button type="submit" size="lg" className="w-full">{resubmit ? 'Tuzatilgan natijani yuborish' : 'Natijani yuborish'}</Button>
        </form>
      )}

      <ConfirmDialog
        open={confirm} title="Natijani yuborish"
        message={<>Bugun <strong>{parsed} ta</strong> buyurtma qabul qilganingizni tasdiqlaysizmi? Yuborilgandan keyin natijani faqat administrator o‘zgartira oladi.</>}
        confirmLabel="Ha, yuborish" onClose={() => setConfirm(false)} onConfirm={async () => { await send.mutateAsync(parsed).catch(() => {}); }}
      />
    </Card>
  );
}

export default function Salary() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const today = tashkentToday();
  const t = parseIso(today);
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const [sel, setSel] = useState<string | null>(null);
  const q = useOperatorMonth(profile?.id, ym.y, ym.m);
  const isCurrent = ym.y === t.y && ym.m === t.m;

  if (q.isLoading) return <><PageHeader title="Oylik to‘lov" /><LoadingBlock rows={4} /></>;
  if (q.isError || !q.data) return <><PageHeader title="Oylik to‘lov" /><ErrorState onRetry={() => void q.refetch()} /></>;
  const d = q.data;
  const { result: r, settings } = d;
  const finalized = d.calc?.approved ? d.calc : null;
  const paid = d.payments.reduce((s, p) => s + Number(p.amount_uzs), 0);
  const status = paymentStatus(finalized ? Number(finalized.payable_uzs) : null, paid, !!finalized);

  const selEntry = sel ? d.entries.find((e) => e.date === sel) : undefined;
  const selInfo = sel ? describeDay(selEntry, settings) : null;
  const selReport = sel ? d.reports.find((x) => x.report_date === sel) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Oylik to‘lov" />
      <MonthNav y={ym.y} m={ym.m} onChange={(y, m) => { setYm({ y, m }); setSel(null); }} />

      {/* Asosiy summa */}
      <Card className="bg-ink text-white">
        {finalized ? (
          <>
            <p className="text-sm text-neutral-300">Tasdiqlangan to‘lov summasi</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-brand">{formatUzs(Number(finalized.payable_uzs))}</p>
            <div className="mt-3 flex items-center gap-2"><Badge tone="yellow">{PAYMENT_STATUS_UZ[status]}</Badge>
              {paid > 0 && <span className="text-sm text-neutral-300">To‘langan: {formatUzs(paid)}</span>}</div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-300">Taxminiy oylik <span className="text-neutral-400">(yakuniy emas)</span></p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-brand">{formatUzs(r.projectedUzs)}</p>
            <p className="mt-2 text-sm text-neutral-300">Oylik maqsad: {formatUzs(settings.monthlyTargetUzs)}</p>
            <div className="mt-3"><Badge tone="neutral">{PAYMENT_STATUS_UZ[status]}</Badge></div>
          </>
        )}
      </Card>
      {!finalized && (
        <Notice tone="info">
          Bu summa — faqat <strong>tasdiqlangan</strong> kunlik natijalarga asoslangan taxminiy hisob. U to‘lov kafolati emas: yakuniy summa oy yakunida administrator tasdiqlagandan keyin belgilanadi.
          {r.counts.pending > 0 && <> Hozir tasdiqlanishini kutayotgan hisobotlar: <strong>{r.counts.pending} ta</strong> (ular hisobga olinmagan).</>}
        </Notice>
      )}

      {isCurrent && (
        <TodayCard
          today={today} report={d.reports.find((x) => x.report_date === today)} settings={settings}
          attendanceToday={(() => { const a = d.attendance.find((x) => x.record_date === today); return a ? ATTENDANCE_UZ[a.kind] : undefined; })()}
          onDone={() => void qc.invalidateQueries({ queryKey: ['month'] })}
        />
      )}

      {/* Kalendar */}
      <Card>
        <h2 className="mb-3 text-lg font-bold">KPI kalendari</h2>
        <KpiCalendar period={d.period} entries={d.entries} settings={settings} today={today} selected={sel} onSelect={setSel} />
      </Card>

      {/* Hisob-kitob tafsiloti */}
      <Card>
        <h2 className="mb-3 text-lg font-bold">Oylik qanday shakllandi</h2>
        <dl className="divide-y divide-neutral-100 text-[15px]">
          <Row label="Oylik maqsad" value={formatUzs(r.baseUzs)} />
          <Row label="Norma bajarilmagan kunlar bo‘yicha tuzatma" value={formatSigned(r.shortfallUzs)} tone={r.shortfallUzs < 0 ? 'neg' : undefined} />
          <Row label="Ortiqcha natija uchun bonus" value={formatSigned(r.bonusUzs)} tone={r.bonusUzs > 0 ? 'pos' : undefined} />
          {r.counts.absences + r.counts.leaves > 0 && <Row label="Kelmagan kunlar bo‘yicha tuzatma" value={formatSigned(r.absenceUzs)} tone={r.absenceUzs < 0 ? 'neg' : undefined} />}
          {d.adjustments.map((a) => <Row key={a.id} label={`Qo‘shimcha tuzatma: ${a.reason}`} value={formatSigned(Number(a.amount_uzs))} tone={a.amount_uzs < 0 ? 'neg' : 'pos'} />)}
          <Row label={finalized ? 'Yakuniy to‘lov summasi' : 'Taxminiy oylik'} value={formatUzs(finalized ? Number(finalized.payable_uzs) : r.projectedUzs)} strong />
        </dl>
      </Card>

      {/* Statistika */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Oylik qabul" value={formatNumber(r.approvedOrders)} hint="tasdiqlangan" />
        <StatCard label="Kunlik o‘rtacha" value={formatAvg(r.avgPerWorkedDay)} hint={`${r.workedDays} ish kuni bo‘yicha`} />
        <StatCard label="Yashil kunlar" value={r.counts.green} tone="green" />
        <StatCard label="Sariq kunlar" value={r.counts.yellow} tone="yellow" />
        <StatCard label="Qizil kunlar" value={r.counts.red} tone="red" />
        <StatCard label="Kelmagan kunlar" value={r.counts.absences} />
        <StatCard label="Topshirilgan hisobotlar" value={r.counts.reported} />
        <StatCard label="Tasdiqlangan hisobotlar" value={r.counts.approved} />
      </div>

      {/* To'lovlar tarixi */}
      <Card>
        <h2 className="mb-3 text-lg font-bold">To‘lovlar tarixi</h2>
        {d.payments.length === 0 ? <p className="text-sm text-neutral-500">Bu davr uchun to‘lovlar hali qayd etilmagan.</p> : (
          <ul className="divide-y divide-neutral-100">
            {d.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div><p className="font-medium">{PAYMENT_KIND_UZ[p.kind]}</p><p className="text-xs text-neutral-500">{formatDateUz(p.paid_on)}{p.note ? ` · ${p.note}` : ''}</p></div>
                <span className="font-semibold tabular-nums">{formatUzs(Number(p.amount_uzs))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Kun tafsiloti */}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? formatDateUz(sel) : ''}>
        {sel && selInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {selInfo.state === 'green' ? <CheckCircle2 className="h-5 w-5 text-kpi-green" /> : selInfo.state === 'pending' ? <Clock className="h-5 w-5 text-yellow-600" /> : <Info className="h-5 w-5 text-neutral-500" />}
              <span className="font-semibold">{STATE_META[selInfo.state].label}</span>
            </div>
            {selInfo.state === 'none' && <p className="text-sm text-neutral-600">{sel === today ? 'Bugungi natija hali kiritilmagan.' : 'Bu kun uchun natija kiritilmagan.'}</p>}
            {selReport && (
              <dl className="divide-y divide-neutral-100 rounded-xl bg-neutral-50 px-3 text-[15px]">
                <Row label="Qabul qilingan buyurtmalar" value={`${selReport.accepted_orders} ta`} />
                <Row label="Hisobot holati" value={REPORT_STATUS_UZ[selReport.status]} />
                {selReport.status === 'approved' && <Row label="Oylikka ta’siri" value={formatSigned(selInfo.adjustment)} tone={selInfo.adjustment < 0 ? 'neg' : selInfo.adjustment > 0 ? 'pos' : undefined} />}
                {selReport.status === 'pending' && <Row label="Tasdiqlansa, taxminiy ta’siri" value={formatSigned(dailyAdjustment(selReport.accepted_orders, settings))} />}
              </dl>
            )}
            {selReport?.review_note && <Notice tone="warn">Administrator izohi: {selReport.review_note}</Notice>}
            {!selReport && selInfo.state === 'absence' && <p className="text-sm text-neutral-600">Ta’sir: {formatSigned(selInfo.adjustment)}</p>}
          </div>
        )}
      </Modal>
      {d.entries.length === 0 && !isCurrent && <EmptyState title="Bu davr uchun ma’lumot yo‘q." />}
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: 'pos' | 'neg'; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${strong ? 'font-bold' : ''}`}>
      <dt className="text-neutral-600">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${tone === 'pos' ? 'text-green-700' : tone === 'neg' ? 'text-red-700' : ''}`}>{value}</dd>
    </div>
  );
}
