import { useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Star, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { publicUrl, removeFiles, uploadImage } from '@/lib/storage';
import { Badge, Button, Field, Input, Textarea, useToast } from '@/components/ui';
import { humanError, PUBLISH_UZ } from '@/lib/uz';
import type { Tone } from '@/components/ui';

export const publishTone = (s: string): Tone => (s === 'published' ? 'green' : s === 'archived' ? 'neutral' : 'yellow');
export const PublishBadge = ({ status }: { status: keyof typeof PUBLISH_UZ }) => <Badge tone={publishTone(status)}>{PUBLISH_UZ[status]}</Badge>;

export const linesToArray = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
export const arrayToLines = (a: string[] | null | undefined) => (a ?? []).join('\n');
export const intOrNull = (v: string) => {
  const t = v.replace(/\s/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

/** Har bir qator — alohida band. Administrator JSON bilan ishlamaydi. */
export function LinesField({ label, hint, value, onChange, rows = 4 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={label} hint={hint ?? 'Har bir bandni yangi qatordan yozing.'}>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function FaqEditor({ label = 'Ko‘p beriladigan savollar', value, onChange }: { label?: string; value: { q: string; a: string }[]; onChange: (v: { q: string; a: string }[]) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {value.map((f, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-neutral-200 p-3">
          <Input placeholder="Savol" value={f.q} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
          <Textarea rows={2} placeholder="Javob" value={f.a} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /> O‘chirish</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { q: '', a: '' }])}><Plus className="h-4 w-4" /> Savol qo‘shish</Button>
    </div>
  );
}

export const cleanFaqs = (f: { q: string; a: string }[]) => f.map((x) => ({ q: x.q.trim(), a: x.a.trim() })).filter((x) => x.q && x.a);

/** Rasmlarni yuklash, tartiblash (birinchisi — asosiy) va o‘chirish. Rasm ma’lumotlar bazasiga darhol yoziladi. */
export function ImageManager({ table, parentColumn, parentId }: { table: 'product_images' | 'set_images'; parentColumn: 'product_id' | 'set_id'; parentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = ['admin-images', table, parentId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await unwrap(supabase.from(table).select('id,path,position').eq(parentColumn, parentId).order('position'))) as { id: string; path: string; position: number }[],
  });
  const imgs = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      let pos = imgs.length ? Math.max(...imgs.map((i) => i.position)) + 1 : 0;
      for (const f of Array.from(files)) {
        const path = await uploadImage('content', table === 'product_images' ? 'products' : 'sets', f);
        const { error } = await supabase.from(table).insert({ [parentColumn]: parentId, path, position: pos++ });
        if (error) { await removeFiles('content', [path]); throw error; }
      }
      await refresh();
      toast('success', 'Rasm yuklandi.');
    } catch (e) { toast('error', humanError(e)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function reorder(i: number, d: -1 | 1) {
    const a = imgs[i], b = imgs[i + d];
    if (!a || !b) return;
    try {
      await unwrap(supabase.from(table).update({ position: b.position }).eq('id', a.id).select());
      await unwrap(supabase.from(table).update({ position: a.position }).eq('id', b.id).select());
      await refresh();
    } catch (e) { toast('error', humanError(e)); }
  }
  async function remove(img: { id: string; path: string }) {
    try {
      await unwrap(supabase.from(table).delete().eq('id', img.id).select());
      await removeFiles('content', [img.path]);
      await refresh();
    } catch (e) { toast('error', humanError(e)); }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Rasmlar</span>
      <div className="grid grid-cols-3 gap-2">
        {imgs.map((img, i) => (
          <div key={img.id} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              <img src={publicUrl('content', img.path) ?? ''} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold"><Star className="h-3 w-3" /> Asosiy</span>}
            </div>
            <div className="flex justify-between">
              <button type="button" aria-label="Oldinga" disabled={i === 0} onClick={() => void reorder(i, -1)} className="p-1 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Rasmni o‘chirish" onClick={() => void remove(img)} className="p-1 text-red-600"><Trash2 className="h-4 w-4" /></button>
              <button type="button" aria-label="Orqaga" disabled={i === imgs.length - 1} onClick={() => void reorder(i, 1)} className="p-1 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
      <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> Rasm qo‘shish</Button>
      <p className="text-xs text-neutral-500">Rasmlar avtomatik siqiladi. Birinchi rasm asosiy hisoblanadi.</p>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-base font-bold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}
