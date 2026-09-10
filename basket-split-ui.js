(function () {
  "use strict";

  function money(value) {
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
  }

  function storeNames(option) {
    return option.stores.map(store => store.name).join(" + ");
  }

  function allocationSummary(option) {
    if (!option || !option.allocations) return "";
    return option.stores.map(store => {
      const count = (option.allocations[store.id] || []).length;
      return count ? `${store.name}: ${count}` : null;
    }).filter(Boolean).join(" · ");
  }

  function allocationLines(option) {
    if (!option || !option.allocations) return "";
    return option.stores.map(store => {
      const lines = option.allocations[store.id] || [];
      if (!lines.length) return "";
      const channel = option.channels && option.channels[store.id] === "bring" ? "доставка сети" : "полка";
      const sum = lines.reduce((total, line) => total + line.lineTotal, 0);
      return `<div class="split-basket__list-store"><b>${store.name}</b><span>${channel} · ${money(sum)}</span>${lines.map(line => `<div class="split-basket__line"><span>${line.name} × ${line.quantity}</span><span>${money(line.lineTotal)}</span></div>`).join("")}</div>`;
    }).join("");
  }

  function buildCard(result) {
    const one = result.bestOne;
    const two = result.bestTwo;
    if (!one || !two || !result.worthSplitting || !(result.extraSaving > 0)) return null;

    const card = document.createElement("section");
    card.className = "split-basket";
    card.setAttribute("data-split-basket", "");
    card.innerHTML = `
      <div class="split-basket__eyebrow">Эксперимент · 2 магазина</div>
      <div class="split-basket__title">Если разделить корзину, можно сэкономить ещё ↓</div>
      <div class="split-basket__grid">
        <div class="split-basket__option">
          <div class="split-basket__label">Всё в одном месте</div>
          <div class="split-basket__sum">${money(one.total)}</div>
          <div class="split-basket__stores">${storeNames(one)}</div>
        </div>
        <div class="split-basket__option best">
          <div class="split-basket__label">2 магазина</div>
          <div class="split-basket__sum">${money(two.total)}</div>
          <div class="split-basket__stores">${storeNames(two)}</div>
        </div>
      </div>
      <div class="split-basket__save">${result.netSaving != null ? `Чистая выгода по известным условиям: −${money(result.netSaving)}` : `Потенциально −${money(result.extraSaving)}`}</div>
      <div class="split-basket__note">${allocationSummary(two)} товара(ов) по магазинам. Только подтверждённые цены${two.channels && Object.values(two.channels).includes("bring") ? "; доставка сети включена, если тариф известен" : ""}. Маршрут и время не выдумываем.</div>
      <details class="split-basket__details"><summary>Что куда брать</summary>${allocationLines(two)}</details>
    `;
    return card;
  }

  function enhance() {
    if (!window.TDBasketSplit || !window.state || state.screen !== "compare") return;
    const app = document.getElementById("app");
    if (!app || app.querySelector("[data-split-basket]")) return;
    const wrap = app.querySelector(".wrap");
    const toggle = wrap && wrap.querySelector(".toggle");
    if (!wrap || !toggle) return;

    const card = buildCard(TDBasketSplit.fromWindow());
    if (card) toggle.insertAdjacentElement("afterend", card);
  }

  const app = document.getElementById("app");
  if (app) new MutationObserver(enhance).observe(app, { childList: true, subtree: true });
  window.addEventListener("td:runtime-ready", enhance);
  setTimeout(enhance, 0);

  window.TDBasketSplitUI = { enhance };
})();
