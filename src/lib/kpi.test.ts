import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS as S, classifyDay, dailyAdjustment, calculateMonth, dedupeEntries,
  pickSettings, describeDay, type DayEntry, type KpiSettings, type KpiSettingsVersion,
} from './kpi';
import { isoRange } from './dates';

const days30 = isoRange('2026-11-01', '2026-11-30');
const everyDay = (n: number, status: 'approved' | 'pending' | 'rejected' = 'approved'): DayEntry[] =>
  days30.map((date) => ({ date, kind: 'worked', accepted: n, status }));
const month = (n: number) => calculateMonth(everyDay(n), S).projectedUzs;

describe('kunlik KPI holati', () => {
  const cases: [number, string][] = [
    [0, 'red'], [49, 'red'], [50, 'yellow'], [59, 'yellow'], [60, 'green'], [61, 'green'], [62, 'green'], [100, 'green'],
  ];
  for (const [n, expected] of cases) {
    test(`${n} ta → ${expected}`, () => assert.equal(classifyDay(n, S), expected));
  }
  test('noto‘g‘ri qiymatlar rad etiladi', () => {
    for (const bad of [-1, 1.5, NaN, '60' as unknown as number]) assert.throws(() => classifyDay(bad, S), RangeError);
  });
});

describe('kunlik tuzatma', () => {
  test('norma = 0', () => assert.equal(dailyAdjustment(60, S), 0));
  test('0 ta → -60 000', () => assert.equal(dailyAdjustment(0, S), -60_000));
  test('49 ta → -11 000', () => assert.equal(dailyAdjustment(49, S), -11_000));
  test('50 ta → -10 000', () => assert.equal(dailyAdjustment(50, S), -10_000));
  test('59 ta → -1 000', () => assert.equal(dailyAdjustment(59, S), -1_000));
  test('61 ta → +2 000', () => assert.equal(dailyAdjustment(61, S), 2_000));
  test('62 ta → +4 000', () => assert.equal(dailyAdjustment(62, S), 4_000));
  test('100 ta → +80 000', () => assert.equal(dailyAdjustment(100, S), 80_000));
});

describe('talab qilingan oylik misollari (30 kun, standart sozlama)', () => {
  test('60 → 2 000 000', () => assert.equal(month(60), 2_000_000));
  test('62 → 2 120 000', () => assert.equal(month(62), 2_120_000));
  test('65 → 2 300 000', () => assert.equal(month(65), 2_300_000));
  test('55 → 1 850 000', () => assert.equal(month(55), 1_850_000));
  test('50 → 1 700 000', () => assert.equal(month(50), 1_700_000));
  test('40 → 1 400 000', () => assert.equal(month(40), 1_400_000));
  test('15 kun norma + 15 tasdiqlangan sababsiz kelmagan → 1 000 000', () => {
    const e: DayEntry[] = days30.map((date, i) =>
      i < 15 ? { date, kind: 'worked', accepted: 60, status: 'approved' } : { date, kind: 'absence' });
    const r = calculateMonth(e, S);
    assert.equal(r.projectedUzs, 1_000_000);
    assert.equal(r.counts.absences, 15);
  });
  test('0 ta, har kuni → manfiy bo‘lmaydi (0 ga tenglashadi)', () => {
    const r = calculateMonth(everyDay(0), { ...S, shortfallCoefUzs: 5_000 });
    assert.equal(r.rawUzs < 0, true);
    assert.equal(r.projectedUzs, 0);
  });
});

describe('tasdiqlanmagan hisobotlar', () => {
  test('kutilayotgan va rad etilgan hisobotlar oylikka kirmaydi', () => {
    const r = calculateMonth([...everyDay(40, 'pending').slice(0, 10), ...everyDay(40, 'rejected').slice(10, 20)], S);
    assert.equal(r.projectedUzs, 2_000_000);
    assert.equal(r.counts.pending, 10);
    assert.equal(r.counts.rejected, 10);
    assert.equal(r.approvedOrders, 0);
    assert.equal(r.pendingImpactUzs, -200_000); // alohida ko‘rsatiladi, hisobga kirmaydi
  });
  test('hisobot topshirilmagan kunlar nolga teng deb olinmaydi', () => {
    const r = calculateMonth([{ date: '2026-11-01', kind: 'worked', accepted: 60, status: 'approved' }], S);
    assert.equal(r.projectedUzs, 2_000_000);
    assert.equal(r.counts.red, 0);
  });
});

