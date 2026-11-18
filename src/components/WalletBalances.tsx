import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Wallet, AlertCircle } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/auth/AuthContext';
import { useWallet, type WalletSummary } from '@/lib/wallet';

export function WalletOverview({ wallet, compact = false }: { wallet?: WalletSummary | null; compact?: boolean }) {
  const displayed=(n:number|undefined)=> n === undefined ? '—' : formatNumber(Number(n));
  return (
    <div className={`rounded-2xl bg-ink text-white ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-200">{compact ? 'Mening balansim' : 'Balanslarim'}</span>
        <Wallet size={18} className="text-brand" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-1 text-xs text-neutral-200"><CheckCircle2 size={15} className="shrink-0 text-brand" />Asosiy balans</div>
          <div className="mt-1 break-all text-xl font-extrabold tabular-nums text-brand">{displayed(wallet?.main_balance)}</div>
          <p className="mt-1 text-[11px] text-neutral-300">so‘m · To‘lovga tayyor</p>
        </div>
        <div className="min-w-0 rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-1 text-xs text-neutral-200"><Clock3 size={15} className="shrink-0" />Hold balans</div>
          <div className="mt-1 break-all text-xl font-extrabold tabular-nums">{displayed(wallet?.hold_balance)}</div>
          <p className="mt-1 text-[11px] text-neutral-300">so‘m · Sotuv tasdiqlanishida</p>
        </div>
      </div>
      {!compact && wallet && <>
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-300">
          <span>Jami to‘langan</span><strong className="text-white">{displayed(wallet.paid_uzs)} so‘m</strong>
        </div>
        {Number(wallet.penalty_uzs)>0 && <div className="mt-2 flex items-center justify-between text-xs text-rose-300">
          <span>Hisobot topshirilmagan kunlar jarimasi</span><strong>−{displayed(wallet.penalty_uzs)} so‘m</strong>
        </div>}
      </>}
    </div>
  );
}

export default function WalletStrip() {
  const { profile } = useAuth();
  const w = useWallet(profile?.id);
  return (
    <div className="mb-4">
      <Link to="/oylik" className="block" aria-label="Oylik to‘lov va balanslarni ko‘rish">
        <WalletOverview wallet={w.data}/>
      </Link>
      {w.isError && <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertCircle size={15} className="shrink-0" /> Balans serverga ulanmagan. Admin 012 va 013 SQL migratsiyalarini tekshirsin.
      </div>}
      {w.isLoading && <p className="mt-1 text-xs text-neutral-500">Balans yuklanmoqda…</p>}
    </div>
  );
}
