import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { arrayToLines, cleanFaqs, FaqEditor, ImageManager, intOrNull, LinesField, linesToArray, PublishBadge } from '@/components/admin';
import { AVAILABILITY_UZ, humanError } from '@/lib/uz';
import { formatUzs } from '@/lib/format';

type Status = 'draft' | 'published' | 'archived';
interface SetRow {
  id: string; code: string; name: string; description: string | null; price_uzs: number | null; promo: string | null; benefits: string[]; usage_info: string | null;
  delivery_info: string | null; payment_info: string | null; availability: keyof typeof AVAILABILITY_UZ; faqs: { q: string; a: string }[]; status: Status; is_demo: boolean;
  items: { product_id: string; quantity: number; is_bonus: boolean; position: number }[]; scripts: { script_id: string }[];
}
interface Item { product_id: string; quantity: string; is_bonus: boolean }
interface Form {
  code: string; name: string; description: string; price: string; promo: string; benefits: string; usage_info: string; delivery_info: string; payment_info: string;
  availability: keyof typeof AVAILABILITY_UZ; status: Status; faqs: { q: string; a: string }[]; items: Item[]; script_id: string;
}
const EMPTY: Form = { code: '', name: '', description: '', price: '', promo: '', benefits: '', usage_info: '', delivery_info: '', payment_info: '', availability: 'available', status: 'draft', faqs: [], items: [], script_id: '' };

const toForm = (s: SetRow): Form => ({
  code: s.code, name: s.name, description: s.description ?? '', price: s.price_uzs == null ? '' : String(s.price_uzs), promo: s.promo ?? '', benefits: arrayToLines(s.benefits),
  usage_info: s.usage_info ?? '', delivery_info: s.delivery_info ?? '', payment_info: s.payment_info ?? '', availability: s.availability, status: s.status, faqs: s.faqs ?? [],
  items: [...s.items].sort((a, b) => a.position - b.position).map((i) => ({ product_id: i.product_id, quantity: String(i.quantity), is_bonus: i.is_bonus })), script_id: s.scripts[0]?.script_id ?? '',
});

export default function Sets() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const [del, setDel] = useState<SetRow | null>(null);
  const [search, setSearch] = useState('');

  const list = useQuery({ queryKey: ['admin-sets'], queryFn: async () => (await unwrap(supabase.from('sets').select('*,items:set_items(product_id,quantity,is_bonus,position),scripts:script_sets(script_id)').order('code'))) as unknown as SetRow[] });
  const products = useQuery({ queryKey: ['admin-product-options'], queryFn: async () => (await unwrap(supabase.from('products').select('id,name,sku').neq('status', 'archived').order('name'))) as { id: string; name: string; sku: string }[] });
  const scripts = useQuery({ queryKey: ['admin-script-options'], queryFn: async () => (await unwrap(supabase.from('scripts').select('id,title').order('title'))) as { id: string; title: string }[] });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-sets'] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => { await unwrap(supabase.from('sets').update({ status }).eq('id', id).select()); },
    onSuccess: () => { void refresh(); toast('success', 'Holat yangilandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });

  const rows = (list.data ?? []).filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Naborlar" subtitle="Nabor mavjud mahsulotlardan tuziladi; mahsulot ma’lumoti takrorlanmaydi."
        action={<Button onClick={() => setEdit({ id: null, form: { ...EMPTY, code: nextCode(list.data ?? []) } })}><Plus className="h-4 w-4" /> Yangi nabor</Button>} />
      <Input placeholder="Nomi yoki kodi bo‘yicha qidirish" value={search} onChange={(e) => setSearch(e.target.value)} />
      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState title="Naborlar topilmadi." />}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((s) => (
          <Card key={s.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="truncate font-semibold">{s.name}</div><div className="text-xs text-neutral-500">{s.code} · {s.items.length} ta mahsulot</div></div>
              <div className="flex flex-wrap justify-end gap-1"><PublishBadge status={s.status} />{s.is_demo && <DemoBadge />}</div>
            </div>
            <div className="text-sm text-neutral-600">{s.price_uzs != null ? formatUzs(Number(s.price_uzs)) : 'Narx kiritilmagan'} · {AVAILABILITY_UZ[s.availability]}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: s.id, form: toForm(s) })}><Pencil className="h-4 w-4" /> Tahrirlash</Button>
              {s.status !== 'published'
                ? <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'published' })}><Eye className="h-4 w-4" /> Nashr etish</Button>
                : <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'draft' })}><EyeOff className="h-4 w-4" /> Yashirish</Button>}
              {s.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: 'archived' })}><Archive className="h-4 w-4" /> Arxivlash</Button>}
              <Button size="sm" variant="ghost" onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-red-600" /> O‘chirish</Button>
            </div>
          </Card>
        ))}
      </div>

      {edit && <SetEditor key={edit.id ?? 'new'} initial={edit} products={products.data ?? []} scripts={scripts.data ?? []} onClose={() => setEdit(null)} onSaved={() => void refresh()} />}

      <ConfirmDialog open={!!del} danger title="Naborni o‘chirish" confirmLabel="O‘chirish"
        message={`“${del?.name}” o‘chiriladi. Mahsulotlarning o‘zi saqlanib qoladi.`} onClose={() => setDel(null)}
        onConfirm={async () => {
          try { await unwrap(supabase.from('sets').delete().eq('id', del!.id).select()); toast('success', 'Nabor o‘chirildi.'); void refresh(); }
          catch (e) { toast('error', humanError(e)); }
          setDel(null);
        }} />
    </div>
  );
}

