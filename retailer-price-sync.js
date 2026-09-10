(function () {
  "use strict";

  const OVERLAYS = [
    "data/retailers/perekrestok.overlay.json?v=20260910a",
    "data/retailers/magnit.overlay.json?v=20260910b",
    "data/retailers/pyat.overlay.json?v=20260910a",
    "data/retailers/lenta.overlay.json?v=20260910a",
    "data/retailers/dixy.overlay.json?v=20260910a"
  ];
  let books = [];
  let loadIssues = [];
  let appliedSignature = "";

  function retailerFromUrl(url) {
    if (/perekrestok/i.test(url)) return "perek";
    if (/magnit/i.test(url)) return "magnit";
    if (/pyat/i.test(url)) return "pyat";
    if (/lenta/i.test(url)) return "lenta";
    if (/dixy/i.test(url)) return "dixy";
    return "unknown";
  }

  function qualityFor(book) {
    if (window.TDDataQuality && typeof TDDataQuality.assessOverlay === "function") return TDDataQuality.assessOverlay(book);
    return { status: book && book.scope_verified === true ? "fresh" : "unverified", usable: Boolean(book && book.scope_verified === true), ageHours: null, reason: null };
  }

  function metaSlot(channel) { return channel === "shelf_catalog" ? "shelf" : "bring"; }
  function setPriceMeta(product, storeId, slot, meta) {
    product.priceMeta = product.priceMeta || {};
    product.priceMeta[storeId] = product.priceMeta[storeId] || {};
    product.priceMeta[storeId][slot] = meta;
  }

  async function loadOverlays() {
    const loaded = [];
    const issues = [];
    for (const url of OVERLAYS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const book = await res.json();
        if (!book || book.schema !== "tamdeshevle.retailer-price-overlay.v1") throw new Error("invalid overlay schema");
        loaded.push(book);
      } catch (err) {
        const issue = { retailer: retailerFromUrl(url), url, status: "load_error", message: String(err && err.message || err) };
        issues.push(issue);
        console.warn("retailer overlay не загрузился", url, err);
      }
    }
    books = loaded;
    loadIssues = issues;
    applyOverlays(true);
  }

  function applyOverlay(book, quality) {
    if (!quality.usable) return 0;
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
      if (slot === "shelf") product.prices = Object.assign({}, product.prices || {}, { [storeId]: value });
      else product.bring = Object.assign({}, product.bring || {}, { [storeId]: value });
      const match = matchedBySku[product.id] || {};
      setPriceMeta(product, storeId, slot, {
        kind: "retailer", retailer: book.retailer, storeId, city: book.city, channel,
        checkedAt: book.checked_at || null, freshness: quality.status, ageHours: quality.ageHours,
        sourceUrl: match.source_url || book.source_url || null, imageUrl: match.image_url || null,
        retailerProductId: match.retailer_product_id || null, retailerName: match.name || null,
        storeContext: book.store_context || null, catalogContext: book.catalog_context || null,
        confidence: Number.isFinite(match.confidence) ? match.confidence : null, method: match.method || null,
        price: value, oldPrice: Number.isFinite(match.old_price_rub) ? match.old_price_rub : null,
        promo: Boolean(match.promo), comparisonPriceBasis: match.comparison_price_basis || null,
        sourcePackagePrice: Number.isFinite(match.source_package_price_rub) ? match.source_package_price_rub : null,
        sourceUnitPrice: Number.isFinite(match.source_unit_price_rub) ? match.source_unit_price_rub : null,
        sourceUnitPriceUnit: match.source_unit_price_unit || null
      });
      count += 1;
    }
    return count;
  }

  function applyOverlays(force) {
    if (!books.length && !loadIssues.length) return false;
    if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS) || PRODUCTS.length < 10) return false;
    if (typeof state === "undefined" || !state) return false;

    const signature = books.map(book => [book.retailer, book.city, book.checked_at, book.scope_verified, Object.keys(book.prices || {}).length, qualityFor(book).status].join(":"))
      .join("|") + ":" + state.city + ":" + PRODUCTS.length + ":" + loadIssues.length;
    if (!force && signature === appliedSignature) return true;

    const applied = books.map(book => {
      const quality = qualityFor(book);
      return {
        retailer: book.retailer,
        city: book.city,
        channel: book.channel || "delivery_catalog",
        checkedAt: book.checked_at || null,
        storeContext: book.store_context || null,
        catalogContext: book.catalog_context || null,
        scopeVerified: book.scope_verified === true,
        freshness: quality.status,
        freshnessReason: quality.reason || null,
        ageHours: Number.isFinite(quality.ageHours) ? quality.ageHours : null,
        usable: quality.usable,
        count: applyOverlay(book, quality)
      };
    });

    appliedSignature = signature;
    window.TDRetailerPriceState = {
      schema: "tamdeshevle.retailer-price-runtime.v2",
      city: state.city,
      overlays: applied,
      loadIssues: loadIssues.slice(),
      healthy: !loadIssues.length && applied.every(item => item.freshness === "fresh" || item.freshness === "unverified"),
      appliedAt: new Date().toISOString()
    };
    window.dispatchEvent(new CustomEvent("td:retailer-prices-applied", { detail: window.TDRetailerPriceState }));
    window.dispatchEvent(new CustomEvent("td:retailer-health", { detail: window.TDRetailerPriceState }));
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
  window.addEventListener("td:prices-applied", () => applyOverlays(true));
  window.addEventListener("td:stores-loaded", () => applyOverlays(true));
  let attempts = 0;
  const timer = setInterval(() => { attempts += 1; if (applyOverlays(false) || attempts >= 50) clearInterval(timer); }, 100);
  loadOverlays();
})();
