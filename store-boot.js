(function () {
  "use strict";

  async function loadStores() {
    try {
      const res = await fetch("stores.json?v=20260910a");
      if (!res.ok) throw new Error(String(res.status));
      const book = await res.json();
      if (!book || !Array.isArray(book.stores) || typeof STORES === "undefined") {
        throw new Error("invalid stores.json");
      }

      STORES.length = 0;
      book.stores.forEach(store => STORES.push(Object.assign({}, store)));

      if (typeof PRICE_BOOK !== "undefined" && PRICE_BOOK) {
        const fees = PRICE_BOOK.delivery_fee || {};
        STORES.forEach(store => {
          if (fees[store.id] != null) store.delivery = fees[store.id];
        });
      }

      window.dispatchEvent(new CustomEvent("td:stores-loaded", {
        detail: { count: STORES.length, schema: book.schema || null, asOf: book.as_of || null }
      }));

      if (typeof render === "function") render();
    } catch (err) {
      console.warn("stores.json не загрузился; использую встроенный fallback", err);
    }
  }

  loadStores();
})();
