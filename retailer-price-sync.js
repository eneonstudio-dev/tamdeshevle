(function () {
  "use strict";

  const OVERLAYS = ["data/retailers/perekrestok.overlay.json?v=20260910a"];
  let books = [];
  let appliedSignature = "";

  async function loadOverlays() {
    const loaded = [];
    for (const url of OVERLAYS) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const book = await res.json();
        if (!book || book.schema !== "tamdeshevle.retailer-price-overlay.v1") throw new Error("invalid overlay schema");
        loaded.push(book);
      } catch (err) {
        console.warn("retailer overlay не загрузился", url, err);
      }
    }
    books = loaded;
    applyOverlays();
  }

  function applyOverlay(book) {
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return 0;
    if (typeof state === "undefined" || !state || book.city !== state.city) return 0;
    const storeId = book.store_id || book.retailer;
    const channel = book.channel || "delivery_catalog";
    let count = 0;

    for (const product of PRODUCTS) {
      const value = book.prices && book.prices[product.id];
      if (!Number.isFinite(value)) continue;
      if (channel === "shelf_catalog") {
        product.prices = Object.assign({}, product.prices || {}, { [storeId]: value });
      } else {
        product.bring = Object.assign({}, product.bring || {}, { [storeId]: value });
      }
      count += 1;
    }
    return count;
  }

  function applyOverlays() {
    if (!books.length) return false;
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS) || PRODUCTS.length < 10) return false;
    if (typeof state === "undefined" || !state) return false;

    const signature = books.map(book => [book.retailer, book.city, book.checked_at, Object.keys(book.prices || {}).length].join(":" )).join("|") + ":" + state.city + ":" + PRODUCTS.length;
    if (signature === appliedSignature) return true;

    const applied = books.map(book => ({
      retailer: book.retailer,
      city: book.city,
      channel: book.channel || "delivery_catalog",
      checkedAt: book.checked_at || null,
      count: applyOverlay(book)
    }));

    appliedSignature = signature;
    window.TDRetailerPriceState = {
      schema: "tamdeshevle.retailer-price-runtime.v1",
      city: state.city,
      overlays: applied,
      appliedAt: new Date().toISOString()
    };
    window.dispatchEvent(new CustomEvent("td:retailer-prices-applied", { detail: window.TDRetailerPriceState }));
    if (applied.some(item => item.count > 0) && typeof render === "function") render();
    return true;
  }

  window.TDApplyRetailerPrices = applyOverlays;
  window.addEventListener("td:prices-applied", applyOverlays);
  window.addEventListener("td:stores-loaded", applyOverlays);

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (applyOverlays() || attempts >= 50) clearInterval(timer);
  }, 100);

  loadOverlays();
})();
