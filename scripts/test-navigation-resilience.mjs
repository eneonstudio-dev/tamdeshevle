import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [app, overlay, index] = await Promise.all([
  read("app.js"),
  read("overlay-history-v1.js"),
  read("index.html")
]);

assert.match(app, /let priceLoad = \{ status: "loading", error: "" \}/, "price loading state must exist");
assert.match(app, /AbortController/, "price loading must be abortable");
assert.match(app, /setTimeout\(\(\) => controller\.abort\(\), 8000\)/, "price loading must have a bounded timeout");
assert.match(app, /Свежие цены не загрузились/, "price errors must be visible to users");
assert.match(app, /Повторить загрузку/, "price error must provide retry");
assert.match(app, /function emptyCartState\(\)/, "empty basket must have a dedicated state");
assert.match(app, /if \(!entries\.length\) return/, "cart screen must branch before rendering checkout dock");
assert.match(app, /if \(!cartCount\(\)\) return/, "comparison screen must guard an empty basket");
assert.match(app, /history\[method\]\(\{ \.\.\.\(history\.state \|\| \{\}\), tdScreen: next \}/, "screen navigation must write browser history");
assert.match(app, /window\.addEventListener\("popstate"/, "screen navigation must respond to browser Back");

for (const selector of [".td-ai", ".td-pickup-backdrop", ".td-courier-backdrop", ".td-continue-stores", ".td-retailer-handoff"]){
  assert.ok(overlay.includes(selector), `overlay history must cover ${selector}`);
}
assert.match(overlay, /history\.pushState\(/, "opening an overlay must create a Back target");
assert.match(overlay, /history\.back\(\)/, "manual overlay close must consume its history entry");
assert.match(overlay, /window\.addEventListener\("popstate"/, "Back must close active overlays");
assert.match(overlay, /MutationObserver/, "overlay history must follow dynamically mounted modals");
assert.match(index, /app\.js\?v=20260912-nav-state-v1/, "index must bust cache for hardened app runtime");
assert.match(index, /overlay-history-v1\.js\?v=20260912-v1/, "index must load overlay history after runtime modules");

console.log("Navigation resilience contract passed: empty/loading/error basket states and browser Back are wired.");
