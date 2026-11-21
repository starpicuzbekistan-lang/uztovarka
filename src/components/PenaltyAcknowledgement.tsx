import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button, useToast } from '@/components/ui';
import { useAbsencePolicy } from '@/lib/wallet';
import { supabase, unwrap } from '@/lib/supabase';
import { formatUzs } from '@/lib/format';
import { formatDateUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

type Acknowledgement = { operator_id: string; acknowledged_at: string };

/** One-time notice for a currently configured daily missing-report fine.
 * Confirmation is stored per operator in Supabase, not only in the browser.
 * This component does not create or collect penalties; the wallet RPC is authoritative.
 */
export default function PenaltyAcknowledgement() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [accepted, setAccepted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const policy = useAbsencePolicy();
  const rule = policy.data?.[0];

  const acknowledgement = useQuery({
    queryKey: ['operator-penalty-acknowledgement', profile?.id],
    enabled: Boolean(profile?.id && profile.role === 'operator' && rule && Number(rule.amount_uzs) > 0),
    queryFn: async () => await unwrap(supabase.from('operator_penalty_acknowledgements')
      .select('operator_id,acknowledged_at').eq('operator_id', profile!.id).maybeSingle()) as Acknowledgement | null,
    retry: 1,
  });

  const acknowledge = useMutation({
    mutationFn: async () => {
      if (!profile || !rule || !accepted) throw new Error('Ogohlantirishni tasdiqlang.');
      await unwrap(supabase.rpc('acknowledge_operator_penalty'));
    },
    onSuccess: () => {
      setSubmissionError(null);
      void qc.invalidateQueries({ queryKey: ['operator-penalty-acknowledgement', profile?.id] });
      toast('success', 'Ogohlantirish bilan tanishganingiz qayd etildi.');
    },
    onError: (err) => {
      // Keep the error inside the open dialog, not behind its backdrop.
      setSubmissionError(humanError(err));
    },
  });

  if (!profile || profile.role !== 'operator' || !rule || Number(rule.amount_uzs) <= 0 ||
      acknowledgement.isLoading || acknowledgement.isError || acknowledgement.data) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="operator-penalty-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-neutral-950/65 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><AlertTriangle size={26}/></div>
        <h2 id="operator-penalty-title" className="text-xl font-extrabold tracking-tight text-neutral-900">Muhim ogohlantirish</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-700">
          Har kuni qabul qilingan buyurtmalar sonini tizimga kiritishingiz shart.
          Hisobot topshirilmagan har bir kun uchun belgilangan jarima balansdan ayriladi.
        </p>
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold text-red-800">Bir kunlik jarima</p>
          <p className="mt-1 text-2xl font-extrabold text-red-700">−{formatUzs(Number(rule.amount_uzs))}</p>
          <p className="mt-1 text-xs text-red-800">Qoida {formatDateUz(rule.effective_from)} dan amal qiladi.</p>
        </div>
        <p className="mt-3 text-xs leading-5 text-neutral-600">
          Tasdiqlangan ta’til yoki dam olish kunlariga jarima hisoblanmaydi.
          Hisobot topshirilmagan kunlar Oylik to‘lov bo‘limida ko‘rsatiladi.
          Ushbu ogohlantirishni tasdiqlashning o‘zi jarima hisoblamaydi.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3 text-sm font-medium leading-5 text-neutral-800">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
            checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>Tanishib chiqdim va jarima shartlarini tushundim.</span>
        </label>
        {submissionError && (
          <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {submissionError}
          </div>
        )}
        <Button className="mt-4 w-full justify-center" disabled={!accepted || acknowledge.isPending}
          loading={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
          <CheckCircle2 size={18}/> Tasdiqlash
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-500">
          <ShieldCheck size={14}/> Tasdiq profilingizda bir marta saqlanadi.
        </p>
      </div>
    </div>
  );
}
