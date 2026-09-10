(function () {
  "use strict";

  function currentStoreId() {
    return window.state && window.state.storeId;
  }

  function decorate() {
    if (!window.TDUnitPrice || !window.state || typeof PRODUCTS === "undefined") return;
    const storeId = currentStoreId();
    if (!storeId) return;
    document.querySelectorAll("#app .item").forEach(item => {
      if (item.querySelector(".unit-price")) return;
      const title = item.querySelector(".title");
      const priceNode = item.querySelector(".price");
      if (!title || !priceNode) return;
      const product = PRODUCTS.find(p => p.name === title.textContent.trim());
      if (!product) return;
      const channel = typeof defaultChannel === "function" ? defaultChannel(storeId) : undefined;
      const price = typeof priceOf === "function" ? priceOf(product, storeId, channel) : null;
      const label = TDUnitPrice.format(price, product.pack);
      if (!label) return;
      const node = document.createElement("div");
      node.className = "unit-price";
      node.textContent = label;
      const info = priceNode.parentElement;
      if (info) info.appendChild(node);
    });
  }

  const app = document.getElementById("app");
  if (!app) return;
  const observer = new MutationObserver(() => queueMicrotask(decorate));
  observer.observe(app, { childList: true, subtree: true });
  decorate();
})();
