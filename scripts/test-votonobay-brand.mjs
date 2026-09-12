import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const shell = fs.readFileSync("v2-shell.js", "utf8");
const brand = fs.readFileSync("brand-votonobay-v1.js", "utf8");
const legacy = fs.readFileSync("brand-prosche-v1.js", "utf8");
const css = fs.readFileSync("votonobay-brand-v1.css", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(shell);
new Function(brand);
new Function(legacy);

assert(/<title>Votonobay — как лучше собрать корзину<\/title>/.test(html), "HTML title must expose Votonobay before JavaScript runs");
assert(/<meta name="theme-color" content="#102018"/.test(html), "first paint must use the canonical graphite-green theme color");
assert(/votonobay-brand-v1\.css\?v=/.test(html), "Votonobay visual foundation must load from the document head");
assert(/Votonobay помогает понять, как лучше собрать корзину/.test(html), "HTML metadata must carry the how-better positioning");
assert(!/<title>[^<]*(Тамдешевле|Там дешевле|Проще)/.test(html), "legacy brand must not appear in the document title");
assert(manifest.name === "Votonobay" && manifest.short_name === "Votonobay", "PWA identity must use Votonobay");
assert(manifest.theme_color === "#102018", "PWA theme must use the canonical graphite-green brand color");
assert(/Votonobay — на главную/.test(shell), "shopping shell must expose the Votonobay wordmark");
assert(/Покупки\. <em>Как лучше\.<\/em>/.test(shell), "hero must express the Bay-first 'how better' philosophy");
assert(/Сравнить варианты/.test(shell), "primary basket CTA must compare options rather than promise only the cheapest result");
assert(!/Там Дешевле|Тамдешевле|Проще/.test(shell), "shopping shell must not regress to legacy master brands");
assert(!/fit=crop/.test(shell) && /fit=max/.test(shell), "home product imagery must not request server-side cropping");
assert(/brand-votonobay-v1\.js/.test(shell), "Votonobay runtime must load independently from Bai checkout");
assert(/brand-votonobay-v1\.js/.test(legacy), "legacy Prosche loader must route to Votonobay");
assert(!/const BRAND="Проще"|td-prosche|tuneBai|td-ai-|TDBai|bai-/.test(legacy), "legacy compatibility shim must not mutate Prosche or Bai UI");
assert(!/td-ai-|TDBai|bai-|assets\/bai/.test(brand), "canonical brand runtime must stay independent from Bai internals");
assert(/body\.td-votonobay/.test(css), "Votonobay visual foundation must be scoped to the canonical body class");
assert(!/[財财]/.test(brand + css + shell), "brand layer must not expose a visible Chinese easter egg");
assert(!/content:\s*["']V["']/.test(css), "brand CSS must not invent an unapproved V monogram");

console.log("Votonobay brand tests passed: first-paint identity, one master brand, Bay-first positioning, no Bai mutation and no unapproved logo/easter-egg regressions.");
