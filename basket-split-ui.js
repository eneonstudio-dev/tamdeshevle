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
      <div class="split-basket__save">Ещё −${money(result.extraSaving)}</div>
      <div class="split-basket__note">${allocationSummary(two)} товара(ов) по магазинам. Только подтверждённые цены. Пока без учёта маршрута и времени.</div>
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
