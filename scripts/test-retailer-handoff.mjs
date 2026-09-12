import fs from "node:fs";
import vm from "node:vm";

const integrationSource = fs.readFileSync("real-store-integration-v1.js", "utf8");
const continueSource = fs.readFileSync("continue-in-stores-v1.js", "utf8");
const probeSource = fs.readFileSync("retailer-integration-probe-v1.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(integrationSource);
new Function(continueSource);
new Function(probeSource);

const planState = {
  lastPlans: [{
    products: [
      { id: "milk", name: "Молоко", storeId: "lenta", quantity: 1 },
      { id: "bread", name: "Хлеб", storeId: "dixy_123", quantity: 1 },
      { id: "fake", name: "Неизвестный", storeId: "lentastic", quantity: 1 }
    ]
  }]
};
const explicitPlan = {
  source: "basket-split",
  mode: "multi",
  products: [
    { id: "milk", name: "Молоко", storeId: "pyat", quantity: 2 },
    { id: "bread", name: "Хлеб", storeId: "magnit", quantity: 1 }
  ]
};
const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const document = {
  head: { appendChild() {} },
  documentElement: { style: {} },
  activeElement: null,
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { dataset: {}, style: {}, textContent: "" }; },
  addEventListener() {},
  removeEventListener() {}
};
class HTMLElement {}
const window = {
  TDShoppingState: { get: () => planState },
  TDPriceMeta: {
    get(id) { return id === "milk" ? { sourceUrl: "https://evil.example/product" } : null; },
    getEstimated() { return null; }
  }
};
const context = vm.createContext({
  window,
  document,
  localStorage,
  location: { href: "https://example.test/" },
  HTMLElement,
  requestAnimationFrame(fn) { if (typeof fn === "function") fn(); return 1; },
  URL,
  console,
  setTimeout,
  clearTimeout,
  CSS: { escape: value => String(value) }
});

const integrationWithoutImports = integrationSource.replace(/^\s*import\([^\n]+\n/m, "");
vm.runInContext(integrationWithoutImports, context, { filename: "real-store-integration-v1.js" });
vm.runInContext(probeSource, context, { filename: "retailer-integration-probe-v1.js" });
vm.runInContext(continueSource, context, { filename: "continue-in-stores-v1.js" });

const integration = window.TDRealStoreIntegrationV1;
const continuation = window.TDContinueInStoresV1;
const probe = window.TDRetailerIntegrationProbeV1;
assert(integration && continuation && probe, "handoff modules must export their public APIs");

for (const id of ["perek", "pyat", "magnit", "lenta", "dixy"]) {
  assert(integration.retailers[id], `missing retailer handoff definition: ${id}`);
  assert(probe.get(id), `missing truthful capability description: ${id}`);
  assert(probe.canTransfer(id) === false, `${id} must not claim automatic cart transfer`);
}

const supported = integration.supportedRetailers().map(r => r.id).sort();
assert(supported.includes("lenta") && supported.includes("dixy"), "Lenta and Dixy basket lines must no longer disappear from handoff");
assert(!supported.includes("lentastic"), "retailer prefix matching must not accept arbitrary lookalike IDs");
assert(integration.supported("ghost") === false, "unknown retailer must fail closed");
assert(integration.open("ghost") === false, "unknown retailer must never fall back to the first available store");

const lentaRows = integration.rows("lenta");
const dixyRows = integration.rows("dixy");
assert(lentaRows.length === 1 && lentaRows[0].url === "https://lenta.com/catalog/", "Lenta fallback must stay on the official catalog");
assert(lentaRows[0].linkKind === "catalog", "untrusted source URL must not be labelled as an official product page");
assert(dixyRows.length === 1 && dixyRows[0].url === "https://dixy.ru/catalog/", "Dixy fallback must stay on the official catalog");

const explicitSupported = integration.supportedRetailers(explicitPlan).map(r => r.id).sort();
assert(JSON.stringify(explicitSupported) === JSON.stringify(["magnit", "pyat"]), "explicit split plan must override AI shopping state for retailer discovery");
assert(integration.rows("pyat", explicitPlan).length === 1, "explicit split plan must expose its own Pyaterochka line");
assert(integration.rows("lenta", explicitPlan).length === 0, "explicit split plan must not leak stores from AI shopping state");
assert(integration.resolvePlan(explicitPlan) === explicitPlan, "explicit handoff plan must be preserved by reference");

assert(continuation.storeKey("lenta_42") === "lenta", "point-scoped Lenta IDs must group under Lenta");
assert(continuation.storeKey("dixy_42") === "dixy", "point-scoped Dixy IDs must group under Dixy");
assert(continuation.storeKey("lentastic") === "lentastic", "unknown retailer IDs must remain explicit instead of being swallowed by a known prefix");
const counts = continuation.counts();
assert(counts.get("lenta") === 1 && counts.get("dixy") === 1 && counts.get("lentastic") === 1, "multi-store handoff counts must preserve supported and unsupported groups");
const explicitCounts = continuation.counts(explicitPlan);
assert(explicitCounts.get("pyat") === 1 && explicitCounts.get("magnit") === 1 && explicitCounts.size === 2, "explicit split plan counts must stay isolated from AI state");
assert(continuation.signature(explicitPlan) !== continuation.signature(), "explicit split progress must use its own basket signature");
assert(continuation.resolvePlan(explicitPlan) === explicitPlan, "continue flow must accept an explicit non-AI plan");

for (const phrase of ["Пошаговая сборка", "не заявляет, что товары уже перенесены", "Официальный каталог магазина"]) {
  assert(integrationSource.includes(phrase), `missing truthful handoff copy: ${phrase}`);
}
assert(!integrationSource.includes("<small>Перенос корзины</small>"), "handoff must not present manual opening as an automatic cart transfer");
assert(continueSource.includes("без прямого шага") && continueSource.includes("не скрываем из плана"), "unsupported store lines must be visible instead of silently disappearing");
assert(continueSource.includes("Votonobay не читает корзину магазина"), "handoff progress copy must use the current master brand");
assert(!integrationSource.includes("TDBai") && !continueSource.includes("TDBai"), "retailer handoff must remain independent from Bai internals");

console.log("Retailer handoff tests passed: five retailers, explicit split plans, official fallbacks, unknown-store fail-closed and truthful manual progress.");
