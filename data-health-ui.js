(function () {
  "use strict";

  function injectStyle() {
    if (document.getElementById("td-data-health-style")) return;
    const style = document.createElement("style");
    style.id = "td-data-health-style";
    style.textContent = `
      .td-data-health{margin:0 0 12px;padding:11px 12px;border-radius:15px;background:#eef8f1;color:#176b47;font-size:11px;font-weight:800;line-height:1.4;border:1px solid rgba(15,123,74,.08)}
      .td-data-health.warn{background:#fff4df;color:#835700;border-color:#f2dfb7}.td-data-health.bad{background:#f8ece8;color:#8d4334;border-color:#ecd0c8}
      .td-data-health strong{display:block;font-size:12px;margin-bottom:2px}.td-data-health small{display:block;font-size:10px;font-weight:700;opacity:.82;margin-top:3px}
    `;
    document.head.appendChild(style);
  }

  function retailerSummary() {
    const state = window.TDRetailerPriceState;
    if (!state) return null;
    const overlays = Array.isArray(state.overlays) ? state.overlays : [];
    const fresh = overlays.filter(item => item.freshness === "fresh" && item.usable).length;
    const stale = overlays.filter(item => item.freshness === "stale" && item.usable).length;
    const blocked = overlays.filter(item => !item.usable).length + ((state.loadIssues || []).length);
    const confirmedPrices = overlays.reduce((sum, item) => sum + Number(item.count || 0), 0);
    return { fresh, stale, blocked, confirmedPrices, overlays, loadIssues: state.loadIssues || [] };
  }

  function collectorSummary() {
    const data = window.TDCollectorHealth;
    if (!data || !data.collectors) return { errors: 0, healthy: 0, unknown: 0 };
    const values = Object.values(data.collectors);
    return {
      errors: values.filter(item => item && item.status === "error").length,
      healthy: values.filter(item => item && item.status === "healthy").length,
      unknown: values.filter(item => !item || item.status === "not_observed").length
    };
  }

  function text() {
    const retailers = retailerSummary();
    const collectors = collectorSummary();
    if (!retailers) return { level: "warn", title: "Проверяем свежесть цен", body: "Источники ещё загружаются.", detail: "Сравнение не получает статус подтверждённого, пока проверка не завершена." };

    let level = "ok";
    if (retailers.blocked || collectors.errors) level = "bad";
    else if (retailers.stale || collectors.unknown) level = "warn";

    const parts = [];
    if (retailers.fresh) parts.push(`${retailers.fresh} свеж. источн.`);
    if (retailers.stale) parts.push(`${retailers.stale} устаревающ.`);
    if (retailers.blocked) parts.push(`${retailers.blocked} заблокир.`);
    if (!parts.length) parts.push("нет активных подтверждённых источников");

    let detail = `${retailers.confirmedPrices} цен сейчас подтверждены retailer-данными.`;
    if (retailers.stale) detail += " Данные старше 36 часов помечаются как устаревающие.";
    if (retailers.blocked) detail += " Источники старше 72 часов, с неверной географией или ошибкой загрузки не применяются.";
    if (collectors.errors) detail += ` Collector errors: ${collectors.errors}; старые проверенные данные не перезаписываются.`;

    return { level, title: "Качество данных", body: parts.join(" · "), detail };
  }

  function mount() {
    if (!document.body) return;
    injectStyle();
    const app = document.getElementById("app");
    if (!app) return;
    const data = text();
    let box = document.querySelector(".td-data-health");
    if (!box) {
      box = document.createElement("div");
      box.className = "td-data-health";
      const note = app.querySelector(".note");
      const toggle = app.querySelector(".toggle");
      if (note) note.insertAdjacentElement("afterend", box);
      else if (toggle) toggle.insertAdjacentElement("afterend", box);
      else return;
    }
    box.className = `td-data-health${data.level === "warn" ? " warn" : data.level === "bad" ? " bad" : ""}`;
    box.innerHTML = `<strong>${data.title}</strong>${data.body}<small>${data.detail}</small>`;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(mount));
  const start = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    requestAnimationFrame(mount);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  window.addEventListener("td:retailer-health", () => requestAnimationFrame(mount));
  window.addEventListener("td:collector-health", () => requestAnimationFrame(mount));
})();
