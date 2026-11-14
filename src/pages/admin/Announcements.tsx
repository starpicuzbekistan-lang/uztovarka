import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Textarea, useToast } from '@/components/ui';
import { PublishBadge } from '@/components/admin';
import { formatDateTimeUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

interface Ann { id: string; title: string; message: string; status: 'draft' | 'published' | 'archived'; published_at: string | null; created_at: string }

export default function Announcements() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Ann> | null>(null);
  const [del, setDel] = useState<Ann | null>(null);
  const [pub, setPub] = useState<Ann | null>(null);
  const list = useQuery({ queryKey: ['admin-announcements'], queryFn: async () => (await unwrap(supabase.from('announcements').select('*').order('created_at', { ascending: false }))) as Ann[] });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin-announcements'] }); void qc.invalidateQueries({ queryKey: ['admin-overview'] }); };

  return (
    <div className="space-y-4">
      <PageHeader title="E’lonlar" subtitle="Nashr etilgan e’lon barcha faol operatorlarga bildirishnoma sifatida yuboriladi."
        action={<Button onClick={() => setEdit({ title: '', message: '' })}><Plus className="h-4 w-4" /> Yangi e’lon</Button>} />
      {list.isLoading && <LoadingBlock rows={3} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data?.length === 0 && <EmptyState icon={<Megaphone className="h-6 w-6" />} title="E’lonlar hali yo‘q." />}
      <div className="space-y-3">
        {(list.data ?? []).map((a) => (
          <Card key={a.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{a.title}</div><PublishBadge status={a.status} /></div>
            <p className="line-clamp-3 whitespace-pre-line text-sm text-neutral-600">{a.message}</p>
            <div className="text-xs text-neutral-400">{a.published_at ? `Nashr etilgan: ${formatDateTimeUz(a.published_at)}` : `Yaratilgan: ${formatDateTimeUz(a.created_at)}`}</div>
            <div className="flex flex-wrap gap-2">
              {a.status !== 'published' && <Button size="sm" onClick={() => setPub(a)}><Send className="h-4 w-4" /> Nashr etish</Button>}
              {a.status !== 'published' && <Button size="sm" variant="outline" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /> Tahrirlash</Button>}
              <Button size="sm" variant="ghost" onClick={() => setDel(a)}><Trash2 className="h-4 w-4 text-red-600" /> O‘chirish</Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && <Editor initial={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
      <ConfirmDialog open={!!pub} title="E’lonni nashr etish" confirmLabel="Nashr etish" message="E’lon barcha faol operatorlarga bildirishnoma sifatida yuboriladi. Nashr etilgandan keyin tahrirlab bo‘lmaydi."
        onClose={() => setPub(null)}
        onConfirm={async () => { try { await unwrap(supabase.rpc('publish_announcement', { p_id: pub!.id })); refresh(); toast('success', 'E’lon nashr etildi.'); } catch (e) { toast('error', humanError(e)); } setPub(null); }} />
      <ConfirmDialog open={!!del} danger title="E’lonni o‘chirish" confirmLabel="O‘chirish" message="E’lon o‘chiriladi. Operatorlarga yuborilgan bildirishnomalar saqlanib qoladi." onClose={() => setDel(null)}
        onConfirm={async () => { try { await unwrap(supabase.from('announcements').delete().eq('id', del!.id).select()); refresh(); toast('success', 'O‘chirildi.'); } catch (e) { toast('error', humanError(e)); } setDel(null); }} />
    </div>
  );
}

function Editor({ initial, onClose, onSaved }: { initial: Partial<Ann>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial.title ?? '');
  const [message, setMessage] = useState(initial.message ?? '');
  const [err, setErr] = useState<{ title?: string; message?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!title.trim()) next.title = 'Sarlavhani kiriting.';
    if (!message.trim()) next.message = 'Xabar matnini kiriting.';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const row = { title: title.trim(), message: message.trim() };
      if (initial.id) await unwrap(supabase.from('announcements').update(row).eq('id', initial.id).select());
      else await unwrap(supabase.from('announcements').insert(row).select());
      onSaved(); toast('success', 'Qoralama saqlandi. Operatorlarga yuborish uchun “Nashr etish” ni bosing.'); onClose();
    } catch (er) { setErr({ form: humanError(er) }); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={initial.id ? 'E’lonni tahrirlash' : 'Yangi e’lon'}>
      <form onSubmit={submit} noValidate className="space-y-3">
        {err.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err.form}</p>}
        <Field label="Sarlavha" error={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Xabar" error={err.message}><Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <p className="text-xs text-neutral-500">E’longa maosh yoki shaxsiy ma’lumot yozmang — u barcha operatorlarga ko‘rinadi.</p>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Qoralama sifatida saqlash</Button></div>
      </form>
    </Modal>
  );
}
