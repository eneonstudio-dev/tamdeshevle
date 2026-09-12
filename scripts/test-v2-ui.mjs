import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8"),ui=fs.readFileSync("v2-shell.js","utf8"),css=fs.readFileSync("v2-shell.css","utf8"),cinema=fs.readFileSync("v2-cinematic.css","utf8"),bai=fs.readFileSync("bai-assistant.js","utf8");
const bayFirstCss=fs.readFileSync("votonobay-bay-first.css","utf8"),touchCss=fs.readFileSync("touch-layout-fix.css","utf8");
const historyUi=fs.readFileSync("price-history.js","utf8"),substitutions=fs.readFileSync("smart-substitutions.js","utf8");
const app=fs.readFileSync("app.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8"),mobileDock=fs.readFileSync("v2-mobile-dock.js","utf8"),life=fs.readFileSync("bai-life.js","utf8"),decisionHandoff=fs.readFileSync("bai-decision-handoff-v1.js","utf8");
const cards=fs.readFileSync("cards.css","utf8"),brand=fs.readFileSync("brand-votonobay-v1.js","utf8"),brandCss=fs.readFileSync("votonobay-brand-v1.css","utf8"),manifest=JSON.parse(fs.readFileSync("manifest.json","utf8"));
new Function(ui);new Function(bai);new Function(decisionHandoff);
assert.match(html,/v2-shell\.css\?v=/);assert.match(html,/v2-shell\.js\?v=/);
assert.match(html,/v2-cinematic\.css\?v=/);assert.match(html,/v2-polish\.js\?v=/);
for(const component of ["Header","HeroSearch","StoreStrip","ProductGrid","ProductCard","ShoppingList","Footer","MobileDock"])assert.match(ui,new RegExp(`function ${component}\\(`));
for(const action of ["tdBayFirstAsk","tdBayFirstSelfSearch","tdV2Search","tdV2Quick","tdV2Menu","tdV2About"])assert.match(ui,new RegExp(`window\\.${action}`));
assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 310px/);
assert.match(css,/\.phone\{max-width:none!important\}/);
assert.match(cinema,/--v2-canvas:#06110c/);assert.match(cinema,/\.v2-hero-bai/);assert.match(cinema,/\.v2-bottom-nav/);
assert.match(cinema,/body \.td-account/);assert.match(cinema,/grid-template-columns:60px minmax\(0,1fr\) auto/);
assert.match(life,/micro-blink/);assert.match(life,/bai-decision-handoff-v1\.js/);assert.match(html,/bai-life\.js\?v=/);
assert.match(mobileDock,/Мобильная навигация/);assert.match(html,/v2-mobile-dock\.js\?v=/);
assert.match(mobileDock,/document\.querySelectorAll\("\.v2-bottom-nav"\)/);assert.match(mobileDock,/dock!==nav\)dock\.remove\(\)/);
assert.match(mobileDock,/aria-current/);assert.match(mobileDock,/type="button"/);
assert.doesNotMatch(mobileDock,/MutationObserver/);
assert.match(ui,/≈ — ориентир, подтверждённые цены отмечаем отдельно/);assert.match(ui,/Помогаем решить, как лучше купить/);
assert.match(ui,/Votonobay — на главную/);assert.match(ui,/Покупки\. <em>Как лучше\.<\/em>/);assert.match(ui,/Спросить Бая/);assert.match(ui,/Искать самому/);assert.match(ui,/Что лучше выбрать\?/);assert.match(ui,/Сравнить варианты/);
assert.match(ui,/window\.TDShoppingAssistant\?\.open/);assert.match(ui,/Что хочешь решить\?/);assert.match(ui,/цене, удобству и времени|Цена, удобство и время|цены, удобству и времени/);
assert.match(touchCss,/votonobay-bay-first\.css/);assert.match(bayFirstCss,/\.v2-hero\.v2-bay-first/);assert.match(bayFirstCss,/\.v2-bay-primary/);assert.match(bayFirstCss,/@media\(min-width:821px\)\{\.td-ai/);
assert.match(brand,/const BRAND="Votonobay"/);assert.match(brand,/помога(ет|ем) решить, как лучше/i);assert.match(brandCss,/body\.td-votonobay/);assert.doesNotMatch(brand,/td-ai-|TDBai|bai-/);
for(const state of ["idle","greeting","peek","curious","checking","thinking","suspicious","happy","excited","big-saving","confused","scared","playful","sleepy","sleeping","hidden","goodbye"])assert.match(bai,new RegExp(`["']?${state}["']?\\s*:`));
assert.doesNotMatch(bai,/MutationObserver/);assert.match(bai,/Уложить Бая спать/);assert.match(bai,/bai-tail-peek\.webp/);assert.match(bai,/window\.TDShoppingAssistant\?\.open/);assert.doesNotMatch(bai,/Я Бай\. Чую, где дешевле/);assert.doesNotMatch(bai,/Где корзина дешевле\?/);

// Bai must carry a finished recommendation into an honest retailer handoff without pretending carts were auto-filled.
assert.match(decisionHandoff,/TDShoppingState\?\.get/);assert.match(decisionHandoff,/lastPlans\?\.\[0\]/);assert.match(decisionHandoff,/TDContinueInStoresV1/);assert.match(decisionHandoff,/continue-in-stores-v1\.js/);assert.match(decisionHandoff,/dataBayContinuePlan|bayContinuePlan/);assert.match(decisionHandoff,/Продолжить в/);assert.match(decisionHandoff,/не буду притворяться, что перенёс товары автоматически/);assert.match(decisionHandoff,/фактические цена и наличие подтверждаются/);assert.match(decisionHandoff,/td:bai-handoff-opened/);assert.match(decisionHandoff,/td:shopping-state/);assert.doesNotMatch(decisionHandoff,/MutationObserver/);assert.match(decisionHandoff,/body\.td-votonobay \.td-continue-stores-card/);assert.match(decisionHandoff,/@media\(max-width:520px\)/);

assert.match(historyUi,/tdHistorySignature/);assert.match(substitutions,/dataset\.signature/);
assert.match(app,/function comparisonLead\(/);assert.match(app,/Победителя пока нет/);assert.match(app,/ЛУЧШИЙ ПОДТВЕРЖДЁННЫЙ ВАРИАНТ/);
assert.match(app,/class="brand-home" onclick="go\('home'\)"/);
assert.equal(manifest.name,"Votonobay");assert.equal(manifest.short_name,"Votonobay");assert.equal(manifest.theme_color,"#102018");assert.equal(manifest.background_color,"#050A07");assert.equal(manifest.lang,"ru");assert.equal(manifest.scope,"./");
assert.match(cards,/\.sku-plate img\{[^}]*object-fit:contain/);assert.match(cards,/\.thumb img,\.product-packaging img\{[^}]*object-fit:contain/);
console.log("V2 UI contract passed: native Bay-first shell, decision-to-purchase handoff, self-service fallback, dark responsive styling, honest data labels and PWA identity are wired.");
