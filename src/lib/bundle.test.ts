import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDiscount, getPreview } from './bundle';

test('Nabor foizli chegirma hisobini tekshiradi', () => {
  assert.equal(getDiscount(160000, 'percent', 10), 16000);
  assert.equal(getPreview(160000, 'percent', 10, 0).total, 144000);
});
test('Belgilangan summa chegirmasi 0 dan pastga tushirmaydi', () => {
  assert.equal(getDiscount(10000, 'fixed', 50000), 10000);
  assert.equal(getPreview(10000, 'fixed', 50000, 0).total, 0);
});
test('Manfiy, noto‘g‘ri qiymatlar chegirmaga aylanmaydi', () => {
  assert.equal(getDiscount(10000, 'percent', -5), 0);
  assert.equal(getDiscount(10000, 'fixed', NaN), 0);
  assert.equal(getDiscount(10000, 'none', 20), 0);
});
