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
      .td-coverage{margin-top:8px;padding:9px 10px;border-radius:12px;background:#eef8f1;color:#176b47;font-size:11px;font-weight:800;line-height:1.35}
      .td-coverage.incomplete{background:#fff3dd;color:#8a5a00}
      .td-coverage.blocked{background:#f5ece9;color:#914b3b}
      .td-coverage small{display:block;margin-top:3px;font-size:10px;font-weight:700;opacity:.82}
      .td-incomplete-sum{font-size:17px!important;line-height:1.15!important;color:#8a5a00!important}
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

  function missingNames(row) {
    if (!row || !Array.isArray(row.missingProductIds) || typeof PRODUCTS === "undefined") return [];
    return row.missingProductIds.map(id => {
      const product = PRODUCTS.find(item => item.id === id);
      return product ? product.name : id;
    });
  }

  function coverageText(row, totalProducts) {
    const coverage = row && row.coverage || {};
    const priced = Number.isFinite(coverage.priced) ? coverage.priced : Math.max(0, totalProducts - (row.missingProductIds || []).length);
    const total = Number.isFinite(coverage.total) ? coverage.total : totalProducts;
    return `${priced} из ${total} товаров имеют цену`;
  }

  function decorateCompare() {
    if (!window.state || state.screen !== "compare" || typeof scenarios !== "function" || typeof cartEntries !== "function") return;
    const rows = scenarios();
    const products = cartEntries();
    const plans = [...document.querySelectorAll(".plan")];
    plans.forEach((plan, index) => {
      const row = rows[index];
      if (!row) return;

      if (!plan.querySelector(".td-plan-source")) {
        const real = products.filter(product => getMeta(product, row.id, row.channel)).length;
        const source = document.createElement("div");
        source.className = `td-plan-source${real ? " real" : ""}`;
        source.textContent = real
          ? `${real} из ${products.length} цен подтверждены каталогом сети`
          : "Сейчас расчёт на учебных ценах";
        const sum = plan.querySelector(".sum");
        if (sum) sum.insertAdjacentElement("afterend", source);
        else plan.appendChild(source);
      }

      if (plan.querySelector(".td-coverage")) return;
      const box = document.createElement("div");
      const missing = missingNames(row);
      const feeUnknown = row.feeKnown === false && row.channel === "bring";
      const complete = row.rankable !== false && !missing.length && !feeUnknown;
      box.className = `td-coverage${complete ? "" : feeUnknown ? " blocked" : " incomplete"}`;

      if (complete) {
        box.textContent = `${coverageText(row, products.length)} · итог можно сравнивать`;
      } else if (missing.length) {
        box.innerHTML = `${coverageText(row, products.length)} · итог пока нельзя сравнить<small>Нет цены: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3}` : ""}</small>`;
      } else if (feeUnknown) {
        box.innerHTML = `Товары посчитаны, но итог пока нельзя сравнить<small>Неизвестна стоимость доставки</small>`;
      } else {
        box.textContent = "Недостаточно данных для точного сравнения";
      }

      const sum = plan.querySelector(".sum");
      if (row.total == null && sum) {
        sum.textContent = "Итог уточняется";
        sum.classList.add("td-incomplete-sum");
      }
      const source = plan.querySelector(".td-plan-source");
      if (source) source.insertAdjacentElement("afterend", box);
      else plan.appendChild(box);
    });
  }

  function decorateHome() {
    if (!window.state || state.screen !== "home") return;
    const note = document.querySelector(".wrap .note");
    if (!note || note.dataset.provenanceReady) return;
    note.dataset.provenanceReady = "1";
    const overlays = window.TDRetailerPriceState && window.TDRetailerPriceState.overlays || [];
    const live = overlays.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const retailers = [...new Set(overlays.filter(item => Number(item.count || 0) > 0).map(item => item.retailer))];
    note.textContent = live
      ? `Уже есть ${live} подтверждённых цен из публичных каталогов${retailers.length ? ` (${retailers.join(", ")})` : ""}. Неполные корзины не участвуют в рейтинге до появления всех нужных цен.`
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
