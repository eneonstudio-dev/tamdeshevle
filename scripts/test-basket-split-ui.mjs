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
assert.match(ui,/Продолжить в двух магазинах →/);assert.match(ui,/continue-in-stores-v1\.js/);assert.match(ui,/source: "basket-split"/);
assert.match(ui,/channel => channel !== "shelf"/);assert.match(ui,/Для разделённой доставки пока не показываем кнопку оформления/);
assert.match(ui,/Товары добавляешь на стороне сети вручную/);assert.doesNotMatch(ui,/автоматически перенес/);
assert.doesNotMatch(ui,/Эксперимент · 2 магазина/);assert.doesNotMatch(ui,/товара\(ов\)/);
assert.match(css,/linear-gradient\(145deg,#101814,#14231b\)/);assert.match(css,/\.split-basket__continue/);assert.match(css,/@media\(max-width:520px\)/);
console.log('Basket split UI contract passed: honest one-vs-two store comparison, explicit shelf handoff, delivery fail-closed and Votonobay styling.');
