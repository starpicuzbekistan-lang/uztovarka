/** Skript matnidagi {{...}} o‘rinbosarlarini joriy nabor ma’lumoti bilan almashtiradi. Narxlar skriptlarda takrorlanmaydi. */

export interface ScriptSetData {
  name: string;
  code: string;
  priceUzs: number | null;
  deliveryInfo: string | null;
  items: { name: string; quantity: number; isBonus: boolean }[];
}

export type Segment = { text: string; missing?: boolean };

const KEYS = ['nabor_nomi', 'narx', 'yetkazib_berish', 'tarkib'] as const;
const MISSING_LABEL: Record<(typeof KEYS)[number], string> = {
  nabor_nomi: 'nabor tanlanmagan',
  narx: 'narx kiritilmagan — administratorga murojaat qiling',
  yetkazib_berish: 'yetkazib berish shartlari kiritilmagan — administratorga murojaat qiling',
  tarkib: 'tarkib kiritilmagan',
};

function nf(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function valueFor(key: (typeof KEYS)[number], set: ScriptSetData | null): string | null {
  if (!set) return null;
  switch (key) {
    case 'nabor_nomi': return set.name || null;
    case 'narx': return set.priceUzs == null ? null : `${nf(set.priceUzs)} so‘m`;
    case 'yetkazib_berish': return set.deliveryInfo?.trim() ? set.deliveryInfo.trim() : null;
    case 'tarkib':
      return set.items.length
        ? set.items.map((i) => `${i.name} — ${i.quantity} dona${i.isBonus ? ' (sovg‘a)' : ''}`).join(', ')
        : null;
  }
}

export function renderScript(text: string, set: ScriptSetData | null): Segment[] {
  const out: Segment[] = [];
  const re = /\{\{\s*([a-z_]+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const key = m[1] as (typeof KEYS)[number];
    if (!KEYS.includes(key)) {
      out.push({ text: m[0] });
    } else {
      const v = valueFor(key, set);
      out.push(v ? { text: v } : { text: `[${MISSING_LABEL[key]}]`, missing: true });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export const segmentsToPlain = (segs: Segment[]) => segs.map((s) => s.text).join('');
export const hasMissing = (segs: Segment[]) => segs.some((s) => s.missing);
