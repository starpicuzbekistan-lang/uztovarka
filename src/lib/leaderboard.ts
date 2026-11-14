export type RankMode = 'total' | 'average' | 'green';

export interface OperatorStats {
  id: string;
  name: string;
  totalOrders: number;
  workedDays: number;
  greenDays: number;
}

export interface Ranked extends OperatorStats {
  rank: number;
  value: number;
}

const avg = (o: OperatorStats) => (o.workedDays > 0 ? o.totalOrders / o.workedDays : 0);

function compare(a: OperatorStats, b: OperatorStats, mode: RankMode): number {
  if (mode === 'total') return b.totalOrders - a.totalOrders;
  if (mode === 'green') return b.greenDays - a.greenDays;
  // O‘rtacha: kasrlarni butun sonlar bilan solishtirish (suzuvchi nuqta xatosiz). 0 kunlik operator oxirida.
  if (a.workedDays === 0 || b.workedDays === 0) return (b.workedDays > 0 ? 1 : 0) - (a.workedDays > 0 ? 1 : 0);
  return b.totalOrders * a.workedDays - a.totalOrders * b.workedDays;
}

/** "Musobaqa" reytingi: teng natija — teng o‘rin (1, 2, 2, 4). Tartib barqaror (teng bo‘lsa ism bo‘yicha). */
export function rankOperators(stats: OperatorStats[], mode: RankMode = 'total'): Ranked[] {
  const sorted = [...stats].sort((a, b) => compare(a, b, mode) || a.name.localeCompare(b.name, 'uz'));
  const out: Ranked[] = [];
  sorted.forEach((o, i) => {
    const prev = out[i - 1];
    const rank = prev && compare(prev, o, mode) === 0 ? prev.rank : i + 1;
    out.push({ ...o, rank, value: mode === 'total' ? o.totalOrders : mode === 'green' ? o.greenDays : avg(o) });
  });
  return out;
}
