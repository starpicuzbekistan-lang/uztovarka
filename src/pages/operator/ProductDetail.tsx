import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Gallery } from '@/components/Media';
import { Badge, Card, DemoBadge, EmptyState, ErrorState, LoadingBlock, ValueOrMissing } from '@/components/ui';
import { formatUzs } from '@/lib/format';
import { formatDateUz } from '@/lib/dates';
import { AVAILABILITY_UZ } from '@/lib/uz';
import { availTone } from './Catalog';

interface P {
  id: string; sku: string; name: string; description: string | null; price_uzs: number | null; quantity_info: string | null; colors: string[];
  material: string | null; dimensions: string | null; specs: { label: string; value: string }[]; benefits: string[]; intended_use: string | null;
  usage_steps: string[]; compatibility: string | null; warnings: string | null; faqs: { q: string; a: string }[]; concerns: string[];
  availability: keyof typeof AVAILABILITY_UZ; is_demo: boolean; updated_at: string;
  category: { name: string } | null; images: { path: string; position: number }[];
  sets: { set: { id: string; code: string; name: string; status: string } | null }[];
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card><h2 className="mb-2 text-base font-bold">{title}</h2>{children}</Card>
);

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await unwrap(supabase.from('products').select('*,category:product_categories(name),images:product_images(path,position),sets:set_items(set:sets(id,code,name,status))').eq('id', id!).eq('status', 'published').maybeSingle())) as unknown as P | null,
  });
  if (q.isLoading) return <LoadingBlock rows={3} />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const p = q.data;
  if (!p) return <EmptyState title="Mahsulot topilmadi." action={<Link to="/mahsulotlar" className="font-semibold underline">Mahsulotlarga qaytish</Link>} />;
  const imgs = [...p.images].sort((a, b) => a.position - b.position).map((i) => i.path);
  const related = p.sets.map((s) => s.set).filter((s): s is NonNullable<typeof s> => !!s && s.status === 'published');
  const specs = [
    ...(p.quantity_info ? [{ label: 'Miqdor / hajm', value: p.quantity_info }] : []),
    ...(p.colors.length ? [{ label: 'Ranglar', value: p.colors.join(', ') }] : []),
    ...(p.material ? [{ label: 'Material', value: p.material }] : []),
    ...(p.dimensions ? [{ label: 'O‘lchamlari', value: p.dimensions }] : []),
    ...(Array.isArray(p.specs) ? p.specs : []),
  ];

  return (
    <div className="space-y-3">
      <button onClick={() => nav(-1)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-600"><ArrowLeft className="h-4 w-4" /> Orqaga</button>
      <Gallery paths={imgs} alt={p.name} kind="product" />
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {p.category && <Badge tone="yellow">{p.category.name}</Badge>}
          <Badge tone={availTone(p.availability)}>{AVAILABILITY_UZ[p.availability]}</Badge>{p.is_demo && <DemoBadge />}
        </div>
        <h1 className="text-2xl font-extrabold leading-tight">{p.name}</h1>
        <p className="text-sm text-neutral-500">Kod: {p.sku}</p>
        <p className="mt-1 text-lg font-bold">{p.price_uzs != null ? formatUzs(Number(p.price_uzs)) : <span className="text-sm font-normal italic text-neutral-400">Narx kiritilmagan</span>}</p>
      </div>

      {p.description && <Section title="Tavsif"><p className="text-[15px] leading-7 text-ink-soft">{p.description}</p></Section>}
      {p.benefits.length > 0 && <Section title="Qanday foyda beradi?"><ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-soft">{p.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></Section>}
      {p.intended_use && <Section title="Qayerda ishlatiladi?"><p className="text-[15px] text-ink-soft">{p.intended_use}</p></Section>}
      {p.usage_steps.length > 0 && <Section title="Qanday ishlatiladi?"><ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-ink-soft">{p.usage_steps.map((s, i) => <li key={i}>{s}</li>)}</ol></Section>}
      {specs.length > 0 && (
        <Section title="Xususiyatlari">
          <dl className="divide-y divide-neutral-100 text-[15px]">{specs.map((s, i) => <div key={i} className="flex justify-between gap-4 py-2"><dt className="text-neutral-500">{s.label}</dt><dd className="text-right font-medium">{s.value}</dd></div>)}</dl>
        </Section>
      )}
      <Section title="Qaysi avtomobillarga mos?"><p className="text-[15px] text-ink-soft"><ValueOrMissing v={p.compatibility} /></p>
        {!p.compatibility && <p className="mt-1 text-xs text-neutral-500">Moslik tasdiqlanmaguncha mijozga taxmin bilan javob bermang.</p>}</Section>
      {p.warnings && <Section title="Ogohlantirish va cheklovlar"><p className="text-[15px] text-ink-soft">{p.warnings}</p></Section>}
      {p.concerns.length > 0 && <Section title="Mijozlar ko‘p bildiradigan xavotirlar"><ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-soft">{p.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <Link to="/skriptlar" className="mt-2 inline-block text-sm font-semibold underline decoration-brand decoration-2 underline-offset-2">E’tirozlarga javoblar →</Link></Section>}
      {Array.isArray(p.faqs) && p.faqs.length > 0 && (
        <Section title="Mijozlar ko‘p beradigan savollar">
          <div className="space-y-3">{p.faqs.map((f, i) => <div key={i}><p className="font-semibold">{f.q}</p><p className="mt-0.5 text-[15px] text-ink-soft">{f.a}</p></div>)}</div>
        </Section>
      )}
      {related.length > 0 && (
        <Section title="Qaysi naborlarga kiradi?">
          <div className="flex flex-col gap-2">{related.map((s) => <Link key={s.id} to={`/naborlar/${s.id}`} className="flex items-center gap-2 rounded-xl bg-neutral-50 p-3 font-medium hover:bg-neutral-100"><Badge tone="dark">{s.code}</Badge>{s.name}</Link>)}</div>
        </Section>
      )}
      <p className="pb-2 text-center text-xs text-neutral-400">Oxirgi yangilanish: {formatDateUz(p.updated_at.slice(0, 10))}</p>
    </div>
  );
}
