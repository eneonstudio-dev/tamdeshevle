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

assert.match(js,/Как лучше купить/,"comparison screen must use a purchase-decision heading instead of cheaper-only framing");
assert.match(js,/Собери нужное — дальше сравним цену, способ покупки и удобство/,"catalog must explain the full purchase decision");
assert.match(js,/Решить, как лучше купить/,"cart primary CTA must lead to a decision, not a cheaper-only comparison");
assert.match(js,/Проверить →/,"catalog cart shortcut must avoid turning savings into the only goal");
assert.match(js,/Есть вариант с экономией .*проверим, стоит ли переключаться/,"savings must be framed as a tradeoff to evaluate");
assert.match(js,/Добавь нужные товары — Votonobay сравнит цену, способ покупки и удобство/,"empty cart must teach the current product promise");
assert.match(js,/Добавляй то, что реально нужно/,"catalog must explain whole-basket shopping before the product grid");
assert.match(js,/без трюка с одной дешёвой позицией/,"catalog must reject isolated cheapest-item framing");
assert.match(js,/рекомендую/,"best comparison option must be expressed as a recommendation");
assert.match(js,/Почему этот вариант/,"comparison explanation must use decision-oriented copy");
assert.match(js,/Votonobay сам ничего не везёт/,"comparison disclaimer must use the current master brand");

assert.match(js,/voto-screen-intro/,"catalog must have a dedicated decision-first intro surface");
assert.match(js,/voto-product-row/,"catalog product rows must receive a stable Votonobay surface hook");
assert.match(js,/voto-product-card/,"catalog product cards must receive semantic state hooks");
assert.match(js,/is-in-cart/,"catalog must visibly distinguish products already in the cart");
assert.match(js,/voto-empty-state/,"catalog search must expose a useful recovery state");
assert.match(js,/Сбросить поиск/,"empty search must offer a direct recovery action");
assert.match(js,/voto-cart-summary/,"legacy inline cart total must receive a semantic Votonobay surface hook");
assert.match(js,/voto-cart-item/,"cart rows must receive a stable dark-surface hook");
assert.match(js,/voto-option-card/,"comparison options must receive semantic decision hooks");
assert.match(js,/voto-decision-lead/,"comparison verdict must be marked as the primary decision block");

assert.match(js,/type="search"|input\.type="search"/,"catalog search must expose search semantics");
assert.match(js,/aria-pressed/,"purchase mode toggle must expose its state accessibly");
assert.match(js,/Минимальный заказ сети не подтверждён — вариант вне рейтинга/,"unknown delivery minimum must be explained visibly");
assert.match(js,/Тариф доставки сети не подтверждён — вариант вне рейтинга/,"unknown delivery fee must be explained visibly");
assert.match(js,/До минимального заказа не хватает/,"known minimum shortfall must be explained visibly");
assert.match(js,/TDCompare\?\.fromWindow/,"delivery constraint copy must be driven by the same comparison result as ranking");
assert.match(js,/Оценка здесь/,"cart must downgrade an operationally incomplete delivery from confirmed total to estimate");
assert.match(js,/indicativeTotal/,"cart may expose the known arithmetic only as an indicative amount");

assert.match(css,/color-scheme:dark/,"inner shopping surfaces must be dark-first");
assert.match(css,/--voto-bg:#050a07/,"inner surfaces must use the approved near-black base");
assert.match(css,/--voto-mint:#2be487/,"inner surfaces must use the restrained mint semantic accent");
assert.match(css,/\.voto-screen-intro/,"catalog intro must have a dedicated visual treatment");
assert.match(css,/\.voto-product-card\.is-in-cart/,"in-cart product state must be visible");
assert.match(css,/\.voto-empty-state/,"catalog empty state must be styled");
assert.match(css,/\.td-product-trust/,"retailer trust metadata must be integrated into the dark visual system");
assert.match(css,/\.td-retailer-name/,"retailer metadata must not remain a light island");
assert.match(css,/\.voto-cart-summary\{background:rgba\(255,255,255,\.045\)!important/,"cart total must override the old white inline card");
assert.match(css,/\.voto-cart-opportunity\{background:rgba\(43,228,135,\.085\)!important/,"cart opportunity must live in the dark Votonobay visual system");
assert.match(css,/\.voto-delivery-constraint/,"delivery constraint explanation must have a dedicated readable treatment");
assert.match(css,/\.voto-cart-constraint/,"cart delivery constraint must have a dedicated readable treatment");
assert.match(css,/body\[data-votonobay-screen="stores"\] \.wrap\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"store choice must use a desktop grid");
assert.match(css,/body\[data-votonobay-screen="catalog"\] \.products\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"catalog must use a desktop grid");
assert.match(css,/@media\(max-width:780px\)/,"inner screen layer must collapse cleanly for mobile");
assert.match(css,/env\(safe-area-inset-bottom\)/,"mobile shopping dock must respect device safe areas");
assert.match(css,/min-width:44px!important/,"mobile quantity controls must keep touch targets usable");
assert.match(css,/prefers-reduced-motion:reduce/,"inner screen motion must respect reduced-motion preferences");

console.log("Votonobay inner UI tests passed: dark decision-first self-service, catalog/cart recovery states, trust metadata, mobile-safe controls, truthful delivery constraints and no Bai coupling.");
