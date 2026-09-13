import fs from 'node:fs';
import assert from 'node:assert/strict';

const visual = fs.readFileSync('ai-shopping-visual-v3.js', 'utf8');
const hints = fs.readFileSync('votonobay-roxy-catalog-hints-v1.js', 'utf8');
const css = fs.readFileSync('votonobay-roxy-catalog-hints-v1.css', 'utf8');

assert.match(visual, /votonobay-roxy-catalog-hints-v1\.js/);
assert.match(hints, /\.voto-catalog-search/);
assert.match(hints, /bai-curious-approved-v1\.webp/);
assert.match(hints, /Смотри на корзину целиком\./);
assert.match(hints, /Проверить с Баем/);
assert.match(hints, /dismissed=true/);
assert.match(css, /\.roxy-catalog-bay-hint/);
assert.doesNotMatch(css, /position\s*:\s*fixed/i);
assert.match(css, /min-height:44px/);
assert.match(css, /@media\(max-width:700px\)/);

console.log('Roxy catalog hint contract passed');
