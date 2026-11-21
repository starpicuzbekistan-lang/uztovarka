import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, Input, LoadingBlock, Notice, useToast } from '@/components/ui';
import { validColorThresholds, useKpiColorThresholds } from '@/lib/kpiColors';
import { supabase, unwrap } from '@/lib/supabase';
import { humanError } from '@/lib/uz';

export default function KpiColorSettingsAdmin() {
  const query = useKpiColorThresholds();
  const qc = useQueryClient();
  const toast = useToast();
  const [red, setRed] = useState('');
  const [yellow, setYellow] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) {
      setRed(String(query.data.redBelow));
      setYellow(String(query.data.yellowBelow));
    }
  }, [query.data?.redBelow, query.data?.yellowBelow]);

  const redNumber = Number(red);
  const yellowNumber = Number(yellow);
  const valid = /^\d+$/.test(red) && /^\d+$/.test(yellow)
    && validColorThresholds({ redBelow: redNumber, yellowBelow: yellowNumber });
  const changed = !!query.data && (redNumber !== query.data.redBelow || yellowNumber !== query.data.yellowBelow);

  async function save() {
    if (!valid || !query.data || !changed) return;
    setSaving(true);
    try {
      await unwrap(supabase.from('kpi_color_thresholds')
        .update({ red_below: redNumber, yellow_below: yellowNumber, updated_at: new Date().toISOString() })
        .eq('id', 1).select('id').single());
      await qc.invalidateQueries();
      toast('success', 'Kun ranglari chegaralari saqlandi.');
    } catch (e) { toast('error', humanError(e)); }
    finally { setSaving(false); }
  }

  return <Card className="space-y-4 p-4">
    <h2 className="text-lg font-bold">KPI kun ranglari chegaralari</h2>
    <p className="text-sm text-neutral-500">Har ikki maydonga son kiriting. Yashil kun sariq limitdan boshlanadi.</p>
    {query.isLoading && <LoadingBlock rows={2}/>}
    {query.isError && <ErrorState message="KPI ranglari yuklanmadi. Supabase’da 016 SQL migratsiyasini o‘rnating." onRetry={() => void query.refetch()}/>}
    {query.data && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500"/> Qizil kun — bundan kam</span>
          <Input type="number" min="0" max="999999" step="1" value={red} onChange={e => setRed(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-400"/> Sariq kun — bundan kam</span>
          <Input type="number" min="1" max="1000000" step="1" value={yellow} onChange={e => setYellow(e.target.value)} />
        </label>
      </div>
      {!valid && <Notice tone="warn">Sariq kun limiti qizil kun limitidan kattaroq butun son bo‘lishi kerak.</Notice>}
      {valid && <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
        <div>🔴 Qizil: 0–{redNumber-1} ta</div>
        <div>🟡 Sariq: {redNumber}–{yellowNumber-1} ta</div>
        <div>🟢 Yashil: {yellowNumber} ta va undan ko‘p</div>
      </div>}
      <Notice tone="info">Faqat kun ranglari o‘zgaradi. Oylik maosh, qabul to‘lovi, bonus va jarima hisoblash formulalari o‘zgarmaydi.</Notice>
      <Button loading={saving} disabled={!valid || !changed} onClick={() => void save()}>Chegaralarni saqlash</Button>
    </>}
  </Card>;
}
