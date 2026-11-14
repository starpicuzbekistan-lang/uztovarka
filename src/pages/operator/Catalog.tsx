import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { CoverImage } from '@/components/Media';
import { Badge, Chip, DemoBadge, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Segmented } from '@/components/ui';
import { formatUzs } from '@/lib/format';
import { AVAILABILITY_UZ } from '@/lib/uz';

export interface ProductRow {
  id: string; sku: string; name: string; description: string | null; price_uzs: number | null; availability: keyof typeof AVAILABILITY_UZ; is_demo: boolean;
  category: { id: string; name: string } | null; images: { path: string; position: number }[];
}
export interface SetRow {
  id: string; code: string; name: string; description: string | null; price_uzs: number | null; availability: keyof typeof AVAILABILITY_UZ; is_demo: boolean;
  images: { path: string; position: number }[]; items: { quantity: number; is_bonus: boolean; product: { name: string } | null }[];
}

export const availTone = (a: string) => (a === 'available' ? 'green' : a === 'limited' ? 'yellow' : 'red') as 'green' | 'yellow' | 'red';
export const firstImage = (imgs: { path: string; position: number }[]) => [...imgs].sort((a, b) => a.position - b.position)[0]?.path ?? null;

export default function Catalog() {
  const [tab, setTab] = useState<'products' | 'sets'>('sets');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [avail, setAvail] = useState<'all' | 'available'>('all');

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await unwrap(supabase.from('products').select('id,sku,name,description,price_uzs,availability,is_demo,category:product_categories(id,name),images:product_images(path,position)').eq('status', 'published').order('name'))) as unknown as ProductRow[],
  });
  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: async () => (await unwrap(supabase.from('sets').select('id,code,name,description,price_uzs,availability,is_demo,images:set_images(path,position),items:set_items(quantity,is_bonus,product:products(name))').eq('status', 'published').order('code'))) as unknown as SetRow[],
  });

  const cats = useMemo(() => {
    const m = new Map<string, string>();
    (products.data ?? []).forEach((p) => p.category && m.set(p.category.id, p.category.name));
    return [...m.entries()];
  }, [products.data]);

  const term = search.trim().toLowerCase();
  const fp = (products.data ?? []).filter((p) =>
    (cat === 'all' || p.category?.id === cat) && (avail === 'all' || p.availability === 'available') &&
    (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)));
  const fs = (sets.data ?? []).filter((s) =>
    (avail === 'all' || s.availability === 'available') &&
    (!term || s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term) || s.items.some((i) => i.product?.name.toLowerCase().includes(term))));

  const active = tab === 'products' ? products : sets;

  return (
    <div className="space-y-3">
      <PageHeader title="Mahsulotlar" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'sets', label: 'Naborlar' }, { value: 'products', label: 'Mahsulotlar' }]} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input type="search" placeholder={tab === 'sets' ? 'Nabor nomi, kodi yoki tarkibi bo‘yicha qidirish' : 'Nomi yoki kodi bo‘yicha qidirish'} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip active={avail === 'available'} onClick={() => setAvail(avail === 'all' ? 'available' : 'all')}>Faqat mavjud</Chip>
        {tab === 'products' && <>
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>Barcha toifalar</Chip>
          {cats.map(([id, name]) => <Chip key={id} active={cat === id} onClick={() => setCat(id)}>{name}</Chip>)}
        </>}
      </div>

      {active.isLoading ? <LoadingBlock rows={4} /> : active.isError ? <ErrorState onRetry={() => void active.refetch()} /> :
        tab === 'sets' ? (
          fs.length === 0 ? <EmptyState title={term ? 'Hech narsa topilmadi.' : 'Hozircha naborlar mavjud emas.'} /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fs.map((s) => (
                <Link key={s.id} to={`/naborlar/${s.id}`} className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-card">
                  <div className="aspect-[16/10] bg-neutral-100"><CoverImage path={firstImage(s.images)} alt={s.name} kind="set" /></div>
                  <div className="p-3.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5"><Badge tone="dark">{s.code}</Badge><Badge tone={availTone(s.availability)}>{AVAILABILITY_UZ[s.availability]}</Badge>{s.is_demo && <DemoBadge />}</div>
                    <h3 className="font-bold leading-snug">{s.name}</h3>
                    <p className="mt-1 text-sm text-neutral-500">{s.items.length} xil mahsulot</p>
                    <p className="mt-1 font-semibold">{s.price_uzs != null ? formatUzs(Number(s.price_uzs)) : <span className="text-sm font-normal italic text-neutral-400">Narx kiritilmagan</span>}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          fp.length === 0 ? <EmptyState title={term ? 'Hech narsa topilmadi.' : 'Hozircha mahsulotlar mavjud emas.'} /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fp.map((p) => (
                <Link key={p.id} to={`/mahsulotlar/${p.id}`} className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-card">
                  <div className="aspect-square bg-neutral-100"><CoverImage path={firstImage(p.images)} alt={p.name} kind="product" /></div>
                  <div className="p-3">
                    <p className="text-[11px] font-medium text-neutral-400">{p.sku}</p>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1"><Badge tone={availTone(p.availability)}>{AVAILABILITY_UZ[p.availability]}</Badge>{p.is_demo && <DemoBadge />}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
    </div>
  );
}
