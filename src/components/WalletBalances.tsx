import { CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import type { WalletSummary } from '@/lib/wallet';

/** Operator oyligi va admin balanslari uchun ochiq rangli, bir xil karta. */
export function WalletOverview({ wallet, compact = false }: { wallet?: WalletSummary | null; compact?: boolean }) {
  const displayed = (n: number | undefined) => n === undefined ? '—' : formatNumber(Number(n));

  return (
    <section aria-label="Asosiy va Hold balanslar" className={`rounded-2xl border border-neutral-200 bg-white shadow-card ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Balanslarim</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Daromad va tasdiqlanishni kutayotgan summa</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-ink" aria-hidden="true">
          <Wallet size={21} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
            <CheckCircle2 size={16} className="shrink-0 text-amber-600" />
            <span>Asosiy balans</span>
          </div>
          <div className="mt-3 break-words text-[clamp(1.25rem,4vw,1.875rem)] font-extrabold leading-tight tracking-tight tabular-nums text-ink">
            <span className={wallet && Number(wallet.main_balance) < 0 ? 'text-red-700' : undefined}>{displayed(wallet?.main_balance)}</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-950/75">{wallet && Number(wallet.main_balance) < 0 ? 'so‘m · Jarima sababli manfiy balans' : 'so‘m · To‘lovga tayyor'}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
            <Clock3 size={16} className="shrink-0 text-neutral-500" />
            <span>Hold balans</span>
          </div>
          <div className="mt-3 break-words text-[clamp(1.25rem,4vw,1.875rem)] font-extrabold leading-tight tracking-tight tabular-nums text-ink">
            {displayed(wallet?.hold_balance)}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">so‘m · Sotuv tasdiqlanishida</p>
        </div>
      </div>
      {!compact && wallet && (
        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-500">Jami to‘langan</span>
            <strong className="font-semibold tabular-nums text-ink">{displayed(wallet.paid_uzs)} so‘m</strong>
          </div>
          {Number(wallet.penalty_uzs) > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-neutral-500">Hisobot topshirilmagan kunlar jarimasi</span>
              <strong className="shrink-0 font-semibold tabular-nums text-red-700">−{displayed(wallet.penalty_uzs)} so‘m</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
