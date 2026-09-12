(function () {
  "use strict";
  if (window.__TDPriceSyncInitialized) return;
  window.__TDPriceSyncInitialized = true;

  const PRICE_ID_ALIASES = {
    bread_dark: "bread",
    chicken_fil: "chicken",
    oil_sunflower: "oil",
    eggs_c1: "eggs",
    buckwheat: "buck",
    smetana: "sour"
  };
  const BASE_PRODUCT_PRICES = new Map();
  const BASE_STORE_DELIVERY = new Map();

  function sourceId(productId) {
    return PRICE_ID_ALIASES[productId] || productId;
  }

  function rememberProductBase(product) {
    if (!product || !product.id) return { prices: {}, bring: {} };
    let base = BASE_PRODUCT_PRICES.get(product.id);
    if (!base) {
      base = {
        prices: Object.assign({}, product.prices || {}),
        bring: Object.assign({}, product.bring || {})
      };
      BASE_PRODUCT_PRICES.set(product.id, base);
    }
    return base;
  }

  function rememberStoreBase(store) {
    if (!store || !store.id) return { hasDelivery: false, delivery: null };
    let base = BASE_STORE_DELIVERY.get(store.id);
    if (!base) {
      base = {
        hasDelivery: Object.prototype.hasOwnProperty.call(store, "delivery"),
        delivery: store.delivery
      };
      BASE_STORE_DELIVERY.set(store.id, base);
    }
    return base;
  }

  function mergePriceRow(target, row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return target;
    Object.entries(row).forEach(([storeId, raw]) => {
      if (raw == null) {
        target[storeId] = null;
        return;
      }
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) target[storeId] = value;
    });
    return target;
  }

  function resetToBaseline() {
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return false;
    if (typeof STORES === "undefined" || !Array.isArray(STORES)) return false;

    PRODUCTS.forEach(product => {
      const base = rememberProductBase(product);
      product.prices = Object.assign({}, base.prices);
      product.bring = Object.assign({}, base.bring);
    });
    STORES.forEach(store => {
      const base = rememberStoreBase(store);
      if (base.hasDelivery) store.delivery = base.delivery;
      else delete store.delivery;
    });
    return true;
  }

  function applyBook() {
    if (typeof PRICE_BOOK === "undefined" || !PRICE_BOOK) return false;
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return false;
    if (typeof STORES === "undefined" || !Array.isArray(STORES)) return false;
    if (typeof state === "undefined" || !state) return false;
    if (!resetToBaseline()) return false;

    const shelf = PRICE_BOOK.flat && PRICE_BOOK.flat[state.city];
    const bring = PRICE_BOOK.flat_bring && PRICE_BOOK.flat_bring[state.city];

    PRODUCTS.forEach(product => {
      const id = sourceId(product.id);
      mergePriceRow(product.prices, shelf && shelf[id]);
      mergePriceRow(product.bring, bring && bring[id]);
    });

    const fees = PRICE_BOOK.delivery_fee || {};
    STORES.forEach(store => {
      if (fees[store.id] == null) return;
      const fee = Number(fees[store.id]);
      if (Number.isFinite(fee) && fee >= 0) store.delivery = fee;
    });

    window.TDPriceState = {
      schema: PRICE_BOOK.schema || null,
      asOf: PRICE_BOOK.as_of || null,
      city: state.city,
      overlayAvailable: Boolean(shelf || bring),
      productCount: PRODUCTS.length,
      aliases: Object.assign({}, PRICE_ID_ALIASES),
      appliedAt: new Date().toISOString()
    };

    window.dispatchEvent(new CustomEvent("td:prices-applied", { detail: window.TDPriceState }));
    return true;
  }

  function safePlanHint(plan) {
    const p = plan || {};
    if (p.channel !== "bring") return "сходить, полка · без адреса";
    const goods = p.goods != null && Number.isFinite(Number(p.goods)) ? Number(p.goods) : null;
    const delivery = p.delivery != null && Number.isFinite(Number(p.delivery)) && Number(p.delivery) >= 0 ? Number(p.delivery) : null;
    const goodsText = goods == null ? "стоимость товаров уточняется" : `товары ${Math.round(goods)} ₽`;
    if (p.feeKnown && delivery != null) return `${goodsText} + доставка сети ${Math.round(delivery)} ₽ · ${p.time || "время уточняется"}`;
    return `${goodsText} · тариф доставки не заложен`;
  }

  // Replace the legacy applier while keeping app.js API intact.
  window.applyCityPrices = applyBook;
  try { applyCityPrices = applyBook; } catch (e) {}
  window.planHint = safePlanHint;
  try { planHint = safePlanHint; } catch (e) {}

  window.TDPriceAliases = Object.freeze(Object.assign({}, PRICE_ID_ALIASES));
  window.TDApplyPrices = applyBook;
  window.TDPricePlanHint = safePlanHint;

  function catalogLooksReady() {
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return false;
    return PRODUCTS.length > 10 && PRODUCTS.some(p => p.id === "eggs_c1");
  }

  let attempts = 0;
  let retryTimer = 0;
  let busy = false;
  let deferred = true;

  function isActive() {
    return !document.hidden && navigator.onLine !== false;
  }

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = 0;
  }

  function renderIfActive() {
    if (!document.hidden && typeof render === "function") render();
  }

  function applyAndRender() {
    const applied = applyBook();
    if (applied) renderIfActive();
    return applied;
  }

  function schedule(delay = 100) {
    clearRetry();
    if (!isActive()) {
      deferred = true;
      return;
    }
    retryTimer = setTimeout(run, delay);
  }

  function run() {
    retryTimer = 0;
    if (!isActive()) {
      deferred = true;
      return;
    }
    if (!catalogLooksReady()) {
      attempts += 1;
      if (attempts < 50) schedule(100);
      return;
    }

    attempts = 0;
    if (typeof PRICE_BOOK !== "undefined" && PRICE_BOOK) {
      deferred = false;
      applyAndRender();
      return;
    }

    if (typeof loadPrices !== "function" || busy) {
      if (!busy) applyAndRender();
      return;
    }

    busy = true;
    deferred = false;
    Promise.resolve(loadPrices())
      .then(() => {
        if (!isActive()) {
          deferred = true;
          return;
        }
        applyAndRender();
      })
      .catch(() => { deferred = true; })
      .finally(() => {
        busy = false;
        if (deferred && isActive()) schedule(0);
      });
  }

  function suspend() {
    deferred = deferred || !window.TDPriceState;
    clearRetry();
  }

  function resume() {
    if (!isActive()) return;
    if (typeof PRICE_BOOK !== "undefined" && PRICE_BOOK) {
      deferred = false;
      applyAndRender();
      return;
    }
    if (deferred || !window.TDPriceState) schedule(0);
  }

  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume());
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("offline", suspend);
  window.addEventListener("online", resume);
  window.addEventListener("td:runtime-suspend", suspend);
  window.addEventListener("td:runtime-resume", resume);

  schedule(0);
})();