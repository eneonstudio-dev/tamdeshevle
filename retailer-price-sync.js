(function () {
  "use strict";

  const OVERLAYS = ["data/retailers/perekrestok.overlay.json?v=20260910a"];
  let books = [];
  let appliedSignature = "";

  function metaSlot(channel) {
    return channel === "shelf_catalog" ? "shelf" : "bring";
  }

  function setPriceMeta(product, storeId, slot, meta) {
    product.priceMeta = product.priceMeta || {};
    product.priceMeta[storeId] = product.priceMeta[storeId] || {};
    product.priceMeta[storeId][slot] = meta;
  }

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
    applyOverlays(true);
  }

  function applyOverlay(book) {
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return 0;
    if (typeof state === "undefined" || !state || book.city !== state.city) return 0;
    const storeId = book.store_id || book.retailer;
    const channel = book.channel || "delivery_catalog";
    const slot = metaSlot(channel);
    const matchedBySku = Object.fromEntries((book.matched || []).map(item => [item.sku, item]));
    let count = 0;

    for (const product of PRODUCTS) {
      const value = book.prices && book.prices[product.id];
      if (!Number.isFinite(value)) continue;
      if (slot === "shelf") {
        product.prices = Object.assign({}, product.prices || {}, { [storeId]: value });
      } else {
        product.bring = Object.assign({}, product.bring || {}, { [storeId]: value });
      }

      const match = matchedBySku[product.id] || {};
      setPriceMeta(product, storeId, slot, {
        kind: "retailer",
        retailer: book.retailer,
        storeId,
        city: book.city,
        channel,
        checkedAt: book.checked_at || null,
        sourceUrl: match.source_url || book.source_url || null,
        retailerProductId: match.retailer_product_id || null,
        retailerName: match.name || null,
        confidence: Number.isFinite(match.confidence) ? match.confidence : null,
        method: match.method || null,
        price: value
      });
      count += 1;
    }
    return count;
  }

  function applyOverlays(force) {
    if (!books.length) return false;
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS) || PRODUCTS.length < 10) return false;
    if (typeof state === "undefined" || !state) return false;

    const signature = books.map(book => [book.retailer, book.city, book.checked_at, Object.keys(book.prices || {}).length].join(":" )).join("|") + ":" + state.city + ":" + PRODUCTS.length;
    if (!force && signature === appliedSignature) return true;

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

  window.TDPriceMeta = {
    get(productId, storeId, channel) {
      if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return null;
      const product = PRODUCTS.find(item => item.id === productId);
      if (!product || !product.priceMeta || !product.priceMeta[storeId]) return null;
      const slot = channel === "bring" || channel === "delivery_catalog" ? "bring" : "shelf";
      return product.priceMeta[storeId][slot] || null;
    },
    isRetailer(productId, storeId, channel) {
      const meta = this.get(productId, storeId, channel);
      return Boolean(meta && meta.kind === "retailer");
    }
  };

  window.TDApplyRetailerPrices = function () { return applyOverlays(true); };
  window.addEventListener("td:prices-applied", function () { applyOverlays(true); });
  window.addEventListener("td:stores-loaded", function () { applyOverlays(true); });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (applyOverlays(false) || attempts >= 50) clearInterval(timer);
  }, 100);

  loadOverlays();
})();
