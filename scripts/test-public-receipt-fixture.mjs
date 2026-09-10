import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { window: {}, console, Date, Number, Set, String, Array, Object, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync('receipt-observations.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('receipt-verification.js', 'utf8'), context);

const fixture = JSON.parse(fs.readFileSync('fixtures/public-magnit-receipt.sample.json', 'utf8'));
const observation = fixture.observation;
assert.equal(fixture.fixture_only, true);
assert.equal(context.window.TDReceiptObservations.validate(observation).ok, true);
assert.equal(observation.verification.store_scope_verified, false);
const result = context.window.TDReceiptVerification.promote(observation, { now: '2026-09-11T00:00:00Z' });
assert.equal(result.gate.ok, false);
assert.ok(result.gate.reasons.includes('exact store scope required'));
assert.ok(result.gate.reasons.includes('receipt is stale'));
assert.equal(result.candidates.length, 0);

console.log('public receipt fixture stays safely outside ranking');
