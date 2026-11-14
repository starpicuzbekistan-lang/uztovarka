import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { formatDateTimeUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

interface Log { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; before_data: unknown; after_data: unknown; created_at: string }

const ACTION_UZ: Record<string, string> = {
  insert: 'Qo‘shildi', update: 'O‘zgartirildi', delete: 'O‘chirildi',
  report_approve: 'Hisobot tasdiqlandi', report_reject: 'Hisobot rad etildi', report_request_correction: 'Tuzatish so‘raldi', report_corrected: 'Hisobot tuzatildi',
  user_invited: 'Foydalanuvchi taklif qilindi', user_activated: 'Hisob faollashtirildi', user_deactivated: 'Hisob nofaol qilindi', role_changed: 'Rol o‘zgartirildi', password_reset_sent: 'Parolni tiklash yuborildi',
};
const ENTITY_UZ: Record<string, string> = {
  daily_reports: 'Kunlik hisobot', kpi_setting_versions: 'KPI sozlamalari', salary_adjustments: 'Oylik tuzatishi', payroll_calculations: 'Oylik hisob-kitobi', payroll_payments: 'To‘lov',
  products: 'Mahsulot', sets: 'Nabor', scripts: 'Skript', articles: 'Maqola', profiles: 'Profil', announcements: 'E’lon', attendance_records: 'Davomat', auth_user: 'Foydalanuvchi', payroll_periods: 'Oylik davri',
};
const PAGE = 50;

export default function AuditLog() {
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['audit', page, entity],
    queryFn: async () => {
      let s = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (entity) s = s.eq('entity', entity);
      const logs = (await unwrap(s)) as Log[];
      const ids = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
      const names = ids.length ? ((await unwrap(supabase.from('profiles').select('id,full_name').in('id', ids))) as { id: string; full_name: string }[]) : [];
      return { logs, names: Object.fromEntries(names.map((n) => [n.id, n.full_name])) as Record<string, string> };
    },
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Faoliyat tarixi" subtitle="Muhim amallar: kim, nima va qachon o‘zgartirgani." />
      <select aria-label="Obyekt turi" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }} className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-[15px]">
        <option value="">Barcha turlar</option>{Object.entries(ENTITY_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {q.isLoading && <LoadingBlock rows={5} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      {q.data?.logs.length === 0 && <EmptyState title="Yozuvlar topilmadi." />}
      <div className="space-y-2">
        {q.data?.logs.map((l) => (
          <Card key={l.id} className="p-3">
            <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
              <span className="min-w-0">
                <span className="block font-medium">{ACTION_UZ[l.action] ?? l.action} <Badge tone="neutral">{ENTITY_UZ[l.entity] ?? l.entity}</Badge></span>
                <span className="text-xs text-neutral-500">{l.actor_id ? (q.data?.names[l.actor_id] ?? 'Foydalanuvchi') : 'Tizim'} · {formatDateTimeUz(l.created_at)}</span>
              </span>
              <span className="text-xs text-neutral-400">{open === l.id ? 'Yopish' : 'Tafsilot'}</span>
            </button>
            {open === l.id && (
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                <div><p className="mb-1 font-semibold text-neutral-500">Oldin</p><pre className="max-h-60 overflow-auto rounded-lg bg-neutral-50 p-2">{l.before_data ? JSON.stringify(l.before_data, null, 2) : '—'}</pre></div>
                <div><p className="mb-1 font-semibold text-neutral-500">Keyin</p><pre className="max-h-60 overflow-auto rounded-lg bg-neutral-50 p-2">{l.after_data ? JSON.stringify(l.after_data, null, 2) : '—'}</pre></div>
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Oldingi</Button>
        <Button variant="outline" disabled={(q.data?.logs.length ?? 0) < PAGE} onClick={() => setPage((p) => p + 1)}>Keyingi</Button>
      </div>
    </div>
  );
}
