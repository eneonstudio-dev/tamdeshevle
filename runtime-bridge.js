(function () {
  "use strict";

  function install() {
    if (!window.TDCompare || !window.state || typeof STORES === "undefined" || typeof PRODUCTS === "undefined") return false;

    const legacyScenarios = typeof window.scenarios === "function" ? window.scenarios : null;
    const legacyPriceOf = typeof window.priceOf === "function" ? window.priceOf : null;

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

    if (legacyScenarios && !window.TDLegacyScenarios) window.TDLegacyScenarios = legacyScenarios;
    if (legacyPriceOf && !window.TDLegacyPriceOf) window.TDLegacyPriceOf = legacyPriceOf;

    // app.js declares these as global functions, so replacing the global bindings
    // makes current UI screens use the extracted comparison engine immediately.
    window.scenarios = window.tdScenarios;
    window.priceOf = window.tdPriceOf;
    try { scenarios = window.tdScenarios; } catch (e) {}
    try { priceOf = window.tdPriceOf; } catch (e) {}

    window.TDRuntimeState = {
      installed: true,
      authoritativeComparison: true,
      legacyScenarioAvailable: Boolean(window.TDLegacyScenarios),
      installedAt: new Date().toISOString()
    };

    window.dispatchEvent(new CustomEvent("td:runtime-ready", { detail: window.TDRuntimeState }));
    return true;
  }

  window.TDRuntime = { install };
  install();
})();
