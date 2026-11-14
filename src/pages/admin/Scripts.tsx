import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, Notice, PageHeader, Segmented, Select, Textarea, useToast } from '@/components/ui';
import { PublishBadge } from '@/components/admin';
import { hasMissing, renderScript, type ScriptSetData } from '@/lib/script';
import { humanError, SCRIPT_CATEGORY_UZ } from '@/lib/uz';

type Status = 'draft' | 'published' | 'archived';
type Cat = keyof typeof SCRIPT_CATEGORY_UZ;
interface Stage { key: string; title: string; objective: string; body: string; notes: string }
interface ScriptRow { id: string; title: string; category: Cat; description: string | null; status: Status; is_demo: boolean; stages: { id: string }[]; sets: { set_id: string }[] }
interface Objection { id: string; objection: string; response: string; explanation: string | null; category: string | null; product_id: string | null; set_id: string | null; status: Status; position: number; is_demo: boolean }

const DEFAULT_STAGES: Omit<Stage, 'key'>[] = [
  { title: 'Salomlashish', objective: 'UZTOVARKA nomidan tanishtirish va mijoz qiziqishini aniqlash.', body: 'Assalomu alaykum! Men UZTOVARKA operatori. Siz bizning sahifamizdan buyurtma qoldirgan edingiz, hozir gaplashishga qulaymi?', notes: '' },
  { title: 'Ehtiyojni aniqlash', objective: 'Mijozning vaziyatini tushunish uchun savollar berish.', body: 'Mashinangizda hozir eng ko‘p nimaga e’tibor berasiz — tozalikka, himoyaga yoki ko‘rinishgami?', notes: '' },
  { title: 'Mahsulot taqdimoti', objective: 'Mahsulot, foyda, miqdor va taklifni tushuntirish.', body: '{{nabor_nomi}} tarkibida: {{tarkib}}. Narxi: {{narx}}.', notes: '' },
  { title: 'E’tirozlar bilan ishlash', objective: 'Mijozning shubhalariga halol javob berish.', body: 'Tushunaman, savolingiz o‘rinli. Keling, birgalikda aniqlashtiramiz…', notes: '' },
  { title: 'Buyurtmani tasdiqlash', objective: 'Narx, manzil va shartlarni tasdiqlash.', body: 'Buyurtmani tasdiqlaymiz: {{nabor_nomi}}, narxi {{narx}}. Yetkazib berish: {{yetkazib_berish}}. Manzilingizni tasdiqlab bersangiz.', notes: '' },
];
let k = 0;
const newKey = () => `k${++k}`;

export default function Scripts() {
  const [tab, setTab] = useState<'scripts' | 'objections'>('scripts');
  return (
    <div className="space-y-4">
      <PageHeader title="Skriptlar" subtitle="Operatorlar faqat nashr etilgan skriptlarni o‘qiydi." />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'scripts', label: 'Skriptlar' }, { value: 'objections', label: 'E’tirozlar' }]} />
      {tab === 'scripts' ? <ScriptList /> : <ObjectionList />}
    </div>
  );
}

