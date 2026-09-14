import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const shell = fs.readFileSync("v2-shell.js", "utf8");
const brand = fs.readFileSync("brand-votonobay-v1.js", "utf8");
const legacy = fs.readFileSync("brand-prosche-v1.js", "utf8");
const coldStart = fs.readFileSync("votonobay-cold-start-v1.js", "utf8");
const roxyHome = fs.readFileSync("votonobay-roxy-home-v1.js", "utf8");
const account = fs.readFileSync("account-hub.js", "utf8");
const css = fs.readFileSync("votonobay-brand-v1.css", "utf8");
const bayCss = fs.readFileSync("votonobay-bay-first.css", "utf8");
const touchCss = fs.readFileSync("touch-layout-fix.css", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const favicon = fs.readFileSync("favicon.svg", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(shell);
new Function(brand);
new Function(legacy);
new Function(coldStart);
new Function(roxyHome);
new Function(account);

assert(/<title>Votonobay — как лучше собрать корзину<\/title>/.test(html), "HTML title must expose Votonobay before JavaScript runs");
assert(/<meta name="theme-color" content="#102018"/.test(html), "first paint must use the canonical graphite-green theme color");
assert(/votonobay-brand-v1\.css\?v=/.test(html), "Votonobay visual foundation must load from the document head");
assert(/touch-layout-fix\.css\?v=/.test(html), "late bootstrap stylesheet must be available for first-paint correction");
assert(/html\{background:#050a07;color-scheme:dark\}/.test(touchCss), "document first paint must start on the approved dark canvas");
assert(/body\{background:#050a07!important;color:#f5faf6\}/.test(touchCss), "legacy beige body paint must be overridden before runtime decoration");
assert(/\.phone\{background:#050a07!important\}/.test(touchCss), "empty app shell must not flash the legacy light surface");
assert(/votonobay-bay-first\.css/.test(touchCss), "canonical late stylesheet must load the native Bay-first layer");
assert(/Votonobay помогает понять, как лучше собрать корзину/.test(html), "HTML metadata must carry the how-better positioning");
assert(!/<title>[^<]*(Тамдешевле|Там дешевле|Проще)/.test(html), "legacy brand must not appear in the document title");
assert(manifest.name === "Votonobay" && manifest.short_name === "Votonobay", "PWA identity must use Votonobay");
assert(manifest.theme_color === "#102018", "PWA theme must use the canonical graphite-green brand color");
assert(manifest.background_color === "#050A07", "PWA launch background must match the dark Bay-first canvas");
assert(/как лучше купить/.test(manifest.description), "PWA description must express the broader how-better philosophy");
assert(/data-icon="peeking-bay"/.test(favicon), "favicon must use the approved peeking Bay identity");
assert(/Votonobay — Бай/.test(favicon), "peeking Bay favicon must carry an accessible title");
assert(/#4FF59A/.test(favicon) && /#07100B/.test(favicon), "app icon must use the Votonobay dark-and-mint palette");
assert(/Votonobay — на главную/.test(shell), "shopping shell must expose the Votonobay wordmark");
assert(/Покупки\. <em>Как лучше\.<\/em>/.test(shell), "hero must express the Bay-first 'how better' philosophy");
assert(/Спросить Бая/.test(shell), "Bay must be the primary home action");
assert(/Искать самому/.test(shell), "self-service search must remain available beside Bay-first");
assert(/Что хочешь решить\?/.test(shell), "assistant surface must frame the interaction as solving a task");
assert(/window\.TDShoppingAssistant\?\.open/.test(shell), "Bay-first entry must open the real shopping assistant");
assert(/Сравнить варианты/.test(shell), "primary basket CTA must compare options rather than promise only the cheapest result");
assert(/\.v2-hero\.v2-bay-first/.test(bayCss), "native Bay-first hero styling must exist");
assert(/\.v2-bay-primary/.test(bayCss), "Bay-first primary CTA styling must exist");
assert(/Скажи, что нужно — поможем решить, как лучше/.test(brand), "runtime brand copy must express the broader decision-assistant philosophy");
assert(!/Там Дешевле|Тамдешевле|Проще/.test(shell), "shopping shell must not regress to legacy master brands");
assert(!/fit=crop/.test(shell) && /fit=max/.test(shell), "home product imagery must not request server-side cropping");
assert(/brand-votonobay-v1\.js/.test(shell), "Votonobay runtime must load independently from Bai checkout");
assert(/brand-votonobay-v1\.js/.test(legacy), "legacy Prosche loader must route to Votonobay");
assert(!/const BRAND="Проще"|td-prosche|tuneBai|td-ai-|TDBai|bai-/.test(legacy), "legacy compatibility shim must not mutate Prosche or Bai UI");
assert(!/td-ai-|TDBai|bai-|assets\/bai/.test(brand), "canonical brand runtime must stay independent from Bai internals");
assert(/body\.td-votonobay/.test(css), "Votonobay visual foundation must be scoped to the canonical body class");
assert(!/[財财]/.test(brand + css + shell), "brand layer must not expose a visible Chinese easter egg");
assert(!/content:\s*["']V["']/.test(css), "brand CSS must not invent an unapproved V monogram");

const coldStartTag = 'votonobay-cold-start-v1.js?v=20260914-v1';
assert(html.includes(coldStartTag), "cold-start guard must ship in the document head");
assert(html.indexOf(coldStartTag) < html.indexOf('app.js?v='), "cold-start guard must execute before legacy app rendering");
assert(/dataset\.votonobayBoot="pending"/.test(coldStart), "cold-start guard must hide the legacy shell before approved Roxy Home is ready");
assert(/saved\.screen="home"/.test(coldStart), "fresh top-level visits must normalize persisted legacy routes to Home");
assert(/navigationType!=="back_forward"/.test(coldStart), "browser Back/Forward restores must keep their in-app destination");
assert(/#app\{visibility:hidden!important;opacity:0!important\}/.test(coldStart), "legacy app content must not be paintable during cold start");
assert(!/setTimeout\(release,1800\)/.test(coldStart), "cold-start guard must never fail open into an intermediate/legacy screen on a timer");
assert(/td:roxy-home-ready/.test(coldStart) && /canonicalHomeReady/.test(coldStart), "cold-start release must wait for explicit approved Roxy Home readiness");
assert(/votonobay-roxy-home-v1\.js/.test(coldStart) && /votonobay-roxy-home-tune-v1\.css/.test(coldStart), "cold-start guard must preload the canonical Home decorator and tune CSS");
assert(/Votonobay · Бай готовит главную/.test(coldStart), "slow startup must show a branded Votonobay boot surface instead of retired UI");
assert(/__TDRoxyHomeV1/.test(roxyHome) && /td:roxy-home-ready/.test(roxyHome), "Roxy Home must be idempotent and signal canonical readiness");
assert(!/Там дешевле сэкономил|Подписка Там Дешевле Plus/.test(account), "account hub must not expose the retired Там Дешевле brand");
assert(/Сэкономлено с Votonobay/.test(account) && /Подписка Votonobay Plus/.test(account), "account hub must use current Votonobay copy");
assert(/tuneAccountBrand/.test(brand), "runtime brand layer must protect late account surfaces too");

console.log("Votonobay brand tests passed: native Bay-first entry, canonical Roxy startup barrier, self-service fallback, dark first paint, peeking Bay PWA identity and one master brand are protected.");