(function () {
  "use strict";

  function injectStyle() {
    if (document.getElementById("td-price-provenance-style")) return;
    const style = document.createElement("style");
    style.id = "td-price-provenance-style";
    style.textContent = `
      .td-price-origin{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;font-size:10px;font-weight:800;line-height:1.2}
      .td-price-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;background:#efebe4;color:#746c60}
      .td-price-pill.real{background:#e5f6ea;color:#0f7b4a}
      .td-price-origin a{color:#0f7b4a;text-decoration:none;border-bottom:1px solid rgba(15,123,74,.25)}
      .td-plan-source{margin:7px 0 2px;font-size:11px;font-weight:800;color:#6b6458}
      .td-plan-source.real{color:#0f7b4a}
      .td-source-summary{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px}
    `;
    document.head.appendChild(style);
  }

  function channelForStore(storeId) {
    if (typeof STORES === "undefined") return "shelf";
    const store = STORES.find(item => item.id === storeId);
    return window.TDCompare ? TDCompare.defaultChannel(store) : (store && store.kind === "delivery" ? "bring" : "shelf");
  }

  function getMeta(product, storeId, channel) {
    if (!product || !window.TDPriceMeta) return null;
    return TDPriceMeta.get(product.id, storeId, channel);
  }

  function shortDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  function productFromCard(card) {
    const title = card.querySelector(".title");
    if (!title || typeof PRODUCTS === "undefined") return null;
    const name = title.textContent.trim();
    return PRODUCTS.find(product => product.name === name) || null;
  }

  function decorateItems() {
    if (!window.state || typeof PRODUCTS === "undefined") return;
    const storeId = state.storeId;
    const channel = channelForStore(storeId);
    document.querySelectorAll(".item").forEach(card => {
      if (card.querySelector(".td-price-origin")) return;
      const product = productFromCard(card);
      const price = card.querySelector(".price");
      if (!product || !price) return;
      const meta = getMeta(product, storeId, channel);
      const holder = document.createElement("div");
      holder.className = "td-price-origin";
      if (meta) {
        const checked = shortDate(meta.checkedAt);
        holder.innerHTML = `<span class="td-price-pill real">● цена из магазина${checked ? ` · ${checked}` : ""}</span>${meta.sourceUrl ? `<a href="${meta.sourceUrl}" target="_blank" rel="noopener">источник ↗</a>` : ""}`;
        holder.title = meta.retailerName || "Подтверждённая цена из публичного каталога сети";
      } else {
        holder.innerHTML = `<span class="td-price-pill">учебная цена</span>`;
      }
      price.insertAdjacentElement("afterend", holder);
    });
  }

  function decorateCompare() {
    if (!window.state || state.screen !== "compare" || typeof scenarios !== "function" || typeof cartEntries !== "function") return;
    const rows = scenarios();
    const products = cartEntries();
    const plans = [...document.querySelectorAll(".plan")];
    plans.forEach((plan, index) => {
      if (plan.querySelector(".td-plan-source")) return;
      const row = rows[index];
      if (!row) return;
      const real = products.filter(product => getMeta(product, row.id, row.channel)).length;
      const source = document.createElement("div");
      source.className = `td-plan-source${real ? " real" : ""}`;
      source.textContent = real
        ? `${real} из ${products.length} цен подтверждены каталогом сети`
        : "Сейчас расчёт на учебных ценах";
      const sum = plan.querySelector(".sum");
      if (sum) sum.insertAdjacentElement("afterend", source);
      else plan.appendChild(source);
    });
  }

  function decorateHome() {
    if (!window.state || state.screen !== "home") return;
    const note = document.querySelector(".wrap .note");
    if (!note || note.dataset.provenanceReady) return;
    note.dataset.provenanceReady = "1";
    const live = window.TDRetailerPriceState && (window.TDRetailerPriceState.overlays || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
    note.textContent = live
      ? `Уже есть ${live} подтверждённых цен из публичного каталога Перекрёстка. Остальные позиции пока считаются по учебным данным и помечаются отдельно.`
      : "Пока здесь учебные цены. Когда есть подтверждённая цена из каталога сети, мы помечаем её отдельно и показываем источник.";
  }

  function decorate() {
    injectStyle();
    decorateHome();
    decorateItems();
    decorateCompare();
  }

  const previousRender = window.render;
  if (typeof previousRender === "function") {
    window.render = function () {
      const result = previousRender.apply(this, arguments);
      requestAnimationFrame(decorate);
      return result;
    };
  }

  window.addEventListener("td:retailer-prices-applied", () => requestAnimationFrame(decorate));
  requestAnimationFrame(decorate);
})();
