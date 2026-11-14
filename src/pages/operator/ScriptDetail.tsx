import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { BackLink, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, Select, useToast } from '@/components/ui';
import { hasMissing, renderScript, segmentsToPlain, type ScriptSetData } from '@/lib/script';
import { SCRIPT_CATEGORY_UZ } from '@/lib/uz';
import { copyText } from '@/lib/clipboard';

interface Stage { id: string; position: number; title: string; objective: string | null; body: string; notes: string | null }
interface SetRow {
  id: string; code: string; name: string; price_uzs: number | null; delivery_info: string | null; status: string;
  items: { quantity: number; is_bonus: boolean; position: number; product: { name: string } | null }[];
}
interface ScriptFull {
  id: string; title: string; category: keyof typeof SCRIPT_CATEGORY_UZ; description: string | null;
  stages: Stage[]; sets: { set: SetRow | null }[];
}

export default function ScriptDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [pickedSet, setPickedSet] = useState<string | null>(sp.get('nabor'));

  const q = useQuery({
    queryKey: ['script', id],
    queryFn: async () => (await unwrap(supabase.from('scripts')
      .select('id,title,category,description,stages:script_stages(id,position,title,objective,body,notes),sets:script_sets(set:sets(id,code,name,price_uzs,delivery_info,status,items:set_items(quantity,is_bonus,position,product:products(name))))')
      .eq('id', id!).eq('status', 'published').maybeSingle())) as unknown as ScriptFull | null,
  });

  const stages = useMemo(() => [...(q.data?.stages ?? [])].sort((a, b) => a.position - b.position), [q.data]);
  const sets = (q.data?.sets ?? []).map((x) => x.set).filter((s): s is SetRow => !!s && s.status === 'published');
  const activeSet = sets.find((s) => s.id === pickedSet) ?? (sets.length === 1 ? sets[0] : null);
  const setData: ScriptSetData | null = activeSet && {
    name: activeSet.name, code: activeSet.code, priceUzs: activeSet.price_uzs == null ? null : Number(activeSet.price_uzs), deliveryInfo: activeSet.delivery_info,
    items: [...activeSet.items].sort((a, b) => a.position - b.position).filter((i) => i.product).map((i) => ({ name: i.product!.name, quantity: i.quantity, isBonus: i.is_bonus })),
  };

  if (q.isLoading) return <LoadingBlock rows={4} />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  if (!q.data) return <EmptyState title="Skript topilmadi." action={<Link to="/skriptlar" className="font-semibold underline">Orqaga</Link>} />;
  if (stages.length === 0) return <div className="space-y-3"><BackLink to="/skriptlar" /><EmptyState title="Bu skriptda hali bosqichlar yo‘q." /></div>;

  const cur = stages[Math.min(step, stages.length - 1)];
  const segs = renderScript(cur.body, setData);
  const missing = hasMissing(segs);

  async function copy() {
    const ok = await copyText(segmentsToPlain(segs));
    toast(ok ? 'success' : 'error', ok ? 'Matn nusxalandi.' : 'Nusxalab bo‘lmadi.');
  }

  return (
    <div className="space-y-3">
      <BackLink to="/skriptlar" />
      <div>
        <Badge tone="neutral">{SCRIPT_CATEGORY_UZ[q.data.category]}</Badge>
        <h1 className="mt-1 text-xl font-extrabold leading-tight">{q.data.title}</h1>
      </div>

      {sets.length > 1 && (
        <Select value={activeSet?.id ?? ''} onChange={(e) => setPickedSet(e.target.value || null)} aria-label="Nabor">
          <option value="">Naborni tanlang</option>
          {sets.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </Select>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Suhbat bosqichlari">
        {stages.map((s, i) => (
          <button key={s.id} role="tab" aria-selected={i === step} onClick={() => setStep(i)}
            className={clsx('inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold', i === step ? 'border-brand bg-brand text-ink' : 'border-neutral-300 bg-white text-neutral-600')}>
            <span className="text-xs opacity-70">{i + 1}</span> {s.title}
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{cur.title}</h2>
        {cur.objective && <p className="text-sm text-neutral-500"><b>Maqsad:</b> {cur.objective}</p>}
        <p className="whitespace-pre-line rounded-xl bg-neutral-50 p-4 text-[17px] leading-8">
          {segs.map((s, i) => s.missing
            ? <mark key={i} className="rounded bg-red-100 px-1 text-red-700">{s.text}</mark>
            : <span key={i}>{s.text}</span>)}
        </p>
        {missing && <Notice tone="warn"><AlertTriangle className="mr-1 inline h-4 w-4" /> Ba’zi ma’lumotlar kiritilmagan. Ularni mijozga aytishdan oldin administratordan so‘rang.</Notice>}
        {cur.notes && <p className="rounded-xl bg-brand-soft p-3 text-sm text-yellow-900"><b>Eslatma:</b> {cur.notes}</p>}
        <Button variant="outline" className="w-full" onClick={() => void copy()}><Copy className="h-4 w-4" /> Matnni nusxalash</Button>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ChevronLeft className="h-4 w-4" /> Oldingi</Button>
        <Button className="flex-1" disabled={step >= stages.length - 1} onClick={() => setStep((s) => s + 1)}>Keyingi <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
