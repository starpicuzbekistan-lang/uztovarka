import clsx from 'clsx';
import { Ban, Check, Clock, Coffee, Minus, Plane, RotateCcw, UserX, X, type LucideIcon } from 'lucide-react';
import { calendarGrid, WEEKDAYS_UZ_SHORT, type Period } from '@/lib/dates';
import { describeDay, type DayEntry, type KpiSettings } from '@/lib/kpi';
import type { KpiColorThresholds } from '@/lib/kpiColors';

type State = ReturnType<typeof describeDay>['state'];

export const STATE_META: Record<State, { label: string; cell: string; icon?: LucideIcon; legend?: string }> = {
  green: { label: 'Norma bajarilgan', cell: 'bg-kpi-greenbg text-green-900 border-green-300', icon: Check },
  yellow: { label: 'Minimal darajaga erishilgan', cell: 'bg-kpi-yellowbg text-yellow-900 border-yellow-300', icon: Minus },
  red: { label: 'Minimal daraja bajarilmagan', cell: 'bg-kpi-redbg text-red-900 border-red-300', icon: X },
  pending: { label: 'Tasdiqlash kutilmoqda', cell: 'bg-white text-ink border-dashed border-yellow-500 border-2', icon: Clock },
  correction_requested: { label: 'Tuzatish so‘ralgan', cell: 'bg-white text-ink border-dashed border-orange-500 border-2', icon: RotateCcw },
  rejected: { label: 'Rad etilgan', cell: 'bg-neutral-50 text-neutral-500 border-neutral-300', icon: Ban },
  absence: { label: 'Kelmagan (tasdiqlangan)', cell: 'bg-neutral-800 text-white border-neutral-800', icon: UserX },
  leave: { label: 'Tasdiqlangan ta’til', cell: 'bg-sky-100 text-sky-900 border-sky-300', icon: Plane },
  day_off: { label: 'Dam olish kuni', cell: 'bg-neutral-200 text-neutral-600 border-neutral-200', icon: Coffee },
  none: { label: 'Natija kiritilmagan', cell: 'bg-white text-neutral-500 border-neutral-200' },
};

export function KpiCalendar({ period, entries, settings, colors, today, selected, onSelect }: {
  period: Period; entries: DayEntry[]; settings: KpiSettings; colors?: KpiColorThresholds; today: string; selected?: string | null; onSelect: (d: string) => void;
}) {
  const map = new Map(entries.map((e) => [e.date, e]));
  const cells = calendarGrid(period);
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-neutral-500">
        {WEEKDAYS_UZ_SHORT.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          if (!date) return <span key={`b${i}`} />;
          const d = describeDay(map.get(date), settings, colors);
          const meta = STATE_META[d.state];
          const Icon = meta.icon;
          const future = date > today;
          return (
            <button key={date} onClick={() => onSelect(date)} aria-label={`${Number(date.slice(8))}-kun: ${meta.label}`}
              aria-pressed={selected === date}
              className={clsx('relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-shadow',
                meta.cell, future && d.state === 'none' && 'opacity-50', date === today && 'ring-2 ring-ink ring-offset-1', selected === date && 'shadow-md ring-2 ring-brand')}>
              <span className="leading-none">{Number(date.slice(8))}</span>
              {Icon && <Icon className="mt-0.5 h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
        {(['green', 'yellow', 'red', 'pending', 'absence', 'day_off'] as State[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={clsx('inline-block h-3.5 w-3.5 rounded border', STATE_META[s].cell)} /> {STATE_META[s].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
