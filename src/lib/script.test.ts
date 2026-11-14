import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderScript, segmentsToPlain, hasMissing, type ScriptSetData } from './script';
import { humanError, validatePassword, validateEmail } from './uz';
import { formatUzs, formatSigned, formatAvg } from './format';

const set: ScriptSetData = {
  name: 'SET-01', code: 'SET-01', priceUzs: 149000, deliveryInfo: 'Toshkent bo‘ylab 1–2 kun',
  items: [{ name: 'Karbon lenta', quantity: 4, isBonus: false }, { name: 'Sochiq', quantity: 1, isBonus: true }],
};

describe('skript o‘rinbosarlari', () => {
  test('nabor ma’lumoti joylanadi', () => {
    const s = renderScript('{{nabor_nomi}}: {{narx}}. {{yetkazib_berish}}', set);
    assert.equal(segmentsToPlain(s), 'SET-01: 149 000 so‘m. Toshkent bo‘ylab 1–2 kun');
    assert.equal(hasMissing(s), false);
  });
  test('tarkib dona bilan', () => {
    assert.equal(segmentsToPlain(renderScript('{{tarkib}}', set)), 'Karbon lenta — 4 dona, Sochiq — 1 dona (sovg‘a)');
  });
  test('narx kiritilmagan bo‘lsa — to‘qib chiqarilmaydi, belgilanadi', () => {
    const s = renderScript('Narxi {{narx}}', { ...set, priceUzs: null });
    assert.equal(hasMissing(s), true);
    assert.match(segmentsToPlain(s), /narx kiritilmagan/);
    assert.doesNotMatch(segmentsToPlain(s), /\d{2,}/);
  });
  test('nabor biriktirilmagan bo‘lsa — hammasi belgilanadi', () => {
    assert.equal(renderScript('{{narx}} {{yetkazib_berish}}', null).filter((x) => x.missing).length, 2);
  });
  test('noma’lum o‘rinbosar o‘zgarmaydi', () => {
    assert.equal(segmentsToPlain(renderScript('{{boshqa}}', set)), '{{boshqa}}');
  });
  test('o‘rinbosarsiz matn o‘zgarmaydi', () => {
    assert.equal(segmentsToPlain(renderScript('Assalomu alaykum', set)), 'Assalomu alaykum');
  });
});

describe('xabar va tekshiruvlar (o‘zbekcha)', () => {
  test('texnik xato foydalanuvchiga ko‘rsatilmaydi', () => {
    assert.equal(humanError(new Error('relation "x" does not exist')), 'Xatolik yuz berdi. Qayta urinib ko‘ring.');
  });
  test('kirish xatosi', () => assert.equal(humanError({ message: 'Invalid login credentials' }), 'Email yoki parol noto‘g‘ri.'));
  test('tarmoq xatosi', () => assert.match(humanError(new TypeError('Failed to fetch')), /Internet aloqasi/));
  test('RPC o‘zbekcha xabari o‘tkaziladi', () =>
    assert.equal(humanError({ code: '23505', message: 'Bu sana uchun hisobot allaqachon topshirilgan' }), 'Bu sana uchun hisobot allaqachon topshirilgan'));
  test('parol qoidalari', () => {
    assert.notEqual(validatePassword('abc'), null);
    assert.notEqual(validatePassword('abcdefgh1'), null);
    assert.notEqual(validatePassword('Abcdefgh'), null);
    assert.equal(validatePassword('Abcdefg1'), null);
  });
  test('email tekshiruvi', () => {
    assert.notEqual(validateEmail(''), null);
    assert.notEqual(validateEmail('foo@'), null);
    assert.equal(validateEmail('ali@uztovarka.uz'), null);
  });
});

describe('formatlash', () => {
  test('so‘m', () => assert.equal(formatUzs(2000000).replace(/ /g, ' '), '2 000 000 so‘m'));
  test('ishorali', () => {
    assert.equal(formatSigned(4000).replace(/ /g, ' '), '+4 000 so‘m');
    assert.equal(formatSigned(-10000).replace(/ /g, ' '), '−10 000 so‘m');
    assert.equal(formatSigned(0), '0 so‘m');
  });
  test('o‘rtacha', () => { assert.equal(formatAvg(62.04), '62'); assert.equal(formatAvg(61.26), '61.3'); });
});
