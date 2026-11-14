/** Sana yordamchilari. Barcha sanalar "YYYY-MM-DD" ko‘rinishida; hisob-kitob UTC da, "bugun" Asia/Tashkent bo‘yicha. */

export const TIMEZONE = 'Asia/Tashkent';

export const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];
export const MONTHS_UZ_CAP = MONTHS_UZ.map((m) => m[0].toUpperCase() + m.slice(1));
export const WEEKDAYS_UZ_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

export function tashkentToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;

export function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

export interface Period {
  start: string;
  end: string;
  days: string[];
}

export function isoRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = parseIso(start);
  const e = parseIso(end);
  const cur = new Date(Date.UTC(s.y, s.m - 1, s.d));
  const last = Date.UTC(e.y, e.m - 1, e.d);
  while (cur.getTime() <= last) {
    out.push(toIso(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Oddiy kalendar oyi davri — mavjud bo‘lmagan sanalar yaratilmaydi. */
export function periodForMonth(y: number, m1: number): Period {
  const start = toIso(y, m1, 1);
  const end = toIso(y, m1, daysInMonth(y, m1));
  return { start, end, days: isoRange(start, end) };
}

export function shiftMonth(y: number, m1: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m1 - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Dushanbadan boshlanadigan kalendar setkasi: bo‘sh kataklar `null`. */
export function calendarGrid(period: Period): (string | null)[] {
  const first = parseIso(period.start);
  const dow = new Date(Date.UTC(first.y, first.m - 1, first.d)).getUTCDay(); // 0=Yak
  const lead = (dow + 6) % 7;
  return [...Array<null>(lead).fill(null), ...period.days];
}

export function formatDateUz(iso: string, withYear = true): string {
  const { y, m, d } = parseIso(iso);
  return `${d}-${MONTHS_UZ[m - 1]}${withYear ? `, ${y}` : ''}`;
}

export function formatDateTimeUz(ts: string): string {
  const dt = new Date(ts);
  const date = tashkentToday(dt);
  const time = new Intl.DateTimeFormat('uz-UZ', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(dt);
  return `${formatDateUz(date)}, ${time}`;
}
