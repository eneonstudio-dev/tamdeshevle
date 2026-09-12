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

assert.match(js,/Как лучше купить/,"comparison screen must frame the result as a purchase decision");
assert.match(js,/Решить, как купить/,"cart must lead into a decision instead of a cheapest-only comparison");
assert.match(js,/Собери корзину — Votonobay поможет выбрать лучший способ покупки/,"catalog must explain whole-basket decision support");
assert.match(js,/Есть вариант лучше:/,"cart savings must be presented as one reason to choose a better option");
assert.match(js,/рекомендую/,"best comparison plan must use recommendation language");
assert.match(js,/Почему этот вариант/,"comparison rationale action must read as decision support");
assert.doesNotMatch(js,/Где выгоднее|где дешевле/i,"canonical inner runtime must not regress to cheapest-only framing");
assert.match(js,/Votonobay сам ничего не везёт/,"comparison disclaimer must use the current master brand");

assert.match(js,/type="search"|input\.type="search"/,"catalog search must expose search semantics");
assert.match(js,/aria-pressed/,"purchase mode toggle must expose its state accessibly");
assert.match(js,/Минимальный заказ сети не подтверждён — вариант вне рейтинга/,"unknown delivery minimum must be explained visibly");
assert.match(js,/Тариф доставки сети не подтверждён — вариант вне рейтинга/,"unknown delivery fee must be explained visibly");
assert.match(js,/До минимального заказа не хватает/,"known minimum shortfall must be explained visibly");
assert.match(js,/TDCompare\?\.fromWindow/,"delivery constraint copy must be driven by the same comparison result as ranking");
assert.match(js,/Оценка здесь/,"cart must downgrade an operationally incomplete delivery from confirmed total to estimate");
assert.match(js,/indicativeTotal/,"cart may expose the known arithmetic only as an indicative amount");

assert.match(css,/body\.td-votonobay-inner\{background:#050a07/,"inner screens must use the canonical near-black Votonobay canvas");
assert.match(css,/\.phone\{max-width:none!important;min-height:100vh;background:radial-gradient/,"inner app shell must remain dark instead of returning to the legacy light canvas");
assert.match(css,/\.item\{margin:0;border:1px solid rgba\(255,255,255,\.07\);border-radius:20px;background:linear-gradient/,"catalog and cart cards must use dark Votonobay surfaces");
assert.match(css,/\.plan\{border:1px solid rgba\(255,255,255,\.07\);border-radius:22px;background:linear-gradient/,"comparison plans must use dark Votonobay surfaces");
assert.match(css,/\.dock\{left:50%;width:min\(820px,calc\(100% - 32px\)\);bottom:14px;.*background:rgba\(7,16,11,\.94\)/,"cart action dock must stay dark and legible");
assert.match(css,/\.voto-cart-better/,"better-option explanation must have a dedicated dark mint treatment");
assert.match(css,/\.voto-delivery-constraint/,"delivery constraint explanation must have a dedicated readable treatment");
assert.match(css,/\.voto-cart-constraint/,"cart delivery constraint must have a dedicated readable treatment");
assert.match(css,/body\[data-votonobay-screen="stores"\] \.wrap\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"store choice must use a desktop grid");
assert.match(css,/body\[data-votonobay-screen="catalog"\] \.products\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"catalog must use a desktop grid");
assert.match(css,/@media\(max-width:780px\)/,"inner screen layer must collapse cleanly for mobile");
assert.match(css,/env\(safe-area-inset-bottom\)/,"mobile cart dock must respect device safe area");
assert.match(css,/prefers-reduced-motion:reduce/,"inner screen motion must respect reduced-motion preferences");

console.log("Votonobay inner UI tests passed: dark catalog/cart/compare surfaces, better-choice framing, visible constraints, accessible controls and no Bai coupling.");
