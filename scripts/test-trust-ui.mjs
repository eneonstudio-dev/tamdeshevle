import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../profile-basket.js',import.meta.url),'utf8');
const covers=fs.readFileSync(new URL('../store-covers.js',import.meta.url),'utf8');

assert.match(app,/p\.rankable/,'best badge must depend on ranking eligibility');
assert.match(app,/оценка · вне рейтинга/,'estimated basket must be disclosed outside the ranking');
assert.match(app,/Оценка здесь/,'cart must label an unverified total as an estimate');
assert.match(app,/≈ /,'estimated totals must have an approximation marker');
assert.match(app,/function displayPrice/,'item prices must use provenance-aware formatting');
assert.match(app,/verified \? "" : "≈ "/,'unverified item prices must be visibly approximate');
assert.match(profile,/quote\.verifiedComplete/,'daily basket history must require fully verified prices');
assert.match(profile,/verified:true/,'saved history must retain verification provenance');
assert.doesNotMatch(covers,/молоко 72 ₽|яйца 115 ₽|−187 ₽ корзина/,'home hero must not present invented prices as live facts');

console.log('Trust UI checks passed: educational totals are estimates, stay outside ranking, and never enter verified price history.');
