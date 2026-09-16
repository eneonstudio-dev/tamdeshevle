import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8"),ui=fs.readFileSync("v2-shell.js","utf8"),css=fs.readFileSync("v2-shell.css","utf8"),cinema=fs.readFileSync("v2-cinematic.css","utf8"),bai=fs.readFileSync("bai-assistant.js","utf8");
const bayFirstCss=fs.readFileSync("votonobay-bay-first.css","utf8"),touchCss=fs.readFileSync("touch-layout-fix.css","utf8");
const historyUi=fs.readFileSync("price-history.js","utf8"),substitutions=fs.readFileSync("smart-substitutions.js","utf8");
const app=fs.readFileSync("app.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8"),mobileDock=fs.readFileSync("v2-mobile-dock.js","utf8"),life=fs.readFileSync("bai-life.js","utf8"),decisionHandoff=fs.readFileSync("votonobay-decision-handoff-v1.js","utf8");
const cards=fs.readFileSync("cards.css","utf8"),brand=fs.readFileSync("brand-votonobay-v1.js","utf8"),brandCss=fs.readFileSync("votonobay-brand-v1.css","utf8"),manifest=JSON.parse(fs.readFileSync("manifest.json","utf8"));
const aiVisual=fs.readFileSync("ai-shopping-visual-v3.js","utf8"),roxyBayCss=fs.readFileSync("votonobay-roxy-bay-panel-v1.css","utf8"),roxyBayJs=fs.readFileSync("votonobay-roxy-bay-panel-v1.js","utf8");
const roxyCatalogJs=fs.readFileSync("votonobay-roxy-catalog-hints-v1.js","utf8"),roxyCatalogCss=fs.readFileSync("votonobay-roxy-catalog-hints-v1.css","utf8");
const roxyRuntimeJs=fs.readFileSync("votonobay-roxy-runtime-states-v1.js","utf8"),roxyRuntimeCss=fs.readFileSync("votonobay-roxy-runtime-states-v1.css","utf8");
const roxyMotionJs=fs.readFileSync("votonobay-roxy-motion-polish-v1.js","utf8"),roxyMotionCss=fs.readFileSync("votonobay-roxy-motion-polish-v1.css","utf8");
new Function(ui);new Function(bai);new Function(decisionHandoff);new Function(roxyBayJs);new Function(roxyCatalogJs);new Function(roxyRuntimeJs);new Function(roxyMotionJs);
assert.match(html,/v2-shell\.css\?v=/);assert.match(html,/v2-shell\.js\?v=/);
assert.match(html,/v2-cinematic\.css\?v=/);assert.match(html,/v2-polish\.js\?v=/);
assert.match(html,/<title>VOTONOBAI — как лучше собрать корзину<\/title>/);assert.match(html,/meta name="description" content="VOTONOBAI /);
for(const component of ["Header","HeroSearch","StoreStrip","ProductGrid","ProductCard","ShoppingList","Footer","MobileDock"])assert.match(ui,new RegExp(`function ${component}\\(`));
for(const action of ["tdBayFirstAsk","tdBayFirstSelfSearch","tdV2Search","tdV2Quick","tdV2Menu","tdV2About"])assert.match(ui,new RegExp(`window\\.${action}`));
assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 310px/);
assert.match(css,/\.phone\{max-width:none!important\}/);
assert.match(cinema,/--v2-canvas:#06110c/);assert.match(cinema,/\.v2-hero-bai/);assert.match(cinema,/\.v2-bottom-nav/);
assert.match(cinema,/body \.td-account/);assert.match(cinema,/grid-template-columns:60px minmax\(0,1fr\) auto/);
assert.match(life,/micro-blink/);assert.match(html,/bai-life\.js\?v=/);assert.match(polish,/votonobay-decision-handoff-v1\.js/);assert.match(polish,/data-votonobay-decision-handoff|votonobayDecisionHandoff/);
assert.match(mobileDock,/Мобильная навигация/);assert.match(html,/v2-mobile-dock\.js\?v=/);
assert.match(mobileDock,/document\.querySelectorAll\("\.v2-bottom-nav"\)/);assert.match(mobileDock,/dock!==nav\)dock\.remove\(\)/);
assert.match(mobileDock,/aria-current/);assert.match(mobileDock,/type="button"/);
assert.doesNotMatch(mobileDock,/MutationObserver/);
assert.match(ui,/≈ — ориентир, подтверждённые цены отмечаем отдельно/);assert.match(ui,/Помогаем решить, как лучше купить/);
assert.match(ui,/function Brand\(/);assert.match(ui,/Покупки\. <em>Как лучше\.<\/em>/);assert.match(ui,/Спросить Бая/);assert.match(ui,/Искать самому/);assert.match(ui,/Что лучше выбрать\?/);assert.match(ui,/Сравнить варианты/);
assert.match(ui,/window\.TDShoppingAssistant\?\.open/);assert.match(ui,/Что хочешь решить\?/);assert.match(ui,/цене, удобству и времени|Цена, удобство и время|цены, удобству и времени/);
assert.match(touchCss,/votonobay-bay-first\.css/);assert.match(bayFirstCss,/\.v2-hero\.v2-bay-first/);assert.match(bayFirstCss,/\.v2-bay-primary/);assert.match(bayFirstCss,/@media\(min-width:821px\)\{\.td-ai/);
assert.match(brand,/const BRAND="VOTONOBAI"/);assert.match(brand,/VOTONO<b>BAI<\/b>/);assert.match(brand,/document\.title=TITLE/);assert.match(brand,/description\.content=DESCRIPTION/);assert.match(brand,/tuneExactLegacyTokens/);assert.match(brand,/помога(ет|ем) решить, как лучше/i);assert.match(brandCss,/body\.td-votonobay/);assert.doesNotMatch(brand,/td-ai-|TDBai|bai-/);
for(const state of ["idle","greeting","peek","curious","checking","thinking","suspicious","happy","excited","big-saving","confused","scared","playful","sleepy","sleeping","hidden","goodbye"])assert.match(bai,new RegExp(`["']?${state}["']?\\s*:`));
assert.doesNotMatch(bai,/MutationObserver/);assert.match(bai,/Уложить Бая спать/);assert.match(bai,/bai-tail-peek\.webp/);assert.match(bai,/window\.TDShoppingAssistant\?\.open/);assert.doesNotMatch(bai,/Я Бай\. Чую, где дешевле/);assert.doesNotMatch(bai,/Где корзина дешевле\?/);

// Approved Roxy Bay conversation: late visual decorator only, no shopping logic fork.
assert.match(aiVisual,/votonobay-roxy-bay-panel-v1\.js/);
assert.match(roxyBayJs,/data-roxy-bay-panel-style/);
assert.match(roxyBayJs,/готов помочь/);
assert.match(roxyBayJs,/roxy-bay-sheet-toggle/);
assert.match(roxyBayJs,/TDShoppingAssistant/);
assert.match(roxyBayJs,/__roxyBayWrapped/);
assert.doesNotMatch(roxyBayJs,/TDShoppingState|shopping-optimizer|provider|ranking|price/i);
assert.match(roxyBayCss,/Desktop: Bai is a side room/);
assert.match(roxyBayCss,/width:min\(438px,42vw\)!important/);
assert.match(roxyBayCss,/Mobile: approved mini-Bai sheet/);
assert.match(roxyBayCss,/height:min\(68dvh,620px\)!important/);
assert.match(roxyBayCss,/inset:0 0 calc\(62px \+ env\(safe-area-inset-bottom\)\) 0!important/);
assert.match(roxyBayCss,/data-roxy-bay-expanded="1"/);
assert.match(roxyBayCss,/\.td-ai-summary \.td-ai-line/);
assert.doesNotMatch(roxyBayCss,/background:#fff!important|background:white!important/i);

// Approved self-service catalog: Bay stays subtle, useful and in normal document flow.
assert.match(aiVisual,/votonobay-roxy-catalog-hints-v1\.js/);
assert.match(roxyCatalogJs,/\.voto-catalog-search/);
assert.match(roxyCatalogJs,/bai-curious-approved-v1\.webp/);
assert.match(roxyCatalogJs,/Смотри на корзину целиком\./);
assert.match(roxyCatalogJs,/Проверить с Баем/);
assert.match(roxyCatalogJs,/dismissed=true/);
assert.match(roxyCatalogJs,/TDShoppingAssistant\?\.open/);
assert.doesNotMatch(roxyCatalogJs,/TDShoppingState|shopping-optimizer|provider|ranking|price/i);
assert.match(roxyCatalogCss,/\.roxy-catalog-bay-hint/);
assert.doesNotMatch(roxyCatalogCss,/position\s*:\s*fixed/i);
assert.match(roxyCatalogCss,/min-height:44px/);
assert.match(roxyCatalogCss,/@media\(max-width:700px\)/);
assert.doesNotMatch(roxyCatalogCss,/background:#fff!important|background:white!important/i);

// Approved Empty / Loading / Error: Bay visibly reacts without changing shopping semantics.
assert.match(aiVisual,/votonobay-roxy-runtime-states-v1\.js/);
for(const asset of ["bai-curious-approved-v1.webp","bai-checking-approved-v1.webp","bai-suspicious-approved-v1.webp","bai-sleeping-approved-v1.webp"])assert.match(roxyRuntimeJs,new RegExp(asset.replace(".","\\.")));
assert.match(roxyRuntimeJs,/data-bai-runtime-state/);
assert.match(roxyRuntimeJs,/roxy-runtime-state-visual/);
assert.match(roxyRuntimeJs,/prefers-reduced-motion|requestAnimationFrame/);
assert.doesNotMatch(roxyRuntimeJs,/TDShoppingState|shopping-optimizer|provider|ranking|price/i);
assert.match(roxyRuntimeCss,/data-roxy-runtime-state="empty"/);
assert.match(roxyRuntimeCss,/data-roxy-runtime-state="loading"/);
assert.match(roxyRuntimeCss,/data-roxy-runtime-state="error"/);
assert.match(roxyRuntimeCss,/roxy-runtime-state-progress/);
assert.match(roxyRuntimeCss,/@media\(max-width:700px\)/);
assert.match(roxyRuntimeCss,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(roxyRuntimeCss,/position\s*:\s*fixed/i);
assert.doesNotMatch(roxyRuntimeCss,/background:#fff!important|background:white!important/i);

// Final motion polish: restrained transitions and feedback, still visual-only.
assert.match(polish,/votonobay-roxy-motion-polish-v1\.js/);
assert.match(roxyMotionJs,/td:v2-rendered/);
assert.match(roxyMotionJs,/data-roxy-motion/);
assert.match(roxyMotionJs,/pointermove/);
assert.match(roxyMotionJs,/roxy-bay-nod/);
assert.doesNotMatch(roxyMotionJs,/MutationObserver|TDShoppingState|shopping-optimizer|provider|ranking|price/i);
assert.match(roxyMotionCss,/roxy-screen-enter/);
assert.match(roxyMotionCss,/@media\(hover:hover\) and \(pointer:fine\)/);
assert.match(roxyMotionCss,/prefers-reduced-motion:reduce/);
assert.match(roxyMotionCss,/\.v2-bottom-nav \.is-active:after/);
assert.match(roxyMotionCss,/roxy-bay-focus/);

assert.match(decisionHandoff,/TDShoppingState\?\.get/);assert.match(decisionHandoff,/lastPlans\?\.\[0\]/);assert.match(decisionHandoff,/TDContinueInStoresV1/);assert.match(decisionHandoff,/continue-in-stores-v1\.js/);assert.match(decisionHandoff,/bayContinuePlan/);assert.match(decisionHandoff,/Продолжить в/);assert.match(decisionHandoff,/не буду притворяться, что перенёс товары автоматически/);assert.match(decisionHandoff,/фактические цена и наличие подтверждаются/);assert.match(decisionHandoff,/td:bai-handoff-opened/);assert.match(decisionHandoff,/td:shopping-state/);assert.doesNotMatch(decisionHandoff,/MutationObserver/);assert.match(decisionHandoff,/body\.td-votonobay \.td-continue-stores-card/);assert.match(decisionHandoff,/@media\(max-width:520px\)/);

assert.match(historyUi,/tdHistorySignature/);assert.match(substitutions,/dataset\.signature/);
assert.match(app,/function comparisonLead\(/);assert.match(app,/Победителя пока нет/);assert.match(app,/ЛУЧШИЙ ПОДТВЕРЖДЁННЫЙ ВАРИАНТ/);
assert.match(app,/class="brand-home" onclick="go\('home'\)"/);
assert.equal(manifest.name,"VOTONOBAI");assert.equal(manifest.short_name,"VOTONOBAI");assert.equal(manifest.theme_color,"#102018");assert.equal(manifest.background_color,"#050A07");assert.equal(manifest.lang,"ru");assert.equal(manifest.scope,"./");
assert.match(cards,/\.sku-plate img\{[^}]*object-fit:contain/);assert.match(cards,/\.thumb img,\.product-packaging img\{[^}]*object-fit:contain/);
console.log("V2 UI contract passed: native Bay-first shell, approved Roxy Bay side panel/mobile sheet, living runtime states, restrained motion polish, subtle catalog hint, decision-to-purchase handoff, self-service fallback, dark responsive styling, honest data labels and canonical VOTONOBAI public identity are wired.");