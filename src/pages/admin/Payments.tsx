import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, Notice, PageHeader, Select, useToast } from '@/components/ui';
import { MonthNav } from '@/components/MonthNav';
import { paymentStatus } from '@/lib/payroll';
import { humanError, PAYMENT_KIND_UZ, PAYMENT_STATUS_UZ } from '@/lib/uz';
import { formatDateUz, parseIso, periodForMonth, tashkentToday } from '@/lib/dates';
import { formatUzs } from '@/lib/format';
import type { Payment, PayrollPeriod } from '@/lib/types';

interface Calc { id: string; operator_id: string; payable_uzs: number; approved: boolean; operator: { full_name: string } | null }

export default function Payments() {
  const t = parseIso(tashkentToday());
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const [pay, setPay] = useState<{ calc: Calc; paid: number } | null>(null);
  const period = periodForMonth(ym.y, ym.m);

  const q = useQuery({
    queryKey: ['admin-payments', period.start],
    queryFn: async () => {
      const pp = ((await unwrap(supabase.from('payroll_periods').select('*').eq('start_date', period.start).eq('end_date', period.end))) as PayrollPeriod[])[0];
      if (!pp) return { pp: null, calcs: [] as Calc[], payments: [] as Payment[] };
      const [calcs, payments] = await Promise.all([
        unwrap(supabase.from('payroll_calculations').select('id,operator_id,payable_uzs,approved,operator:profiles!payroll_calculations_operator_id_fkey(full_name)').eq('period_id', pp.id)) as unknown as Promise<Calc[]>,
        unwrap(supabase.from('payroll_payments').select('*').eq('period_id', pp.id).order('paid_on')) as Promise<Payment[]>,
      ]);
      return { pp, calcs, payments };
    },
  });
  const paidOf = (op: string) => (q.data?.payments ?? []).filter((p) => p.operator_id === op).reduce((s, p) => s + Number(p.amount_uzs), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="To‘lovlar" subtitle="Avans, qisman va yakuniy to‘lovlarni qayd etish." />
      <MonthNav y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
      <Notice tone="info">Bu bo‘lim to‘lovni faqat qayd etadi — ilova orqali pul o‘tkazilmaydi. To‘lovni oylik yakunlanib tasdiqlangandan keyin yozing; avans esa istalgan vaqtda yozilishi mumkin.</Notice>
      {q.isLoading && <LoadingBlock rows={3} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      {q.data && q.data.calcs.length === 0 && <EmptyState icon={<Banknote className="h-6 w-6" />} title="Bu davr uchun yakunlangan oyliklar yo‘q." hint="“KPI va oyliklar” bo‘limida oylikni yakunlang va tasdiqlang." />}
      <div className="space-y-3">
        {(q.data?.calcs ?? []).map((c) => {
          const paid = paidOf(c.operator_id);
          const st = paymentStatus(Number(c.payable_uzs), paid, c.approved);
          const list = (q.data?.payments ?? []).filter((p) => p.operator_id === c.operator_id);
          return (
            <Card key={c.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{c.operator?.full_name}</div><div className="text-xs text-neutral-500">Yakuniy: {formatUzs(Number(c.payable_uzs))} · To‘langan: {formatUzs(paid)} · Qoldiq: {formatUzs(Math.max(0, Number(c.payable_uzs) - paid))}</div></div>
                <Badge tone={st === 'paid' ? 'green' : st === 'partially_paid' ? 'yellow' : 'neutral'}>{PAYMENT_STATUS_UZ[st]}</Badge>
              </div>
              {list.length > 0 && <ul className="space-y-1">{list.map((p) => <li key={p.id} className="flex justify-between rounded-lg bg-neutral-50 px-2 py-1 text-xs"><span>{formatDateUz(p.paid_on)} · {PAYMENT_KIND_UZ[p.kind]}{p.note ? ` · ${p.note}` : ''}</span><b className="tabular-nums">{formatUzs(Number(p.amount_uzs))}</b></li>)}</ul>}
              <Button size="sm" variant="outline" onClick={() => setPay({ calc: c, paid })}>To‘lovni qayd etish</Button>
            </Card>
          );
        })}
      </div>
      {pay && q.data?.pp && <PayModal periodId={q.data.pp.id} calc={pay.calc} paid={pay.paid} onClose={() => setPay(null)} />}
    </div>
  );
}

function PayModal({ periodId, calc, paid, onClose }: { periodId: string; calc: Calc; paid: number; onClose: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const remaining = Math.max(0, Number(calc.payable_uzs) - paid);
  const [kind, setKind] = useState<'advance' | 'partial' | 'final'>(calc.approved ? (remaining > 0 ? 'final' : 'partial') : 'advance');
  const [amount, setAmount] = useState(calc.approved ? String(remaining) : '');
  const [date, setDate] = useState(tashkentToday());
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ amount?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function go(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(/\s/g, ''));
    if (!amount.trim() || !Number.isInteger(n) || n <= 0) return setErr({ amount: 'Summani musbat butun son sifatida kiriting.' });
    if (n > remaining) return setErr({ amount: `Summa qoldiqdan (${formatUzs(remaining)}) oshmasligi kerak.` });
    if (kind !== 'advance' && !calc.approved) return setErr({ form: 'Oylik tasdiqlanmaguncha faqat avans yozish mumkin.' });
    setBusy(true);
    try {
      await unwrap(supabase.from('payroll_payments').insert({ period_id: periodId, operator_id: calc.operator_id, kind, amount_uzs: n, paid_on: date, note: note.trim() || null, created_by: profile?.id }).select());
      void qc.invalidateQueries({ queryKey: ['admin-payments'] }); void qc.invalidateQueries({ queryKey: ['month'] }); void qc.invalidateQueries({ queryKey: ['admin-overview'] });
      toast('success', 'To‘lov qayd etildi.'); onClose();
    } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`To‘lov: ${calc.operator?.full_name}`}>
      <form onSubmit={go} noValidate className="space-y-3">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <p className="text-sm text-neutral-600">Qoldiq: <b>{formatUzs(remaining)}</b></p>
        <Field label="Turi"><Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{Object.entries(PAYMENT_KIND_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Summa (so‘m)" error={err.amount}><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="To‘langan sana"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Izoh (ixtiyoriy)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Qayd etish</Button></div>
      </form>
    </Modal>
  );
}
