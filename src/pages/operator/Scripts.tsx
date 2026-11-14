import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Search } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Badge, Card, Chip, DemoBadge, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Segmented, useToast } from '@/components/ui';
import { formatDateUz } from '@/lib/dates';
import { SCRIPT_CATEGORY_UZ } from '@/lib/uz';
import { copyText } from '@/lib/clipboard';

type Cat = keyof typeof SCRIPT_CATEGORY_UZ;
interface ScriptRow {
  id: string; title: string; category: Cat; description: string | null; is_demo: boolean; updated_at: string;
  sets: { set: { name: string; code: string } | null }[];
}
interface Objection {
  id: string; objection: string; response: string; explanation: string | null; category: string | null; is_demo: boolean;
  product: { name: string } | null; set: { name: string } | null;
}

export default function Scripts() {
  const [tab, setTab] = useState<'scripts' | 'objections'>('scripts');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const toast = useToast();

  const scripts = useQuery({
    queryKey: ['scripts'],
    queryFn: async () => (await unwrap(supabase.from('scripts').select('id,title,category,description,is_demo,updated_at,sets:script_sets(set:sets(name,code))').eq('status', 'published').order('title'))) as unknown as ScriptRow[],
  });
  const objections = useQuery({
    queryKey: ['objections'],
    queryFn: async () => (await unwrap(supabase.from('objections').select('id,objection,response,explanation,category,is_demo,product:products(name),set:sets(name)').eq('status', 'published').order('position').order('objection'))) as unknown as Objection[],
  });

  const term = search.trim().toLowerCase();
  const fs = (scripts.data ?? []).filter((s) =>
    (cat === 'all' || s.category === cat) &&
    (!term || s.title.toLowerCase().includes(term) || (s.description ?? '').toLowerCase().includes(term) || s.sets.some((x) => x.set?.name.toLowerCase().includes(term))));
  const fo = (objections.data ?? []).filter((o) => !term || o.objection.toLowerCase().includes(term) || o.response.toLowerCase().includes(term));
  const active = tab === 'scripts' ? scripts : objections;

  async function copy(text: string) {
    const ok = await copyText(text);
    toast(ok ? 'success' : 'error', ok ? 'Nusxalandi.' : 'Nusxalab bo‘lmadi.');
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Skriptlar" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'scripts', label: 'Skriptlar' }, { value: 'objections', label: 'E’tirozlar' }]} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input type="search" className="pl-10" placeholder={tab === 'scripts' ? 'Skript nomi yoki nabor bo‘yicha qidirish' : 'E’tirozni qidirish'} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {tab === 'scripts' && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>Barchasi</Chip>
          {(Object.keys(SCRIPT_CATEGORY_UZ) as Cat[]).map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{SCRIPT_CATEGORY_UZ[c]}</Chip>)}
        </div>
      )}

      {active.isLoading && <LoadingBlock rows={4} />}
      {active.isError && <ErrorState onRetry={() => void active.refetch()} />}

      {tab === 'scripts' && scripts.data && (fs.length === 0
        ? <EmptyState title="Skriptlar topilmadi." hint="Qidiruv yoki filtrni o‘zgartirib ko‘ring." />
        : <div className="space-y-2">{fs.map((s) => (
          <Link key={s.id} to={`/skriptlar/${s.id}`} className="block">
            <Card className="space-y-1.5 transition-colors hover:border-brand">
              <div className="flex flex-wrap items-center gap-1.5"><Badge tone="neutral">{SCRIPT_CATEGORY_UZ[s.category]}</Badge>{s.is_demo && <DemoBadge />}</div>
              <h2 className="text-[17px] font-bold leading-snug">{s.title}</h2>
              {s.description && <p className="line-clamp-2 text-sm text-neutral-600">{s.description}</p>}
              {s.sets.length > 0 && <p className="text-xs text-neutral-500">Nabor: {s.sets.map((x) => x.set?.name).filter(Boolean).join(', ')}</p>}
              <p className="text-xs text-neutral-400">Yangilangan: {formatDateUz(s.updated_at.slice(0, 10))}</p>
            </Card>
          </Link>))}</div>)}

      {tab === 'objections' && objections.data && (fo.length === 0
        ? <EmptyState title="E’tirozlar topilmadi." />
        : <div className="space-y-2">{fo.map((o) => (
          <Card key={o.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold">“{o.objection}”</h2>
              {o.is_demo && <DemoBadge />}
            </div>
            <p className="whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-[15px] leading-6">{o.response}</p>
            {o.explanation && <p className="text-sm text-neutral-500"><b>Nega shunday:</b> {o.explanation}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">{[o.category, o.product?.name, o.set?.name].filter(Boolean).join(' · ')}</span>
              <button onClick={() => void copy(o.response)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50"><Copy className="h-4 w-4" /> Nusxalash</button>
            </div>
          </Card>))}</div>)}
    </div>
  );
}
