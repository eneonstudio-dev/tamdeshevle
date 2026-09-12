(function () {
  "use strict";

  const STORAGE_KEY = "td:receipt-drafts:v1";
  const EXPORT_SCHEMA = "td.receipt_drafts_export";
  const EXPORT_VERSION = 1;
  let storageError = null;

  function emitChanged(count) {
    try {
      window.dispatchEvent(new CustomEvent("td:receipt-drafts-changed", { detail: { count } }));
    } catch (_) {}
  }

  function loadDrafts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveDrafts(drafts) {
    const safe = Array.isArray(drafts) ? drafts.slice(0, 100) : [];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      storageError = null;
    } catch (error) {
      storageError = error || new Error("local storage unavailable");
      console.warn("Receipt draft storage unavailable", storageError);
      return null;
    }
    emitChanged(safe.length);
    return safe;
  }

  function validateDraft(draft) {
    const observation = draft && draft.observation;
    const contract = window.TDReceiptObservations;
    if (!observation || !contract || typeof contract.validate !== "function") {
      return { ok: false, errors: ["receipt contract unavailable"] };
    }
    return contract.validate(observation);
  }

  function summarizeDraft(draft) {
    const observation = draft && draft.observation || {};
    const items = Array.isArray(observation.items) ? observation.items : [];
    const strongMatches = items.filter(item => item && (item.match_method === "barcode" || item.match_method === "sku")).length;
    const matched = items.filter(item => item && item.product_id).length;
    const validation = validateDraft(draft);
    return {
      ok: validation.ok,
      errors: validation.errors || [],
      receipt_id: observation.receipt_id || null,
      store_id: observation.store && observation.store.store_id || null,
      address: observation.store && observation.store.address || null,
      observed_at: observation.observed_at || null,
      line_count: items.length,
      matched_count: matched,
      strong_match_count: strongMatches,
      local_photo_name: draft && draft.local_photo_name || null,
      rankable: false
    };
  }

  function exportPayload() {
    const drafts = loadDrafts();
    return {
      schema: EXPORT_SCHEMA,
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      rankable: false,
      drafts
    };
  }

  function downloadExport() {
    const payload = exportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `votonobay-receipts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return payload.drafts.length;
  }

  function normalizeImportedDraft(raw) {
    const draft = raw && raw.observation ? raw : { observation: raw };
    const validation = validateDraft(draft);
    if (!validation.ok) return { ok: false, errors: validation.errors || ["invalid receipt"] };
    return {
      ok: true,
      draft: {
        saved_at: draft.saved_at || new Date().toISOString(),
        local_photo_name: draft.local_photo_name || null,
        observation: draft.observation
      }
    };
  }

  function importPayload(payload) {
    let input = payload;
    if (typeof input === "string") {
      try { input = JSON.parse(input); }
      catch (_) { return { ok: false, imported: 0, rejected: 1, errors: ["invalid JSON"] }; }
    }

    let candidates = [];
    if (Array.isArray(input)) candidates = input;
    else if (input && input.schema === EXPORT_SCHEMA && Array.isArray(input.drafts)) candidates = input.drafts;
    else if (input && input.observation) candidates = [input];
    else if (input && input.schema === "td.receipt_observation") candidates = [{ observation: input }];
    else return { ok: false, imported: 0, rejected: 1, errors: ["unsupported receipt import format"] };

    const accepted = [];
    const errors = [];
    for (const candidate of candidates) {
      const normalized = normalizeImportedDraft(candidate);
      if (normalized.ok) accepted.push(normalized.draft);
      else errors.push(...normalized.errors);
    }

    const existing = loadDrafts();
    const seen = new Set(existing.map(draft => draft && draft.observation && draft.observation.receipt_id).filter(Boolean));
    const fresh = accepted.filter(draft => {
      const id = draft.observation && draft.observation.receipt_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (fresh.length && !saveDrafts([...fresh, ...existing])) {
      return {
        ok: false,
        imported: 0,
        rejected: candidates.length,
        errors: [...errors, "local receipt storage unavailable"]
      };
    }

    return {
      ok: fresh.length > 0 && errors.length === 0,
      imported: fresh.length,
      rejected: candidates.length - fresh.length,
      errors
    };
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("file required"));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsText(file);
    });
  }

  async function importFile(file) {
    const text = await readFile(file);
    return importPayload(text);
  }

  function clearDrafts() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      storageError = null;
    } catch (error) {
      storageError = error || new Error("local storage unavailable");
      console.warn("Receipt draft storage clear failed", storageError);
      return false;
    }
    emitChanged(0);
    return true;
  }

  window.TDReceiptLocal = {
    STORAGE_KEY,
    EXPORT_SCHEMA,
    EXPORT_VERSION,
    loadDrafts,
    saveDrafts,
    validateDraft,
    summarizeDraft,
    exportPayload,
    downloadExport,
    importPayload,
    importFile,
    clearDrafts,
    get storageError() { return storageError; }
  };
})();