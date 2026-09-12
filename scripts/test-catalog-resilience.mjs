import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync("ui-layer-coordinator.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert.match(ui, /function installCatalogSearch\(\)/, "catalog search interception must exist");
assert.match(ui, /removeAttribute\("oninput"\)/, "legacy full-app oninput rerender must be removed at runtime");
assert.match(ui, /input\.addEventListener\("input"/, "catalog search must use a local input listener");
assert.match(ui, /function applyCatalogFilter\(/, "catalog search must filter rendered items locally");
assert.match(ui, /item\.hidden=!match/, "catalog filtering must not rebuild the whole app while typing");
assert.match(ui, /Ничего не нашли/, "catalog must expose an explicit no-results state");
assert.match(ui, /data-catalog-search-clear/, "no-results state must provide a clear-search action");
assert.match(ui, /Найдено товаров/, "search result count must be announced accessibly");
assert.match(ui, /enterkeyhint","search"/, "mobile keyboard must receive search intent");

assert.match(ui, /function installQuantityA11y\(\)/, "quantity accessibility guard must exist");
assert.match(ui, /announce\(qty\?/, "quantity changes must be announced to assistive tech");
assert.match(ui, /buttons\[0\]\.disabled=value<=0/, "minus control must be disabled at zero");
assert.match(ui, /buttons\[1\]\.disabled=value>=99/, "plus control must be disabled at max quantity");
assert.match(ui, /Количество: \$\{value\}/, "quantity value must carry an accessible label");

assert.match(ui, /navigator\.onLine!==false/, "network state must use browser online status");
assert.match(ui, /window\.addEventListener\("offline"/, "offline transition must be handled");
assert.match(ui, /window\.addEventListener\("online"/, "online transition must be handled");
assert.match(ui, /Корзина и сохранённые оценки работают локально/, "offline UI must explain what still works");
assert.match(ui, /if\(shouldRefresh&&typeof window\.loadPrices==="function"\)window\.loadPrices\(\)/, "returning online must refresh price data automatically");

assert.match(app, /oninput="state\.q=this\.value;render\(\)"/, "test must cover the legacy app search handler that the runtime interceptor neutralizes");
const appPos = index.indexOf("app.js?v=");
const dataPos = index.indexOf("data-layer.js");
const coordinatorPos = index.indexOf("ui-layer-coordinator.js");
assert.ok(appPos >= 0 && dataPos > appPos && coordinatorPos > dataPos, "coordinator must load after app and TDData so it can safely intercept search and quantity controls");

console.log("Catalog resilience passed: Android-friendly local search, no-results UX, quantity announcements and offline recovery are wired.");
