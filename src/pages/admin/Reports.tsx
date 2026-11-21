import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History, MessageSquareWarning, Pencil, X } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { classifyDay, type DayStatus, type ReportStatus } from '@/lib/kpi';
import { useKpiColorThresholds } from '@/lib/kpiColors';
import { ATTENDANCE_UZ, humanError, REPORT_STATUS_UZ } from '@/lib/uz';
import { formatDateTimeUz, formatDateUz, tashkentToday } from '@/lib/dates';

interface Row { id: string; operator_id: string; report_date: string; accepted_orders: number; original_orders: number; status: ReportStatus; review_note: string | null; submitted_at: string; operator: { full_name: string } | null }
interface Hist { id: string; action: string; old_value: unknown; new_value: unknown; note: string | null; created_at: string; by: { full_name: string } | null }

const statusTone = (s: ReportStatus) => (s === 'approved' ? 'green' : s === 'pending' ? 'yellow' : s === 'rejected' ? 'red' : 'blue') as 'green' | 'yellow' | 'red' | 'blue';
const dayTone = { green: 'green', yellow: 'yellow', red: 'red' } as const;
const DAY_UZ: Record<DayStatus, string> = { green: 'Yashil', yellow: 'Sariq', red: 'Qizil' };
const HIST_UZ: Record<string, string> = { submitted: 'Yuborildi', approve: 'Tasdiqlandi', reject: 'Rad etildi', request_correction: 'Tuzatish so‘raldi', corrected: 'Tuzatildi', resubmitted: 'Qayta yuborildi' };

