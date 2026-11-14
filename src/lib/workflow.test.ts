import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, reviewReport, correctReport } from './reports';
import { canAccess, homeFor } from './access';
import { rankOperators, type OperatorStats } from './leaderboard';
import { finalizePayroll, paymentStatus } from './payroll';
import { DEFAULT_SETTINGS as S, type DayEntry } from './kpi';
import {
  tashkentToday, periodForMonth, calendarGrid, shiftMonth, daysInMonth, isoRange, formatDateUz,
} from './dates';

describe('kunlik hisobotni topshirish', () => {
  const base = { count: 62, reportDate: '2026-11-14', today: '2026-11-14', alreadyExists: false };
  test('to‘g‘ri hisobot', () => assert.deepEqual(validateSubmission(base), { ok: true }));
  test('takroriy hisobot rad etiladi', () =>
    assert.deepEqual(validateSubmission({ ...base, alreadyExists: true }), { ok: false, code: 'duplicate' }));
  test('manfiy / kasr / matn rad etiladi', () => {
    for (const count of [-1, 2.5, '62', null]) {
      assert.deepEqual(validateSubmission({ ...base, count }), { ok: false, code: 'invalid_count' });
    }
  });
  test('0 qabul qilinadi', () => assert.deepEqual(validateSubmission({ ...base, count: 0 }), { ok: true }));
  test('o‘tgan sana — ruxsatsiz rad, ruxsat bilan ok', () => {
    const past = { ...base, reportDate: '2026-11-13' };
    assert.deepEqual(validateSubmission(past), { ok: false, code: 'backdated' });
    assert.deepEqual(validateSubmission({ ...past, allowBackdate: true }), { ok: true });
  });
  test('kelajak sana rad etiladi', () =>
    assert.deepEqual(validateSubmission({ ...base, reportDate: '2026-11-15' }), { ok: false, code: 'future' }));
  test('nofaol foydalanuvchi topshira olmaydi', () =>
    assert.deepEqual(validateSubmission({ ...base, isActive: false }), { ok: false, code: 'inactive' }));
});

describe('hisobotni ko‘rib chiqish', () => {
  const base = { status: 'pending' as const, operatorId: 'op', reviewerId: 'adm', reviewerRole: 'admin' as const };
  test('tasdiqlash', () =>
    assert.deepEqual(reviewReport({ ...base, action: 'approve' }), { ok: true, next: 'approved' }));
  test('rad etish sababsiz mumkin emas', () =>
    assert.deepEqual(reviewReport({ ...base, action: 'reject' }), { ok: false, code: 'note_required' }));
  test('sabab bilan rad etish', () =>
    assert.deepEqual(reviewReport({ ...base, action: 'reject', note: 'Son noto‘g‘ri' }), { ok: true, next: 'rejected' }));
  test('tuzatish so‘rash', () =>
    assert.deepEqual(reviewReport({ ...base, action: 'request_correction', note: 'Qayta tekshiring' }),
      { ok: true, next: 'correction_requested' }));
  test('operator o‘z natijasini tasdiqlay olmaydi', () =>
    assert.deepEqual(reviewReport({ ...base, reviewerId: 'op', action: 'approve' }), { ok: false, code: 'self_review' }));
  test('operator roli tasdiqlay olmaydi', () =>
    assert.deepEqual(reviewReport({ ...base, reviewerRole: 'operator', action: 'approve' }), { ok: false, code: 'not_admin' }));
  test('qayta ko‘rib chiqilgan hisobot qayta tasdiqlanmaydi', () =>
    assert.deepEqual(reviewReport({ ...base, status: 'approved', action: 'approve' }), { ok: false, code: 'not_pending' }));
  test('tuzatish: asl qiymat va tarix saqlanadi', () => {
    const r = correctReport({ acceptedOrders: 62, originalOrders: 62, history: [] }, 58, 'adm', 'Hisob-kitobda xato', 't1');
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.report.acceptedOrders, 58);
      assert.equal(r.report.originalOrders, 62);
      assert.deepEqual(r.report.history, [{ at: 't1', by: 'adm', from: 62, to: 58, note: 'Hisob-kitobda xato' }]);
    }
    assert.deepEqual(correctReport({ acceptedOrders: 1, originalOrders: 1, history: [] }, 5, 'a', ' ', 't'),
      { ok: false, code: 'note_required' });
  });
});

