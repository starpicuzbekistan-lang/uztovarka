import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ChevronDown, Lock, LockOpen, Plus, Save } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, Notice, PageHeader, Segmented, Select, Textarea, useToast } from '@/components/ui';
import { MonthNav } from '@/components/MonthNav';
import { useOperatorMonth } from '@/lib/useMonthData';
import { finalizePayroll, paymentStatus } from '@/lib/payroll';
import { DEFAULT_SETTINGS, pickSettings, type KpiSettings } from '@/lib/kpi';
import { rowToVersion, type PayrollPeriod, type SettingsRow } from '@/lib/types';
import { ABSENCE_RULE_UZ, humanError, LEAVE_POLICY_UZ, PAYMENT_STATUS_UZ } from '@/lib/uz';
import { formatDateUz, parseIso, periodForMonth, tashkentToday } from '@/lib/dates';
import { formatNumber, formatSigned, formatUzs } from '@/lib/format';

type Tab = 'payroll' | 'settings';

export default function KpiPayroll() {
  const [tab, setTab] = useState<Tab>('payroll');
  return (
    <div className="space-y-4">
      <PageHeader title="KPI va oyliklar" subtitle="Hisob-kitob qoidalari versiyalanadi: yakunlangan oyliklar o‘zgarmaydi." />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'payroll', label: 'Oylik hisob-kitobi' }, { value: 'settings', label: 'KPI sozlamalari' }]} />
      {tab === 'payroll' ? <PayrollTab /> : <SettingsTab />}
    </div>
  );
}

/* ───────────────────────── Oylik hisob-kitobi ───────────────────────── */
function PayrollTab() {
  const t = parseIso(tashkentToday());
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const qc = useQueryClient();
  const toast = useToast();
  const period = periodForMonth(ym.y, ym.m);
  const [lockAsk, setLockAsk] = useState<'lock' | 'unlock' | null>(null);

  const ops = useQuery({ queryKey: ['admin-active-operators'], queryFn: async () => (await unwrap(supabase.from('profiles').select('id,full_name').eq('role', 'operator').eq('is_active', true).order('full_name'))) as { id: string; full_name: string }[] });
  const pp = useQuery({
    queryKey: ['admin-period', period.start, period.end],
    queryFn: async () => ((await unwrap(supabase.from('payroll_periods').select('*').eq('start_date', period.start).eq('end_date', period.end))) as PayrollPeriod[])[0] ?? null,
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['month'] }); void qc.invalidateQueries({ queryKey: ['admin-period'] }); void qc.invalidateQueries({ queryKey: ['admin-overview'] }); };

  const locked = pp.data?.status === 'locked';
  async function setLock(lock: boolean) {
    try { await unwrap(supabase.from('payroll_periods').update({ status: lock ? 'locked' : 'open' }).eq('id', pp.data!.id).select()); refresh(); toast('success', lock ? 'Davr yopildi.' : 'Davr ochildi.'); }
    catch (e) { toast('error', humanError(e)); }
    setLockAsk(null);
  }

  return (
    <div className="space-y-3">
      <MonthNav y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-neutral-600">
          {pp.data ? <>Ish kunlari: <b>{pp.data.working_days}</b> · Holat: <Badge tone={locked ? 'dark' : 'green'}>{locked ? 'Yopilgan' : 'Ochiq'}</Badge></> : 'Bu davr uchun hisob-kitob hali boshlanmagan.'}
        </div>
        {pp.data && <Button size="sm" variant="outline" onClick={() => setLockAsk(locked ? 'unlock' : 'lock')}>{locked ? <><LockOpen className="h-4 w-4" /> Davrni ochish</> : <><Lock className="h-4 w-4" /> Davrni yopish</>}</Button>}
      </div>
      <Notice tone="info">“Taxminiy” — tasdiqlangan hisobotlar asosidagi joriy hisob. “Yakuniy” — siz yakunlab, tasdiqlagandan keyingi to‘lanadigan summa. Kutilayotgan hisobotlar bo‘lsa, oylikni yakunlab bo‘lmaydi.</Notice>

      {(ops.isLoading || pp.isLoading) && <LoadingBlock rows={3} />}
      {ops.isError && <ErrorState message={humanError(ops.error)} onRetry={() => void ops.refetch()} />}
      {ops.data?.length === 0 && <EmptyState title="Faol operatorlar yo‘q." />}
      <div className="space-y-2">
        {(ops.data ?? []).map((o) => <PayrollRow key={`${o.id}-${ym.y}-${ym.m}`} op={o} y={ym.y} m={ym.m} locked={locked} />)}
      </div>

      <ConfirmDialog open={!!lockAsk} title={lockAsk === 'lock' ? 'Davrni yopish' : 'Davrni ochish'} confirmLabel={lockAsk === 'lock' ? 'Yopish' : 'Ochish'} danger={lockAsk === 'unlock'}
        message={lockAsk === 'lock' ? 'Yopilgan davrda tuzatishlar va hisob-kitoblar o‘zgartirilmaydi. To‘lovlarni yozish davom etadi.' : 'Davr ochilgach, tuzatish kiritish mumkin bo‘ladi. Bu amal faoliyat tarixiga yoziladi.'}
        onClose={() => setLockAsk(null)} onConfirm={() => setLock(lockAsk === 'lock')} />
    </div>
  );
}