export default function Reports() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const today = tashkentToday();
  const [operator, setOperator] = useState('');
  const [status, setStatus] = useState<'' | ReportStatus>('pending');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [review, setReview] = useState<{ row: Row; action: 'reject' | 'request_correction' } | null>(null);
  const [correct, setCorrect] = useState<Row | null>(null);
  const [hist, setHist] = useState<Row | null>(null);
  const [attOpen, setAttOpen] = useState(false);

  const ops = useQuery({ queryKey: ['admin-op-options'], queryFn: async () => (await unwrap(supabase.from('profiles').select('id,full_name').eq('role', 'operator').eq('is_active', true).order('full_name'))) as { id: string; full_name: string }[] });
  const colors = useKpiColorThresholds();
  const list = useQuery({
    queryKey: ['admin-reports', operator, status, from, to],
    queryFn: async () => {
      let s = supabase.from('daily_reports').select('*,operator:profiles!daily_reports_operator_id_fkey(full_name)').gte('report_date', from).lte('report_date', to).order('report_date', { ascending: false }).order('submitted_at', { ascending: false }).limit(500);
      if (operator) s = s.eq('operator_id', operator);
      if (status) s = s.eq('status', status);
      return (await unwrap(s)) as unknown as Row[];
    },
  });
  const counts = useQuery({
    queryKey: ['admin-report-counts', from, to],
    queryFn: async () => {
      const rows = (await unwrap(supabase.from('daily_reports').select('status').gte('report_date', from).lte('report_date', to).limit(5000))) as { status: ReportStatus }[];
      return rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
    },
  });
  const refresh = () => { for (const k of ['admin-reports', 'admin-report-counts', 'admin-overview', 'month']) void qc.invalidateQueries({ queryKey: [k] }); };

  const approve = useMutation({
    mutationFn: async (id: string) => { await unwrap(supabase.rpc('review_report', { p_id: id, p_action: 'approve' })); },
    onSuccess: () => { refresh(); toast('success', 'Hisobot tasdiqlandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });

  const c = counts.data ?? {};
  const rows = useMemo(() => list.data ?? [], [list.data]);

  return (
    <div className="space-y-4">
      <PageHeader title="Kunlik hisobotlar" subtitle="Operatorlar yuborgan natijalarni tasdiqlang, rad eting yoki tuzating."
        action={<Button variant="outline" onClick={() => setAttOpen(true)}>Davomat belgilash</Button>} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['pending', 'approved', 'rejected', 'correction_requested'] as ReportStatus[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-2xl border p-3 text-left ${status === s ? 'border-brand bg-brand-soft' : 'border-neutral-200 bg-white'}`}>
            <div className="text-xs text-neutral-500">{REPORT_STATUS_UZ[s]}</div><div className="text-2xl font-bold tabular-nums">{c[s] ?? 0}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={operator} onChange={(e) => setOperator(e.target.value)} aria-label="Operator"><option value="">Barcha operatorlar</option>{(ops.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as '' | ReportStatus)} aria-label="Holat"><option value="">Barcha holatlar</option>{Object.entries(REPORT_STATUS_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Boshlanish sanasi" />
        <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Tugash sanasi" />
      </div>

      {colors.isError && <ErrorState message="KPI ranglari yuklanmadi (016 SQL migratsiyasini tekshiring)." onRetry={() => void colors.refetch()}/>}
      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState title="Hisobotlar topilmadi." hint="Filtrlarni o‘zgartirib ko‘ring." />}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr><th className="p-3">Operator</th><th className="p-3">Sana</th><th className="p-3 text-right">Qabul</th><th className="p-3">KPI</th><th className="p-3">Holat</th><th className="p-3">Yuborilgan</th><th className="p-3 text-right">Amallar</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const k = classifyDay(r.accepted_orders, undefined, colors.data);
                const own = r.operator_id === profile?.id;
                return (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.operator?.full_name ?? '—'}</td>
                    <td className="p-3">{formatDateUz(r.report_date)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{r.accepted_orders}{r.original_orders !== r.accepted_orders && <span className="block text-xs font-normal text-neutral-400">asl: {r.original_orders}</span>}</td>
                    <td className="p-3"><Badge tone={dayTone[k]}>{DAY_UZ[k]}</Badge></td>
                    <td className="p-3"><Badge tone={statusTone(r.status)}>{REPORT_STATUS_UZ[r.status]}</Badge>{r.review_note && <span className="block max-w-[180px] truncate text-xs text-neutral-400" title={r.review_note}>{r.review_note}</span>}</td>
                    <td className="p-3 text-xs text-neutral-500">{formatDateTimeUz(r.submitted_at)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {r.status === 'pending' && !own && <>
                          <Button size="sm" aria-label="Tasdiqlash" loading={approve.isPending && approve.variables === r.id} onClick={() => approve.mutate(r.id)}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" aria-label="Rad etish" onClick={() => setReview({ row: r, action: 'reject' })}><X className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" aria-label="Tuzatish so‘rash" onClick={() => setReview({ row: r, action: 'request_correction' })}><MessageSquareWarning className="h-4 w-4" /></Button>
                        </>}
                        {!own && <Button size="sm" variant="ghost" aria-label="Qiymatni tuzatish" onClick={() => setCorrect(r)}><Pencil className="h-4 w-4" /></Button>}
                        <Button size="sm" variant="ghost" aria-label="Tarix" onClick={() => setHist(r)}><History className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {review && <ReviewModal row={review.row} action={review.action} onClose={() => setReview(null)} onDone={refresh} />}
      {correct && <CorrectModal row={correct} onClose={() => setCorrect(null)} onDone={refresh} />}
      {hist && <HistoryModal row={hist} onClose={() => setHist(null)} />}
      {attOpen && <AttendanceModal operators={ops.data ?? []} onClose={() => setAttOpen(false)} onDone={refresh} />}
    </div>
  );
}

function ReviewModal({ row, action, onClose, onDone }: { row: Row; action: 'reject' | 'request_correction'; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!note.trim()) return setErr('Sababni yozing.');
    setBusy(true);
    try { await unwrap(supabase.rpc('review_report', { p_id: row.id, p_action: action, p_note: note.trim() })); onDone(); toast('success', action === 'reject' ? 'Hisobot rad etildi.' : 'Tuzatish so‘raldi.'); onClose(); }
    catch (e) { setErr(humanError(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={action === 'reject' ? 'Hisobotni rad etish' : 'Tuzatishni so‘rash'}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">{row.operator?.full_name} · {formatDateUz(row.report_date)} · {row.accepted_orders} ta</p>
        <Field label="Sabab (operatorga ko‘rinadi)" error={err}><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Bekor qilish</Button><Button variant={action === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={() => void go()}>{action === 'reject' ? 'Rad etish' : 'Yuborish'}</Button></div>
      </div>
    </Modal>
  );
}

function CorrectModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [count, setCount] = useState(String(row.accepted_orders));
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ count?: string; note?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  async function go() {
    const n = Number(count);
    const next: typeof err = {};
    if (count.trim() === '' || !Number.isInteger(n) || n < 0) next.count = 'Manfiy bo‘lmagan butun son kiriting.';
    if (!note.trim()) next.note = 'Tuzatish sababini yozing.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try { await unwrap(supabase.rpc('correct_report', { p_id: row.id, p_count: n, p_note: note.trim() })); onDone(); toast('success', 'Hisobot tuzatildi. Asl qiymat tarixda saqlanadi.'); onClose(); }
    catch (e) { setErr({ form: humanError(e) }); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Hisobotni tuzatish">
      <div className="space-y-3">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <p className="text-sm text-neutral-600">{row.operator?.full_name} · {formatDateUz(row.report_date)} · hozirgi: {row.accepted_orders} ta</p>
        <Field label="To‘g‘ri qabul soni" error={err.count}><Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></Field>
        <Field label="Sabab" error={err.note}><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Bekor qilish</Button><Button loading={busy} onClick={() => void go()}>Tuzatish</Button></div>
      </div>
    </Modal>
  );
}

function HistoryModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['report-history', row.id],
    queryFn: async () => (await unwrap(supabase.from('report_history').select('*,by:profiles!report_history_changed_by_fkey(full_name)').eq('report_id', row.id).order('created_at'))) as unknown as Hist[],
  });
  return (
    <Modal open onClose={onClose} title="Hisobot tarixi">
      {q.isLoading && <LoadingBlock rows={2} />}
      {q.isError && <ErrorState message={humanError(q.error)} />}
      <ol className="space-y-3">
        {q.data?.map((h) => (
          <li key={h.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
            <div className="flex justify-between"><b>{HIST_UZ[h.action] ?? h.action}</b><span className="text-xs text-neutral-400">{formatDateTimeUz(h.created_at)}</span></div>
            <div className="text-xs text-neutral-500">{h.by?.full_name ?? 'Tizim'}</div>

{(h.old_value != null || h.new_value != null) && (
  <div className="mt-1 text-xs text-neutral-600">
    {h.old_value != null ? JSON.stringify(h.old_value) : ''}
    {h.old_value != null && h.new_value != null ? ' → ' : ''}
    {h.new_value != null ? JSON.stringify(h.new_value) : ''}
  </div>
)}
            {h.note && <div className="mt-1">Izoh: {h.note}</div>}
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function AttendanceModal({ operators, onClose, onDone }: { operators: { id: string; full_name: string }[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [op, setOp] = useState('');
  const [date, setDate] = useState(tashkentToday());
  const [kind, setKind] = useState<keyof typeof ATTENDANCE_UZ | 'clear'>('absent');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!op) return setErr('Operatorni tanlang.');
    setBusy(true);
    try {
      if (kind === 'clear') await unwrap(supabase.rpc('clear_attendance', { p_operator: op, p_date: date }));
      else await unwrap(supabase.rpc('set_attendance', { p_operator: op, p_date: date, p_kind: kind, p_note: note.trim() || null }));
      onDone(); toast('success', 'Davomat yangilandi.'); onClose();
    } catch (e) { setErr(humanError(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Davomat belgilash">
      <div className="space-y-3">
        {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <Field label="Operator"><Select value={op} onChange={(e) => setOp(e.target.value)}><option value="">Tanlang</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</Select></Field>
        <Field label="Sana"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Holat" hint="“Kelmagan” ishlangan kunda 0 ta buyurtma bilan bir xil emas: u alohida hisoblanadi.">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{Object.entries(ATTENDANCE_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="clear">Belgini olib tashlash</option></Select>
        </Field>
        <Field label="Izoh (ixtiyoriy)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Bekor qilish</Button><Button loading={busy} onClick={() => void go()}>Saqlash</Button></div>
      </div>
    </Modal>
  );
}
