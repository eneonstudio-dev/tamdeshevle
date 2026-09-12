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

  function sourceId(productId) {
    return PRICE_ID_ALIASES[productId] || productId;
  }

  function applyBook() {
    if (typeof PRICE_BOOK === "undefined" || !PRICE_BOOK) return false;
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return false;
    if (typeof STORES === "undefined" || !Array.isArray(STORES)) return false;
    if (typeof state === "undefined" || !state) return false;

    const shelf = PRICE_BOOK.flat && PRICE_BOOK.flat[state.city];
    const bring = PRICE_BOOK.flat_bring && PRICE_BOOK.flat_bring[state.city];
    if (!shelf && !bring) return false;

    PRODUCTS.forEach(product => {
      const id = sourceId(product.id);
      if (shelf && shelf[id]) {
        product.prices = Object.assign({}, product.prices || {}, shelf[id]);
      }
      if (bring && bring[id]) {
        product.bring = Object.assign({}, product.bring || {}, bring[id]);
      }
    });

    const fees = PRICE_BOOK.delivery_fee || {};
    STORES.forEach(store => {
      if (fees[store.id] != null) store.delivery = fees[store.id];
    });

    window.TDPriceState = {
      schema: PRICE_BOOK.schema || null,
      asOf: PRICE_BOOK.as_of || null,
      city: state.city,
      productCount: PRODUCTS.length,
      aliases: Object.assign({}, PRICE_ID_ALIASES),
      appliedAt: new Date().toISOString()
    };

    window.dispatchEvent(new CustomEvent("td:prices-applied", { detail: window.TDPriceState }));
    return true;
  }

  // Replace the legacy applier while keeping app.js API intact.
  window.applyCityPrices = applyBook;
  try { applyCityPrices = applyBook; } catch (e) {}

  window.TDPriceAliases = Object.freeze(Object.assign({}, PRICE_ID_ALIASES));
  window.TDApplyPrices = applyBook;

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
