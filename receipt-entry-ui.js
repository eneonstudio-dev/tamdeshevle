(function () {
  "use strict";

  const STORAGE_KEY = "td:receipt-drafts:v1";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  function stores() {
    return typeof STORES !== "undefined" && Array.isArray(STORES)
      ? STORES.filter(store => store && store.kind !== "delivery")
      : [];
  }

  function products() {
    return typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS) ? PRODUCTS : [];
  }

  function currentState() {
    if (window.TDData && window.TDData.state) return window.TDData.state;
    try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; }
  }

  function selectedPoint() {
    try {
      const point = JSON.parse(localStorage.getItem("td:selected-store-point") || "null");
      if (!point || !point.id || !point.chainId || !point.storeId || !point.address || !point.scopeMethod || Number(point.scopeConfidence) < 0.75) return null;
      return point;
    } catch (_) { return null; }
  }

  function loadDrafts() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function saveDraft(observation, localPhotoName) {
    const drafts = loadDrafts();
    drafts.unshift({ saved_at: new Date().toISOString(), local_photo_name: localPhotoName || null, observation });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, 20)));
  }

  function storeOptions(selectedId) {
    return stores().map(store => `<option value="${esc(store.id)}"${store.id === selectedId ? " selected" : ""}>${esc(store.name || store.id)}</option>`).join("");
  }

  function productOptions() {
    return `<option value="">Не сопоставлен</option>` + products().map(product => `<option value="${esc(product.id)}">${esc(product.name || product.id)}</option>`).join("");
  }

  function openSheet() {
    if (document.querySelector(".receipt-entry-backdrop")) return;
    const stateNow = currentState() || {};
    const point = selectedPoint();
    const selectedStore = stores().find(store => store.id === (point ? point.chainId : stateNow.storeId)) || stores()[0] || null;
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const overlay = document.createElement("div");
    overlay.className = "receipt-entry-backdrop";
    overlay.innerHTML = `
      <section class="receipt-entry-sheet" role="dialog" aria-modal="true" aria-label="Добавить чек">
        <div class="receipt-entry-head">
          <div><h2>Добавить чек</h2><p>Пока сохраняем безопасный черновик. На сравнение цен он не влияет.</p></div>
          <button class="receipt-entry-close" type="button" aria-label="Закрыть">×</button>
        </div>
        <div class="receipt-entry-note">${point ? `Чек будет привязан к выбранной точке: ${esc(point.address)}.` : "Точная точка не выбрана. Адрес можно сохранить в черновике, но он не подтверждает магазин — выбери точку на карте перед отправкой."}</div>
        <form class="receipt-entry-form">
          <div class="receipt-entry-grid">
            <div class="receipt-entry-field"><label>Магазин</label><select name="store_id" required>${storeOptions(selectedStore && selectedStore.id)}</select></div>
            <div class="receipt-entry-field"><label>Дата и время</label><input name="observed_at" type="datetime-local" value="${localDateTime}" required></div>
            <div class="receipt-entry-field full"><label>Адрес магазина</label><input name="address" autocomplete="street-address" placeholder="Москва, Кировоградская улица, 17" value="${esc(point && point.address || "")}"${point ? " readonly" : ""} required></div>
            <div class="receipt-entry-field full"><label>Название в чеке</label><input name="receipt_name" placeholder="Молоко 3.2% 930 мл" required></div>
            <div class="receipt-entry-field"><label>Цена строки, ₽</label><input name="price" inputmode="decimal" type="number" min="0.01" step="0.01" required></div>
            <div class="receipt-entry-field"><label>Количество</label><input name="quantity" inputmode="decimal" type="number" min="0.001" step="0.001" value="1" required></div>
            <div class="receipt-entry-field full"><label>Товар в Тамдешевле</label><select name="product_id">${productOptions()}</select></div>
            <div class="receipt-entry-field"><label>Штрихкод</label><input name="barcode" inputmode="numeric" placeholder="Необязательно"></div>
            <div class="receipt-entry-field"><label>Фото чека</label><div class="receipt-entry-file"><input name="photo" type="file" accept="image/*" capture="environment"></div></div>
          </div>
          <button class="receipt-entry-save" type="submit">Сохранить черновик</button>
          <button class="receipt-entry-submit" type="button" disabled>Отправить фото на проверку</button>
          <div class="receipt-entry-status" hidden></div>
        </form>
      </section>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector(".receipt-entry-close").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });

    const form = overlay.querySelector(".receipt-entry-form");
    const queueButton = form.querySelector(".receipt-entry-submit");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector(".receipt-entry-status");
      const data = new FormData(form);
      const storeId = String(data.get("store_id") || "");
      const store = stores().find(item => item.id === storeId) || null;
      const currentPoint = selectedPoint();
      const scopedPoint = currentPoint && currentPoint.chainId === storeId ? currentPoint : null;
      const productId = String(data.get("product_id") || "").trim() || null;
      const barcode = String(data.get("barcode") || "").trim() || null;
      const matchMethod = productId ? (barcode ? "barcode" : "name") : "unmatched";
      const localPhoto = form.elements.photo && form.elements.photo.files && form.elements.photo.files[0];

      if (!window.TDReceiptObservations) {
        status.hidden = false;
        status.className = "receipt-entry-status warn";
        status.textContent = "Модуль чеков пока недоступен.";
        return;
      }

      const observation = window.TDReceiptObservations.create({
        source: "manual_receipt",
        receipt_id: `local-${Date.now()}`,
        observed_at: new Date(String(data.get("observed_at"))).toISOString(),
        store: {
          chain_id: store ? store.id : storeId,
          store_id: scopedPoint ? scopedPoint.storeId : storeId,
          external_store_id: scopedPoint ? scopedPoint.id : null,
          address: String(data.get("address") || "").trim(),
          scope_source: scopedPoint ? "verified_store_point" : "manual_address",
          scope_method: scopedPoint ? scopedPoint.scopeMethod : null,
          scope_confidence: scopedPoint ? Number(scopedPoint.scopeConfidence) : null
        },
        items: [{
          receipt_name: String(data.get("receipt_name") || "").trim(),
          barcode,
          product_id: productId,
          match_method: matchMethod,
          price: Number(data.get("price")),
          quantity: Number(data.get("quantity")) || 1,
          currency: "RUB"
        }]
      });

      const validation = window.TDReceiptObservations.validate(observation);
      if (!validation.ok) {
        status.hidden = false;
        status.className = "receipt-entry-status warn";
        status.textContent = `Не сохранила: ${validation.errors.join(", ")}`;
        return;
      }

      saveDraft(observation, localPhoto ? localPhoto.name : null);
      form._receiptObservation = observation;
      form._receiptPhoto = localPhoto || null;
      queueButton.disabled = !(localPhoto && window.TDAuth && typeof window.TDAuth.submitReceiptEvidence === "function");
      status.hidden = false;
      status.className = "receipt-entry-status ok";
      status.textContent = localPhoto
        ? (queueButton.disabled ? "Черновик сохранён. Чтобы отправить фото на проверку, сначала войди в аккаунт." : "Черновик сохранён. Фото ещё не отправлено — нажми кнопку ниже.")
        : "Черновик сохранён. Он не участвует в рейтинге до подтверждения чека.";
      window.dispatchEvent(new CustomEvent("td:receipt-draft-saved", { detail: { observation } }));
    });
    queueButton.addEventListener("click", async () => {
      const status = form.querySelector(".receipt-entry-status");
      if (!form._receiptObservation || !form._receiptPhoto) { status.hidden = false; status.className = "receipt-entry-status warn"; status.textContent = "Сначала сохрани черновик с фото чека."; return; }
      queueButton.disabled = true; status.hidden = false; status.className = "receipt-entry-status"; status.textContent = "Отправляем защищённое фото на проверку…";
      try {
        const result = await window.TDAuth.submitReceiptEvidence({ observation: form._receiptObservation, file: form._receiptPhoto });
        status.className = "receipt-entry-status ok";
        status.textContent = `Чек отправлен в очередь проверки · ${result.status}. До ручного подтверждения цена не влияет на рейтинг.`;
      } catch (error) {
        const code = String(error && error.message || error);
        status.className = "receipt-entry-status warn";
        status.textContent = code === "SIGN_IN_REQUIRED" ? "Войди в аккаунт, чтобы отправить чек." : code === "RECEIPT_FILE_INVALID" ? "Нужен JPG, PNG, WEBP или HEIC до 10 МБ." : "Не удалось отправить чек. Черновик остался на устройстве.";
      } finally { queueButton.disabled = false; }
    });
  }

  function mount() {
    const wrap = document.querySelector("#app .wrap");
    if (!wrap || wrap.querySelector(".receipt-entry-cta")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "receipt-entry-cta";
    button.innerHTML = `<span>Есть чек? Помоги Баю сверить цену<small>Сохраним черновик, в рейтинг без проверки не пустим</small></span><b>＋</b>`;
    button.addEventListener("click", openSheet);
    const hero = wrap.querySelector(".hero");
    if (hero && hero.nextSibling) wrap.insertBefore(button, hero.nextSibling);
    else wrap.prepend(button);
  }

  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();

  window.TDReceiptEntry = { open: openSheet, loadDrafts };
})();
