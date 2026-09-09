(function () {
  "use strict";

  function defaultChannel(store) {
    return store && store.kind === "delivery" ? "bring" : "shelf";
  }

  function unitPrice(product, storeId, channel) {
    if (!product) return 0;
    if (channel === "bring") {
      const bring = product.bring && product.bring[storeId];
      if (Number.isFinite(bring)) return bring;
    }
    const shelf = product.prices && product.prices[storeId];
    return Number.isFinite(shelf) ? shelf : 0;
  }

  function cartEntries(products, cart) {
    return products.filter(product => Number(cart && cart[product.id]) > 0);
  }

  function goodsTotal(products, cart, storeId, channel) {
    return cartEntries(products, cart).reduce((sum, product) => {
      return sum + unitPrice(product, storeId, channel) * Number(cart[product.id] || 0);
    }, 0);
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
    const originGoods = goodsTotal(products, cart, origin.id, originChannel);
    const originDelivery = originChannel === "bring" && origin.kind === "delivery" ? Number(origin.delivery || 0) : 0;
    const originTotal = originGoods + originDelivery;

    let eligible = stores.filter(store => Array.isArray(store.city) && store.city.includes(city));
    if (mode === "walk") eligible = eligible.filter(store => store.kind !== "delivery");
    if (mode === "delivery") eligible = eligible.filter(store => store.has_bring);

    return eligible.map(store => {
      const channel = mode === "delivery" ? "bring" : mode === "walk" ? "shelf" : defaultChannel(store);
      const goods = goodsTotal(products, cart, store.id, channel);
      const feeKnown = channel === "bring" && store.kind === "delivery";
      const delivery = feeKnown ? Number(store.delivery || 0) : 0;
      const total = goods + delivery;
      return Object.assign({}, store, {
        channel,
        goods,
        delivery,
        feeKnown,
        total,
        save: originTotal - total,
        same: store.id === origin.id && channel === originChannel
      });
    }).sort((a, b) => a.total - b.total);
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
    unitPrice,
    cartEntries,
    goodsTotal,
    compare,
    fromWindow
  };
})();
