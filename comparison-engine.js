(function () {
  "use strict";

  function defaultChannel(store) {
    return store && store.kind === "delivery" ? "bring" : "shelf";
  }

  function metaSlot(channel) {
    return channel === "bring" || channel === "delivery_catalog" ? "bring" : "shelf";
  }

  function priceMeta(product, storeId, channel) {
    if (!product || !product.priceMeta || !product.priceMeta[storeId]) return null;
    return product.priceMeta[storeId][metaSlot(channel)] || null;
  }

  function isVerifiedPrice(product, storeId, channel) {
    const meta = priceMeta(product, storeId, channel);
    return Boolean(meta && meta.kind === "retailer" && meta.freshness !== "expired" && meta.freshness !== "invalid");
  }

  function unitPrice(product, storeId, channel) {
    if (!product) return null;
    if (channel === "bring") {
      const bring = product.bring && product.bring[storeId];
      return Number.isFinite(bring) ? bring : null;
    }
    const shelf = product.prices && product.prices[storeId];
    return Number.isFinite(shelf) ? shelf : null;
  }

  function cartEntries(products, cart) {
    return products.filter(product => Number(cart && cart[product.id]) > 0);
  }

  function basketQuote(products, cart, storeId, channel) {
    const entries = cartEntries(products, cart);
    const missingProductIds = [];
    const estimatedProductIds = [];
    let partialGoods = 0;
    let coveredItems = 0;
    let verifiedItems = 0;

    for (const product of entries) {
      const price = unitPrice(product, storeId, channel);
      if (!Number.isFinite(price)) {
        missingProductIds.push(product.id);
        continue;
      }
      partialGoods += price * Number(cart[product.id] || 0);
      coveredItems += 1;
      if (isVerifiedPrice(product, storeId, channel)) verifiedItems += 1;
      else estimatedProductIds.push(product.id);
    }

    const totalItems = entries.length;
    const complete = missingProductIds.length === 0;
    const verifiedComplete = complete && verifiedItems === totalItems;
    return {
      goods: complete ? partialGoods : null,
      partialGoods,
      complete,
      verifiedComplete,
      missingProductIds,
      estimatedProductIds,
      coveredItems,
      verifiedItems,
      estimatedItems: Math.max(0, coveredItems - verifiedItems),
      totalItems,
      coverage: totalItems ? coveredItems / totalItems : 1,
      verifiedCoverage: totalItems ? verifiedItems / totalItems : 1
    };
  }

  function goodsTotal(products, cart, storeId, channel) {
    return basketQuote(products, cart, storeId, channel).goods;
  }

  function feeQuote(store, channel) {
    if (channel !== "bring") return { known: true, value: 0 };
    const value = Number(store && store.delivery);
    return Number.isFinite(value) ? { known: true, value } : { known: false, value: null };
  }

  function compare(options) {
    const stores = Array.isArray(options && options.stores) ? options.stores : [];
    const products = Array.isArray(options && options.products) ? options.products : [];
    const cart = options && options.cart || {};
    const city = options && options.city || "msk";
    const mode = options && options.mode || "any";
    const originStoreId = options && options.originStoreId;

    const origin = stores.find(store => store.id === originStoreId) || stores[0] || null;
    if (!origin) return [];

    const originChannel = defaultChannel(origin);
    const originQuote = basketQuote(products, cart, origin.id, originChannel);
    const originFee = feeQuote(origin, originChannel);
    const originComplete = originQuote.complete && originFee.known;
    const originTotal = originComplete ? originQuote.goods + originFee.value : null;

    let eligible = stores.filter(store => Array.isArray(store.city) && store.city.includes(city));
    if (mode === "walk") eligible = eligible.filter(store => store.kind !== "delivery");
    if (mode === "delivery") eligible = eligible.filter(store => store.has_bring);

    return eligible.map(store => {
      const channel = mode === "delivery" ? "bring" : mode === "walk" ? "shelf" : defaultChannel(store);
      const quote = basketQuote(products, cart, store.id, channel);
      const fee = feeQuote(store, channel);
      const complete = quote.complete && fee.known;
      const verifiedComplete = complete && quote.verifiedComplete;
      const total = complete ? quote.goods + fee.value : null;
      const verifiedSavings = originTotal != null && total != null && originQuote.verifiedComplete && quote.verifiedComplete;
      return Object.assign({}, store, {
        channel,
        goods: quote.goods,
        partialGoods: quote.partialGoods,
        delivery: fee.value,
        feeKnown: fee.known,
        total,
        complete,
        verifiedComplete,
        rankable: complete,
        coveredItems: quote.coveredItems,
        verifiedItems: quote.verifiedItems,
        estimatedItems: quote.estimatedItems,
        totalItems: quote.totalItems,
        coverage: quote.coverage,
        verifiedCoverage: quote.verifiedCoverage,
        missingProductIds: quote.missingProductIds,
        estimatedProductIds: quote.estimatedProductIds,
        save: verifiedSavings ? originTotal - total : null,
        indicativeSave: originTotal != null && total != null ? originTotal - total : null,
        same: store.id === origin.id && channel === originChannel
      });
    }).sort((a, b) => {
      if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
      if (a.rankable && b.rankable && a.total !== b.total) return a.total - b.total;
      if (a.coverage !== b.coverage) return b.coverage - a.coverage;
      return String(a.name || a.id).localeCompare(String(b.name || b.id), "ru");
    });
  }

  function fromWindow(overrides) {
    const state = window.state || {};
    return compare(Object.assign({
      stores: typeof STORES !== "undefined" ? STORES : [],
      products: typeof PRODUCTS !== "undefined" ? PRODUCTS : [],
      cart: state.cart || {},
      city: state.city || "msk",
      mode: state.mode || "any",
      originStoreId: state.storeId
    }, overrides || {}));
  }

  window.TDCompare = {
    defaultChannel,
    priceMeta,
    isVerifiedPrice,
    unitPrice,
    cartEntries,
    basketQuote,
    goodsTotal,
    feeQuote,
    compare,
    fromWindow
  };
})();
