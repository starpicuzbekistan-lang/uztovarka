import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MailPlus, Power, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select, useToast } from '@/components/ui';
import { humanError, ROLE_UZ, validateEmail } from '@/lib/uz';
import { formatDateUz, formatDateTimeUz } from '@/lib/dates';
import type { Profile } from '@/lib/types';

type PresenceRecord = { user_id: string; last_login_at: string | null; last_seen_at: string | null; online: boolean };

const isOnline = (p: PresenceRecord | undefined, now: number) => !!p && p.online && !!p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 90_000;

type AdminAction =
  | { action: 'invite'; email: string; full_name: string; role: 'admin' | 'manager' | 'operator'; position?: string; employee_id?: string }
  | { action: 'set_active'; user_id: string; active: boolean }
  | { action: 'confirm_signup_email'; user_id: string }
  | { action: 'set_role'; user_id: string; role: 'admin' | 'manager' | 'operator' }
  | { action: 'send_reset'; email: string }
  | { action: 'resend_invite'; email: string };

/** Barcha imtiyozli amallar serverdagi Edge Function orqali bajariladi (service-role kaliti brauzerda yo‘q). */
async function callAdmin(body: AdminAction) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    // Edge Function o‘zbekcha xabar qaytaradi: { error: '...' }
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) throw new Error(j.error);
    } catch (e) {
      if (e instanceof Error && e.message && !/Unexpected|JSON/i.test(e.message)) throw e;
    }
    throw error;
  }
  return data;
}

const errText = (e: unknown) => (e instanceof Error && /[ʻ‘’]|ruxsat|mavjud|kiriting|noto/i.test(e.message) ? e.message : humanError(e));