describe('davomat', () => {
  const oneAbsence: DayEntry[] = [{ date: '2026-11-02', kind: 'absence' }];
  test('prorata: 1 kun = 66 667 (yakuniy yaxlitlash)', () => {
    assert.equal(calculateMonth(oneAbsence, S).absenceUzs, -66_667);
  });
  test('yaxlitlash oxirida: 3 kun = 200 000 (3×66 667 emas)', () => {
    const e: DayEntry[] = ['01', '02', '03'].map((d) => ({ date: `2026-11-${d}`, kind: 'absence' }));
    assert.equal(calculateMonth(e, S).absenceUzs, -200_000);
  });
  test('belgilangan summa qoidasi', () => {
    const s: KpiSettings = { ...S, absenceRule: 'fixed', absenceFixedUzs: 50_000 };
    assert.equal(calculateMonth(oneAbsence, s).projectedUzs, 1_950_000);
  });
  test('qoida "yo‘q" bo‘lsa kamaytirilmaydi', () => {
    assert.equal(calculateMonth(oneAbsence, { ...S, absenceRule: 'none' }).projectedUzs, 2_000_000);
  });
  test('rejalashtirilgan dam olish kuni oylikni kamaytirmaydi', () => {
    const r = calculateMonth([{ date: '2026-11-01', kind: 'day_off' }], S);
    assert.equal(r.projectedUzs, 2_000_000);
    assert.equal(r.counts.daysOff, 1);
  });
  test('tasdiqlangan ta’til: standart — neytral', () => {
    assert.equal(calculateMonth([{ date: '2026-11-01', kind: 'leave' }], S).projectedUzs, 2_000_000);
  });
  test('tasdiqlangan ta’til: "kelmagan bilan bir xil" siyosati', () => {
    const s: KpiSettings = { ...S, leavePolicy: 'same_as_absence' };
    assert.equal(calculateMonth([{ date: '2026-11-01', kind: 'leave' }], s).projectedUzs, 2_000_000 - 66_667);
  });
});

describe('ikki marta hisoblanmaslik', () => {
  test('bir sanadagi ikki hisobot: tasdiqlangani bir marta hisoblanadi', () => {
    const e: DayEntry[] = [
      { date: '2026-11-05', kind: 'worked', accepted: 70, status: 'pending' },
      { date: '2026-11-05', kind: 'worked', accepted: 70, status: 'approved' },
      { date: '2026-11-05', kind: 'worked', accepted: 70, status: 'approved' },
    ];
    const r = calculateMonth(e, S);
    assert.equal(r.bonusUzs, 20_000);
    assert.equal(r.approvedOrders, 70);
  });
  test('admin davomat yozuvi hisobotdan ustun', () => {
    const e: DayEntry[] = [
      { date: '2026-11-05', kind: 'worked', accepted: 70, status: 'approved' },
      { date: '2026-11-05', kind: 'absence' },
    ];
    assert.equal(dedupeEntries(e).length, 1);
    assert.equal(calculateMonth(e, S).counts.absences, 1);
    assert.equal(calculateMonth(e, S).bonusUzs, 0);
  });
});

describe('qo‘lda tuzatmalar va hisob-kitob tafsiloti', () => {
  test('qo‘lda tuzatma qo‘shiladi', () => {
    assert.equal(calculateMonth(everyDay(60), S, [150_000, -50_000]).projectedUzs, 2_100_000);
  });
  test('o‘rtacha faqat tasdiqlangan ish kunlari bo‘yicha', () => {
    const r = calculateMonth([
      { date: '2026-11-01', kind: 'worked', accepted: 60, status: 'approved' },
      { date: '2026-11-02', kind: 'worked', accepted: 70, status: 'approved' },
      { date: '2026-11-03', kind: 'worked', accepted: 999, status: 'pending' },
    ], S);
    assert.equal(r.avgPerWorkedDay, 65);
    assert.equal(r.workedDays, 2);
  });
  test('describeDay', () => {
    assert.deepEqual(describeDay({ date: 'x', kind: 'worked', accepted: 55, status: 'approved' }, S),
      { state: 'yellow', adjustment: -5_000, accepted: 55 });
    assert.equal(describeDay({ date: 'x', kind: 'worked', accepted: 55, status: 'pending' }, S).adjustment, 0);
    assert.equal(describeDay(undefined, S).state, 'none');
  });
});

describe('tarixiy sozlamalar', () => {
  const v = (effectiveFrom: string, monthlyTargetUzs: number, operatorId?: string): KpiSettingsVersion =>
    ({ ...S, effectiveFrom, monthlyTargetUzs, operatorId });
  const versions = [v('2026-01-01', 2_000_000), v('2026-12-01', 2_500_000), v('2026-11-15', 3_000_000, 'op1')];

  test('noyabr uchun eski versiya, dekabr uchun yangisi', () => {
    assert.equal(pickSettings(versions, '2026-11-30')?.monthlyTargetUzs, 2_000_000);
    assert.equal(pickSettings(versions, '2026-12-01')?.monthlyTargetUzs, 2_500_000);
  });
  test('operatorga xos sozlama umumiydan ustun, boshqalarga ta’sir qilmaydi', () => {
    assert.equal(pickSettings(versions, '2026-11-20', 'op1')?.monthlyTargetUzs, 3_000_000);
    assert.equal(pickSettings(versions, '2026-11-20', 'op2')?.monthlyTargetUzs, 2_000_000);
  });
  test('kuchga kirmagan versiya yo‘q', () => assert.equal(pickSettings(versions, '2025-12-31'), undefined));
});
