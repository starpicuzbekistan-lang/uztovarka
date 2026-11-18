import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, LogOut } from 'lucide-react';
import OperatorMotivation from '@/components/OperatorMotivation';
import TeamsSection from '@/components/TeamsSection';
import SalesPerformance from '@/components/SalesPerformance';
import { useWallet, useMissingDays } from '@/lib/wallet';
import { useAuth } from '@/auth/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { useOperatorMonth } from '@/lib/useMonthData';
import { rankOperators, type RankMode } from '@/lib/leaderboard';
import { MONTHS_UZ_CAP, tashkentToday, parseIso } from '@/lib/dates';
import { formatAvg, formatNumber } from '@/lib/format';
import { humanError, ROLE_UZ, validatePassword } from '@/lib/uz';
import { Avatar, Badge, Button, Card, ErrorState, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, StatCard, useToast } from '@/components/ui';
import { MonthNav } from '@/components/MonthNav';
import { uploadImage } from '@/lib/storage';
import clsx from 'clsx';

type Tab = 'info' | 'perf' | 'rank' | 'teams' | 'settings';

export default function Profile() {
  const [tab, setTab] = useState<Tab>('info');
  return (
    <div className="space-y-4">
      <PageHeader title="Profil" />
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'info', label: 'Umumiy' }, { value: 'perf', label: 'Ko‘rsatkich' },
        { value: 'rank', label: 'Reyting' }, { value: 'teams', label: 'Jamoalar' }, { value: 'settings', label: 'Sozlamalar' },
      ]} />
      {tab === 'info' && <InfoSection />}
      {tab === 'perf' && <PerformanceSection />}
      {tab === 'rank' && <LeaderboardSection />}
      {tab === 'teams' && <TeamsSection />}
      {tab === 'settings' && <SettingsSection />}
    </div>
  );
}

function InfoSection() {
  const { profile } = useAuth();
  if (!profile) return null;
  const rows: [string, string][] = [
    ['Lavozim', profile.position || '—'], ['Xodim ID', profile.employee_id || '—'],
    ['Email', profile.email || '—'], ['Telefon', profile.phone || '—'], ['Rol', ROLE_UZ[profile.role]],
  ];
  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
      <div className="flex items-center gap-4">
        <Avatar name={profile.full_name} path={profile.avatar_url} size={64} />
        <div>
          <div className="text-lg font-bold">{profile.full_name}</div>
          <Badge tone={profile.is_active ? 'green' : 'red'}>{profile.is_active ? 'Faol' : 'Nofaol'}</Badge>
        </div>
      </div>
      <dl className="divide-y divide-neutral-100 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-neutral-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      </Card>
      <OperatorMotivation operatorId={profile.id} />
      <ProfileAbsenceSummary operatorId={profile.id} />
    </div>
  );
}

function ProfileAbsenceSummary({operatorId}:{operatorId:string}){
 const w=useWallet(operatorId);
 return <Card className="space-y-2 p-4">
  <h3 className="font-bold">Davomat va jarimalar</h3>
  <p className="text-xs text-neutral-500">Hisobot topshirilmagan ish kunlari uchun admin belgilagan jarima.</p>
  {w.isLoading&&<LoadingBlock rows={1}/>}
  {w.isError&&<ErrorState message={humanError(w.error)} onRetry={()=>void w.refetch()}/>}
  {w.data&&<div className="flex justify-between gap-3 text-sm">
    <span>Hisobotsiz kunlar: <b>{w.data.missing_days}</b></span>
    <span className="font-bold text-red-700">−{formatNumber(Number(w.data.penalty_uzs))} so‘m</span>
  </div>}
 </Card>;
}

function useMonthState() {
  const t = parseIso(tashkentToday());
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  return { ym, setYm };
}

