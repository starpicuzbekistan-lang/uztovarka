import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccess, homeFor } from './access';

describe('operator/admin only navigation', () => {
  it('operator accesses only operator pages', () => {
    const p = { role: 'operator' as const, isActive: true };
    assert.equal(canAccess(p, 'operator'), true);
    assert.equal(canAccess(p, 'admin'), false);
    assert.equal(homeFor(p), '/');
  });
  it('administrator accesses only administrator pages', () => {
    const p = { role: 'admin' as const, isActive: true };
    assert.equal(canAccess(p, 'admin'), true);
    assert.equal(canAccess(p, 'operator'), false);
    assert.equal(homeFor(p), '/admin');
  });
  it('legacy manager cannot access either area', () => {
    const p = { role: 'manager' as const, isActive: true };
    assert.equal(canAccess(p, 'admin'), false);
    assert.equal(canAccess(p, 'operator'), false);
    assert.equal(homeFor(p), '/login');
  });
  it('inactive users cannot enter', () => {
    assert.equal(canAccess({ role: 'admin', isActive: false }, 'admin'), false);
    assert.equal(canAccess({ role: 'operator', isActive: false }, 'operator'), false);
    assert.equal(homeFor({ role: 'manager', isActive: false }), '/login');
  });
});
