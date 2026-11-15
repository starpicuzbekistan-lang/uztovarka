import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { type BundleSettings } from '@/lib/bundle';
import { Button, Card, ErrorState, Field, Input, LoadingBlock, useToast } from '@/components/ui';
import { humanError } from '@/lib/uz';

export default function BundleSettingsCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bundle-settings'], queryFn: async () => (await unwrap(supabase.from('bundle_builder_settings').select('*').eq('id', 1).single())) as BundleSettings });
  const [form, setForm] = useState<BundleSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data && !form) setForm(q.data); }, [q.data, form]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (![form.max_discount_percent, form.max_discount_uzs, form.delivery_fee_uzs].every(Number.isFinite)
      || form.max_discount_percent < 0 || form.max_discount_percent > 100
      || !Number.isSafeInteger(form.max_discount_uzs) || form.max_discount_uzs < 0
      || !Number.isSafeInteger(form.delivery_fee_uzs) || form.delivery_fee_uzs < 0) {
      toast('error', 'Limitlarni tekshiring: foiz 0–100, summalar manfiy bo‘lmagan butun son bo‘lishi kerak.'); return;
    }
    setBusy(true);
    try {
      await unwrap(supabase.from('bundle_builder_settings').update({
        discount_enabled: form.discount_enabled,
        operators_can_discount: form.operators_can_discount,
        max_discount_percent: form.max_discount_percent,
        max_discount_uzs: form.max_discount_uzs,
        free_delivery: form.free_delivery,
        delivery_fee_uzs: form.delivery_fee_uzs,
      }).eq('id', 1).select());
      await qc.invalidateQueries({ queryKey: ['bundle-settings'] });
      toast('success', 'Nabor konstruktori sozlamalari saqlandi.');
    } catch (err) { toast('error', humanError(err)); }
    finally { setBusy(false); }
  }
  return <Card className="space-y-3 p-4">
    <h2 className="font-bold">Nabor tuzish va chegirma sozlamalari</h2>
    <p className="text-sm text-neutral-500">Operatorlar uchun chegirma limitlari va yetkazib berish narxini boshqaring.</p>
    {q.isLoading && <LoadingBlock rows={2} />}
    {q.isError && <ErrorState message="Nabor sozlamalari topilmadi. 007_bundle_builder.sql faylini Supabase SQL Editor’da ishga tushiring." onRetry={() => void q.refetch()} />}
    {form && !q.isError && <form onSubmit={(e) => void save(e)} className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.discount_enabled} onChange={e => setForm({ ...form, discount_enabled: e.target.checked })} /> Chegirmalarni yoqish</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.operators_can_discount} onChange={e => setForm({ ...form, operators_can_discount: e.target.checked })} /> Operatorlarga chegirma berishga ruxsat</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Maksimal foizli chegirma (%)"><Input type="number" min="0" max="100" step="0.01" value={form.max_discount_percent} onChange={e => setForm({ ...form, max_discount_percent: Number(e.target.value) })} /></Field>
        <Field label="Maksimal summali chegirma (so‘m)"><Input type="number" min="0" step="1" value={form.max_discount_uzs} onChange={e => setForm({ ...form, max_discount_uzs: Number(e.target.value) })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.free_delivery} onChange={e => setForm({ ...form, free_delivery: e.target.checked })} /> Yetkazib berish bepul</label>
      {!form.free_delivery && <Field label="Yetkazib berish narxi (so‘m)"><Input type="number" min="0" step="1" value={form.delivery_fee_uzs} onChange={e => setForm({ ...form, delivery_fee_uzs: Number(e.target.value) })} /></Field>}
      <p className="text-xs text-neutral-500">Chegirmalar dastlab o‘chirilgan. Ularni yoqib, ruxsat va limitlarni belgilashingiz mumkin. Narxlar serverda qayta tekshiriladi.</p>
      <Button type="submit" loading={busy}>Sozlamalarni saqlash</Button>
    </form>}
  </Card>;
}
