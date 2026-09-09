(function () {
  "use strict";

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
  const timer = setInterval(() => {
    attempts += 1;
    if (catalogLooksReady()) {
      clearInterval(timer);
      if (typeof loadPrices === "function") {
        Promise.resolve(loadPrices()).finally(() => {
          applyBook();
          if (typeof render === "function") render();
        });
      } else {
        applyBook();
        if (typeof render === "function") render();
      }
      return;
    }
    if (attempts >= 50) clearInterval(timer);
  }, 100);
})();
