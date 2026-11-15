import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBasket, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { CoverImage } from '@/components/Media';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { formatUzs } from '@/lib/format';
import { humanError } from '@/lib/uz';
import { getPreview, type BundleQuote, type BundleSettings, type DiscountType } from '@/lib/bundle';
import type { ProductRow } from './Catalog';

const firstImage = (images: { path: string; position: number }[]) => [...images].sort((a, b) => a.position - b.position)[0]?.path ?? null;

export default function BundleBuilder({ products, search, categoryId, onlyAvailable }: { products: ProductRow[]; search: string; categoryId: string; onlyAvailable: boolean }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [kind, setKind] = useState<DiscountType>('none');
  const [amount, setAmount] = useState('0');
  const [quote, setQuote] = useState<BundleQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ['bundle-settings'],
    queryFn: async () => (await unwrap(supabase.from('bundle_builder_settings').select('*').eq('id', 1).single())) as BundleSettings,
  });
  const settings = config.data;
  const canDiscount = Boolean(settings?.discount_enabled && (profile?.role === 'admin' || settings?.operators_can_discount));
  const eligible = products.filter(p => p.availability !== 'unavailable');
  const term = search.trim().toLocaleLowerCase('uz-UZ');
  const visible = eligible.filter(p =>
    (categoryId === 'all' || p.category?.id === categoryId) &&
    (!onlyAvailable || p.availability === 'available') &&
    (!term || p.name.toLocaleLowerCase('uz-UZ').includes(term) || p.sku.toLocaleLowerCase('uz-UZ').includes(term)));
  const chosen = useMemo(() => eligible.filter(p => (qty[p.id] || 0) > 0), [eligible, qty]);
  const subtotal = chosen.reduce((sum, p) => sum + Number(p.price_uzs ?? 0) * qty[p.id], 0);
  const missing = chosen.some(p => p.price_uzs === null || !Number.isSafeInteger(Number(p.price_uzs)));
  const discountValue = Number(amount);
  const allowed = kind === 'none' ? 0 : kind === 'percent' ? Number(settings?.max_discount_percent ?? 0) : Number(settings?.max_discount_uzs ?? 0);
  const validDiscount = kind === 'none' || (canDiscount && Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= allowed &&
    (kind !== 'fixed' || Number.isSafeInteger(discountValue)));
  const appliedKind: DiscountType = canDiscount ? kind : 'none';
  const fee = settings?.free_delivery ? 0 : Number(settings?.delivery_fee_uzs ?? 0);
  const preview = getPreview(subtotal, appliedKind, discountValue, fee);

  // Har qanday tanlov yoki narx o‘zgarishidan keyin avvalgi tasdiqlangan hisob bekor bo‘ladi.
  useEffect(() => { setQuote(null); }, [qty, kind, amount, settings, products]);
  useEffect(() => { if (!canDiscount) { setKind('none'); setAmount('0'); } }, [canDiscount]);

  function changeQty(id: string, value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 99) return;
    setQty((s) => ({ ...s, [id]: value }));
  }
  async function verify() {
    if (!chosen.length || missing || !validDiscount || !settings || !Number.isSafeInteger(subtotal)) return;
    setBusy(true);
    try {
      const result = await unwrap(supabase.rpc('calculate_custom_bundle', {
        p_items: chosen.map(p => ({ product_id: p.id, quantity: qty[p.id] })),
        p_discount_type: appliedKind,
        p_discount_value: appliedKind === 'none' ? 0 : discountValue,
      })) as BundleQuote;
      setQuote(result);
      toast('success', 'Hisob serverda tekshirildi.');
    } catch (e) { toast('error', humanError(e)); }
    finally { setBusy(false); }
  }
  async function copyQuote() {
    if (!quote) return;
    const text = [
      'UZTOVARKA — Individual nabor',
      ...quote.items.map(p => `${p.name} (${p.sku}) — ${p.quantity} × ${formatUzs(p.price_uzs)} = ${formatUzs(p.subtotal_uzs)}`),
      `Mahsulotlar jami: ${formatUzs(quote.subtotal_uzs)}`,
      `Chegirma: −${formatUzs(quote.discount_uzs)}`,
      `Yetkazib berish: ${quote.delivery_uzs === 0 ? 'Bepul' : formatUzs(quote.delivery_uzs)}`,
      `Yakuniy narx: ${formatUzs(quote.total_uzs)}`,
      'Hisob-kitob. Buyurtmani administrator yoki operator orqali tasdiqlang.',
    ].join('\n');
    try { await navigator.clipboard.writeText(text); toast('success', 'Hisob nusxalandi.'); }
    catch { toast('error', 'Nusxalab bo‘lmadi.'); }
  }

  if (config.isLoading) return <LoadingBlock rows={2} />;
  if (config.isError || !settings) return <ErrorState message="Nabor narx sozlamalarini yuklab bo‘lmadi. Administrator 007 SQL migratsiyasini tekshirsin." onRetry={() => void config.refetch()} />;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-bold"><ShoppingBasket className="h-5 w-5" /> Individual nabor tuzish</h2>
        <p className="mt-1 text-sm text-neutral-500">Mahsulotlar bazasidagi narxlar asosida o‘z naboringizni tuzing.</p>
        {visible.length === 0 && <EmptyState title="Mos mahsulot topilmadi." />}
        <div className="mt-3 space-y-2">
          {visible.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100"><CoverImage path={firstImage(p.images)} alt={p.name} kind="product" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{p.name}</p>
                <p className="text-xs text-neutral-500">{p.sku} · {p.price_uzs == null ? 'Narx kiritilmagan' : formatUzs(Number(p.price_uzs))}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1" aria-label={`${p.name} miqdori`}>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Kamaytirish" disabled={!qty[p.id]} onClick={() => changeQty(p.id, (qty[p.id] ?? 0) - 1)}><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center text-sm font-bold tabular-nums">{qty[p.id] ?? 0}</span>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Qo‘shish" disabled={(qty[p.id] ?? 0) >= 99 || p.price_uzs == null} onClick={() => changeQty(p.id, (qty[p.id] ?? 0) + 1)}><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Tanlangan mahsulotlar ({chosen.length})</h2>
          <Button size="sm" variant="ghost" onClick={() => { setQty({}); setKind('none'); setAmount('0'); }}><RotateCcw className="h-4 w-4" /> Tozalash</Button>
        </div>
        {chosen.length === 0 ? <p className="text-sm text-neutral-500">Mahsulot qo‘shing.</p> : chosen.map(p => <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0 flex-1"><span className="font-medium">{p.name}</span><span className="ml-1 text-neutral-500">× {qty[p.id]}</span></div>
          <span className="shrink-0 font-medium tabular-nums">{p.price_uzs == null ? 'Narx yo‘q' : formatUzs(Number(p.price_uzs) * qty[p.id])}</span>
          <button onClick={() => changeQty(p.id, 0)} className="text-neutral-400" aria-label="Olib tashlash"><Trash2 className="h-4 w-4" /></button>
        </div>)}
        <div className="border-t border-neutral-100 pt-3">
          <label htmlFor="discount-kind" className="mb-1.5 block text-sm font-medium">Chegirma turi</label>
          <Select id="discount-kind" disabled={!canDiscount} value={appliedKind} onChange={(e) => { setKind(e.target.value as DiscountType); setAmount('0'); }}>
            <option value="none">Chegirmasiz</option><option value="percent">Foiz (%)</option><option value="fixed">So‘m</option>
          </Select>
          {!canDiscount && <p className="mt-1 text-xs text-neutral-500">Chegirma berishga administrator ruxsati kerak.</p>}
          {canDiscount && appliedKind !== 'none' && <div className="mt-2">
            <label htmlFor="discount-value" className="mb-1.5 block text-sm font-medium">Chegirma ({appliedKind === 'percent' ? '%' : 'so‘m'})</label>
            <input id="discount-value" type="number" min={0} max={allowed} step={appliedKind === 'percent' ? '0.1' : '1'} value={amount} onChange={e => setAmount(e.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" />
            <p className="mt-1 text-xs text-neutral-500">Ruxsat etilgan limit: {appliedKind === 'percent' ? `${allowed}%` : formatUzs(allowed)}</p>
          </div>}
        </div>
        {!validDiscount && <p className="text-sm font-medium text-red-600">Chegirma qiymati ruxsat etilgan limitdan oshmasligi kerak.</p>}
        {missing && <p className="text-sm font-medium text-red-600">Tanlangan mahsulotlardan birining narxi kiritilmagan.</p>}
        <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
          <div className="flex justify-between"><span>Mahsulotlar jami</span><strong>{formatUzs(subtotal)}</strong></div>
          <div className="flex justify-between"><span>Chegirma</span><span>−{formatUzs(preview.discount)}</span></div>
          <div className="flex justify-between"><span>Yetkazib berish</span><span className={fee === 0 ? 'text-green-700' : ''}>{fee === 0 ? 'Bepul' : formatUzs(fee)}</span></div>
          <div className="flex items-center justify-between border-t border-neutral-200 pt-2 text-base"><strong>Yakuniy narx</strong><strong>{formatUzs(preview.total)}</strong></div>
        </div>
        <Button className="w-full" disabled={!chosen.length || missing || !validDiscount || busy || !Number.isSafeInteger(subtotal)} loading={busy} onClick={() => void verify()}><ShieldCheck className="h-4 w-4" /> Hisobni tekshirish</Button>
        {quote && <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-1 text-sm font-medium text-green-800"><Check className="h-4 w-4" /> Narxlar serverda tekshirildi: {formatUzs(quote.total_uzs)}</p>
          <Button className="w-full" variant="outline" onClick={() => void copyQuote()}><Copy className="h-4 w-4" /> Hisobni nusxalash</Button>
        </div>}
        <p className="text-xs text-neutral-500">Bu individual hisob-kitob. Mavjud SET-01 va boshqa naborlar narxiga ta’sir qilmaydi.</p>
      </Card>
    </div>
  );
}
