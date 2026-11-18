import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Info, Gift, Wallet } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useWallet, type WalletMovement } from '@/lib/wallet';
import { WalletOverview } from '@/components/WalletBalances';
import { useOperatorMonth } from '@/lib/useMonthData';
import { KpiCalendar, STATE_META } from '@/components/KpiCalendar';
import { MonthNav } from '@/components/MonthNav';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, LoadingBlock, Modal, Notice, PageHeader, StatCard, useToast, EmptyState } from '@/components/ui';
import { formatAvg, formatNumber, formatUzs } from '@/lib/format';
import { formatDateUz, formatDateTimeUz, parseIso, tashkentToday } from '@/lib/dates';
import { classifyDay, describeDay, isValidCount, type KpiSettings } from '@/lib/kpi';
import { validateSubmission } from '@/lib/reports';
import { humanError, ATTENDANCE_UZ, REPORT_STATUS_UZ } from '@/lib/uz';
import type { Report } from '@/lib/types';

const SUBMIT_ERR: Record<string, string> = {
  invalid_count: 'Buyurtmalar soni manfiy bo‘lmagan butun son bo‘lishi kerak.',
  duplicate: 'Bu sana uchun hisobot allaqachon topshirilgan.',
  backdated: 'O‘tgan sana uchun hisobot topshirishga ruxsat yo‘q.',
  future: 'Kelajak sanasiga hisobot topshirib bo‘lmaydi.',
  inactive: 'Hisobingiz faol emas.',
};

const TONE = { green: 'green', yellow: 'yellow', red: 'red' } as const;
const KPI_WORD = { green: 'Yashil', yellow: 'Sariq', red: 'Qizil' } as const;

function TodayCard({ today, report, settings, attendanceToday, onDone }: {
  today: string; report: Report | undefined; settings: KpiSettings; attendanceToday?: string; onDone: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const resubmit = report?.status === 'correction_requested';

  const send = useMutation({
    mutationFn: async (count: number) => {
      if (resubmit) await unwrap(supabase.rpc('resubmit_report', { p_id: report!.id, p_count: count }));
      else await unwrap(supabase.rpc('submit_daily_report', { p_count: count }));
    },
    onSuccess: () => { setValue(''); setConfirm(false); toast('success', 'Natijangiz yuborildi. Administrator tasdiqlashini kuting.'); onDone(); },
    onError: (e) => { setConfirm(false); setError(humanError(e)); },
  });

  const parsed = value.trim() === '' ? NaN : Number(value);
  function validate(): number | null {
    const v = validateSubmission({ count: parsed, reportDate: today, today, alreadyExists: !!report && !resubmit });
    if (!v.ok) { setError(SUBMIT_ERR[v.code]); return null; }
    setError(null);
    return parsed;
  }

  const showForm = !report || resubmit;
  const draftOk = isValidCount(parsed);

  return (
    <Card>
      <h2 className="text-lg font-bold">Bugungi qabul natijasi</h2>
      <p className="text-sm text-neutral-500">{formatDateUz(today)}</p>

      {attendanceToday && <div className="mt-3"><Notice tone="info">Bugun uchun davomat belgilangan: {attendanceToday}.</Notice></div>}

      {report && !resubmit && (
        <div className="mt-3 space-y-3">
          {report.status === 'pending' && <Notice tone="warn">Hisobotingiz tasdiqlanishi kutilmoqda.</Notice>}
          {report.status === 'approved' && <Notice tone="success">Hisobotingiz tasdiqlandi.</Notice>}
          {report.status === 'rejected' && <Notice tone="error">Hisobotingiz rad etildi.{report.review_note ? ` Sabab: ${report.review_note}` : ''}</Notice>}
          <div className="flex items-baseline justify-between rounded-xl bg-neutral-50 p-3">
            <span className="text-sm text-neutral-600">Yuborilgan natija</span>
            <span className="text-2xl font-bold tabular-nums">{report.accepted_orders} ta</span>
          </div>
          {report.status === 'pending' && (
            <p className="text-sm text-neutral-600">
              <Badge tone={TONE[classifyDay(report.accepted_orders, settings)]}>{KPI_WORD[classifyDay(report.accepted_orders, settings)]} kun</Badge>{' '}
              Admin qabulni tasdiqlasa, asosiy balansga: <strong>{formatUzs(report.accepted_orders * 1000)}</strong>
            </p>
          )}
        </div>
      )}

      {resubmit && <div className="mt-3"><Notice tone="warn">Administrator natijani tuzatishni so‘radi.{report?.review_note ? ` Izoh: ${report.review_note}` : ''}</Notice></div>}

      {showForm && !attendanceToday && (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (validate() !== null) setConfirm(true); }} noValidate>
          {!resubmit && <p className="text-sm text-neutral-600">Bugun nechta buyurtma qabul qildingiz?</p>}
          <Field label="Qabul qilingan buyurtmalar soni" error={error}>
            <Input inputMode="numeric" pattern="[0-9]*" placeholder="Masalan, 62" value={value}
              onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setError(null); }} className="text-lg font-semibold" />
          </Field>
          {draftOk && (
            <p className="text-sm text-neutral-600">
              <Badge tone={TONE[classifyDay(parsed, settings)]}>{KPI_WORD[classifyDay(parsed, settings)]} kun</Badge>{' '}
              Admin qabulni tasdiqlasa, asosiy balansga: <strong>{formatUzs(parsed * 1000)}</strong>
            </p>
          )}
          <Button type="submit" size="lg" className="w-full">{resubmit ? 'Tuzatilgan natijani yuborish' : 'Natijani yuborish'}</Button>
        </form>
      )}

      <ConfirmDialog
        open={confirm} title="Natijani yuborish"
        message={<>Bugun <strong>{parsed} ta</strong> buyurtma qabul qilganingizni tasdiqlaysizmi? Yuborilgandan keyin natijani faqat administrator o‘zgartira oladi.</>}
        confirmLabel="Ha, yuborish" onClose={() => setConfirm(false)} onConfirm={async () => { await send.mutateAsync(parsed).catch(() => {}); }}
      />
    </Card>
  );
}


