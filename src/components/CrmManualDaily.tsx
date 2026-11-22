import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Save } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { tashkentToday } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { humanError } from '@/lib/uz';
import { Button, Card, Field, Input, Notice, useToast } from '@/components/ui';

type CrmDay = { report_date: string; accepted_count: number };

export default function CrmManualDaily({ monthStart, monthEnd }: { monthStart: string; monthEnd: string }) {
  const { profile } = useAuth();
  const today = tashkentToday();
  const [day, setDay] = useState(today);
  const [draft, setDraft] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const single = useQuery({
    queryKey: ['crm-daily-accepted', day],
    queryFn: async () => await unwrap(
      supabase.from('crm_daily_acceptance').select('report_date,accepted_count')
        .eq('report_date', day).maybeSingle()
    ) as CrmDay | null,
  });
  const monthly = useQuery({
    queryKey: ['crm-monthly-accepted', monthStart, monthEnd],
    queryFn: async () => await unwrap(
      supabase.from('crm_daily_acceptance').select('report_date,accepted_count')
        .gte('report_date', monthStart).lte('report_date', monthEnd).order('report_date')
    ) as CrmDay[],
  });

  const input = draft ?? (single.data ? String(single.data.accepted_count) : '');
  const monthlyTotal = (monthly.data ?? []).reduce((sum, entry) => sum + Number(entry.accepted_count), 0);
  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(input);
      if (!profile?.id || !/^\d+$/.test(input.trim()) || !Number.isSafeInteger(amount) || amount > 10000000) {
        throw new Error('0 yoki undan katta butun qabul sonini kiriting (maksimum 10 000 000).');
      }
      if (day > today) throw new Error('Kelajak sanasi uchun qabul kiritilmaydi.');
      await unwrap(supabase.from('crm_daily_acceptance').upsert({
        report_date: day,
        accepted_count: amount,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'report_date' }));
    },
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['crm-daily-accepted'] });
      void qc.invalidateQueries({ queryKey: ['crm-monthly-accepted'] });
      toast('success', 'CRM bo‘yicha kunlik qabul saqlandi.');
    },
    onError: e => toast('error', humanError(e)),
  });

  const monthLabel = monthStart.slice(0, 7);
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ClipboardCheck size={20} /> CRM bo‘yicha qabul
          </h2>
          <p className="mt-1 text-xs text-neutral-500">Idial.uz natijasini administrator qo‘lda kiritadi.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">Qo‘lda</span>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-50 p-3">
        <div>
          <p className="text-xs text-neutral-500">Tanlangan kun</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{single.isLoading ? '…' : single.isError ? '—' : single.data ? formatNumber(Number(single.data.accepted_count)) : 'Kiritilmagan'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{monthLabel} — jami</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{monthly.isLoading ? '…' : monthly.isError ? '—' : formatNumber(monthlyTotal)}</p>
          <p className="text-[11px] text-neutral-500">{monthly.data?.length ?? 0} kun uchun</p>
        </div>
      </div>
      {single.isError || monthly.isError ? <Notice tone="error">CRM hisoboti yuklanmadi. Sahifani yangilang.</Notice> : null}
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Sana">
          <Input type="date" value={day} max={today} onChange={e => { setDay(e.target.value); setDraft(null); }} />
        </Field>
        <Field label="Qabul qilingan buyurtmalar">
          <Input type="number" min="0" max="10000000" step="1" inputMode="numeric" value={input}
            placeholder="Masalan, 150" onChange={e => setDraft(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!day || single.isLoading || save.isPending} loading={save.isPending}>
          <Save size={16} /> Saqlash
        </Button>
      </form>
      <p className="text-xs leading-5 text-neutral-500">
        Bir sanaga bir marta yoziladi; keyin o‘zgartirsangiz avvalgi son yangilanadi, qo‘shib yuborilmaydi.
        Bu raqam operatorlarning KPI, oylik to‘lovi yoki jarimalariga ta’sir qilmaydi.
      </p>
    </Card>
  );
}
