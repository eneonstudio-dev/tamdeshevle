(function () {
  "use strict";

  function eligibleWalkStores(stores, city) {
    return (stores || []).filter(store =>
      store && store.kind !== "delivery" && Array.isArray(store.city) && store.city.includes(city)
    );
  }

  function oneStoreOptions(stores, products, cart, city) {
    return eligibleWalkStores(stores, city).map(store => {
      const quote = TDCompare.basketQuote(products, cart, store.id, "shelf");
      return {
        type: "one",
        stores: [store],
        total: quote.verifiedComplete ? quote.goods : null,
        rankable: quote.verifiedComplete,
        verifiedItems: quote.verifiedItems,
        totalItems: quote.totalItems
      };
    }).filter(option => option.rankable).sort((a, b) => a.total - b.total);
  }

  function pairOption(a, b, products, cart) {
    const entries = TDCompare.cartEntries(products, cart || {});
    const allocations = { [a.id]: [], [b.id]: [] };
    let total = 0;

    for (const product of entries) {
      const quantity = Number(cart[product.id] || 0);
      const candidates = [a, b].map(store => {
        const price = TDCompare.unitPrice(product, store.id, "shelf");
        const verified = TDCompare.isVerifiedPrice(product, store.id, "shelf");
        return { store, price, verified };
      }).filter(candidate => candidate.verified && Number.isFinite(candidate.price));

      if (!candidates.length) return null;
      candidates.sort((x, y) => x.price - y.price);
      const chosen = candidates[0];
      const lineTotal = chosen.price * quantity;
      allocations[chosen.store.id].push({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: chosen.price,
        lineTotal
      });
      total += lineTotal;
    }

    return {
      type: "two",
      stores: [a, b],
      total,
      rankable: true,
      allocations,
      totalItems: entries.length,
      usedStoreIds: [a.id, b.id].filter(id => allocations[id].length > 0)
    };
  }

  function optimize(options) {
    if (!window.TDCompare) return { bestOne: null, bestTwo: null, extraSaving: null };
    const stores = options && options.stores || [];
    const products = options && options.products || [];
    const cart = options && options.cart || {};
    const city = options && options.city || "msk";

    const one = oneStoreOptions(stores, products, cart, city);
    const bestOne = one[0] || null;
    const walk = eligibleWalkStores(stores, city);
    const pairs = [];

    for (let i = 0; i < walk.length; i += 1) {
      for (let j = i + 1; j < walk.length; j += 1) {
        const option = pairOption(walk[i], walk[j], products, cart);
        if (option && option.usedStoreIds.length === 2) pairs.push(option);
      }
    }

    pairs.sort((a, b) => a.total - b.total);
    const bestTwo = pairs[0] || null;
    const extraSaving = bestOne && bestTwo ? Math.max(0, bestOne.total - bestTwo.total) : null;

    return {
      bestOne,
      bestTwo,
      extraSaving,
      worthSplitting: Boolean(bestOne && bestTwo && bestTwo.total < bestOne.total),
      pairCount: pairs.length
    };
  }

  function fromWindow() {
    if (typeof STORES === "undefined" || typeof PRODUCTS === "undefined" || !window.state) {
      return { bestOne: null, bestTwo: null, extraSaving: null, worthSplitting: false, pairCount: 0 };
    }
    return optimize({ stores: STORES, products: PRODUCTS, cart: state.cart || {}, city: state.city || "msk" });
  }

  window.TDBasketSplit = { eligibleWalkStores, oneStoreOptions, pairOption, optimize, fromWindow };
})();
