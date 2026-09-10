(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  function api() { return window.TDReceiptLocal || null; }

  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function renderList(root) {
    const tools = api();
    if (!tools) return;
    const drafts = tools.loadDrafts();
    const list = root.querySelector(".receipt-local-list");
    const count = root.querySelector("[data-receipt-count]");
    if (count) count.textContent = String(drafts.length);
    if (!list) return;
    if (!drafts.length) {
      list.innerHTML = '<div class="receipt-local-empty">Пока пусто. Добавь чек — он останется только на этом устройстве.</div>';
      return;
    }
    list.innerHTML = drafts.slice(0, 20).map(draft => {
      const summary = tools.summarizeDraft(draft);
      const observation = draft && draft.observation || {};
      const first = Array.isArray(observation.items) ? observation.items[0] : null;
      const title = first && first.receipt_name || "Чек";
      const strength = summary.strong_match_count > 0 ? "штрихкод/SKU" : (summary.matched_count > 0 ? "сопоставлен по названию" : "не сопоставлен");
      return `<div class="receipt-local-row"><div><b>${esc(title)}</b><small>${esc(summary.store_id || "магазин")} · ${esc(formatDate(summary.observed_at))}</small></div><span>${esc(strength)}</span></div>`;
    }).join("");
    window.dispatchEvent(new CustomEvent("td:receipt-local-list-rendered"));
  }

  function openPanel() {
    if (document.querySelector(".receipt-local-backdrop")) return;
    const tools = api();
    if (!tools) return;
    const overlay = document.createElement("div");
    overlay.className = "receipt-local-backdrop";
    overlay.innerHTML = `<section class="receipt-local-sheet" role="dialog" aria-modal="true" aria-label="Черновики чеков">
      <div class="receipt-local-head"><div><h2>Чеки на устройстве</h2><p><b data-receipt-count>0</b> черновиков. Ни один не участвует в рейтинге.</p></div><button type="button" class="receipt-local-close" aria-label="Закрыть">×</button></div>
      <div class="receipt-local-actions"><button type="button" data-action="export">Скачать JSON-копию</button><label>Импорт JSON<input type="file" accept="application/json,.json" data-action="import" hidden></label></div>
      <div class="receipt-local-status" hidden></div><div class="receipt-local-list"></div>
      <button type="button" class="receipt-local-clear" data-action="clear">Очистить локальные черновики</button>
      <div class="receipt-local-foot">Нажми на чек, чтобы Бай локально проверил поля. Даже после такой проверки чек остаётся <b>rankable:false</b> до настоящего proof.</div>
    </section>`;
    document.body.appendChild(overlay);
    renderList(overlay);
    const status = overlay.querySelector(".receipt-local-status");
    const close = () => overlay.remove();
    overlay.querySelector(".receipt-local-close").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-action="export"]').addEventListener("click", () => {
      const count = tools.downloadExport(); status.hidden = false; status.textContent = `Сохранила JSON-копию: ${count} чек(ов).`;
    });
    overlay.querySelector('[data-action="import"]').addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      try { const result = await tools.importFile(file); status.hidden = false; status.textContent = `Импорт: ${result.imported}; пропущено: ${result.rejected}. В рейтинг ничего не попало.`; renderList(overlay); }
      catch (_) { status.hidden = false; status.textContent = "Не смогла прочитать JSON-файл."; }
      event.target.value = "";
    });
    overlay.querySelector('[data-action="clear"]').addEventListener("click", () => {
      if (!window.confirm("Удалить локальные черновики чеков с этого устройства?")) return;
      tools.clearDrafts(); status.hidden = false; status.textContent = "Локальные черновики удалены."; renderList(overlay);
    });
  }

  function mount() {
    const cta = document.querySelector(".receipt-entry-cta");
    if (!cta || document.querySelector(".receipt-local-open")) return;
    const button = document.createElement("button");
    button.type = "button"; button.className = "receipt-local-open";
    button.innerHTML = '<span>Мои чеки на устройстве</span><b>↔</b>';
    button.addEventListener("click", openPanel); cta.insertAdjacentElement("afterend", button);
  }

  function loadReview() {
    if (window.TDReceiptLocalReview || document.querySelector('script[data-td-receipt-review]')) return;
    const script = document.createElement("script");
    script.src = "receipt-local-review.js?v=20260910-local-review-v1";
    script.dataset.tdReceiptReview = "1";
    document.head.appendChild(script);
  }

  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("td:receipt-draft-saved", mount);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mount(); loadReview(); }, { once: true });
  else { mount(); loadReview(); }
  window.TDReceiptLocalPanel = { open: openPanel, mount, renderList };
})();