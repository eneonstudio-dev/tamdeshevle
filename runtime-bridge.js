(function () {
  "use strict";

  if (window.__TDRuntimeBridgeInitialized) return;
  window.__TDRuntimeBridgeInitialized = true;

  let viewportCleanup = null;
  let hiddenAt = 0;
  let lastPriceRefreshAt = 0;

  function syncViewport() {
    const vv = window.visualViewport;
    const height = Math.max(320, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 320));
    const top = Math.max(0, Math.round(vv?.offsetTop || 0));
    const layoutHeight = Math.max(height, Math.round(window.innerHeight || document.documentElement.clientHeight || height));
    const covered = Math.max(0, layoutHeight - height - top);
    const keyboardOpen = covered > 120;
    const root = document.documentElement;
    root.style.setProperty("--td-vvh", height + "px");
    root.style.setProperty("--td-vvtop", top + "px");
    root.style.setProperty("--td-keyboard-covered", covered + "px");
    document.body?.toggleAttribute("data-td-keyboard-open", keyboardOpen);
    window.dispatchEvent(new CustomEvent("td:viewport", {
      detail: { height, top, covered, keyboardOpen }
    }));
  }

  function bindViewport() {
    if (viewportCleanup) viewportCleanup();
    const vv = window.visualViewport;
    let raf = 0;
    const queue = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncViewport);
    };
    vv?.addEventListener("resize", queue);
    vv?.addEventListener("scroll", queue);
    window.addEventListener("resize", queue);
    window.addEventListener("orientationchange", queue);
    queue();
    viewportCleanup = () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", queue);
      vv?.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      window.removeEventListener("orientationchange", queue);
    };
  }

  function refreshPricesAfterResume(force) {
    if (document.hidden || navigator.onLine === false || typeof window.loadPrices !== "function") return;
    const now = Date.now();
    if (!force && now - lastPriceRefreshAt < 30000) return;
    lastPriceRefreshAt = now;
    Promise.resolve(window.loadPrices()).catch(err => console.warn("[Runtime] price refresh after resume failed", err));
  }

  function suspendRuntime() {
    hiddenAt = Date.now();
    window.speechSynthesis?.cancel?.();
    window.dispatchEvent(new CustomEvent("td:runtime-suspend"));
  }

  function resumeRuntime(forceRefresh) {
    const sleptFor = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    syncViewport();
    refreshPricesAfterResume(Boolean(forceRefresh || sleptFor > 30000));
    window.dispatchEvent(new CustomEvent("td:runtime-resume", { detail: { sleptFor } }));
  }

  function installLifecycle() {
    bindViewport();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) suspendRuntime();
      else resumeRuntime(false);
    });
    window.addEventListener("pagehide", suspendRuntime);
    window.addEventListener("pageshow", event => resumeRuntime(Boolean(event.persisted)));
    window.addEventListener("online", () => refreshPricesAfterResume(true));
  }

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
      return TDCompare.compare({
        stores: STORES,
        products: PRODUCTS,
        cart: state.cart || {},
        city: state.city,
        mode: state.mode,
        originStoreId: state.storeId
      });
    };

    window.TDRuntimeState = {
      installed: true,
      authoritativeComparison: true,
      mobileLifecycle: true,
      installedAt: new Date().toISOString()
    };

    installLifecycle();
    window.dispatchEvent(new CustomEvent("td:runtime-ready", { detail: window.TDRuntimeState }));
    return true;
  }

  window.TDRuntime = { install, syncViewport, resume: resumeRuntime };
  install();
})();