function PayrollRow({ op, y, m, locked }: { op: { id: string; full_name: string }; y: number; m: number; locked: boolean }) {
  const q = useOperatorMonth(op.id, y, m);
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [finAsk, setFinAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = q.data;

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['month'] }); void qc.invalidateQueries({ queryKey: ['admin-overview'] }); void qc.invalidateQueries({ queryKey: ['admin-payments'] }); };

  async function ensurePeriod(): Promise<string> {
    if (d?.payrollPeriod) return d.payrollPeriod.id;
    const r = (await unwrap(supabase.from('payroll_periods').insert({ start_date: d!.period.start, end_date: d!.period.end, working_days: d!.settings.workingDays }).select('id').single())) as { id: string };
    void qc.invalidateQueries({ queryKey: ['admin-period'] });
    return r.id;
  }

  async function finalize() {
    if (!d) return;
    setBusy(true);
    try {
      const pid = await ensurePeriod();
      const fin = finalizePayroll({
        operatorId: op.id, period: { start: d.period.start, end: d.period.end, workingDays: d.payrollPeriod?.working_days ?? d.settings.workingDays },
        entries: d.entries, settings: d.settings, manualAdjustmentsUzs: d.adjustments.map((a) => Number(a.amount_uzs)), alreadyFinalized: !!d.calc,
      });
      if (!fin.ok) { toast('error', fin.code === 'pending_reports' ? `Kutilayotgan hisobotlar bor (${fin.pending}). Avval ularni ko‘rib chiqing.` : 'Bu oylik allaqachon yakunlangan.'); return; }
      await unwrap(supabase.rpc('finalize_payroll', { p_period: pid, p_operator: op.id, p_snapshot: fin.snapshot, p_payable: fin.snapshot.payableUzs }));
      refresh(); toast('success', 'Oylik yakunlandi. Endi uni tasdiqlang.');
    } catch (e) { toast('error', humanError(e)); } finally { setBusy(false); setFinAsk(false); }
  }
  async function approve() {
    setBusy(true);
    try { await unwrap(supabase.rpc('approve_payroll', { p_calc: d!.calc!.id })); refresh(); toast('success', 'Oylik tasdiqlandi.'); }
    catch (e) { toast('error', humanError(e)); } finally { setBusy(false); }
  }

  const paid = (d?.payments ?? []).reduce((s, p) => s + Number(p.amount_uzs), 0);
  const status = d ? paymentStatus(d.calc ? Number(d.calc.payable_uzs) : null, paid, !!d.calc?.approved) : 'calculating';
  const r = d?.result;

  return (
    <Card className="p-0">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{op.full_name}</div>
          {q.isLoading ? <div className="text-xs text-neutral-400">Hisoblanmoqda…</div> : r && <div className="text-xs text-neutral-500">{formatNumber(r.approvedOrders)} ta · {r.workedDays} kun{r.counts.pending > 0 && <span className="ml-1 font-semibold text-yellow-700">· {r.counts.pending} ta kutilmoqda</span>}</div>}
        </div>
        {r && <div className="text-right"><div className="font-bold tabular-nums">{d!.calc ? formatUzs(Number(d!.calc.payable_uzs)) : formatUzs(r.projectedUzs)}</div><div className="text-[11px] text-neutral-400">{d!.calc ? 'Yakuniy' : 'Taxminiy'}</div></div>}
        <ChevronDown className={clsx('h-5 w-5 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')} />
      </button>
      {q.isError && <div className="px-4 pb-3"><ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} /></div>}
      {open && d && r && (
        <div className="space-y-3 border-t border-neutral-100 p-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <dt className="text-neutral-500">Oylik maqsad</dt><dd className="text-right tabular-nums">{formatUzs(r.baseUzs)}</dd>
            <dt className="text-neutral-500">Norma yetmagan kunlar</dt><dd className="text-right tabular-nums">{formatSigned(r.shortfallUzs)}</dd>
            <dt className="text-neutral-500">Qo‘shimcha natija</dt><dd className="text-right tabular-nums">{formatSigned(r.bonusUzs)}</dd>
            <dt className="text-neutral-500">Kelmagan kunlar ({r.counts.absences})</dt><dd className="text-right tabular-nums">{formatSigned(r.absenceUzs)}</dd>
            <dt className="text-neutral-500">Qo‘lda tuzatishlar</dt><dd className="text-right tabular-nums">{formatSigned(r.manualUzs)}</dd>
            <dt className="font-semibold">Taxminiy jami</dt><dd className="text-right font-semibold tabular-nums">{formatUzs(r.projectedUzs)}</dd>
            <dt className="text-neutral-500">Yashil / sariq / qizil</dt><dd className="text-right">{r.counts.green} / {r.counts.yellow} / {r.counts.red}</dd>
            <dt className="text-neutral-500">To‘lov holati</dt><dd className="text-right">{PAYMENT_STATUS_UZ[status]}</dd>
            {d.calc && <><dt className="text-neutral-500">To‘langan</dt><dd className="text-right tabular-nums">{formatUzs(paid)}</dd></>}
          </dl>
          {d.adjustments.length > 0 && (
            <div><p className="mb-1 text-xs font-semibold text-neutral-500">Qo‘lda tuzatishlar</p>
              <ul className="space-y-1">{d.adjustments.map((a) => <li key={a.id} className="flex justify-between gap-2 rounded-lg bg-neutral-50 px-2 py-1 text-xs"><span>{a.reason}</span><b className="tabular-nums">{formatSigned(Number(a.amount_uzs))}</b></li>)}</ul></div>
          )}
          <div className="flex flex-wrap gap-2">
            {!d.calc && <Button size="sm" variant="outline" disabled={locked} onClick={() => setAdjOpen(true)}><Plus className="h-4 w-4" /> Tuzatish kiritish</Button>}
            {!d.calc && <Button size="sm" disabled={locked || r.counts.pending > 0} loading={busy} onClick={() => setFinAsk(true)}><Save className="h-4 w-4" /> Oylikni yakunlash</Button>}
            {d.calc && !d.calc.approved && <Button size="sm" loading={busy} disabled={locked} onClick={() => void approve()}><CheckCheck className="h-4 w-4" /> Tasdiqlash</Button>}
          </div>
          {!d.calc && r.counts.pending > 0 && <p className="text-xs text-yellow-700">Avval kutilayotgan {r.counts.pending} ta hisobotni ko‘rib chiqing.</p>}
        </div>
      )}
      {adjOpen && d && <AdjustModal opName={op.full_name} onClose={() => setAdjOpen(false)} onSave={async (amount, reason) => { const pid = await ensurePeriod(); const me = (await supabase.auth.getUser()).data.user?.id; await unwrap(supabase.from('salary_adjustments').insert({ operator_id: op.id, period_id: pid, amount_uzs: amount, reason, created_by: me }).select()); refresh(); toast('success', 'Tuzatish saqlandi.'); }} />}
      <ConfirmDialog open={finAsk} title="Oylikni yakunlash" confirmLabel="Yakunlash" message={`${op.full_name}: to‘lanadigan summa ${r ? formatUzs(r.projectedUzs) : ''} qilib muhrlanadi. Keyin KPI sozlamalari o‘zgarsa ham bu summa o‘zgarmaydi.`} onClose={() => setFinAsk(false)} onConfirm={() => finalize()} />
    </Card>
  );
}

