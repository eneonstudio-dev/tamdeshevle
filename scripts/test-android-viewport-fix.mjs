import fs from 'node:fs';import assert from 'node:assert/strict';
const css=fs.readFileSync(new URL('../android-viewport-fix.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(css,/@media\(max-width:820px\)/);assert.match(css,/\.bai-panel\{position:fixed;left:12px;right:12px/);assert.match(css,/overflow-x:hidden/);assert.match(css,/max-height:calc\(100dvh - 158px\)/);assert.match(html,/android-viewport-fix\.css/);
console.log('Android wide-portrait viewport containment passed.');