function ScriptList() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const [del, setDel] = useState<ScriptRow | null>(null);
  const list = useQuery({ queryKey: ['admin-scripts'], queryFn: async () => (await unwrap(supabase.from('scripts').select('id,title,category,description,status,is_demo,stages:script_stages(id),sets:script_sets(set_id)').order('title'))) as unknown as ScriptRow[] });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin-scripts'] }); void qc.invalidateQueries({ queryKey: ['admin-script-options'] }); };

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => { await unwrap(supabase.from('scripts').update({ status }).eq('id', id).select()); },
    onSuccess: () => { refresh(); toast('success', 'Holat yangilandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });

  async function duplicate(s: ScriptRow) {
    try {
      const src = (await unwrap(supabase.from('script_stages').select('*').eq('script_id', s.id).order('position'))) as { title: string; objective: string | null; body: string; notes: string | null; position: number }[];
      const copy = (await unwrap(supabase.from('scripts').insert({ title: `${s.title} (nusxa)`, category: s.category, description: s.description, status: 'draft' }).select('id').single())) as { id: string };
      if (src.length) await unwrap(supabase.from('script_stages').insert(src.map((x) => ({ script_id: copy.id, position: x.position, title: x.title, objective: x.objective, body: x.body, notes: x.notes }))).select());
      refresh();
      toast('success', 'Nusxa qoralama sifatida yaratildi.');
    } catch (e) { toast('error', humanError(e)); }
  }

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Yangi skript</Button></div>
      {list.isLoading && <LoadingBlock rows={3} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data?.length === 0 && <EmptyState title="Skriptlar hali yo‘q." />}
      <div className="grid gap-3 md:grid-cols-2">
        {(list.data ?? []).map((s) => (
          <Card key={s.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-semibold">{s.title}</div><div className="text-xs text-neutral-500">{SCRIPT_CATEGORY_UZ[s.category]} · {s.stages.length} bosqich</div></div>
              <div className="flex flex-wrap justify-end gap-1"><PublishBadge status={s.status} />{s.is_demo && <DemoBadge />}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(s.id)}><Pencil className="h-4 w-4" /> Tahrirlash</Button>
              {s.status !== 'published'
                ? <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'published' })}><Eye className="h-4 w-4" /> Nashr etish</Button>
                : <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'draft' })}><EyeOff className="h-4 w-4" /> Yashirish</Button>}
              <Button size="sm" variant="ghost" onClick={() => void duplicate(s)}><Copy className="h-4 w-4" /> Nusxa</Button>
              <Button size="sm" variant="ghost" onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-red-600" /> O‘chirish</Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && <ScriptEditor key={edit} id={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={refresh} />}
      <ConfirmDialog open={!!del} danger title="Skriptni o‘chirish" confirmLabel="O‘chirish" message={`“${del?.title}” va uning barcha bosqichlari o‘chiriladi.`} onClose={() => setDel(null)}
        onConfirm={async () => {
          try { await unwrap(supabase.from('scripts').delete().eq('id', del!.id).select()); toast('success', 'Skript o‘chirildi.'); refresh(); } catch (e) { toast('error', humanError(e)); }
          setDel(null);
        }} />
    </>
  );
}

