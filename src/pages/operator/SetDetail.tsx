import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Gift } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Gallery } from '@/components/Media';
import { Badge, Card, DemoBadge, EmptyState, ErrorState, LoadingBlock, ValueOrMissing } from '@/components/ui';
import { formatUzs } from '@/lib/format';
import { formatDateUz } from '@/lib/dates';
import { AVAILABILITY_UZ } from '@/lib/uz';
import { availTone } from './Catalog';

interface S {
  id: string; code: string; name: string; description: string | null; price_uzs: number | null; promo: string | null; benefits: string[];
  usage_info: string | null; delivery_info: string | null; payment_info: string | null; availability: keyof typeof AVAILABILITY_UZ;
  faqs: { q: string; a: string }[]; is_demo: boolean; updated_at: string; images: { path: string; position: number }[];
  items: { quantity: number; is_bonus: boolean; position: number; product: { id: string; name: string; sku: string; status: string } | null }[];
  scripts: { script: { id: string; title: string; status: string } | null }[];
}

export default function SetDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['set', id],
    queryFn: async () => (await unwrap(supabase.from('sets').select('*,images:set_images(path,position),items:set_items(quantity,is_bonus,position,product:products(id,name,sku,status)),scripts:script_sets(script:scripts(id,title,status))').eq('id', id!).eq('status', 'published').maybeSingle())) as unknown as S | null,
  });
  if (q.isLoading) return <LoadingBlock rows={3} />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const s = q.data;
  if (!s) return <EmptyState title="Nabor topilmadi." action={<Link to="/mahsulotlar" className="font-semibold underline">Orqaga</Link>} />;
  const imgs = [...s.images].sort((a, b) => a.position - b.position).map((i) => i.path);
  const items = [...s.items].sort((a, b) => a.position - b.position);
  const script = s.scripts.map((x) => x.script).find((x) => x && x.status === 'published');

  return (
    <div className="space-y-3">
      <button onClick={() => nav(-1)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-600"><ArrowLeft className="h-4 w-4" /> Orqaga</button>
      <Gallery paths={imgs} alt={s.name} kind="set" />
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5"><Badge tone="dark">{s.code}</Badge><Badge tone={availTone(s.availability)}>{AVAILABILITY_UZ[s.availability]}</Badge>{s.is_demo && <DemoBadge />}</div>
        <h1 className="text-2xl font-extrabold leading-tight">{s.name}</h1>
        <p className="mt-1 text-2xl font-bold">{s.price_uzs != null ? formatUzs(Number(s.price_uzs)) : <span className="text-sm font-normal italic text-neutral-400">Narx kiritilmagan</span>}</p>
        {s.promo && <p className="mt-2 rounded-xl bg-brand-soft p-3 text-sm font-medium text-yellow-900">{s.promo}</p>}
      </div>

      {script && (
        <Link to={`/skriptlar/${script.id}?nabor=${s.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-ink hover:bg-brand-dark">
          <BookOpen className="h-5 w-5" /> Ushbu nabor skriptini ochish
        </Link>
      )}

      <Card>
        <h2 className="mb-2 text-base font-bold">Nabor tarkibi</h2>
        {items.length === 0 ? <p className="text-sm text-neutral-500">Tarkib kiritilmagan.</p> : (
          <ul className="divide-y divide-neutral-100">
            {items.map((it, i) => (
              <li key={i}>
                {it.product && it.product.status === 'published' ? (
                  <Link to={`/mahsulotlar/${it.product.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><span className="block font-medium">{it.product.name}</span><span className="text-xs text-neutral-400">{it.product.sku}</span></span>
                    <span className="flex shrink-0 items-center gap-2">{it.is_bonus && <Badge tone="yellow"><Gift className="h-3 w-3" /> Sovg‘a</Badge>}<span className="font-semibold tabular-nums">{it.quantity} dona</span></span>
                  </Link>
                ) : (
                  <div className="flex min-h-12 items-center justify-between py-2"><span className="font-medium">{it.product?.name ?? 'Mahsulot'}</span><span className="font-semibold">{it.quantity} dona</span></div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-400">Mahsulot tafsilotini ko‘rish uchun uni bosing.</p>
      </Card>

      {s.description && <Card><h2 className="mb-2 text-base font-bold">Tavsif</h2><p className="text-[15px] leading-7 text-ink-soft">{s.description}</p></Card>}
      {s.benefits.length > 0 && <Card><h2 className="mb-2 text-base font-bold">Qanday foyda beradi?</h2><ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-soft">{s.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></Card>}
      {s.usage_info && <Card><h2 className="mb-2 text-base font-bold">Foydalanish bo‘yicha ko‘rsatma</h2><p className="whitespace-pre-line text-[15px] text-ink-soft">{s.usage_info}</p></Card>}
      <Card><h2 className="mb-2 text-base font-bold">Yetkazib berish</h2><p className="whitespace-pre-line text-[15px] text-ink-soft"><ValueOrMissing v={s.delivery_info} /></p></Card>
      <Card><h2 className="mb-2 text-base font-bold">To‘lov</h2><p className="whitespace-pre-line text-[15px] text-ink-soft"><ValueOrMissing v={s.payment_info} /></p></Card>
      {Array.isArray(s.faqs) && s.faqs.length > 0 && (
        <Card><h2 className="mb-2 text-base font-bold">Mijozlar ko‘p beradigan savollar</h2>
          <div className="space-y-3">{s.faqs.map((f, i) => <div key={i}><p className="font-semibold">{f.q}</p><p className="mt-0.5 text-[15px] text-ink-soft">{f.a}</p></div>)}</div></Card>
      )}
      <p className="pb-2 text-center text-xs text-neutral-400">Oxirgi yangilanish: {formatDateUz(s.updated_at.slice(0, 10))}</p>
    </div>
  );
}
