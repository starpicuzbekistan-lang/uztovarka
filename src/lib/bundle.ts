export type DiscountType = 'none' | 'percent' | 'fixed';
export interface BundleSettings {
  id: number;
  discount_enabled: boolean;
  operators_can_discount: boolean;
  max_discount_percent: number;
  max_discount_uzs: number;
  free_delivery: boolean;
  delivery_fee_uzs: number;
}

export interface BundleLine {
  id: string;
  sku: string;
  name: string;
  price_uzs: number;
  quantity: number;
  subtotal_uzs: number;
}
export interface BundleQuote {
  items: BundleLine[];
  subtotal_uzs: number;
  discount_uzs: number;
  delivery_uzs: number;
  total_uzs: number;
}

export const validAmount = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function getDiscount(subtotal: number, type: DiscountType, value: number): number {
  if (!validAmount(subtotal) || !Number.isFinite(value) || value < 0) return 0;
  if (type === 'percent') return Math.min(subtotal, Math.round(subtotal * Math.min(100, value) / 100));
  if (type === 'fixed') return Math.min(subtotal, Math.floor(value));
  return 0;
}
export function getPreview(subtotal: number, type: DiscountType, discountValue: number, delivery: number) {
  const discount = getDiscount(subtotal, type, discountValue);
  return { discount, total: subtotal - discount + delivery };
}
