import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Segmented, Select, Textarea, useToast } from '@/components/ui';
import { arrayToLines, cleanFaqs, FaqEditor, ImageManager, intOrNull, LinesField, linesToArray, PublishBadge } from '@/components/admin';
import { AVAILABILITY_UZ, humanError } from '@/lib/uz';
import { formatUzs } from '@/lib/format';

type Status = 'draft' | 'published' | 'archived';
interface Product {
  id: string; sku: string; name: string; category_id: string | null; description: string | null; price_uzs: number | null; quantity_info: string | null;
  colors: string[]; material: string | null; dimensions: string | null; specs: { label: string; value: string }[]; benefits: string[]; intended_use: string | null;
  usage_steps: string[]; compatibility: string | null; warnings: string | null; faqs: { q: string; a: string }[]; concerns: string[];
  availability: keyof typeof AVAILABILITY_UZ; status: Status; is_demo: boolean;
}
interface Form {
  sku: string; name: string; category_id: string; description: string; price: string; quantity_info: string; colors: string; material: string; dimensions: string;
  specs: string; benefits: string; intended_use: string; usage_steps: string; compatibility: string; warnings: string; faqs: { q: string; a: string }[]; concerns: string;
  availability: keyof typeof AVAILABILITY_UZ; status: Status;
}
const EMPTY: Form = { sku: '', name: '', category_id: '', description: '', price: '', quantity_info: '', colors: '', material: '', dimensions: '', specs: '', benefits: '', intended_use: '', usage_steps: '', compatibility: '', warnings: '', faqs: [], concerns: '', availability: 'available', status: 'draft' };

const toForm = (p: Product): Form => ({
  sku: p.sku, name: p.name, category_id: p.category_id ?? '', description: p.description ?? '', price: p.price_uzs == null ? '' : String(p.price_uzs),
  quantity_info: p.quantity_info ?? '', colors: p.colors.join(', '), material: p.material ?? '', dimensions: p.dimensions ?? '',
  specs: (p.specs ?? []).map((s) => `${s.label}: ${s.value}`).join('\n'), benefits: arrayToLines(p.benefits), intended_use: p.intended_use ?? '',
  usage_steps: arrayToLines(p.usage_steps), compatibility: p.compatibility ?? '', warnings: p.warnings ?? '', faqs: p.faqs ?? [], concerns: arrayToLines(p.concerns),
  availability: p.availability, status: p.status,
});

