(function () {
  "use strict";

  function channelFor(store, mode) {
    if (mode === "delivery") return store && store.has_bring ? "bring" : null;
    if (mode === "walk") return store && store.kind !== "delivery" ? "shelf" : null;
    return store ? window.TDCompare.defaultChannel(store) : null;
  }

  function eligibleStores(stores, city, mode) {
    return (stores || []).filter(store =>
      store && Array.isArray(store.city) && store.city.includes(city) && channelFor(store, mode)
    );
  }

  function rublesFromKopecks(value) { return value / 100; }

  function deliveryTerms(store, channel, subtotal) {
    const fee = window.TDCompare.feeQuote(store, channel);
    const minimum = Number(store && store.minOrder);
    const minimumKnown = channel !== "bring" || Number.isFinite(minimum);
    const meetsMinimum = channel !== "bring" || !minimumKnown || subtotal >= minimum;
    return { fee, minimum: minimumKnown ? minimum : null, minimumKnown, meetsMinimum, operationalKnown: fee.known && minimumKnown };
  }

  function oneStoreOptions(stores, products, cart, city, mode) {
    return eligibleStores(stores, city, mode).map(store => {
      const channel = channelFor(store, mode);
      const quote = window.TDCompare.basketQuote(products, cart, store.id, channel);
      const terms = deliveryTerms(store, channel, quote.goods);
      const total = quote.verifiedComplete && terms.fee.known && terms.meetsMinimum ? quote.goods + terms.fee.value : null;
      return {
        type: "one",
        stores: [store],
        channels: { [store.id]: channel }, total,
        rankable: total != null, operationalKnown: terms.operationalKnown,
        verifiedItems: quote.verifiedItems,
        totalItems: quote.totalItems
      };
    }).filter(option => option.rankable).sort((a, b) => a.total - b.total);
  }

  function pairOption(a, b, products, cart, mode) {
    const entries = window.TDCompare.cartEntries(products, cart || {});
    const allocations = { [a.id]: [], [b.id]: [] };
    const channels = { [a.id]: channelFor(a, mode), [b.id]: channelFor(b, mode) };
    let goodsKopecks = 0;

    for (const product of entries) {
      const quantity = Number(cart[product.id] || 0);
      const candidates = [a, b].map(store => {
        const channel = channels[store.id];
        const price = window.TDCompare.unitPrice(product, store.id, channel);
        const verified = window.TDCompare.isVerifiedPrice(product, store.id, channel);
        return { store, price, verified };
      }).filter(candidate => candidate.verified && Number.isFinite(candidate.price));

      if (!candidates.length) return null;
      candidates.sort((x, y) => x.price - y.price);
      const chosen = candidates[0];
      const lineKopecks = Math.round(chosen.price * 100) * quantity;
      allocations[chosen.store.id].push({ productId: product.id, name: product.name, quantity, unitPrice: chosen.price, lineTotal: rublesFromKopecks(lineKopecks) });
      goodsKopecks += lineKopecks;
    }

    const usedStoreIds = [a.id, b.id].filter(id => allocations[id].length > 0);
    if (usedStoreIds.length !== 2) return null;
    let totalKopecks = goodsKopecks;
    let operationalKnown = true;
    for (const store of [a, b]) {
      const subtotal = allocations[store.id].reduce((sum, line) => sum + line.lineTotal, 0);
      const terms = deliveryTerms(store, channels[store.id], subtotal);
      if (!terms.fee.known || !terms.meetsMinimum) return null;
      totalKopecks += Math.round(terms.fee.value * 100);
      operationalKnown = operationalKnown && terms.operationalKnown;
    }

    return {
      type: "two",
      stores: [a, b],
      channels, total: rublesFromKopecks(totalKopecks), goods: rublesFromKopecks(goodsKopecks),
      rankable: true,
      operationalKnown,
      allocations,
      totalItems: entries.length,
      usedStoreIds
    };
  }

  function optimize(options) {
    if (!window.TDCompare) return { bestOne: null, bestTwo: null, extraSaving: null, worthSplitting: false, pairCount: 0 };
    const stores = options && options.stores || [];
    const products = options && options.products || [];
    const cart = options && options.cart || {};
    const city = options && options.city || "msk";
    const mode = options && options.mode || "walk";
    const extraStopCost = Number(options && options.extraStopCost);
    const one = oneStoreOptions(stores, products, cart, city, mode);
    const bestOne = one[0] || null;
    const eligible = eligibleStores(stores, city, mode);
    const pairs = [];

    for (let i = 0; i < eligible.length; i += 1) {
      for (let j = i + 1; j < eligible.length; j += 1) {
        const option = pairOption(eligible[i], eligible[j], products, cart, mode);
        if (option) pairs.push(option);
      }
    }

    pairs.sort((a, b) => a.total - b.total);
    const bestTwo = pairs[0] || null;
    const extraSaving = bestOne && bestTwo ? Math.max(0, bestOne.total - bestTwo.total) : null;
    const travelKnown = mode === "delivery" || Number.isFinite(extraStopCost) && extraStopCost >= 0;
    const operationalCost = mode === "delivery" ? 0 : travelKnown ? extraStopCost : null;
    const netSaving = bestOne && bestTwo && operationalCost != null ? bestOne.total-bestTwo.total-operationalCost : null;
    const worthSplitting = Boolean(bestOne && bestTwo && (netSaving == null ? bestTwo.total < bestOne.total : netSaving > 0));
    return { bestOne, bestTwo, extraSaving, operationalCost, travelKnown, worthSplitting, netSaving:worthSplitting?netSaving:null, pairCount: pairs.length };
  }

  function fromWindow() {
    if (typeof STORES === "undefined" || typeof PRODUCTS === "undefined" || !window.state) {
      return { bestOne: null, bestTwo: null, extraSaving: null, worthSplitting: false, pairCount: 0 };
    }
    return optimize({ stores: STORES, products: PRODUCTS, cart: state.cart || {}, city: state.city || "msk", mode: state.mode || "walk" });
  }

  window.TDBasketSplit = { channelFor, eligibleStores, oneStoreOptions, pairOption, optimize, fromWindow };
})();
