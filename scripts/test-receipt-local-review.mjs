import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../receipt-local-review.js', import.meta.url), 'utf8');

assert.match(source, /rankable:false/);
assert.match(source, /proof_verified:false/);
assert.match(source, /reviewed_local/);
assert.match(source, /needs_fix/);
assert.match(source, /TDReceiptLocalReview/);
assert.doesNotMatch(source, /TDReceiptPriceAdapter\.(apply|promote|write)/);
assert.doesNotMatch(source, /scope_verified\s*:\s*true/);

console.log('receipt local review safety: ok');
