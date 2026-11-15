import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingBlock, Notice, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { periodForMonth } from '@/lib/dates';
import { salesIndicators } from '@/lib/salesMetrics';
import { formatNumber } from '@/lib/format';
import { humanError } from '@/lib/uz';
import type { Report } from '@/lib/types';

type Row = { month_start:string; unique_calls:number; sold_orders:number };
const percentText = (x:number|null) => x===null?'—':`${x.toLocaleString('uz-UZ')}%`;
const numberText = (x:number|null) => x===null?'—':x.toLocaleString('uz-UZ');

/** Mavjud KPI kartalariga tegmaydi; faqat uning PASTIDAGI yangi bo‘lim. */
export default function SalesPerformance({ operatorId, y, m, reports, workedDays }: {operatorId:string;y:number;m:number;reports:Report[];workedDays:number}) {
  const period=periodForMonth(y,m);
  const q=useQuery({queryKey:['sales-metrics',operatorId,period.start],queryFn:async()=>
    ((await unwrap(supabase.from('operator_sales_monthly').select('month_start,unique_calls,sold_orders').eq('operator_id',operatorId).eq('month_start',period.start))) as Row[])[0]??null});
  const valid=reports.filter(r=>r.status==='approved'&&!r.is_demo);
  const complete=valid.length>0&&!!q.data;
  const calls=Number(q.data?.unique_calls??0);
  const sold=Number(q.data?.sold_orders??0);
  const accepted=valid.reduce((s,r)=>s+r.accepted_orders,0);
  const kpi=salesIndicators(calls,accepted,sold,workedDays);
  return <div className="space-y-3 border-t border-neutral-200 pt-4">
    <h3 className="text-base font-bold">Savdo samaradorligi</h3>
    <p className="text-xs text-neutral-500">Unique Calls va Sotuvni administrator kiritadi. Qabul — operator hisobotidan, faqat tasdiqlangani.</p>
    {q.isLoading&&<LoadingBlock rows={2}/>}
    {q.isError&&<ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/>}
    {!q.isLoading && !q.isError && <>
      {complete && (sold > accepted || accepted > calls) && <Notice tone="warn">Ma’lumotlarni tekshiring: Qabul Unique Calls'dan, yoki Sotuv Qabuldan ko‘p. Gold Verified uchun mos oylik ko‘rsatkichlar kerak.</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Unique Calls" value={q.data?formatNumber(calls):'—'}/>
        <StatCard label="Qabul (tasdiqlangan)" value={formatNumber(accepted)}/>
        <StatCard label="Sotilgan buyurtmalar" value={q.data?formatNumber(sold):'—'}/>
      </div>
      {!complete&&<Notice tone="warn">Ma’lumot to‘liq emas: Bu oy uchun Unique Calls va Sotuv jami hali kiritilmagan (yoki tasdiqlangan qabul yo‘q). Admin kiritgach foizlar hisoblanadi.</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Qabul konversiyasi" value={complete?percentText(kpi.acceptanceConversion):'—'}/>
        <StatCard label="Sotuv konversiyasi" value={complete?percentText(kpi.salesFromAccepted):'—'}/>
        <StatCard label="Umumiy sotuv ulushi" value={complete?percentText(kpi.salesFromUnique):'—'}/>
        <StatCard label="Sotuvga aylanmagan qabul" value={complete?formatNumber(kpi.unsoldAccepted):'—'}/>
        <StatCard label="Kunlik o‘rtacha Unique Calls" value={complete?numberText(kpi.dailyAverageCalls):'—'}/>
        <StatCard label="Kunlik o‘rtacha sotuv" value={complete?numberText(kpi.dailyAverageSales):'—'}/>
      </div>
      <p className="text-xs text-neutral-500">Konversiyalar: Qabul / Unique Calls; Sotuv / Qabul; Sotuv / Unique Calls. Sotuvga aylanmagan qabul — bekor qilingan buyurtma degani emas.</p>
    </>}
  </div>;
}