export default function Products() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const [del, setDel] = useState<Product | null>(null);

  const list = useQuery({ queryKey: ['admin-products'], queryFn: async () => (await unwrap(supabase.from('products').select('*').order('name'))) as Product[] });
  const cats = useQuery({ queryKey: ['product-categories'], queryFn: async () => (await unwrap(supabase.from('product_categories').select('*').order('position').order('name'))) as { id: string; name: string }[] });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-products'] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => { await unwrap(supabase.from('products').update({ status }).eq('id', id).select()); },
    onSuccess: () => { void refresh(); toast('success', 'Holat yangilandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });

  const rows = (list.data ?? []).filter((p) => (filter === 'all' || p.status === filter) && `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Mahsulotlar" subtitle="Mahsulot ma’lumoti barcha naborlarda avtomatik yangilanadi."
        action={<Button onClick={() => setEdit({ id: null, form: EMPTY })}><Plus className="h-4 w-4" /> Yangi mahsulot</Button>} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Nomi yoki kodi bo‘yicha qidirish" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Hammasi' }, { value: 'published', label: 'Nashr' }, { value: 'draft', label: 'Qoralama' }, { value: 'archived', label: 'Arxiv' }]} />
      </div>
      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState title="Mahsulotlar topilmadi." />}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-neutral-500">{p.sku}</div></div>
              <div className="flex flex-wrap justify-end gap-1"><PublishBadge status={p.status} />{p.is_demo && <DemoBadge />}</div>
            </div>
            <div className="text-sm text-neutral-600">{p.price_uzs != null ? formatUzs(Number(p.price_uzs)) : 'Narx kiritilmagan'} · {AVAILABILITY_UZ[p.availability]}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, form: toForm(p) })}><Pencil className="h-4 w-4" /> Tahrirlash</Button>
              {p.status !== 'published'
                ? <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: p.id, status: 'published' })}><Eye className="h-4 w-4" /> Nashr etish</Button>
                : <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: p.id, status: 'draft' })}><EyeOff className="h-4 w-4" /> Yashirish</Button>}
              {p.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: p.id, status: 'archived' })}><Archive className="h-4 w-4" /> Arxivlash</Button>}
              <Button size="sm" variant="ghost" onClick={() => setDel(p)}><Trash2 className="h-4 w-4 text-red-600" /> O‘chirish</Button>
            </div>
          </Card>
        ))}
      </div>

      {edit && <ProductEditor key={edit.id ?? 'new'} initial={edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={() => void refresh()} />}

      <ConfirmDialog open={!!del} danger title="Mahsulotni o‘chirish" confirmLabel="O‘chirish"
        message={`“${del?.name}” butunlay o‘chiriladi. Agar mahsulot biror naborga kirgan bo‘lsa, o‘chirib bo‘lmaydi — uni arxivlang.`}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try { await unwrap(supabase.from('products').delete().eq('id', del!.id).select()); toast('success', 'Mahsulot o‘chirildi.'); void refresh(); }
          catch (e) { toast('error', humanError(e)); }
          setDel(null);
        }} />
    </div>
  );
}

function ProductEditor({ initial, cats, onClose, onSaved }: { initial: { id: string | null; form: Form }; cats: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [id, setId] = useState(initial.id);
  const [f, setF] = useState<Form>(initial.form);
  const [errs, setErrs] = useState<{ sku?: string; name?: string; price?: string; specs?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (!f.sku.trim()) next.sku = 'Mahsulot kodini kiriting.';
    if (!f.name.trim()) next.name = 'Nomini kiriting.';
    const price = intOrNull(f.price);
    if (Number.isNaN(price)) next.price = 'Narx butun, manfiy bo‘lmagan son bo‘lishi kerak.';
    const specs = linesToArray(f.specs).map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : null;
    });
    if (specs.some((s) => !s || !s.value)) next.specs = 'Har bir qator “Nomi: qiymati” ko‘rinishida bo‘lishi kerak.';
    setErrs(next);
    if (Object.keys(next).length) return;
    const row = {
      sku: f.sku.trim(), name: f.name.trim(), category_id: f.category_id || null, description: f.description.trim() || null, price_uzs: price,
      quantity_info: f.quantity_info.trim() || null, colors: f.colors.split(',').map((x) => x.trim()).filter(Boolean), material: f.material.trim() || null,
      dimensions: f.dimensions.trim() || null, specs, benefits: linesToArray(f.benefits), intended_use: f.intended_use.trim() || null,
      usage_steps: linesToArray(f.usage_steps), compatibility: f.compatibility.trim() || null, warnings: f.warnings.trim() || null,
      faqs: cleanFaqs(f.faqs), concerns: linesToArray(f.concerns), availability: f.availability, status: f.status,
    };
    setBusy(true);
    try {
      if (id) await unwrap(supabase.from('products').update(row).eq('id', id).select());
      else { const r = (await unwrap(supabase.from('products').insert(row).select('id').single())) as { id: string }; setId(r.id); }
      onSaved();
      toast('success', id ? 'Mahsulot saqlandi.' : 'Mahsulot yaratildi. Endi rasmlarni qo‘shishingiz mumkin.');
      if (id) onClose();
    } catch (err) {
      const dup = (err as { code?: string })?.code === '23505';
      setErrs({ form: dup ? 'Bu kod bilan mahsulot allaqachon mavjud.' : humanError(err) });
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        {errs.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errs.form}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nomi" error={errs.name}><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Mahsulot kodi (SKU)" error={errs.sku}><Input value={f.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
          <Field label="Kategoriya">
            <Select value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Tanlanmagan</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Narxi (so‘m)" error={errs.price} hint="Bo‘sh qoldirilsa, “Narx kiritilmagan” ko‘rinadi."><Input inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label="Mavjudlik"><Select value={f.availability} onChange={(e) => set('availability', e.target.value as Form['availability'])}>{Object.entries(AVAILABILITY_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Holati"><Select value={f.status} onChange={(e) => set('status', e.target.value as Status)}><option value="draft">Qoralama</option><option value="published">Nashr etilgan</option><option value="archived">Arxivlangan</option></Select></Field>
          <Field label="Miqdor / hajm"><Input value={f.quantity_info} onChange={(e) => set('quantity_info', e.target.value)} /></Field>
          <Field label="Ranglar" hint="Vergul bilan ajrating."><Input value={f.colors} onChange={(e) => set('colors', e.target.value)} /></Field>
          <Field label="Material"><Input value={f.material} onChange={(e) => set('material', e.target.value)} /></Field>
          <Field label="O‘lchamlari"><Input value={f.dimensions} onChange={(e) => set('dimensions', e.target.value)} /></Field>
        </div>
        <Field label="Tavsif"><Textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Texnik xususiyatlar" error={errs.specs} hint="Har bir qator: “Nomi: qiymati”. Faqat tasdiqlangan ma’lumot kiriting."><Textarea rows={3} value={f.specs} onChange={(e) => set('specs', e.target.value)} /></Field>
        <LinesField label="Foydalari" value={f.benefits} onChange={(v) => set('benefits', v)} />
        <Field label="Qayerda ishlatiladi"><Textarea rows={2} value={f.intended_use} onChange={(e) => set('intended_use', e.target.value)} /></Field>
        <LinesField label="Foydalanish bosqichlari" hint="Har bir bosqichni yangi qatordan yozing (raqamlanadi)." value={f.usage_steps} onChange={(v) => set('usage_steps', v)} />
        <Field label="Mos avtomobillar" hint="Faqat tasdiqlangan ma’lumotni yozing. Bo‘sh bo‘lsa, operatorga “kiritilmagan” ko‘rinadi."><Textarea rows={2} value={f.compatibility} onChange={(e) => set('compatibility', e.target.value)} /></Field>
        <Field label="Ogohlantirish va cheklovlar"><Textarea rows={2} value={f.warnings} onChange={(e) => set('warnings', e.target.value)} /></Field>
        <LinesField label="Mijozlarning odatiy xavotirlari" value={f.concerns} onChange={(v) => set('concerns', v)} rows={3} />
        <FaqEditor value={f.faqs} onChange={(v) => set('faqs', v)} />
        {id ? <ImageManager table="product_images" parentColumn="product_id" parentId={id} /> : <p className="text-sm text-neutral-500">Rasm qo‘shish uchun avval mahsulotni saqlang.</p>}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>{id ? 'Yopish' : 'Bekor qilish'}</Button>
          <Button type="submit" loading={busy}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  );
}
