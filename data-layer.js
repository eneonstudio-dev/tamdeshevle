(function () {
  "use strict";

  const REQUIRED_STORE_FIELDS = ["id", "name", "kind", "city"];
  const VALID_KINDS = new Set(["shop", "hyper", "delivery"]);

  function stores() {
    return typeof STORES !== "undefined" && Array.isArray(STORES) ? STORES : [];
  }

  function products() {
    return typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS) ? PRODUCTS : [];
  }

  function byStore(id) {
    return stores().find(store => store.id === id) || null;
  }

  function byProduct(id) {
    return products().find(product => product.id === id) || null;
  }

  function price(productId, storeId, channel) {
    const product = byProduct(productId);
    if (!product) return null;
    const source = channel === "bring" ? product.bring : product.prices;
    const value = source && source[storeId];
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function cartTotal(cart, storeId, channel) {
    if (!cart || typeof cart !== "object") return 0;
    let total = 0;
    for (const [productId, qty] of Object.entries(cart)) {
      const count = Number(qty);
      if (!Number.isFinite(count) || count < 0) return null;
      if (count === 0) continue;
      const unit = price(productId, storeId, channel);
      if (unit == null) return null;
      total += unit * count;
    }
    return total;
  }

  function validate() {
    const errors = [];
    const warnings = [];
    const storeIds = new Set();
    const productIds = new Set();

    stores().forEach((store, index) => {
      REQUIRED_STORE_FIELDS.forEach(field => {
        if (store[field] == null || store[field] === "") {
          errors.push(`STORES[${index}] missing ${field}`);
        }
      });
      if (store.id) {
        if (storeIds.has(store.id)) errors.push(`duplicate store id: ${store.id}`);
        storeIds.add(store.id);
      }
      if (store.kind && !VALID_KINDS.has(store.kind)) {
        warnings.push(`unknown store kind: ${store.id || index} → ${store.kind}`);
      }
      if (!Array.isArray(store.city) || !store.city.length) {
        warnings.push(`store has no cities: ${store.id || index}`);
      }
    });

    products().forEach((product, index) => {
      if (!product.id) errors.push(`PRODUCTS[${index}] missing id`);
      if (!product.name) errors.push(`PRODUCTS[${index}] missing name`);
      if (product.id) {
        if (productIds.has(product.id)) errors.push(`duplicate product id: ${product.id}`);
        productIds.add(product.id);
      }
      storeIds.forEach(storeId => {
        if (!product.prices || !Number.isFinite(product.prices[storeId])) {
          warnings.push(`missing shelf price: ${product.id || index} @ ${storeId}`);
        }
      });
    });

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      storeCount: stores().length,
      productCount: products().length,
      checkedAt: new Date().toISOString()
    };
  }

  const api = {
    stores,
    products,
    byStore,
    byProduct,
    price,
    cartTotal,
    validate,
    get state() {
      return typeof state !== "undefined" ? state : null;
    }
  };

  window.TDData = api;

  function publishHealth() {
    const report = validate();
    window.TDDataHealth = report;
    window.dispatchEvent(new CustomEvent("td:data-health", { detail: report }));
    if (!report.ok) console.error("[Тамдешевле] Ошибки данных", report.errors);
    if (report.warnings.length) console.warn("[Тамдешевле] Предупреждения данных", report.warnings);
  }

  const previousRender = window.render;
  if (typeof previousRender === "function") {
    window.render = function () {
      const result = previousRender.apply(this, arguments);
      queueMicrotask(publishHealth);
      return result;
    };
  }

  publishHealth();
})();
