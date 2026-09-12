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
    if (!meta || !["fresh", "stale"].includes(meta.freshness)) return false;
    if (meta.kind === "retailer") return meta.scopeVerified === true && meta.comparisonEligible === true && meta.availability === "in_stock";
    if (meta.kind !== "receipt") return false;
    return Boolean(
      meta.trust === "verified_receipt" &&
      meta.scope_verified === true &&
      meta.proof_verified === true &&
      meta.identity_verified === true
    );
  }

  function unitPrice(product, storeId, channel) {
    if (!product) return null;
    if (channel === "bring") {
      const bring = product.bring && product.bring[storeId];
      return Number.isFinite(bring) && bring > 0 ? bring : null;
    }
    const shelf = product.prices && product.prices[storeId];
    return Number.isFinite(shelf) && shelf > 0 ? shelf : null;
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
      const quantity = Number(cart[product.id]);
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 99) { missingProductIds.push(product.id); continue; }
      const price = unitPrice(product, storeId, channel);
      if (!Number.isFinite(price)) {
        missingProductIds.push(product.id);
        continue;
      }
      partialGoods += Math.round(price * 100) * quantity;
      coveredItems += 1;
      if (isVerifiedPrice(product, storeId, channel)) verifiedItems += 1;
      else estimatedProductIds.push(product.id);
    }

    for (const [id, qty] of Object.entries(cart || {})) {
      if (Number(qty) > 0 && !entries.some(product => product.id === id)) missingProductIds.push(id);
    }
    partialGoods /= 100;
    const totalItems = coveredItems + missingProductIds.length;
    const hasItems = totalItems > 0;
    const complete = hasItems && missingProductIds.length === 0;
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
      coverage: totalItems ? coveredItems / totalItems : 0,
      verifiedCoverage: totalItems ? verifiedItems / totalItems : 0
    };
  }

  function goodsTotal(products, cart, storeId, channel) {
    return basketQuote(products, cart, storeId, channel).goods;
  }

  function feeQuote(store, channel) {
    if (channel !== "bring") return { known: true, value: 0 };
    const raw = store && store.delivery;
    const value = typeof raw === "number" ? raw : NaN;
    return Number.isFinite(value) && value >= 0 ? { known: true, value } : { known: false, value: null };
  }

  function minimumQuote(store, channel, goods) {
    if (channel !== "bring") return { known: true, value: 0, met: true, shortfall: 0 };
    const raw = store && store.minOrder;
    const value = typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : null;
    const known = value != null;
    const met = known && Number.isFinite(goods) && goods >= value;
    return {
      known,
      value,
      met,
      shortfall: known && Number.isFinite(goods) ? Math.max(0, value - goods) : null
    };
  }

  function deliveryTerms(store, channel, goods) {
    const fee = feeQuote(store, channel);
    const minimum = minimumQuote(store, channel, goods);
    const operationalKnown = channel !== "bring" || (fee.known && minimum.known);
    const eligible = operationalKnown && minimum.met;
    let reason = null;
    if (channel === "bring" && !fee.known) reason = "fee_unknown";
    else if (channel === "bring" && !minimum.known) reason = "minimum_unknown";
    else if (channel === "bring" && !minimum.met) reason = "minimum_unmet";
    return { fee, minimum, operationalKnown, eligible, reason };
  }

  function compare(options) {
    const stores = Array.isArray(options && options.stores) ? options.stores : [];
    const products = Array.isArray(options && options.products) ? options.products : [];
    const cart = options && options.cart || {};
    const city = options && options.city || "msk";
    const mode = options && options.mode || "any";
    const originStoreId = options && options.originStoreId;

    let eligible = stores.filter(store => Array.isArray(store.city) && store.city.includes(city));
    if (mode === "walk") eligible = eligible.filter(store => store.kind !== "delivery");
    if (mode === "delivery") eligible = eligible.filter(store => store.has_bring === true);
    if (!eligible.length) return [];

    const requestedOrigin = eligible.find(store => store.id === originStoreId) || null;
    const origin = requestedOrigin || eligible[0];
    const referenceAvailable = Boolean(requestedOrigin);
    const originChannel = mode === "delivery" ? "bring" : mode === "walk" ? "shelf" : defaultChannel(origin);
    const originQuote = basketQuote(products, cart, origin.id, originChannel);
    const originTerms = deliveryTerms(origin, originChannel, originQuote.goods);
    const originComplete = originQuote.complete && originTerms.eligible;
    const originTotal = originComplete ? originQuote.goods + originTerms.fee.value : null;

    return eligible.map(store => {
      const channel = mode === "delivery" ? "bring" : mode === "walk" ? "shelf" : defaultChannel(store);
      const quote = basketQuote(products, cart, store.id, channel);
      const terms = deliveryTerms(store, channel, quote.goods);
      const pricedComplete = quote.complete && terms.fee.known;
      const indicativeTotal = pricedComplete ? quote.goods + terms.fee.value : null;
      const complete = quote.complete && terms.eligible;
      const verifiedComplete = complete && quote.verifiedComplete;
      const total = complete ? indicativeTotal : null;
      const verifiedSavings = referenceAvailable && originTotal != null && total != null && originQuote.verifiedComplete && quote.verifiedComplete;
      return Object.assign({}, store, {
        channel,
        goods: quote.goods,
        partialGoods: quote.partialGoods,
        delivery: terms.fee.value,
        feeKnown: terms.fee.known,
        minimumOrder: terms.minimum.value,
        minimumKnown: terms.minimum.known,
        minimumMet: terms.minimum.met,
        minimumShortfall: terms.minimum.shortfall,
        operationalKnown: terms.operationalKnown,
        operationalReason: terms.reason,
        indicativeTotal,
        total,
        complete,
        verifiedComplete,
        // A plan ranks only when prices AND the operational delivery terms are known and satisfied.
        rankable: verifiedComplete,
        coveredItems: quote.coveredItems,
        verifiedItems: quote.verifiedItems,
        estimatedItems: quote.estimatedItems,
        totalItems: quote.totalItems,
        coverage: quote.coverage,
        verifiedCoverage: quote.verifiedCoverage,
        missingProductIds: quote.missingProductIds,
        estimatedProductIds: quote.estimatedProductIds,
        referenceStoreId: referenceAvailable ? origin.id : null,
        referenceStoreName: referenceAvailable ? (origin.name || origin.id) : null,
        referenceAvailable,
        save: verifiedSavings ? originTotal - total : null,
        indicativeSave: referenceAvailable && originTotal != null && total != null ? originTotal - total : null,
        same: referenceAvailable && store.id === origin.id && channel === originChannel
      });
    }).sort((a, b) => {
      if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
      if (a.rankable && b.rankable && a.total !== b.total) return a.total - b.total;
      if (a.verifiedCoverage !== b.verifiedCoverage) return b.verifiedCoverage - a.verifiedCoverage;
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
    minimumQuote,
    deliveryTerms,
    compare,
    fromWindow
  };
})();
