import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8");
const js=fs.readFileSync("votonobay-inner-v1.js","utf8");
const css=fs.readFileSync("votonobay-inner-v1.css","utf8");

new Function(js);

assert.match(html,/votonobay-inner-v1\.css\?v=/,"inner screen styles must load from the document head");
assert.match(html,/votonobay-inner-v1\.js\?v=/,"inner screen runtime must load after the shopping shell");
assert.match(js,/app-store-guard\.js/,"inner runtime must load the non-Bai store-state guard");
assert.match(js,/td:v2-rendered/,"inner screen layer must follow the existing render lifecycle");
assert.doesNotMatch(js,/MutationObserver/,"inner screen layer must not add a DOM observer loop");
assert.doesNotMatch(js,/TDBai|bai:|bai-|\.td-ai|assets\/bai/,"inner screen layer must not modify Bai");
assert.doesNotMatch(css,/\.td-ai|bai-|assets\/bai/,"inner screen styles must not target Bai");
assert.match(js,/Решение по корзине/,"comparison screen must use the Votonobay decision framing");
assert.match(js,/Решить по корзине/,"cart CTA must lead to a decision rather than generic comparison");
assert.doesNotMatch(js,/Сравнить варианты/,"inner journey must not fall back to the old comparison-only CTA");
assert.match(js,/Собери список — Votonobay оценит корзину целиком/,"catalog must explain whole-basket evaluation");
assert.match(js,/placeholder="Найти товар"|input\.placeholder="Найти товар"/,"catalog search must use a direct product-search prompt");
assert.match(js,/Votonobay сам ничего не везёт/,"comparison disclaimer must use the current master brand");
assert.match(js,/type="search"|input\.type="search"/,"catalog search must expose search semantics");
assert.match(js,/aria-pressed/,"purchase mode toggle must expose its state accessibly");
assert.match(js,/Минимальный заказ сети не подтверждён — вариант вне рейтинга/,"unknown delivery minimum must be explained visibly");
assert.match(js,/Тариф доставки сети не подтверждён — вариант вне рейтинга/,"unknown delivery fee must be explained visibly");
assert.match(js,/До минимального заказа не хватает/,"known minimum shortfall must be explained visibly");
assert.match(js,/TDCompare\?\.fromWindow/,"delivery constraint copy must be driven by the same comparison result as ranking");
assert.match(js,/Оценка здесь/,"cart must downgrade an operationally incomplete delivery from confirmed total to estimate");
assert.match(js,/indicativeTotal/,"cart may expose the known arithmetic only as an indicative amount");
assert.match(css,/--voto-bg:#050a07/,"inner screens must use the approved near-black Votonobay base");
assert.match(css,/--voto-mint:#2be487/,"inner screens must use the restrained mint semantic accent");
assert.match(css,/color-scheme:dark/,"inner screens must render native controls in the dark theme");
assert.doesNotMatch(css,/body\.td-votonobay-inner\{background:#e8ece8/,"legacy light inner shell must not return");
assert.match(css,/body\.td-votonobay-inner \.item,body\.td-votonobay-inner \.product-card\{[^}]*background:linear-gradient/,"catalog and cart cards must stay in the dark surface system");
assert.match(css,/body\.td-votonobay-inner \.thumb,body\.td-votonobay-inner \.product-packaging\{background:#f2f5f2/,"product photography must keep a neutral light plate for legibility");
assert.match(css,/body\.td-votonobay-inner \.dock\{[^}]*background:rgba\(8,17,12,.94\)/,"cart dock must stay dark instead of reverting to the legacy light sheet");
assert.match(css,/body\.td-votonobay-inner \.plan\.best\{[^}]*rgba\(43,228,135,.38\)/,"recommended plans must use mint hierarchy rather than a generic white card");
assert.match(css,/\.voto-delivery-constraint/,"delivery constraint explanation must have a dedicated readable treatment");
assert.match(css,/\.voto-cart-constraint/,"cart delivery constraint must have a dedicated readable treatment");
assert.match(css,/body\[data-votonobay-screen="stores"\] \.wrap\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"store choice must use a desktop grid");
assert.match(css,/body\[data-votonobay-screen="catalog"\] \.products\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"catalog must use a desktop grid");
assert.match(css,/@media\(max-width:780px\)/,"inner screen layer must collapse cleanly for mobile");
assert.match(css,/prefers-reduced-motion:reduce/,"inner screen motion must respect reduced-motion preferences");

console.log("Votonobay inner UI tests passed: stores, catalog, cart and decision share the dark/mint product system, stay accessible, explain delivery constraints and remain independent of Bai.");