function ScriptEditor({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Cat>('general');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [setIds, setSetIds] = useState<string[]>([]);
  const [stages, setStages] = useState<Stage[]>(id ? [] : DEFAULT_STAGES.map((s) => ({ ...s, key: newKey() })));
  const [preview, setPreview] = useState(false);
  const [previewSet, setPreviewSet] = useState('');
  const [err, setErr] = useState<{ title?: string; stages?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const sets = useQuery({ queryKey: ['admin-set-options'], queryFn: async () => (await unwrap(supabase.from('sets').select('id,code,name,price_uzs,delivery_info,items:set_items(quantity,is_bonus,position,product:products(name))').order('code'))) as unknown as { id: string; code: string; name: string; price_uzs: number | null; delivery_info: string | null; items: { quantity: number; is_bonus: boolean; position: number; product: { name: string } | null }[] }[] });
  const loaded = useQuery({
    queryKey: ['admin-script', id], enabled: !!id, staleTime: 0,
    queryFn: async () => {
      const s = (await unwrap(supabase.from('scripts').select('*,stages:script_stages(*),sets:script_sets(set_id)').eq('id', id!).single())) as unknown as { title: string; category: Cat; description: string | null; status: Status; stages: { position: number; title: string; objective: string | null; body: string; notes: string | null }[]; sets: { set_id: string }[] };
      setTitle(s.title); setCategory(s.category); setDescription(s.description ?? ''); setStatus(s.status); setSetIds(s.sets.map((x) => x.set_id));
      setStages([...s.stages].sort((a, b) => a.position - b.position).map((x) => ({ key: newKey(), title: x.title, objective: x.objective ?? '', body: x.body, notes: x.notes ?? '' })));
      return s;
    },
  });

  const move = (i: number, d: -1 | 1) => setStages((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const patch = (i: number, p: Partial<Stage>) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!title.trim()) next.title = 'Skript nomini kiriting.';
    if (stages.some((s) => !s.title.trim() || !s.body.trim())) next.stages = 'Har bir bosqichda sarlavha va matn bo‘lishi kerak.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const row = { title: title.trim(), category, description: description.trim() || null, status };
      let sid = id;
      if (sid) await unwrap(supabase.from('scripts').update(row).eq('id', sid).select());
      else sid = ((await unwrap(supabase.from('scripts').insert(row).select('id').single())) as { id: string }).id;
      await unwrap(supabase.from('script_stages').delete().eq('script_id', sid).select());
      if (stages.length) await unwrap(supabase.from('script_stages').insert(stages.map((s, p) => ({ script_id: sid, position: p, title: s.title.trim(), objective: s.objective.trim() || null, body: s.body, notes: s.notes.trim() || null }))).select());
      await unwrap(supabase.from('script_sets').delete().eq('script_id', sid).select());
      if (setIds.length) await unwrap(supabase.from('script_sets').insert(setIds.map((set_id) => ({ script_id: sid, set_id }))).select());
      onSaved();
      toast('success', 'Skript saqlandi.');
      onClose();
    } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }

  const pset = sets.data?.find((s) => s.id === (previewSet || setIds[0]));
  const psd: ScriptSetData | null = pset ? { name: pset.name, code: pset.code, priceUzs: pset.price_uzs == null ? null : Number(pset.price_uzs), deliveryInfo: pset.delivery_info, items: [...pset.items].sort((a, b) => a.position - b.position).filter((i) => i.product).map((i) => ({ name: i.product!.name, quantity: i.quantity, isBonus: i.is_bonus })) } : null;

  return (
    <Modal open onClose={onClose} title={id ? 'Skriptni tahrirlash' : 'Yangi skript'} wide>
      {id && loaded.isLoading ? <LoadingBlock rows={3} /> : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Skript nomi" error={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Kategoriya"><Select value={category} onChange={(e) => setCategory(e.target.value as Cat)}>{Object.entries(SCRIPT_CATEGORY_UZ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            <Field label="Holati"><Select value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="draft">Qoralama</option><option value="published">Nashr etilgan</option><option value="archived">Arxivlangan</option></Select></Field>
          </div>
          <Field label="Qisqa tavsif"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

          <div className="space-y-1">
            <span className="text-sm font-medium">Bog‘langan naborlar</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
              {(sets.data ?? []).length === 0 && <p className="text-sm text-neutral-500">Naborlar hali yo‘q.</p>}
              {(sets.data ?? []).map((s) => (
                <label key={s.id} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-yellow-400" checked={setIds.includes(s.id)} onChange={(e) => setSetIds((a) => (e.target.checked ? [...a, s.id] : a.filter((x) => x !== s.id)))} /> {s.code} — {s.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">Matnda <code>{'{{nabor_nomi}}'}</code>, <code>{'{{narx}}'}</code>, <code>{'{{yetkazib_berish}}'}</code>, <code>{'{{tarkib}}'}</code> yozsangiz, ular nabor ma’lumotidan avtomatik to‘ldiriladi. Narxni skriptga qo‘lda yozmang.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Bosqichlar</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>{preview ? 'Tahrirlash' : 'Operator ko‘rinishi'}</Button></div>
            {err.stages && <p role="alert" className="text-sm text-red-600">{err.stages}</p>}
            {preview && setIds.length > 1 && (
              <Select value={previewSet || setIds[0]} onChange={(e) => setPreviewSet(e.target.value)} aria-label="Ko‘rib chiqish uchun nabor">{(sets.data ?? []).filter((s) => setIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            )}
            {stages.map((s, i) => {
              const segs = renderScript(s.body, psd);
              return (
                <div key={s.key} className="space-y-2 rounded-2xl border border-neutral-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-500">BOSQICH {i + 1}</span>
                    <div className="flex">
                      <button type="button" aria-label="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)} className="p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Pastga" disabled={i === stages.length - 1} onClick={() => move(i, 1)} className="p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label="Bosqichni o‘chirish" onClick={() => setStages((a) => a.filter((_, j) => j !== i))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {preview ? (
                    <div className="space-y-1"><p className="font-semibold">{s.title}</p>
                      <p className="whitespace-pre-line rounded-xl bg-neutral-50 p-3">{segs.map((x, j) => (x.missing ? <mark key={j} className="rounded bg-red-100 px-1 text-red-700">{x.text}</mark> : <span key={j}>{x.text}</span>))}</p>
                      {hasMissing(segs) && <Notice tone="warn">Bu matnda nabor ma’lumoti yetishmayapti — operatorga ogohlantirish ko‘rinadi.</Notice>}</div>
                  ) : (<>
                    <Input placeholder="Sarlavha" value={s.title} onChange={(e) => patch(i, { title: e.target.value })} />
                    <Input placeholder="Maqsad" value={s.objective} onChange={(e) => patch(i, { objective: e.target.value })} />
                    <Textarea rows={4} placeholder="Operator uchun tavsiya etilgan matn" value={s.body} onChange={(e) => patch(i, { body: e.target.value })} />
                    <Input placeholder="Amaliy eslatma (ixtiyoriy)" value={s.notes} onChange={(e) => patch(i, { notes: e.target.value })} />
                  </>)}
                </div>
              );
            })}
            <Button type="button" size="sm" variant="outline" onClick={() => setStages((a) => [...a, { key: newKey(), title: '', objective: '', body: '', notes: '' }])}><Plus className="h-4 w-4" /> Bosqich qo‘shish</Button>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
            <Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button>
            <Button type="submit" loading={busy}>Saqlash</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ObjectionList() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Objection> | null>(null);
  const [del, setDel] = useState<Objection | null>(null);
  const list = useQuery({ queryKey: ['admin-objections'], queryFn: async () => (await unwrap(supabase.from('objections').select('*').order('position').order('objection'))) as Objection[] });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-objections'] });
  return (
    <>
      <div className="flex justify-end"><Button onClick={() => setEdit({ status: 'published', objection: '', response: '' })}><Plus className="h-4 w-4" /> Yangi e’tiroz</Button></div>
      {list.isLoading && <LoadingBlock rows={3} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data?.length === 0 && <EmptyState title="E’tirozlar hali yo‘q." />}
      <div className="space-y-2">
        {(list.data ?? []).map((o) => (
          <Card key={o.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">“{o.objection}”</div><div className="flex gap-1"><PublishBadge status={o.status} />{o.is_demo && <DemoBadge />}</div></div>
            <p className="line-clamp-2 text-sm text-neutral-600">{o.response}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(o)}><Pencil className="h-4 w-4" /> Tahrirlash</Button>
              <Button size="sm" variant="ghost" onClick={() => setDel(o)}><Trash2 className="h-4 w-4 text-red-600" /> O‘chirish</Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && <ObjectionEditor initial={edit} onClose={() => setEdit(null)} onSaved={() => void refresh()} />}
      <ConfirmDialog open={!!del} danger title="E’tirozni o‘chirish" confirmLabel="O‘chirish" message="Bu e’tiroz va javobi o‘chiriladi." onClose={() => setDel(null)}
        onConfirm={async () => { try { await unwrap(supabase.from('objections').delete().eq('id', del!.id).select()); void refresh(); toast('success', 'O‘chirildi.'); } catch (e) { toast('error', humanError(e)); } setDel(null); }} />
    </>
  );
}

function ObjectionEditor({ initial, onClose, onSaved }: { initial: Partial<Objection>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ objection: initial.objection ?? '', response: initial.response ?? '', explanation: initial.explanation ?? '', category: initial.category ?? '', product_id: initial.product_id ?? '', set_id: initial.set_id ?? '', status: (initial.status ?? 'published') as Status });
  const [err, setErr] = useState<{ objection?: string; response?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const products = useQuery({ queryKey: ['admin-product-options'], queryFn: async () => (await unwrap(supabase.from('products').select('id,name,sku').neq('status', 'archived').order('name'))) as { id: string; name: string; sku: string }[] });
  const sets = useQuery({ queryKey: ['admin-set-simple'], queryFn: async () => (await unwrap(supabase.from('sets').select('id,name,code').order('code'))) as { id: string; name: string; code: string }[] });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!f.objection.trim()) next.objection = 'Mijoz e’tirozini kiriting.';
    if (!f.response.trim()) next.response = 'Tavsiya etilgan javobni kiriting.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const row = { objection: f.objection.trim(), response: f.response.trim(), explanation: f.explanation.trim() || null, category: f.category.trim() || null, product_id: f.product_id || null, set_id: f.set_id || null, status: f.status };
      if (initial.id) await unwrap(supabase.from('objections').update(row).eq('id', initial.id).select());
      else await unwrap(supabase.from('objections').insert(row).select());
      onSaved(); toast('success', 'Saqlandi.'); onClose();
    } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={initial.id ? 'E’tirozni tahrirlash' : 'Yangi e’tiroz'}>
      <form onSubmit={submit} noValidate className="space-y-3">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <Field label="Mijoz e’tirozi" error={err.objection}><Input value={f.objection} onChange={(e) => setF({ ...f, objection: e.target.value })} placeholder="Masalan: Qimmat ekan" /></Field>
        <Field label="Tavsiya etilgan javob" error={err.response}><Textarea rows={4} value={f.response} onChange={(e) => setF({ ...f, response: e.target.value })} /></Field>
        <Field label="Operator uchun izoh"><Textarea rows={2} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></Field>
        <Field label="Kategoriya"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Narx, ishonch, ehtiyoj…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mahsulot"><Select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}><option value="">—</option>{(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Nabor"><Select value={f.set_id} onChange={(e) => setF({ ...f, set_id: e.target.value })}><option value="">—</option>{(sets.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</Select></Field>
        </div>
        <Field label="Holati"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}><option value="published">Nashr etilgan</option><option value="draft">Qoralama</option><option value="archived">Arxivlangan</option></Select></Field>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
      </form>
    </Modal>
  );
}