describe('rollarga asoslangan kirish', () => {
  test('kirmagan foydalanuvchi', () => {
    assert.equal(canAccess(null, 'operator'), false);
    assert.equal(canAccess(null, 'admin'), false);
    assert.equal(homeFor(null), '/login');
  });
  test('operator admin panelga kira olmaydi', () => {
    assert.equal(canAccess({ role: 'operator', isActive: true }, 'admin'), false);
    assert.equal(canAccess({ role: 'operator', isActive: true }, 'operator'), true);
  });
  test('admin ikkala qismga kiradi', () => {
    assert.equal(canAccess({ role: 'admin', isActive: true }, 'admin'), true);
    assert.equal(canAccess({ role: 'admin', isActive: true }, 'operator'), true);
  });
  test('nofaol hisob hech qayerga kira olmaydi', () => {
    assert.equal(canAccess({ role: 'admin', isActive: false }, 'admin'), false);
    assert.equal(canAccess({ role: 'operator', isActive: false }, 'operator'), false);
    assert.equal(homeFor({ role: 'operator', isActive: false }), '/login');
  });
  test('rolga qarab yo‘naltirish', () => {
    assert.equal(homeFor({ role: 'admin', isActive: true }), '/admin');
    assert.equal(homeFor({ role: 'operator', isActive: true }), '/');
  });
});

describe('operatorlar reytingi', () => {
  const o = (id: string, totalOrders: number, workedDays: number, greenDays: number): OperatorStats =>
    ({ id, name: id, totalOrders, workedDays, greenDays });
  const data = [o('Anvar', 1800, 30, 28), o('Bobur', 1500, 20, 20), o('Dilnoza', 1800, 25, 20), o('Eldor', 0, 0, 0)];

  test('jami qabul: teng natija — teng o‘rin', () => {
    const r = rankOperators(data, 'total');
    assert.deepEqual(r.map((x) => [x.id, x.rank]), [['Anvar', 1], ['Dilnoza', 1], ['Bobur', 3], ['Eldor', 4]]);
  });
  test('kunlik o‘rtacha ishlangan kunlarni hisobga oladi', () => {
    const r = rankOperators(data, 'average');
    assert.deepEqual(r.map((x) => x.id), ['Bobur', 'Dilnoza', 'Anvar', 'Eldor']); // 75, 72, 60, 0
    assert.equal(r[0].value, 75);
  });
  test('0 kun ishlagan operator o‘rtacha bo‘yicha oxirida', () => {
    assert.equal(rankOperators(data, 'average').at(-1)?.id, 'Eldor');
  });
  test('yashil kunlar', () => {
    const r = rankOperators(data, 'green');
    assert.deepEqual(r.map((x) => [x.id, x.rank]), [['Anvar', 1], ['Bobur', 2], ['Dilnoza', 2], ['Eldor', 4]]);
  });
  test('o‘rtachada teng natija (kasr) — teng o‘rin', () => {
    const r = rankOperators([o('A', 100, 2, 0), o('B', 50, 1, 0), o('C', 10, 1, 0)], 'average');
    assert.deepEqual(r.map((x) => x.rank), [1, 1, 3]);
  });
  test('kirish massivi o‘zgarmaydi', () => {
    const copy = JSON.stringify(data);
    rankOperators(data, 'total');
    assert.equal(JSON.stringify(data), copy);
  });
});

