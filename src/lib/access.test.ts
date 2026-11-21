import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccess, homeFor } from './access';
describe('manager must be a separate restricted role',()=>{
 it('manager may access only manager area',()=>{
  const p={role:'manager' as const,isActive:true};
  assert.equal(canAccess(p,'manager'),true);
  assert.equal(canAccess(p,'operator'),false);
  assert.equal(canAccess(p,'admin'),false);
  assert.equal(homeFor(p),'/manager');
 });
 it('operator and admin remain restricted',()=>{
  assert.equal(canAccess({role:'operator',isActive:true},'admin'),false);
  assert.equal(canAccess({role:'operator',isActive:true},'manager'),false);
  assert.equal(canAccess({role:'admin',isActive:true},'manager'),false);
  assert.equal(canAccess({role:'admin',isActive:true},'admin'),true);
 });
 it('inactive manager is denied',()=>{
  const p={role:'manager' as const,isActive:false};
  assert.equal(canAccess(p,'manager'),false);
  assert.equal(homeFor(p),'/login');
 });
});