function PerformanceSection() {
  const { profile } = useAuth();
  const { ym, setYm } = useMonthState();
  const q = useOperatorMonth(profile?.id, ym.y, ym.m);
  const missed=useMissingDays(profile?.id,`${ym.y}-${String(ym.m).padStart(2,'0')}-01`);
  const r = q.data?.result;
  return (
    <div className="space-y-4">
      <MonthNav y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
      {q.isLoading && <LoadingBlock rows={3} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      {r && (
        <>
          <p className="text-xs text-neutral-500">Faqat administrator tasdiqlagan hisobotlar hisobga olinadi.</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Oylik qabul" value={formatNumber(r.approvedOrders)} />
            <StatCard label="Kunlik o‘rtacha" value={r.workedDays ? formatAvg(r.avgPerWorkedDay) : '—'} />
            <StatCard label="Norma bajarilgan kunlar" value={r.counts.green} />
            <StatCard label="Ishlangan kunlar" value={r.workedDays} />
          </div>
          <h3 className="pt-2 text-sm font-semibold text-neutral-600">KPI natijalari</h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Yashil kunlar" value={r.counts.green} tone="green" />
            <StatCard label="Sariq kunlar" value={r.counts.yellow} tone="yellow" />
            <StatCard label="Qizil kunlar" value={r.counts.red} tone="red" />
          </div>
          <p className="text-xs text-neutral-500">Kelmagan kunlar: {r.counts.absences} · Ta’tillar: {r.counts.leaves}</p>
          {missed.data&&<Card className="space-y-1 p-3 text-sm">
             <div className="flex justify-between gap-2"><span>Hisobot topshirilmagan kunlar</span><b>{missed.data.length} kun</b></div>
             <div className="flex justify-between gap-2"><span>Jarima</span><b className="text-red-700">−{formatNumber(missed.data.reduce((a,m)=>a+Number(m.penalty_uzs),0))} so‘m</b></div>
          </Card>}
          {missed.isError&&<p className="text-xs text-amber-700">Davomat jarimasi ma’lumotlarini yuklab bo‘lmadi.</p>}
          {profile?.id && q.data && <SalesPerformance operatorId={profile.id} y={ym.y} m={ym.m} reports={q.data.reports} workedDays={r.workedDays} />}
        </>
      )}
    </div>
  );
}

function LeaderboardSection() {
  const { profile } = useAuth();
  const { ym, setYm } = useMonthState();
  const [mode, setMode] = useState<RankMode>('total');
  const start = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(ym.y, ym.m, 0)).toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ['leaderboard', start, end],
    queryFn: async () => (await unwrap(supabase.rpc('leaderboard', { p_start: start, p_end: end }))) as
      { operator_id: string; full_name: string; avatar_url: string | null; total_orders: number; worked_days: number; green_days: number }[],
  });
  const prizes = useQuery({
    queryKey: ['monthly-prizes', start],
    queryFn: async () => ((await unwrap(supabase.from('monthly_rank_prizes').select('first_uzs,second_uzs,third_uzs').eq('month_start',start))) as
      {first_uzs:number;second_uzs:number;third_uzs:number}[])[0] ?? null,
  });
  const stats = (q.data ?? []).map((o) => ({ id: o.operator_id, name: o.full_name, totalOrders: Number(o.total_orders), workedDays: Number(o.worked_days), greenDays: Number(o.green_days) }));
  const ranked = rankOperators(stats, mode);
  const avatar = (id: string) => q.data?.find((o) => o.operator_id === id)?.avatar_url ?? null;
  const medal = ['bg-yellow-100 text-yellow-800', 'bg-neutral-200 text-neutral-700', 'bg-orange-100 text-orange-800'];
  const valueLabel = (v: number) => (mode === 'average' ? formatAvg(v) : formatNumber(v));

  return (
    <div className="space-y-4">
      <MonthNav y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
      <Card className="space-y-3 p-4">
        <h2 className="font-bold">🏆 TOP 3 uchun oylik pul mukofotlari</h2>
        {prizes.isError && <ErrorState message={humanError(prizes.error)} onRetry={() => void prizes.refetch()} />}
        <div className="grid grid-cols-3 gap-2">
          {([
            { rank: '🥈', label: '2-o‘rin', amount: prizes.data?.second_uzs },
            { rank: '🥇', label: '1-o‘rin', amount: prizes.data?.first_uzs },
            { rank: '🥉', label: '3-o‘rin', amount: prizes.data?.third_uzs },
          ]).map((item, i) => <div key={item.label} className={clsx('flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center',i === 1 && 'border-amber-400 bg-amber-50')}>
            <span className="text-2xl">{item.rank}</span>
            <span className="text-xs font-semibold">{item.label}</span>
            <span className="text-sm font-bold tabular-nums">{prizes.isLoading ? '…' : item.amount === undefined ? '—' : formatNumber(Number(item.amount))}</span>
            <span className="text-[11px] text-neutral-500">so‘m</span>
          </div>)}
        </div>
        {!prizes.isLoading && !prizes.data && <p className="text-xs text-neutral-500">Bu oy uchun mukofotlar administrator tomonidan hali belgilanmagan.</p>}
        <p className="text-xs text-neutral-500">O‘rinlar jami tasdiqlangan qabul bo‘yicha belgilanadi. Reyting filtrlari pastda.</p>
      </Card>
      <Segmented<RankMode> value={mode} onChange={setMode} options={[
        { value: 'total', label: 'Jami qabul' }, { value: 'average', label: 'Kunlik o‘rtacha' }, { value: 'green', label: 'Yashil kunlar' },
      ]} />
      {q.isLoading && <LoadingBlock rows={5} />}
      {q.isError && <ErrorState message={humanError(q.error)} onRetry={() => void q.refetch()} />}
      {q.data && ranked.length === 0 && <Notice tone="info">Bu oy uchun reyting hali shakllanmagan.</Notice>}
      <div className="space-y-2">
        {ranked.map((o) => (
          <Card key={o.id} className={clsx('flex items-center gap-3 p-3', o.id === profile?.id && 'ring-2 ring-brand')}>
            <span className={clsx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold', medal[o.rank - 1] ?? 'bg-neutral-100 text-neutral-600')}>{o.rank}</span>
            <Avatar name={o.name} path={avatar(o.id)} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{o.name}{o.id === profile?.id && ' (siz)'}</div>
              <div className="text-xs text-neutral-500">Ishlangan: {o.workedDays} kun · Yashil: {o.greenDays}</div>
            </div>
            <div className="text-right">
              <div className="font-bold tabular-nums">{valueLabel(o.value)}</div>
              <div className="text-[11px] text-neutral-400">{mode === 'average' ? 'o‘rtacha' : mode === 'green' ? 'kun' : `${formatNumber(o.totalOrders)} ta`}</div>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-neutral-400">{MONTHS_UZ_CAP[ym.m - 1]} {ym.y}. Faqat tasdiqlangan hisobotlar; oyliklar ko‘rsatilmaydi.</p>
    </div>
  );
}

function PasswordInput({ label, value, onChange, auto, error }: { label: string; value: string; onChange: (v: string) => void; auto: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} autoComplete={auto} className="pr-12" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500">
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </Field>
  );
}

function SettingsSection() {
  const { profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [notifyReports, setNR] = useState(profile?.notify_reports ?? true);
  const [notifyAnn, setNA] = useState(profile?.notify_announcements ?? true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState<{ cur?: string; pw?: string; pw2?: string; form?: string }>({});
  const [pwBusy, setPwBusy] = useState(false);

  async function saveInfo(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!name.trim()) return toast('error', 'Ism-familiyani kiriting.');
    setSavingInfo(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: name.trim(), phone: phone.trim() || null, notify_reports: notifyReports, notify_announcements: notifyAnn,
      }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast('success', 'Ma’lumotlar saqlandi.');
    } catch (err) { toast('error', humanError(err)); } finally { setSavingInfo(false); }
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !profile) return;
    setPhotoBusy(true);
    try {
      const path = await uploadImage('avatars', profile.id, file, 512);
      const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast('success', 'Rasm yangilandi.');
    } catch (err) { toast('error', humanError(err)); } finally { setPhotoBusy(false); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!profile?.email) return;
    const next: typeof pwErr = {};
    if (!cur) next.cur = 'Joriy parolni kiriting.';
    const v = validatePassword(pw);
    if (v) next.pw = v;
    else if (pw === cur) next.pw = 'Yangi parol eskisidan farq qilishi kerak.';
    if (pw !== pw2) next.pw2 = 'Parollar bir-biriga mos kelmadi.';
    setPwErr(next);
    if (Object.keys(next).length) return;
    setPwBusy(true);
    try {
      // Joriy parolni qayta tekshirish: o‘g‘irlangan seans parolni o‘zgartira olmasligi uchun
      const { error: e1 } = await supabase.auth.signInWithPassword({ email: profile.email, password: cur });
      if (e1) { setPwErr({ cur: 'Joriy parol noto‘g‘ri.' }); return; }
      const { error: e2 } = await supabase.auth.updateUser({ password: pw });
      if (e2) throw e2;
      setCur(''); setPw(''); setPw2('');
      toast('success', 'Parol muvaffaqiyatli o‘zgartirildi.');
    } catch (err) { setPwErr({ form: humanError(err) }); } finally { setPwBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Shaxsiy ma’lumotlar</h2>
        <form onSubmit={saveInfo} className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.full_name ?? ''} path={profile?.avatar_url} size={56} />
            <label className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50">
              {photoBusy ? 'Yuklanmoqda…' : 'Rasmni almashtirish'}
              <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <Field label="Ism-familiya"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Telefon"><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" /></Field>
          <h3 className="pt-2 text-sm font-semibold">Bildirishnomalar</h3>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Hisobot natijalari haqida</span><input type="checkbox" className="h-5 w-5 accent-yellow-400" checked={notifyReports} onChange={(e) => setNR(e.target.checked)} /></label>
          <label className="flex items-center justify-between gap-3 text-sm"><span>E’lonlar haqida</span><input type="checkbox" className="h-5 w-5 accent-yellow-400" checked={notifyAnn} onChange={(e) => setNA(e.target.checked)} /></label>
          <Button type="submit" loading={savingInfo} className="w-full">Saqlash</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Xavfsizlik</h2>
        <form onSubmit={changePassword} noValidate className="space-y-3">
          {pwErr.form && <Notice tone="error">{pwErr.form}</Notice>}
          <PasswordInput label="Joriy parol" value={cur} onChange={setCur} auto="current-password" error={pwErr.cur} />
          <PasswordInput label="Yangi parol" value={pw} onChange={setPw} auto="new-password" error={pwErr.pw} />
          <PasswordInput label="Yangi parolni takrorlang" value={pw2} onChange={setPw2} auto="new-password" error={pwErr.pw2} />
          <Button type="submit" loading={pwBusy} className="w-full">Parolni o‘zgartirish</Button>
        </form>
      </Card>

      <Button variant="outline" size="lg" className="w-full" onClick={() => void signOut()}>
        <LogOut className="h-5 w-5" /> Chiqish
      </Button>
    </div>
  );
}
