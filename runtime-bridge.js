(function () {
  "use strict";

  function install() {
    if (!window.TDCompare || !window.state || typeof STORES === "undefined" || typeof PRODUCTS === "undefined") return false;

    window.tdStoreBy = function (id) {
      return STORES.find(store => store.id === id) || null;
    };

    window.tdDefaultChannel = function (id) {
      return TDCompare.defaultChannel(window.tdStoreBy(id));
    };

    window.tdPriceOf = function (product, storeId, channel) {
      return TDCompare.unitPrice(product, storeId, channel || window.tdDefaultChannel(storeId));
    };

    window.tdCartEntries = function () {
      return TDCompare.cartEntries(PRODUCTS, state.cart || {});
    };

    window.tdCartCount = function () {
      return window.tdCartEntries().reduce((sum, product) => sum + Number(state.cart[product.id] || 0), 0);
    };

    window.tdSumIn = function (storeId, channel) {
      return TDCompare.goodsTotal(PRODUCTS, state.cart || {}, storeId, channel || window.tdDefaultChannel(storeId));
    };

    window.tdScenarios = function () {
      return TDCompare.fromWindow();
    };

    window.dispatchEvent(new CustomEvent("td:runtime-ready"));
    return true;
  }

  window.TDRuntime = { install };
  install();
})();
