/** 2000000 → "2 000 000" */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 2000000 → "2 000 000 so‘m" */
export function formatUzs(n: number): string {
  return `${formatNumber(n)} so‘m`;
}

/** +4 000 so‘m / −10 000 so‘m / 0 so‘m */
export function formatSigned(n: number): string {
  if (n === 0) return '0 so‘m';
  return `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n))} so‘m`;
}

export function formatAvg(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
}