export default function Operators() {
  const { profile: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toggle, setToggle] = useState<Profile | null>(null);
  const [roleTarget, setRoleTarget] = useState<Profile | null>(null);
  const [targetRole, setTargetRole] = useState<'admin'|'manager'|'operator'>('operator');
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => (await unwrap(supabase.from('profiles').select('*').order('created_at', { ascending: false }))) as Profile[],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-profiles'] });
  const presence = useQuery({
    queryKey: ['admin-operator-presence'],
    queryFn: async () => (await unwrap(supabase.from('operator_presence')
      .select('user_id,last_login_at,last_seen_at,online'))) as PresenceRecord[],
    refetchInterval: 30_000,
  });
  const [clock, setClock] = useState(Date.now());
  // Online chirog'i 90 soniya signal bo'lmasa avtomatik o'chadi.
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const run = useMutation({
    mutationFn: callAdmin,
    onSuccess: () => { void refresh(); },
    onError: (e) => toast('error', errText(e)),
  });

  const rows = (list.data ?? []).filter((p) => `${p.full_name} ${p.email ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const onlineCount = (presence.data ?? []).filter(p => isOnline(p, clock)).length;
  const pendingRegistrations=(list.data??[]).filter(p=>p.role==='operator'&&!p.is_active&&p.signup_requested_at&&!p.signup_reviewed_at);

  return (
    <div className="space-y-4">
      <PageHeader title="Xodimlar" subtitle="Operatorlar o‘zlari ro‘yxatdan o‘tishlari mumkin. Admin tasdiqlamaguncha tizimga kira olishmaydi."
        action={<Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Yangi operator</Button>} />
      <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-bold text-amber-950">Tasdiqlashni kutayotgan arizalar · {pendingRegistrations.length}</h2>
        <p className="text-xs text-amber-900/80">Operator o‘zi email va parol tanlaydi. Sen tasdiqlaganingda uning email holati ham avtomatik tasdiqlanadi (yangilangan admin-users funksiyasi o‘rnatilgach). Ilgari tasdiqlanganlar uchun pastda «Kirishdagi email xatosini tuzatish» tugmasi mavjud.</p>
        {pendingRegistrations.length===0&&<p className="text-sm text-neutral-600">Hozircha yangi ariza yo‘q.</p>}
        {pendingRegistrations.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
          <div className="min-w-0"><p className="truncate font-semibold">{p.full_name}</p><p className="truncate text-xs text-neutral-500">{p.email}</p></div>
          <Button size="sm" disabled={run.isPending} loading={run.isPending&&run.variables?.action==='set_active'}
            onClick={()=>run.mutate({action:'set_active',user_id:p.id,active:true},{
              onSuccess:()=>toast('success','Operator tasdiqlandi. Endi o‘z paroli bilan kirishi mumkin.')
            })}>
            <ShieldCheck className="h-4 w-4"/> Tasdiqlash
          </Button>
        </div>)}
      </section>
      <Input placeholder="Ism yoki email bo‘yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Online: {presence.isError ? '—' : onlineCount}
        </span>
        <span>Online — ilova ko‘rinib turgan va oxirgi 90 soniyada signal bergan operator.</span>
      </div>
      {presence.isError && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
        Online ma’lumotlarini yuklab bo‘lmadi. Supabase SQL Editor’da 010_operator_presence.sql migratsiyasini tekshiring.
      </p>}

      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorState message={humanError(list.error)} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState title="Operatorlar topilmadi" hint="Yangi operatorni taklif qiling." />}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => {
          const self = p.id === me?.id;
          const last = presence.data?.find(v => v.user_id === p.id);
          const connected = isOnline(last, clock);
          return (
            <Card key={p.id} className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={p.full_name} path={p.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.full_name}{self && ' (siz)'}</div>
                  <div className="truncate text-sm text-neutral-500">{p.email}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={p.is_active ? 'green' : p.signup_requested_at && !p.signup_reviewed_at ? 'yellow' : 'red'}>
                    {p.is_active?'Hisob faol':p.signup_requested_at&&!p.signup_reviewed_at?'Admin tasdig‘ini kutmoqda':'Hisob nofaol'}
                  </Badge>
                  {p.role === 'operator' && <span className="flex items-center gap-1 text-xs font-medium text-neutral-600" title="Online holati: 90 soniyalik faoliyat oynasi">
                    <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-neutral-300'}`} />
                    {connected ? 'Online' : 'Offline'}
                  </span>}
                  <Badge tone={p.role === 'admin' ? 'yellow' : 'neutral'}>{ROLE_UZ[p.role]}</Badge>
                </div>
              </div>
              <div className="space-y-1 text-xs text-neutral-500">
                <p>{p.position}{p.employee_id ? ` · ID: ${p.employee_id}` : ''} · Qo‘shilgan: {formatDateUz(p.created_at.slice(0, 10))}</p>
                {p.role === 'operator' && <>
                  <p>Oxirgi kirish: {last?.last_login_at ? formatDateTimeUz(last.last_login_at) : 'Hali qayd etilmagan'}</p>
                  <p>Oxirgi faollik: {last?.last_seen_at ? formatDateTimeUz(last.last_seen_at) : 'Hali qayd etilmagan'}</p>
                </>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={self && p.is_active} onClick={() => setToggle(p)}>
                  <Power className="h-4 w-4" /> {p.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
                </Button>
                {p.role==='operator' && p.is_active && p.signup_requested_at && (
                  <Button size="sm" variant="outline"
                    disabled={run.isPending}
                    loading={run.isPending && run.variables?.action==='confirm_signup_email'}
                    onClick={()=>run.mutate({ action:'confirm_signup_email', user_id:p.id },{
                      onSuccess:()=>toast('success','Operator emaili admin tomonidan tasdiqlandi. Endi o‘z paroli bilan kira oladi.')
                    })}>
                    <ShieldCheck className="h-4 w-4"/> Kirishdagi email xatosini tuzatish
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={self} onClick={() => { setRoleTarget(p); setTargetRole(p.role); }}>
                  <ShieldCheck className="h-4 w-4" /> Rolni o‘zgartirish
                </Button>
                <Button size="sm" variant="outline" loading={run.isPending && run.variables?.action === 'send_reset' && (run.variables as any).email === p.email}
                  onClick={() => p.email && run.mutate({ action: 'send_reset', email: p.email }, { onSuccess: () => toast('success', 'Parolni tiklash havolasi yuborildi.') })}>
                  <KeyRound className="h-4 w-4" /> Parolni tiklash
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => p.email && run.mutate({ action: 'resend_invite', email: p.email }, { onSuccess: () => toast('success', 'Taklif qayta yuborildi.') })}>
                  <MailPlus className="h-4 w-4" /> Taklifni qayta yuborish
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={() => { setInviteOpen(false); void refresh(); toast('success', 'Taklif yuborildi. Operator emaildagi havola orqali parol o‘rnatadi.'); }} />

      <ConfirmDialog open={!!toggle} danger={!!toggle?.is_active}
        title={toggle?.is_active ? 'Hisobni nofaol qilish' : 'Hisobni faollashtirish'}
        message={toggle?.is_active
          ? `${toggle?.full_name} tizimga kira olmaydi va barcha seanslari tugatiladi. Hisobotlari saqlanib qoladi.`
          : `${toggle?.full_name} qayta tizimga kira oladi.`}
        confirmLabel={toggle?.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
        onClose={() => setToggle(null)}
        onConfirm={() => { if (toggle) run.mutate({ action: 'set_active', user_id: toggle.id, active: !toggle.is_active }, { onSuccess: () => toast('success', 'Holat yangilandi.') }); setToggle(null); }} />

      <Modal open={!!roleTarget} onClose={() => setRoleTarget(null)} title="Xodim rolini o‘zgartirish">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">{roleTarget?.full_name} uchun yangi rolni tanlang. Administrator barcha moliya va boshqaruv funksiyalariga kira oladi, menejer esa faqat o‘z jamoasini boshqaradi.</p>
          <Field label="Yangi rol">
            <Select value={targetRole} onChange={e=>setTargetRole(e.target.value as 'admin'|'manager'|'operator')}>
              <option value="operator">Operator</option>
              <option value="manager">Menejer</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRoleTarget(null)}>Bekor qilish</Button>
            <Button disabled={!roleTarget||roleTarget.role===targetRole||run.isPending} loading={run.isPending} onClick={()=>{
              if(!roleTarget)return;
              run.mutate({action:'set_role',user_id:roleTarget.id,role:targetRole},{onSuccess:()=>toast('success','Rol yangilandi.')});
              setRoleTarget(null);
            }}>Saqlash</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ full_name: '', email: '', position: 'Operator', employee_id: '', role: 'operator' as 'admin' | 'manager' | 'operator' });
  const [errs, setErrs] = useState<{ full_name?: string; email?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (!f.full_name.trim()) next.full_name = 'Ism-familiyani kiriting.';
    const ev = validateEmail(f.email);
    if (ev) next.email = ev;
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await callAdmin({ action: 'invite', email: f.email, full_name: f.full_name.trim(), role: f.role, position: f.position.trim() || undefined, employee_id: f.employee_id.trim() || undefined });
      setF({ full_name: '', email: '', position: 'Operator', employee_id: '', role: 'operator' });
      onDone();
    } catch (err) {
      setErrs({ form: errText(err) });
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yangi xodimni taklif qilish">
      <form onSubmit={submit} noValidate className="space-y-3">
        {errs.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errs.form}</p>}
        <Field label="Ism-familiya" error={errs.full_name}><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Email manzil" error={errs.email} hint="Taklif havolasi shu manzilga yuboriladi."><Input type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lavozim"><Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} /></Field>
          <Field label="Xodim ID (ixtiyoriy)"><Input value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} /></Field>
        </div>
        <Field label="Rol">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'admin' | 'manager' | 'operator' })}>
            <option value="operator">Operator</option>
            <option value="manager">Menejer</option>
            <option value="admin">Administrator</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button type="submit" loading={busy}>Taklif yuborish</Button>
        </div>
      </form>
    </Modal>
  );
}
