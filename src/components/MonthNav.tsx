import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS_UZ_CAP, shiftMonth } from '@/lib/dates';

export function MonthNav({ y, m, onChange, maxFuture = 0 }: { y: number; m: number; onChange: (y: number, m: number) => void; maxFuture?: number }) {
  const go = (d: number) => { const n = shiftMonth(y, m, d); onChange(n.y, n.m); };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-1 py-1 shadow-card">
      <button onClick={() => go(-1)} aria-label="Oldingi davr" className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-neutral-100"><ChevronLeft className="h-5 w-5" /></button>
      <span className="font-semibold">{MONTHS_UZ_CAP[m - 1]} {y}</span>
      <button onClick={() => go(1)} aria-label="Keyingi davr" disabled={maxFuture < 0} className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-neutral-100 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
    </div>
  );
}