describe('sana va davrlar', () => {
  test('Toshkent vaqti bo‘yicha "bugun"', () => {
    assert.equal(tashkentToday(new Date('2026-11-13T18:59:00Z')), '2026-11-13');
    assert.equal(tashkentToday(new Date('2026-11-13T19:00:00Z')), '2026-11-14');
  });
  test('oylar uzunligi', () => {
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2028, 2), 29);
    assert.equal(daysInMonth(2026, 11), 30);
    assert.equal(daysInMonth(2026, 12), 31);
  });
  test('fevral davri mavjud bo‘lmagan sanalarni yaratmaydi', () => {
    const p = periodForMonth(2026, 2);
    assert.equal(p.days.length, 28);
    assert.equal(p.days.at(-1), '2026-02-28');
  });
  test('oyni almashtirish', () => {
    assert.deepEqual(shiftMonth(2026, 12, 1), { y: 2027, m: 1 });
    assert.deepEqual(shiftMonth(2026, 1, -1), { y: 2025, m: 12 });
  });
  test('kalendar setkasi dushanbadan boshlanadi', () => {
    const g = calendarGrid(periodForMonth(2026, 11)); // 1-noyabr 2026 — yakshanba
    assert.equal(g.slice(0, 6).every((x) => x === null), true);
    assert.equal(g[6], '2026-11-01');
  });
  test('isoRange va format', () => {
    assert.deepEqual(isoRange('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    assert.equal(formatDateUz('2026-11-14'), '14-noyabr, 2026');
  });
});

describe('oylikni yakunlash', () => {
  const period = { start: '2026-11-01', end: '2026-11-30', workingDays: 30 };
  const entries = (status: 'approved' | 'pending'): DayEntry[] =>
    isoRange(period.start, period.end).map((date) => ({ date, kind: 'worked', accepted: 62, status }));

  test('yakunlash: to‘lanadigan summa', () => {
    const r = finalizePayroll({ operatorId: 'op', period, entries: entries('approved'), settings: S, now: 't' });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.snapshot.payableUzs, 2_120_000);
  });
  test('kutilayotgan hisobot bo‘lsa yakunlanmaydi', () => {
    const r = finalizePayroll({ operatorId: 'op', period, entries: entries('pending'), settings: S });
    assert.deepEqual(r, { ok: false, code: 'pending_reports', pending: 30 });
  });
  test('qayta yakunlash bloklanadi', () => {
    const r = finalizePayroll({ operatorId: 'op', period, entries: entries('approved'), settings: S, alreadyFinalized: true });
    assert.deepEqual(r, { ok: false, code: 'already_finalized' });
  });
  test('keyingi sozlama o‘zgarishi yakunlangan oylikni o‘zgartirmaydi', () => {
    const settings = { ...S };
    const r = finalizePayroll({ operatorId: 'op', period, entries: entries('approved'), settings });
    assert.ok(r.ok);
    settings.bonusCoefUzs = 10_000; // keyin o‘zgartirildi
    settings.monthlyTargetUzs = 5_000_000;
    if (r.ok) {
      assert.equal(r.snapshot.payableUzs, 2_120_000);
      assert.equal(r.snapshot.settings.bonusCoefUzs, 2_000);
      assert.equal(Object.isFrozen(r.snapshot), true);
    }
  });
  test('davr bo‘yicha ish kunlari soni sozlamani almashtiradi (28 kunlik fevral)', () => {
    const feb = { start: '2026-02-01', end: '2026-02-28', workingDays: 28 };
    const e: DayEntry[] = [{ date: '2026-02-03', kind: 'absence' }];
    const r = finalizePayroll({ operatorId: 'op', period: feb, entries: e, settings: S });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.snapshot.result.absenceUzs, -71_429); // 2 000 000 / 28
  });
  test('to‘lov holatlari', () => {
    assert.equal(paymentStatus(null, 0, false), 'calculating');
    assert.equal(paymentStatus(2_000_000, 0, false), 'pending_approval');
    assert.equal(paymentStatus(2_000_000, 0, true), 'approved');
    assert.equal(paymentStatus(2_000_000, 500_000, true), 'partially_paid');
    assert.equal(paymentStatus(2_000_000, 2_000_000, true), 'paid');
  });
});
