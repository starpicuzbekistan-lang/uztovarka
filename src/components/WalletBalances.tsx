import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/auth/AuthContext';
import { useWallet, type WalletSummary } from '@/lib/wallet';

export function WalletOverview({ wallet, compact = false }: { wallet: WalletSummary; compact?: boolean }) {
  return (
    <div className={`rounded-2xl bg-ink text-white ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-200">{compact ? 'Mening balansim' : 'Balanslarim'}</span>
        <Wallet size={18} className="text-brand" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-1 text-xs text-neutral-200"><CheckCircle2 size={15} className="shrink-0 text-brand" />Asosiy balans</div>
          <div className="mt-1 break-all text-xl font-extrabold tabular-nums text-brand">{formatNumber(Number(wallet.main_balance))}</div>
          <p className="mt-1 text-[11px] text-neutral-300">so‘m · To‘lovga tayyor</p>
        </div>
        <div className="min-w-0 rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-1 text-xs text-neutral-200"><Clock3 size={15} className="shrink-0" />Hold balans</div>
          <div className="mt-1 break-all text-xl font-extrabold tabular-nums">{formatNumber(Number(wallet.hold_balance))}</div>
          <p className="mt-1 text-[11px] text-neutral-300">so‘m · Sotuv tasdiqlanishida</p>
        </div>
      </div>
      {!compact && <div className="mt-3 flex items-center justify-between text-xs text-neutral-300">
        <span>Jami qayd etilgan to‘lov</span><strong className="text-white">{formatNumber(Number(wallet.paid_uzs))} so‘m</strong>
      </div>}
    </div>
  );
}

export default function WalletStrip() {
  const { profile } = useAuth();
  const w = useWallet(profile?.id);
  return (
    <div className="mb-4">
      {w.isError ? <p className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
        Balans yuklanmadi. Admin yangi 012 SQL migratsiyasini tekshirsin.
      </p> : w.data ? <Link to="/oylik" className="block" aria-label="Oylik to‘lov va balanslarni ko‘rish">
        <WalletOverview wallet={w.data} compact />
      </Link> : <div className="h-28 animate-pulse rounded-2xl bg-neutral-200/70" />}
    </div>
  );
}