function AdjustModal({ opName, onClose, onSave }: { opName: string; onClose: () => void; onSave: (amount: number, reason: string) => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState<'+' | '-'>('+');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<{ amount?: string; reason?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(/\s/g, ''));
    const next: typeof err = {};
    if (!amount.trim() || !Number.isInteger(n) || n <= 0) next.amount = 'Summani musbat butun son sifatida kiriting.';
    if (!reason.trim()) next.reason = 'Tuzatish sababini yozing (hujjatlashtirish uchun majburiy).';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try { await onSave(sign === '-' ? -n : n, reason.trim()); onClose(); } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Tuzatish: ${opName}`}>
      <form onSubmit={go} noValidate className="space-y-3">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <Segmented value={sign} onChange={setSign} options={[{ value: '+', label: 'Qo‘shish' }, { value: '-', label: 'Ayirish' }]} />
        <Field label="Summa (so‘m)" error={err.amount}><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Sabab" error={err.reason} hint="Mehnat shartnomasi va amaldagi qonunchilikka mos asos bo‘lishi kerak."><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── KPI sozlamalari ───────────────────────── */
interface SForm { operatorId: string; effectiveFrom: string; monthlyTarget: string; workingDays: string; dailyTarget: string; minThreshold: string; shortfall: string; bonus: string; absenceRule: KpiSettings['absenceRule']; absenceFixed: string; leavePolicy: KpiSettings['leavePolicy']; note: string }

function SettingsTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const today = tashkentToday();
  const vq = useQuery({ queryKey: ['kpi-versions'], queryFn: async () => (await unwrap(supabase.from('kpi_setting_versions').select('*').order('effective_from', { ascending: false }))) as SettingsRow[] });
  const ops = useQuery({ queryKey: ['admin-op-options'], queryFn: async () => (await unwrap(supabase.from('profiles').select('id,full_name').eq('role', 'operator').eq('is_active', true).order('full_name'))) as { id: string; full_name: string }[] });

  const cur = useMemo(() => pickSettings((vq.data ?? []).map(rowToVersion), today) ?? DEFAULT_SETTINGS, [vq.data, today]);
  const [form, setForm] = useState<SForm | null>(null);
  const start = (operatorId = ''): SForm => {
    const s = operatorId ? (pickSettings((vq.data ?? []).map(rowToVersion), today, operatorId) ?? cur) : cur;
    return { operatorId, effectiveFrom: today, monthlyTarget: String(s.monthlyTargetUzs), workingDays: String(s.workingDays), dailyTarget: String(s.dailyTarget), minThreshold: String(s.minThreshold), shortfall: String(s.shortfallCoefUzs), bonus: String(s.bonusCoefUzs), absenceRule: s.absenceRule, absenceFixed: String(s.absenceFixedUzs), leavePolicy: s.leavePolicy, note: '' };
  };
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const f = form;
  const set = <K extends keyof SForm>(k: K, v: SForm[K]) => setForm((s) => (s ? { ...s, [k]: v } : s));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\s/g, '')));
    const v = { monthly: num(f.monthlyTarget), wd: num(f.workingDays), dt: num(f.dailyTarget), mt: num(f.minThreshold), sf: num(f.shortfall), bn: num(f.bonus), af: num(f.absenceFixed) };
    const next: Record<string, string> = {};
    const nonNeg = (k: string, n: number, label: string) => { if (!Number.isInteger(n) || n < 0) next[k] = `${label} manfiy bo‘lmagan butun son bo‘lishi kerak.`; };
    nonNeg('monthly', v.monthly, 'Oylik maqsad'); nonNeg('dt', v.dt, 'Kunlik norma'); nonNeg('mt', v.mt, 'Minimal chegara');
    nonNeg('sf', v.sf, 'Koeffitsiyent'); nonNeg('bn', v.bn, 'Bonus koeffitsiyenti'); nonNeg('af', v.af, 'Summa');
    if (!Number.isInteger(v.wd) || v.wd < 1 || v.wd > 31) next.wd = 'Ish kunlari 1 dan 31 gacha bo‘lishi kerak.';
    if (!next.mt && !next.dt && v.mt > v.dt) next.mt = 'Minimal chegara kunlik normadan oshmasligi kerak.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.effectiveFrom)) next.date = 'Amal qilish sanasini kiriting.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const row = { operator_id: f.operatorId || null, effective_from: f.effectiveFrom, monthly_target_uzs: v.monthly, working_days: v.wd, daily_target: v.dt, min_threshold: v.mt, shortfall_coef_uzs: v.sf, bonus_coef_uzs: v.bn, absence_rule: f.absenceRule, absence_fixed_uzs: v.af, leave_policy: f.leavePolicy, note: f.note.trim() || null, created_by: profile?.id };
      await unwrap(supabase.from('kpi_setting_versions').insert(row).select());
      void qc.invalidateQueries({ queryKey: ['kpi-versions'] }); void qc.invalidateQueries({ queryKey: ['month'] });
      toast('success', 'Yangi sozlamalar versiyasi saqlandi.'); setForm(null);
    } catch (er) {
      setErr({ form: (er as { code?: string })?.code === '23505' ? 'Bu sana uchun sozlama allaqachon mavjud. Boshqa sanani tanlang.' : humanError(er) });
    } finally { setBusy(false); }
  }

  const opName = (id: string | null) => ops.data?.find((o) => o.id === id)?.full_name ?? 'Operator';

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-4">
        <h2 className="font-bold">Joriy umumiy sozlamalar</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Oylik maqsad</dt><dd className="text-right">{formatUzs(cur.monthlyTargetUzs)}</dd>
          <dt className="text-neutral-500">Ish kunlari</dt><dd className="text-right">{cur.workingDays}</dd>
          <dt className="text-neutral-500">Kunlik norma / minimal</dt><dd className="text-right">{cur.dailyTarget} / {cur.minThreshold}</dd>
          <dt className="text-neutral-500">Norma yetmaganda koeffitsiyent</dt><dd className="text-right">{formatUzs(cur.shortfallCoefUzs)}</dd>
          <dt className="text-neutral-500">Ortiqcha natija koeffitsiyenti</dt><dd className="text-right">{formatUzs(cur.bonusCoefUzs)}</dd>
          <dt className="text-neutral-500">Kelmagan kun</dt><dd className="text-right">{ABSENCE_RULE_UZ[cur.absenceRule]}</dd>
          <dt className="text-neutral-500">Tasdiqlangan ta’til</dt><dd className="text-right">{LEAVE_POLICY_UZ[cur.leavePolicy]}</dd>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => { setErr({}); setForm(start()); }}>Yangi versiya (hamma uchun)</Button>
          <Select className="!min-h-9 w-auto" value="" aria-label="Operator uchun alohida sozlama" onChange={(e) => { if (e.target.value) { setErr({}); setForm(start(e.target.value)); } }}>
            <option value="">Operator uchun alohida…</option>{(ops.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </Select>
        </div>
        <p className="text-xs text-neutral-500">Yangi versiya faqat tanlangan sanadan boshlab amal qiladi; oldingi davrlar va yakunlangan oyliklar o‘zgarmaydi. Sozlamalar mehnat shartnomasi va O‘zbekiston mehnat qonunchiligiga mos bo‘lishi kerak.</p>
      </Card>

      <h2 className="font-bold">Versiyalar tarixi</h2>
      {vq.isLoading && <LoadingBlock rows={2} />}
      {vq.isError && <ErrorState message={humanError(vq.error)} onRetry={() => void vq.refetch()} />}
      <div className="space-y-2">
        {(vq.data ?? []).map((v) => (
          <Card key={v.id} className="p-3 text-sm">
            <div className="flex items-center justify-between"><b>{formatDateUz(v.effective_from)} dan</b><Badge tone={v.operator_id ? 'yellow' : 'neutral'}>{v.operator_id ? opName(v.operator_id) : 'Hamma uchun'}</Badge></div>
            <div className="mt-1 text-xs text-neutral-600">Maqsad {formatNumber(Number(v.monthly_target_uzs))} · {v.working_days} kun · norma {v.daily_target} / min {v.min_threshold} · koef. {formatNumber(Number(v.shortfall_coef_uzs))} / {formatNumber(Number(v.bonus_coef_uzs))}</div>
            {v.note && <div className="mt-1 text-xs text-neutral-500">Izoh: {v.note}</div>}
          </Card>
        ))}
      </div>

      {f && (
        <Modal open onClose={() => setForm(null)} title={f.operatorId ? `Alohida sozlama: ${opName(f.operatorId)}` : 'Yangi KPI sozlamalari versiyasi'}>
          <form onSubmit={save} noValidate className="space-y-3">
            {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
            <Field label="Amal qilish boshlanadigan sana" error={err.date}><Input type="date" value={f.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Oylik maqsad (so‘m)" error={err.monthly}><Input inputMode="numeric" value={f.monthlyTarget} onChange={(e) => set('monthlyTarget', e.target.value)} /></Field>
              <Field label="Ish kunlari soni" error={err.wd}><Input inputMode="numeric" value={f.workingDays} onChange={(e) => set('workingDays', e.target.value)} /></Field>
              <Field label="Kunlik norma" error={err.dt}><Input inputMode="numeric" value={f.dailyTarget} onChange={(e) => set('dailyTarget', e.target.value)} /></Field>
              <Field label="Minimal chegara" error={err.mt}><Input inputMode="numeric" value={f.minThreshold} onChange={(e) => set('minThreshold', e.target.value)} /></Field>
              <Field label="Norma yetmaganda koeffitsiyent (so‘m)" error={err.sf}><Input inputMode="numeric" value={f.shortfall} onChange={(e) => set('shortfall', e.target.value)} /></Field>
              <Field label="Ortiqcha natija koeffitsiyenti (so‘m)" error={err.bn}><Input inputMode="numeric" value={f.bonus} onChange={(e) => set('bonus', e.target.value)} /></Field>
            </div>
            <Field label="Kelmagan kunni hisoblash"><Select value={f.absenceRule} onChange={(e) => set('absenceRule', e.target.value as SForm['absenceRule'])}>{Object.entries(ABSENCE_RULE_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            {f.absenceRule === 'fixed' && <Field label="Bir kun uchun summa (so‘m)" error={err.af}><Input inputMode="numeric" value={f.absenceFixed} onChange={(e) => set('absenceFixed', e.target.value)} /></Field>}
            <Field label="Tasdiqlangan ta’til"><Select value={f.leavePolicy} onChange={(e) => set('leavePolicy', e.target.value as SForm['leavePolicy'])}>{Object.entries(LEAVE_POLICY_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Izoh (ixtiyoriy)"><Input value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={() => setForm(null)}>Bekor qilish</Button><Button type="submit" loading={busy}>Versiyani saqlash</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
