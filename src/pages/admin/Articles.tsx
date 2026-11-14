import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, Eye, EyeOff, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Pencil, Pin, PinOff, Plus, Quote, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Segmented, Select, Textarea, useToast } from '@/components/ui';
import { PublishBadge } from '@/components/admin';
import { CoverImage } from '@/components/Media';
import { readMinutes, sanitizeHtml, stripHtml } from '@/lib/sanitize';
import { publicUrl, removeFiles, uploadImage } from '@/lib/storage';
import { formatDateUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

type Status = 'draft' | 'published' | 'archived';
interface Article {
  id: string; title: string; excerpt: string | null; content: string; cover_path: string | null; category_id: string | null; status: Status; pinned: boolean;
  sort_order: number; read_minutes: number | null; published_at: string | null; is_demo: boolean; updated_at: string;
}

export default function Articles() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [edit, setEdit] = useState<Article | 'new' | null>(null);
  const [del, setDel] = useState<Article | null>(null);

  const list = useQuery({ queryKey: ['admin-articles'], queryFn: async () => (await unwrap(supabase.from('articles').select('*').order('pinned', { ascending: false }).order('sort_order', { ascending: false }).order('published_at', { ascending: false, nullsFirst: true }))) as Article[] });
  const cats = useQuery({ queryKey: ['article-categories'], queryFn: async () => (await unwrap(supabase.from('article_categories').select('*').order('position').order('name'))) as { id: string; name: string }[] });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin-articles'] }); void qc.invalidateQueries({ queryKey: ['articles'] }); };

  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string } & Record<string, unknown>) => { await unwrap(supabase.from('articles').update(p).eq('id', id).select()); },
    onSuccess: () => { refresh(); toast('success', 'Yangilandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });
  const publish = (a: Article, publishNow: boolean) => patch.mutate({ id: a.id, status: publishNow ? 'published' : 'draft', ...(publishNow && !a.published_at ? { published_at: new Date().toISOString() } : {}) });

  const rows = (list.data ?? []).filter((a) => filter === 'all' || a.status === filter);
  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-4">
      <PageHeader title="Maqolalar" subtitle="Nashr etilgan maqolalar operatorlarning bosh sahifasida darhol paydo bo‘ladi."
        action={<Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Yangi maqola</Button>} />
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Hammasi' }, { value: 'published', label: 'Nashr' }, { value: 'draft', label: 'Qoralama' }, { value: 'archived', label: 'Arxiv' }]} />
      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState title="Maqolalar topilmadi." />}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((a) => (
          <Card key={a.id} className="flex gap-3 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl"><CoverImage path={a.cover_path} alt="" /></div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap gap-1"><PublishBadge status={a.status} />{a.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold"><Pin className="h-3 w-3" /> Qadalgan</span>}{a.is_demo && <DemoBadge />}</div>
              <div className="line-clamp-2 font-semibold leading-snug">{a.title}</div>
              <div className="text-xs text-neutral-500">{catName(a.category_id) ?? 'Kategoriyasiz'}{a.published_at ? ` · ${formatDateUz(a.published_at.slice(0, 10))}` : ''}</div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                {a.status !== 'published' ? <Button size="sm" variant="outline" onClick={() => publish(a, true)}><Eye className="h-4 w-4" /> Nashr</Button> : <Button size="sm" variant="outline" onClick={() => publish(a, false)}><EyeOff className="h-4 w-4" /> Yashirish</Button>}
                <Button size="sm" variant="ghost" aria-label={a.pinned ? 'Qadashni bekor qilish' : 'Qadash'} onClick={() => patch.mutate({ id: a.id, pinned: !a.pinned })}>{a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button>
                <Button size="sm" variant="ghost" aria-label="O‘chirish" onClick={() => setDel(a)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {edit && <ArticleEditor key={edit === 'new' ? 'new' : edit.id} article={edit === 'new' ? null : edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={refresh} />}
      <ConfirmDialog open={!!del} danger title="Maqolani o‘chirish" confirmLabel="O‘chirish" message={`“${del?.title}” butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await unwrap(supabase.from('articles').delete().eq('id', del!.id).select());
            if (del!.cover_path) await removeFiles('content', [del!.cover_path]);
            refresh(); toast('success', 'Maqola o‘chirildi.');
          } catch (e) { toast('error', humanError(e)); }
          setDel(null);
        }} />
    </div>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100">{children}</button>;
}

function ArticleEditor({ article, cats, onClose, onSaved }: { article: Article | null; cats: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(article?.title ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [categoryId, setCategoryId] = useState(article?.category_id ?? '');
  const [status, setStatus] = useState<Status>(article?.status ?? 'draft');
  const [pinned, setPinned] = useState(article?.pinned ?? false);
  const [sortOrder, setSortOrder] = useState(String(article?.sort_order ?? 0));
  const [cover, setCover] = useState<string | null>(article?.cover_path ?? null);
  const [oldCover] = useState<string | null>(article?.cover_path ?? null);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [err, setErr] = useState<{ title?: string; content?: string; sort?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const exec = (cmd: string, val?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, val); };
  const addLink = () => {
    const url = window.prompt('Havola manzili (https://…)');
    if (url && /^https?:\/\//i.test(url.trim())) exec('createLink', url.trim());
    else if (url) toast('error', 'Havola http:// yoki https:// bilan boshlanishi kerak.');
  };
  async function uploadCover(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try { setCover(await uploadImage('content', 'articles', f)); } catch (e) { toast('error', humanError(e)); } finally { setUploading(false); if (coverRef.current) coverRef.current.value = ''; }
  }
  async function insertImage(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      const path = await uploadImage('content', 'articles', f);
      const url = publicUrl('content', path);
      if (url) exec('insertImage', url);
    } catch (e) { toast('error', humanError(e)); } finally { setUploading(false); if (imgRef.current) imgRef.current.value = ''; }
  }
  const currentHtml = () => sanitizeHtml(editorRef.current?.innerHTML ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const html = currentHtml();
    const next: typeof err = {};
    if (!title.trim()) next.title = 'Maqola sarlavhasini kiriting.';
    if (status === 'published' && !stripHtml(html)) next.content = 'Nashr etish uchun maqola matnini yozing.';
    const so = Number(sortOrder);
    if (!Number.isInteger(so)) next.sort = 'Butun son kiriting.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const row = {
        title: title.trim(), excerpt: excerpt.trim() || stripHtml(html).slice(0, 160) || null, content: html, cover_path: cover, category_id: categoryId || null,
        status, pinned, sort_order: so, read_minutes: stripHtml(html) ? readMinutes(html) : null,
        published_at: status === 'published' ? (article?.published_at ?? new Date().toISOString()) : (article?.published_at ?? null),
      };
      if (article) await unwrap(supabase.from('articles').update(row).eq('id', article.id).select());
      else await unwrap(supabase.from('articles').insert(row).select());
      if (oldCover && oldCover !== cover) await removeFiles('content', [oldCover]).catch(() => {});
      onSaved(); toast('success', 'Maqola saqlandi.'); onClose();
    } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={article ? 'Maqolani tahrirlash' : 'Yangi maqola'} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <Field label="Sarlavha" error={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Kategoriya"><Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Tanlanmagan</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Holati"><Select value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="draft">Qoralama</option><option value="published">Nashr etilgan</option><option value="archived">Arxivlangan</option></Select></Field>
          <Field label="Tartib raqami" error={err.sort} hint="Kattasi yuqorida chiqadi."><Input inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-yellow-400" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Muhim maqola sifatida qadash (ro‘yxat tepasida turadi)</label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Muqova rasmi</span>
          <div className="flex items-center gap-3">
            <div className="h-20 w-32 overflow-hidden rounded-xl border border-neutral-200"><CoverImage path={cover} alt="" /></div>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadCover(e.target.files?.[0])} />
            <Button type="button" size="sm" variant="outline" loading={uploading} onClick={() => coverRef.current?.click()}><ImagePlus className="h-4 w-4" /> Yuklash</Button>
            {cover && <Button type="button" size="sm" variant="ghost" onClick={() => setCover(null)}>Olib tashlash</Button>}
          </div>
        </div>

        <Field label="Qisqa tavsif" hint="Bo‘sh qoldirilsa, matnning boshidan olinadi."><Textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></Field>

        <div className="space-y-1">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">Maqola matni</span>
            <Button type="button" size="sm" variant="outline" onClick={() => { if (!preview) setPreviewHtml(currentHtml()); setPreview((p) => !p); }}>{preview ? 'Tahrirlash' : 'Ko‘rib chiqish'}</Button></div>
          <div className={preview ? 'hidden' : ''}>
            <div className="flex flex-wrap gap-0.5 rounded-t-xl border border-b-0 border-neutral-300 bg-neutral-50 p-1">
              <ToolBtn label="Katta sarlavha" onClick={() => exec('formatBlock', 'h2')}><Heading2 className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Kichik sarlavha" onClick={() => exec('formatBlock', 'h3')}><Heading3 className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Qalin" onClick={() => exec('bold')}><Bold className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Qiya" onClick={() => exec('italic')}><Italic className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Markerli ro‘yxat" onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Raqamli ro‘yxat" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Iqtibos / misol" onClick={() => exec('formatBlock', 'blockquote')}><Quote className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Havola" onClick={addLink}><Link2 className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Matn ichiga rasm" onClick={() => imgRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolBtn>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => void insertImage(e.target.files?.[0])} />
            </div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Maqola matni"
              className="prose-uz min-h-[260px] rounded-b-xl border border-neutral-300 bg-white p-3 outline-none focus:border-ink"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article?.content ?? '') }} />
          </div>
          {preview && <div className="prose-uz min-h-[260px] rounded-xl border border-neutral-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
          {err.content && <p role="alert" className="text-sm text-red-600">{err.content}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button type="submit" loading={busy}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  );
}