function nextCode(sets: { code: string }[]) {
  const max = sets.reduce((m, s) => { const n = /(\d+)$/.exec(s.code); return n ? Math.max(m, Number(n[1])) : m; }, 0);
  return `SET-${String(max + 1).padStart(2, '0')}`;
}

function SetEditor({ initial, products, scripts, onClose, onSaved }: {
  initial: { id: string | null; form: Form }; products: { id: string; name: string; sku: string }[]; scripts: { id: string; title: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [id, setId] = useState(initial.id);
  const [f, setF] = useState<Form>(initial.form);
  const [errs, setErrs] = useState<{ code?: string; name?: string; price?: string; items?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const setItem = (i: number, patch: Partial<Item>) => set('items', f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (!f.code.trim()) next.code = 'Nabor kodini kiriting.';
    if (!f.name.trim()) next.name = 'Nomini kiriting.';
    const price = intOrNull(f.price);
    if (Number.isNaN(price)) next.price = 'Narx butun, manfiy bo‘lmagan son bo‘lishi kerak.';
    const items = f.items.map((i) => ({ ...i, q: Number(i.quantity) }));
    if (items.some((i) => !i.product_id)) next.items = 'Barcha qatorlarda mahsulotni tanlang.';
    else if (items.some((i) => !Number.isInteger(i.q) || i.q < 1)) next.items = 'Miqdor 1 yoki undan katta butun son bo‘lishi kerak.';
    else if (new Set(items.map((i) => i.product_id)).size !== items.length) next.items = 'Bitta mahsulot naborga faqat bir marta qo‘shiladi (miqdorini oshiring).';
    setErrs(next);
    if (Object.keys(next).length) return;
    const row = {
      code: f.code.trim().toUpperCase(), name: f.name.trim(), description: f.description.trim() || null, price_uzs: price, promo: f.promo.trim() || null,
      benefits: linesToArray(f.benefits), usage_info: f.usage_info.trim() || null, delivery_info: f.delivery_info.trim() || null, payment_info: f.payment_info.trim() || null,
      availability: f.availability, faqs: cleanFaqs(f.faqs), status: f.status,
    };
    setBusy(true);
    try {
      let sid = id;
      if (sid) await unwrap(supabase.from('sets').update(row).eq('id', sid).select());
      else { const r = (await unwrap(supabase.from('sets').insert(row).select('id').single())) as { id: string }; sid = r.id; setId(sid); }
      // Tarkib va skript bog‘lanishini almashtirish
      await unwrap(supabase.from('set_items').delete().eq('set_id', sid).select());
      if (items.length) await unwrap(supabase.from('set_items').insert(items.map((i, p) => ({ set_id: sid, product_id: i.product_id, quantity: i.q, is_bonus: i.is_bonus, position: p }))).select());
      await unwrap(supabase.from('script_sets').delete().eq('set_id', sid).select());
      if (f.script_id) await unwrap(supabase.from('script_sets').insert({ set_id: sid, script_id: f.script_id }).select());
      onSaved();
      toast('success', id ? 'Nabor saqlandi.' : 'Nabor yaratildi. Endi rasmlarni qo‘shishingiz mumkin.');
      if (id) onClose();
    } catch (err) {
      const dup = (err as { code?: string })?.code === '23505';
      setErrs({ form: dup ? 'Bu kod bilan nabor allaqachon mavjud.' : humanError(err) });
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={id ? 'Naborni tahrirlash' : 'Yangi nabor'} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        {errs.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errs.form}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nabor nomi" error={errs.name}><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Nabor kodi" error={errs.code}><Input value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Narxi (so‘m)" error={errs.price} hint="Bo‘sh qoldirilsa, operatorga “narx kiritilmagan” ko‘rinadi."><Input inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label="Mavjudlik"><Select value={f.availability} onChange={(e) => set('availability', e.target.value as Form['availability'])}>{Object.entries(AVAILABILITY_UZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Holati"><Select value={f.status} onChange={(e) => set('status', e.target.value as Status)}><option value="draft">Qoralama</option><option value="published">Nashr etilgan</option><option value="archived">Arxivlangan</option></Select></Field>
          <Field label="Bog‘langan skript">
            <Select value={f.script_id} onChange={(e) => set('script_id', e.target.value)}><option value="">Yo‘q</option>{scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select>
          </Field>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Nabor tarkibi</span>
          {f.items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-2">
              <Select className="min-w-0 flex-1" value={it.product_id} onChange={(e) => setItem(i, { product_id: e.target.value })} aria-label="Mahsulot">
                <option value="">Mahsulotni tanlang</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </Select>
              <Input className="w-20" inputMode="numeric" aria-label="Miqdori" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
              <label className="inline-flex min-h-11 items-center gap-1.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-yellow-400" checked={it.is_bonus} onChange={(e) => setItem(i, { is_bonus: e.target.checked })} /> Sovg‘a</label>
              <Button type="button" size="sm" variant="ghost" aria-label="Qatorni o‘chirish" onClick={() => set('items', f.items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {errs.items && <p role="alert" className="text-sm text-red-600">{errs.items}</p>}
          <Button type="button" size="sm" variant="outline" onClick={() => set('items', [...f.items, { product_id: '', quantity: '1', is_bonus: false }])}><Plus className="h-4 w-4" /> Mahsulot qo‘shish</Button>
        </div>

        <Field label="Aksiya ma’lumoti"><Input value={f.promo} onChange={(e) => set('promo', e.target.value)} /></Field>
        <Field label="Tavsif"><Textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <LinesField label="Foydalari" value={f.benefits} onChange={(v) => set('benefits', v)} />
        <Field label="Foydalanish bo‘yicha ko‘rsatma"><Textarea rows={3} value={f.usage_info} onChange={(e) => set('usage_info', e.target.value)} /></Field>
        <Field label="Yetkazib berish shartlari"><Textarea rows={2} value={f.delivery_info} onChange={(e) => set('delivery_info', e.target.value)} /></Field>
        <Field label="To‘lov ma’lumoti"><Textarea rows={2} value={f.payment_info} onChange={(e) => set('payment_info', e.target.value)} /></Field>
        <FaqEditor value={f.faqs} onChange={(v) => set('faqs', v)} />
        {id ? <ImageManager table="set_images" parentColumn="set_id" parentId={id} /> : <p className="text-sm text-neutral-500">Rasm qo‘shish uchun avval naborni saqlang.</p>}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>{id ? 'Yopish' : 'Bekor qilish'}</Button>
          <Button type="submit" loading={busy}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  );
}
