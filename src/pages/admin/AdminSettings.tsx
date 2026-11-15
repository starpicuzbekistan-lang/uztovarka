import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Card, ConfirmDialog, DemoBadge, ErrorState, Input, LoadingBlock, Notice, PageHeader, Select, useToast } from '@/components/ui';
import { humanError } from '@/lib/uz';
import BundleSettingsCard from './BundleSettings';
import OperatorRewardsSales from './OperatorRewardsSales';

type Table = 'product_categories' | 'article_categories';

export default function AdminSettings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sozlamalar" subtitle="Kategoriyalar va demo ma’lumotlarni boshqarish." />
      <BundleSettingsCard />
      <OperatorRewardsSales />
      <CategoryCard title="Mahsulot kategoriyalari" table="product_categories" />
      <CategoryCard title="Maqola kategoriyalari" table="article_categories" />
      <DemoCard />
      <Card className="p-4 text-sm text-neutral-600">
        <h2 className="mb-1 font-bold text-ink">KPI va maosh sozlamalari</h2>
        Maosh koeffitsiyentlari, ish kunlari va kelmagan kunlar qoidasi “KPI va oyliklar” bo‘limidagi “KPI sozlamalari” orqali, amal qilish sanasi bilan versiyalanadi.
      </Card>
    </div>
  );
}

function CategoryCard({ title, table }: { title: string; table: Table }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['categories-admin', table];
  const q = useQuery({ queryKey: key, queryFn: async () => (await unwrap(supabase.from(table).select('id,name,position').order('position').order('name'))) as { id: string; name: string; position: number }[] });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: [table === 'product_categories' ? 'product-categories' : 'article-categories'] }); };

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast('error', 'Kategoriya nomini kiriting.');
    setBusy(true);
    try { await unwrap(supabase.from(table).insert({ name: n, position: (q.data?.length ?? 0) + 1 }).select()); setName(''); refresh(); toast('success', 'Kategoriya qo‘shildi.'); }
    catch (er) { toast('error', (er as { code?: string })?.code === '23505' ? 'Bunday kategoriya allaqachon bor.' : humanError(er)); } finally { setBusy(false); }
  }
  async function rename() {
    const n = editing?.name.trim();
    if (!editing || !n) return toast('error', 'Nomini kiriting.');
    try { await unwrap(supabase.from(table).update({ name: n }).eq('id', editing.id).select()); setEditing(null); refresh(); toast('success', 'Saqlandi.'); }
    catch (er) { toast('error', (er as { code?: string })?.code === '23505' ? 'Bunday kategoriya allaqachon bor.' : humanError(er)); }
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-bold">{title}</h2>
      {q.isLoading && <LoadingBlock rows={2} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      <ul className="divide-y divide-neutral-100">
        {(q.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
            {editing?.id === c.id ? (
              <><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Kategoriya nomi" /><Button size="sm" onClick={() => void rename()}>Saqlash</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Bekor</Button></>
            ) : (
              <><span>{c.name}</span><span className="flex"><Button size="sm" variant="ghost" aria-label="Nomini o‘zgartirish" onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" aria-label="O‘chirish" onClick={() => setDel(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button></span></>
            )}
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-2 text-sm text-neutral-500">Kategoriyalar yo‘q.</li>}
      </ul>
      <form onSubmit={add} className="flex gap-2"><Input placeholder="Yangi kategoriya" value={name} onChange={(e) => setName(e.target.value)} /><Button type="submit" loading={busy}><Plus className="h-4 w-4" /> Qo‘shish</Button></form>
      <ConfirmDialog open={!!del} danger title="Kategoriyani o‘chirish" confirmLabel="O‘chirish" message={`“${del?.name}” o‘chiriladi. Unga tegishli yozuvlar kategoriyasiz qoladi.`} onClose={() => setDel(null)}
        onConfirm={async () => { try { await unwrap(supabase.from(table).delete().eq('id', del!.id).select()); refresh(); toast('success', 'O‘chirildi.'); } catch (e) { toast('error', humanError(e)); } setDel(null); }} />
    </Card>
  );
}

function DemoCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const [op, setOp] = useState('');
  const [busy, setBusy] = useState(false);
  const [purge, setPurge] = useState(false);
  const ops = useQuery({ queryKey: ['admin-op-options'], queryFn: async () => (await unwrap(supabase.from('profiles').select('id,full_name').eq('role', 'operator').eq('is_active', true).order('full_name'))) as { id: string; full_name: string }[] });
  const refreshAll = () => void qc.invalidateQueries();

  async function seed() {
    if (!op) return toast('error', 'Operatorni tanlang.');
    setBusy(true);
    try { const n = await unwrap(supabase.rpc('seed_demo_reports', { p_operator: op, p_days: 20 })); refreshAll(); toast('success', `${n} ta demo hisobot qo‘shildi.`); }
    catch (e) { toast('error', humanError(e)); } finally { setBusy(false); }
  }
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2"><h2 className="font-bold">Demo ma’lumotlar</h2><DemoBadge /></div>
      <Notice tone="warn">Demo yozuvlar “DEMO” belgisi bilan ko‘rinadi. Ishga tushirishdan oldin ularni o‘chiring — haqiqiy ma’lumotlarga tegilmaydi.</Notice>
      <div className="flex flex-wrap gap-2">
        <Select className="min-w-[200px] flex-1" value={op} onChange={(e) => setOp(e.target.value)} aria-label="Operator"><option value="">Operatorni tanlang</option>{(ops.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</Select>
        <Button variant="outline" loading={busy} onClick={() => void seed()}>Namunaviy hisobotlar qo‘shish</Button>
      </div>
      <Button variant="danger" onClick={() => setPurge(true)}><Trash2 className="h-4 w-4" /> Barcha demo ma’lumotlarni o‘chirish</Button>
      <ConfirmDialog open={purge} danger title="Demo ma’lumotlarni o‘chirish" confirmLabel="O‘chirish" message="Demo deb belgilangan hisobotlar, maqolalar, skriptlar, e’tirozlar, naborlar va mahsulotlar butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi."
        onClose={() => setPurge(false)} onConfirm={async () => { try { await unwrap(supabase.rpc('purge_demo_data')); refreshAll(); toast('success', 'Demo ma’lumotlar o‘chirildi.'); } catch (e) { toast('error', humanError(e)); } setPurge(false); }} />
    </Card>
  );
}
