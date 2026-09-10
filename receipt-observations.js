(function () {
  "use strict";

  const VERSION = 1;
  const VALID_SOURCES = new Set(["receipt", "manual_receipt", "barcode_receipt"]);
  const VALID_MATCH = new Set(["barcode", "sku", "name", "unmatched"]);

  function cleanText(value) {
    const text = String(value == null ? "" : value).trim();
    return text || null;
  }

  function finitePositive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function isoDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function normalizeItem(item, index) {
    const source = item || {};
    const price = finitePositive(source.price);
    const quantity = finitePositive(source.quantity) || 1;
    const matchMethod = VALID_MATCH.has(source.match_method) ? source.match_method : "unmatched";
    const productId = cleanText(source.product_id);
    const barcode = cleanText(source.barcode);
    const receiptName = cleanText(source.receipt_name || source.name);

    return {
      line_index: Number.isInteger(source.line_index) ? source.line_index : index,
      receipt_name: receiptName,
      barcode,
      product_id: productId,
      match_method: matchMethod,
      price,
      quantity,
      unit_price: price == null ? null : price / quantity,
      currency: cleanText(source.currency) || "RUB",
      matched: Boolean(productId && matchMethod !== "unmatched")
    };
  }

  function create(input) {
    const source = input || {};
    const observedAt = isoDate(source.observed_at || source.purchased_at);
    const store = source.store || {};
    const items = Array.isArray(source.items) ? source.items.map(normalizeItem) : [];
    const receiptSource = VALID_SOURCES.has(source.source) ? source.source : "receipt";
    const storeId = cleanText(store.store_id || source.store_id);
    const chainId = cleanText(store.chain_id || source.chain_id);
    const address = cleanText(store.address || source.store_address);
    const externalStoreId = cleanText(store.external_store_id || source.external_store_id);
    const scopeSource = cleanText(store.scope_source || source.scope_source);
    const scopeMethod = cleanText(store.scope_method || source.scope_method);
    const scopeConfidence = Number(store.scope_confidence || source.scope_confidence);
    const exactStore = Boolean(storeId && externalStoreId && address && scopeSource === "verified_store_point" && scopeMethod && Number.isFinite(scopeConfidence) && scopeConfidence >= 0.75);

    const observation = {
      schema: "td.receipt_observation",
      version: VERSION,
      source: receiptSource,
      receipt_id: cleanText(source.receipt_id),
      observed_at: observedAt,
      store: {
        chain_id: chainId,
        store_id: storeId,
        external_store_id: externalStoreId,
        address,
        scope_source: scopeSource,
        scope_method: scopeMethod,
        scope_confidence: Number.isFinite(scopeConfidence) ? scopeConfidence : null
      },
      proof: {
        kind: "receipt",
        image_ref: cleanText(source.image_ref),
        fiscal_sign: cleanText(source.fiscal_sign),
        raw_text_ref: cleanText(source.raw_text_ref)
      },
      items,
      totals: {
        line_count: items.length,
        matched_count: items.filter(item => item.matched).length,
        observed_total: items.reduce((sum, item) => sum + (item.price || 0), 0)
      },
      verification: {
        store_scope_verified: exactStore,
        price_scope: exactStore ? "exact_store_receipt" : "receipt_unscoped",
        rankable: false,
        reason: exactStore
          ? "Receipt observation is exact-store evidence but requires promotion through the verification pipeline before ranking."
          : "Receipt is not linked to a verified store point; a typed address alone cannot participate in ranking."
      }
    };

    return observation;
  }

  function validate(observation) {
    const errors = [];
    if (!observation || observation.schema !== "td.receipt_observation") errors.push("invalid schema");
    if (!observation || observation.version !== VERSION) errors.push("unsupported version");
    if (!observation || !observation.observed_at) errors.push("missing observed_at");
    if (!observation || !observation.store || !observation.store.chain_id) errors.push("missing chain_id");
    if (!observation || !Array.isArray(observation.items) || !observation.items.length) errors.push("missing items");
    if (observation && Array.isArray(observation.items)) {
      observation.items.forEach((item, index) => {
        if (!finitePositive(item.price)) errors.push(`items[${index}] invalid price`);
        if (!finitePositive(item.quantity)) errors.push(`items[${index}] invalid quantity`);
        if (!item.receipt_name && !item.barcode && !item.product_id) errors.push(`items[${index}] missing identity`);
      });
    }
    return { ok: errors.length === 0, errors };
  }

  function toPriceCandidates(observation) {
    const checked = validate(observation);
    if (!checked.ok) return [];
    return observation.items
      .filter(item => item.matched && item.product_id && finitePositive(item.unit_price))
      .map(item => ({
        product_id: item.product_id,
        chain_id: observation.store.chain_id,
        store_id: observation.store.store_id,
        external_store_id: observation.store.external_store_id,
        address: observation.store.address,
        price: item.unit_price,
        observed_at: observation.observed_at,
        source: "receipt",
        proof_ref: observation.receipt_id || observation.proof.image_ref || null,
        scope_verified: observation.verification.store_scope_verified,
        rankable: false
      }));
  }

  window.TDReceiptObservations = { VERSION, create, validate, toPriceCandidates };
})();
