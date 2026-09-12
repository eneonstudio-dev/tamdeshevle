import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("selected-store-ui.js", "utf8");
const storage = new Map();
const events = [];
const state = { storeId: "pyat", city: "msk", mode: "any", screen: "catalog", cart: {} };
const stores = [
  { id: "pyat", name: "Пятёрочка", kind: "shop", city: ["msk", "spb"], has_bring: true },
  { id: "magnit", name: "Магнит", kind: "shop", city: ["msk"], has_bring: true },
  { id: "delivery", name: "Доставка", kind: "delivery", city: ["msk"], has_bring: true },
  { id: "pickup", name: "Самовывоз", kind: "shop", city: ["msk"], has_bring: false }
];

const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const document = {
  readyState: "loading",
  body: {},
  head: { appendChild() {} },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() { return { dataset: {}, style: {}, appendChild() {} }; }
};
class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
const window = {
  state,
  addEventListener() {},
  dispatchEvent(event) { events.push(event); }
};
const context = vm.createContext({
  window,
  state,
  STORES: stores,
  PRODUCTS: [],
  localStorage,
  document,
  MutationObserver,
  CustomEvent,
  requestAnimationFrame: fn => { fn(); return 1; },
  cancelAnimationFrame() {},
  queueMicrotask,
  setTimeout,
  clearTimeout,
  console
});
vm.runInContext(source, context, { filename: "selected-store-ui.js" });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function save(point) {
  storage.set("td:selected-store-point", JSON.stringify(point));
}
function reset(next = {}) {
  storage.clear();
  events.length = 0;
  Object.assign(state, { storeId: "pyat", city: "msk", mode: "any", screen: "catalog", cart: {} }, next);
}

const valid = {
  id: "osm:node:1",
  chainId: "pyat",
  storeId: "0293",
  priceStoreId: "pyat",
  address: "Москва, тестовая точка",
  city: "msk",
  version: 2,
  selectedAt: "2026-09-12T09:00:00.000Z"
};

reset();
storage.set("td:selected-store-point", "{broken json");
assert(window.TDSelectedStore.get() === null, "malformed selected point must fail closed");
assert(!storage.has("td:selected-store-point"), "malformed selected point must be removed from storage");

reset();
save(valid);
assert(window.TDSelectedStore.get()?.storeId === "0293", "valid selected point must survive reconciliation");
assert(state.storeId === "pyat", "valid point must not rewrite an already matching store");

reset({ storeId: "magnit" });
save(valid);
assert(window.TDSelectedStore.get() === null, "manual store change must invalidate the old exact point");
assert(state.storeId === "magnit", "stale exact point must never hijack the newer store choice");
assert(!storage.has("td:selected-store-point"), "stale point must be removed after store change");
assert(events.at(-1)?.detail?.reason === "store_changed", "store mismatch must expose a deterministic clear reason");

reset({ city: "spb" });
save(valid);
assert(window.TDSelectedStore.get() === null, "point from another city must be invalidated");
assert(state.city === "spb" && state.storeId === "pyat", "city mismatch cleanup must not mutate app state");
assert(events.at(-1)?.detail?.reason === "city_changed", "city mismatch must expose a deterministic clear reason");

reset();
save({ ...valid, chainId: "deleted-chain" });
assert(window.TDSelectedStore.get() === null, "removed/unknown retailer chain must invalidate the point");
assert(state.storeId === "pyat", "unknown selected chain must not replace the current store");

reset({ mode: "walk" });
save({ ...valid, referenceStoreId: "delivery" });
const walkPoint = window.TDSelectedStore.get();
assert(walkPoint && !walkPoint.referenceStoreId, "delivery-only comparison reference must be dropped in walk mode");
assert(!JSON.parse(storage.get("td:selected-store-point")).referenceStoreId, "invalid reference cleanup must persist");

reset({ mode: "delivery" });
save({ ...valid, referenceStoreId: "pickup" });
const deliveryPoint = window.TDSelectedStore.get();
assert(deliveryPoint && !deliveryPoint.referenceStoreId, "pickup-only comparison reference must be dropped in delivery mode");

reset();
save({ ...valid, referenceStoreId: "magnit" });
assert(window.TDSelectedStore.get()?.referenceStoreId === "magnit", "eligible comparison reference must be preserved");

reset();
const legacy = { ...valid };
delete legacy.city;
delete legacy.version;
save(legacy);
const migrated = window.TDSelectedStore.get();
assert(migrated?.city === "msk" && migrated?.version === 2, "legacy same-store point must be scoped to the current city and migrated");
const migratedStored = JSON.parse(storage.get("td:selected-store-point"));
assert(migratedStored.city === "msk" && migratedStored.version === 2, "legacy migration must persist atomically");

reset({ storeId: "magnit" });
save(valid);
const restored = window.TDSelectedStore.makeCurrent();
assert(restored?.chainId === "pyat" && state.storeId === "pyat", "explicit makeCurrent may restore a still-eligible point");
assert(JSON.parse(storage.get("td")).storeId === "pyat", "explicit point restoration must persist the chain selection");

console.log("Selected store state tests passed: malformed, stale store, city, mode/reference and legacy reconciliation are fail-closed.");
