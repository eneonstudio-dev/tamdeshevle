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
      return count ? `${store.name}: ${count} поз.` : null;
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

  function savingCopy(result, two) {
    const delivery = two.channels && Object.values(two.channels).includes("bring");
    if (result.netSaving != null) {
      return delivery
        ? `С учётом известных тарифов доставки: −${money(result.netSaving)}`
        : `С учётом заданной стоимости второго захода: −${money(result.netSaving)}`;
    }
    return `По ценам товаров: до −${money(result.extraSaving)}. Дорога и время второго магазина пока не учтены.`;
  }

  function buildCard(result) {
    const one = result.bestOne;
    const two = result.bestTwo;
    if (!one || !two || !result.worthSplitting || !(result.extraSaving > 0)) return null;
    const delivery = two.channels && Object.values(two.channels).includes("bring");

    const card = document.createElement("section");
    card.className = "split-basket";
    card.setAttribute("data-split-basket", "");
    card.setAttribute("aria-label", "Сравнение одного и двух магазинов");
    card.innerHTML = `
      <div class="split-basket__eyebrow">ВАРИАНТ · ДВА МАГАЗИНА</div>
      <div class="split-basket__title">Разделить корзину между двумя магазинами</div>
      <div class="split-basket__grid">
        <div class="split-basket__option">
          <div class="split-basket__label">Один магазин</div>
          <div class="split-basket__sum">${money(one.total)}</div>
          <div class="split-basket__stores">${storeNames(one)}</div>
        </div>
        <div class="split-basket__option best">
          <div class="split-basket__label">Два магазина</div>
          <div class="split-basket__sum">${money(two.total)}</div>
          <div class="split-basket__stores">${storeNames(two)}</div>
        </div>
      </div>
      <div class="split-basket__save">${savingCopy(result, two)}</div>
      <div class="split-basket__note">${allocationSummary(two)} · используются только подтверждённые цены${delivery ? " и известные условия доставки" : ""}.</div>
      ${!delivery ? settingsHtml(result) : ""}
      <details class="split-basket__details"><summary>Что брать в каждом магазине</summary>${allocationLines(two)}</details>
      <p class="split-basket__disclaimer">Votonobay показывает распределение корзины, но не оформляет два заказа автоматически. Наличие и финальную сумму подтверждает каждый магазин.</p>
    `;
    return card;
  }

  function settingsHtml(result) {
    const x = window.TDAssemblyPreferences?.read() || { minutes: 0, rubPerMinute: 0, transportRub: 0 };
    const configured = window.TDAssemblyPreferences?.hasConfiguredCost?.() === true;
    return `<details class="split-basket__details split-basket__cost"><summary>${configured ? "Изменить стоимость дороги и времени" : "Учесть дорогу и время"}</summary><label>Лишний крюк, минут <input data-assembly="minutes" type="number" min="0" max="180" inputmode="numeric" value="${x.minutes}"></label><label>Цена минуты, ₽ <input data-assembly="rubPerMinute" type="number" min="0" max="100" inputmode="decimal" value="${x.rubPerMinute}"></label><label>Транспорт, ₽ <input data-assembly="transportRub" type="number" min="0" max="5000" inputmode="numeric" value="${x.transportRub}"></label><small>${configured ? `Учтённая стоимость второго магазина: ${money(result.operationalCost || 0)}.` : "Пока эти поля не сохранены, Votonobay не называет экономию «чистой»."}</small></details>`;
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
  if (app && typeof MutationObserver === "function") new MutationObserver(enhance).observe(app, { childList: true, subtree: true });
  window.addEventListener("td:runtime-ready", enhance);
  window.addEventListener("td:assembly-settings", () => { document.querySelector("[data-split-basket]")?.remove(); enhance(); });
  document.addEventListener("change", event => {
    const input = event.target.closest?.("[data-assembly]");
    if (!input || !window.TDAssemblyPreferences) return;
    TDAssemblyPreferences.save({ [input.dataset.assembly]: Number(input.value) || 0 });
  });
  setTimeout(enhance, 0);

  window.TDBasketSplitUI = { enhance, buildCard, savingCopy };
})();
