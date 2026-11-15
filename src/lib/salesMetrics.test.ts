import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percent, salesIndicators } from './salesMetrics';

test('Savdo konversiyalari hisoblanadi', () => {
  assert.deepEqual(salesIndicators(500,230,100,10), {
    acceptanceConversion: 46, salesFromAccepted: 43.5, salesFromUnique: 20,
    unsoldAccepted: 130, dailyAverageCalls: 50, dailyAverageSales: 10,
  });
});
test('Nol maxrajga bo‘lish yo‘q', () => {
  assert.equal(percent(0,0),null);
  assert.equal(salesIndicators(0,0,0,0).dailyAverageSales,null);
});
