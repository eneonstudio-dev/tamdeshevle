import fs from 'node:fs';
import assert from 'node:assert/strict';

const visual=fs.readFileSync('ai-shopping-visual-v3.js','utf8');
const runtime=fs.readFileSync('votonobay-roxy-runtime-states-v1.js','utf8');
const css=fs.readFileSync('votonobay-roxy-runtime-states-v1.css','utf8');

assert.match(visual,/votonobay-roxy-runtime-states-v1\.js/);
assert.match(runtime,/bai-curious-approved-v1\.webp/);
assert.match(runtime,/bai-checking-approved-v1\.webp/);
assert.match(runtime,/bai-suspicious-approved-v1\.webp/);
assert.match(runtime,/bai-sleeping-approved-v1\.webp/);
assert.match(runtime,/data-bai-runtime-state/);
assert.match(runtime,/roxy-runtime-state-visual/);
assert.match(css,/data-roxy-runtime-state="loading"/);
assert.match(css,/data-roxy-runtime-state="error"/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/background\s*:\s*#fff/i);

console.log('Roxy runtime state visual contract passed');
