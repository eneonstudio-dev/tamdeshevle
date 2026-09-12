import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('basket-split-ui.js','utf8');
const css=fs.readFileSync('basket-split.css','utf8');
const html=fs.readFileSync('index.html','utf8');

new Function(ui);
assert.match(html,/basket-split\.css/);assert.match(html,/basket-split-ui\.js/);
assert.match(ui,/ВАРИАНТ · ДВА МАГАЗИНА/);assert.match(ui,/Разделить корзину между двумя магазинами/);
assert.match(ui,/Дорога и время второго магазина пока не учтены/);assert.match(ui,/не оформляет два заказа автоматически/);
assert.match(ui,/hasConfiguredCost/);assert.match(ui,/используются только подтверждённые цены/);
assert.doesNotMatch(ui,/Эксперимент · 2 магазина/);assert.doesNotMatch(ui,/товара\(ов\)/);
assert.match(css,/linear-gradient\(145deg,#101814,#14231b\)/);assert.match(css,/@media\(max-width:520px\)/);
console.log('Basket split UI contract passed: honest one-vs-two store comparison, explicit travel-cost state and Votonobay styling.');