export default function Salary() {
 const { profile }=useAuth();
 const qc=useQueryClient();
 const today=tashkentToday();
 const t=parseIso(today);
 const [ym,setYm]=useState({y:t.y,m:t.m});
 const [sel,setSel]=useState<string|null>(null);
 const q=useOperatorMonth(profile?.id,ym.y,ym.m);
 const wallet=useWallet(profile?.id);
 const start=`${ym.y}-${String(ym.m).padStart(2,'0')}-01`;
 const isCurrent=ym.y===t.y&&ym.m===t.m;
 const sales=useQuery({queryKey:['salary-month-sales',profile?.id,start],enabled:!!profile?.id,
   queryFn:async()=>((await unwrap(supabase.from('operator_sales_monthly').select('sold_orders')
   .eq('operator_id',profile!.id).eq('month_start',start))) as {sold_orders:number}[])[0]??null});
 const confirmed=useQuery({queryKey:['salary-month-confirmed',profile?.id,start],enabled:!!profile?.id,
   queryFn:async()=>((await unwrap(supabase.from('wallet_sales_confirmations').select('confirmed_orders')
   .eq('operator_id',profile!.id).eq('month_start',start))) as {confirmed_orders:number}[])[0]??null});
 const movements=useQuery({queryKey:['salary-movements',profile?.id],enabled:!!profile?.id,
   queryFn:async()=>await unwrap(supabase.from('wallet_movements')
   .select('id,operator_id,action,amount_uzs,note,created_at').eq('operator_id',profile!.id)
   .order('created_at',{ascending:false}).limit(100)) as WalletMovement[]});
 if(q.isLoading)return <><PageHeader title="Oylik to‘lov"/><LoadingBlock rows={4}/></>;
 if(q.isError||!q.data)return <><PageHeader title="Oylik to‘lov"/><ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/></>;
 const d=q.data;
 const {result:r,settings}=d;
 const currentWallet=wallet.data;
 const approvedAccepted=d.reports.filter(rep=>rep.status==='approved'&&!rep.is_demo &&
  rep.report_date>=(currentWallet?.start_date??'9999-12-31'))
  .reduce((sum,rep)=>sum+rep.accepted_orders,0);
 const confirmedSold=Number(confirmed.data?.confirmed_orders??0);
 const heldSold=Math.max(0,Number(sales.data?.sold_orders??0)-confirmedSold);
 const selEntry=sel?d.entries.find(e=>e.date===sel):undefined;
 const selInfo=sel?describeDay(selEntry,settings):null;
 const selReport=sel?d.reports.find(rep=>rep.report_date===sel):undefined;
 const selectedMonthMovements=(movements.data??[]).filter(m=>m.created_at.slice(0,7)===start.slice(0,7));
 return <div className="space-y-4">
  <PageHeader title="Oylik to‘lov" />
  <MonthNav y={ym.y} m={ym.m} onChange={(y,m)=>{setYm({y,m});setSel(null);}}/>
  {wallet.isLoading&&<LoadingBlock rows={2}/>}
  {wallet.isError&&<ErrorState message={humanError(wallet.error)} onRetry={()=>void wallet.refetch()}/>}
  {currentWallet&&<WalletOverview wallet={currentWallet}/>}
  <p className="text-xs text-neutral-500">Asosiy balans: tasdiqlangan qabul × 1 000 + tasdiqlangan sotuv × 5 000 + bonuslar − to‘lovlar. Hold: tasdiqlanishini kutayotgan sotuv × 5 000.</p>
  <Card className="space-y-4 p-4">
   <h2 className="text-lg font-bold">Daromad tarkibi · {ym.m}/{ym.y}</h2>
   <div className="grid grid-cols-2 gap-3">
    <div className="rounded-xl bg-neutral-50 p-3">
     <p className="text-xs text-neutral-500">Qabullardan</p>
     <p className="mt-1 break-all text-xl font-extrabold tabular-nums">{formatNumber(approvedAccepted*1000)}</p>
     <p className="mt-1 text-[11px] text-neutral-500">{formatNumber(approvedAccepted)} ta × 1 000 so‘m</p>
    </div>
    <div className="rounded-xl bg-neutral-50 p-3">
     <p className="text-xs text-neutral-500">Sotuvlardan</p>
     <p className="mt-1 break-all text-xl font-extrabold tabular-nums">{formatNumber(confirmedSold*5000)}</p>
     <p className="mt-1 text-[11px] text-neutral-500">{formatNumber(confirmedSold)} ta × 5 000 so‘m</p>
    </div>
   </div>
   <div className="flex items-center justify-between gap-3 rounded-xl bg-yellow-50 px-3 py-2">
    <div><p className="text-sm font-semibold">Hold'dagi sotuvlar</p><p className="text-xs text-neutral-500">{heldSold} ta tasdiqlanmagan</p></div>
    <span className="font-bold tabular-nums">{formatUzs(heldSold*5000)}</span>
   </div>
   <p className="text-xs text-neutral-500">Tanlangan oy statistikasi. Yuqoridagi balanslar barcha oylar bo‘yicha, yangi hamyon boshlangan sanadan hisoblanadi.</p>
  </Card>
  {isCurrent&&<TodayCard
   today={today} report={d.reports.find(x=>x.report_date===today)} settings={settings}
   attendanceToday={(()=>{const a=d.attendance.find(x=>x.record_date===today);return a?ATTENDANCE_UZ[a.kind]:undefined;})()}
   onDone={()=>{void qc.invalidateQueries({queryKey:['month']});void qc.invalidateQueries({queryKey:['operator-wallet']});}}
  />}
  <Card>
   <h2 className="mb-3 text-lg font-bold">KPI kalendari</h2>
   <KpiCalendar period={d.period} entries={d.entries} settings={settings} today={today} selected={sel} onSelect={setSel}/>
  </Card>
  <div className="grid grid-cols-2 gap-3">
   <StatCard label="Oylik qabul" value={formatNumber(r.approvedOrders)} hint="tasdiqlangan" />
   <StatCard label="Kunlik o‘rtacha" value={formatAvg(r.avgPerWorkedDay)} hint={`${r.workedDays} ish kuni bo‘yicha`} />
   <StatCard label="Yashil kunlar" value={r.counts.green} tone="green"/>
   <StatCard label="Sariq kunlar" value={r.counts.yellow} tone="yellow"/>
   <StatCard label="Qizil kunlar" value={r.counts.red} tone="red"/>
   <StatCard label="Kelmagan kunlar" value={r.counts.absences}/>
   <StatCard label="Topshirilgan hisobotlar" value={r.counts.reported}/>
   <StatCard label="Tasdiqlangan hisobotlar" value={r.counts.approved}/>
  </div>
  <Card>
   <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Gift size={20} className="text-amber-500"/>Qo‘shimcha bonus va to‘lovlar</h2>
   {movements.isError&&<ErrorState message={humanError(movements.error)} onRetry={()=>void movements.refetch()}/>}
   {movements.isLoading&&<LoadingBlock rows={1}/>}
   {movements.data&&selectedMonthMovements.length===0&&<p className="text-sm text-neutral-500">Tanlangan oy uchun bonus yoki to‘lov hali qayd etilmagan.</p>}
   <ul className="divide-y divide-neutral-100">
    {selectedMonthMovements.map(m=><li key={m.id} className="flex items-center justify-between gap-3 py-3">
     <div className="min-w-0"><p className="truncate text-sm font-medium">{m.note}</p>
      <p className="text-xs text-neutral-500">{m.action==='bonus'?'Qo‘shimcha bonus':'To‘langan'} · {formatDateTimeUz(m.created_at)}</p></div>
     <span className={`shrink-0 text-sm font-bold tabular-nums ${m.action==='bonus'?'text-green-700':'text-neutral-700'}`}>
      {m.action==='bonus'?'+':'−'}{formatUzs(Number(m.amount_uzs))}
     </span>
    </li>)}
   </ul>
  </Card>
  <Modal open={!!sel} onClose={()=>setSel(null)} title={sel?formatDateUz(sel):''}>
   {sel&&selInfo&&<div className="space-y-3">
    <div className="flex items-center gap-2">
     {selInfo.state==='green'?<CheckCircle2 className="h-5 w-5 text-kpi-green"/>:
      selInfo.state==='pending'?<Clock className="h-5 w-5 text-yellow-600"/>:
      <Info className="h-5 w-5 text-neutral-500"/>}
     <span className="font-semibold">{STATE_META[selInfo.state].label}</span>
    </div>
    {selInfo.state==='none'&&<p className="text-sm text-neutral-600">{sel===today?'Bugungi natija hali kiritilmagan.':'Bu kun uchun natija kiritilmagan.'}</p>}
    {selReport&&<dl className="divide-y divide-neutral-100 rounded-xl bg-neutral-50 px-3 text-[15px]">
     <Row label="Qabul qilingan buyurtmalar" value={`${selReport.accepted_orders} ta`}/>
     <Row label="Hisobot holati" value={REPORT_STATUS_UZ[selReport.status]}/>
     {selReport.status==='approved'&&!selReport.is_demo&&currentWallet&&selReport.report_date>=currentWallet.start_date&&
       <Row label="Asosiy balansga qo‘shilgan" value={formatUzs(selReport.accepted_orders*1000)} strong/>}
     {selReport.status==='pending'&&<Row label="Admin tasdiqlasa" value={formatUzs(selReport.accepted_orders*1000)}/>}
    </dl>}
    {selReport?.review_note&&<Notice tone="warn">Administrator izohi: {selReport.review_note}</Notice>}
   </div>}
  </Modal>
  {d.entries.length===0&&!isCurrent&&<EmptyState title="Bu davr uchun ma’lumot yo‘q." />}
 </div>;
}
function Row({label,value,strong}:{label:string;value:string;strong?:boolean}){
 return <div className={`flex items-baseline justify-between gap-3 py-2.5 ${strong?'font-bold':''}`}>
  <dt className="text-neutral-600">{label}</dt><dd className="shrink-0 text-right tabular-nums">{value}</dd>
 </div>;
}
