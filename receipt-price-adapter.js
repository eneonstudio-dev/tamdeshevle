(function () {
  "use strict";

  function ensureMeta(product, storeId) {
    product.priceMeta = product.priceMeta || {};
    product.priceMeta[storeId] = product.priceMeta[storeId] || {};
    return product.priceMeta[storeId];
  }

  function applyCandidate(products, candidate) {
    if (!candidate || candidate.eligible_for_ranking !== true || candidate.scope_verified !== true) {
      return { applied: false, reason: "candidate_not_verified" };
    }
    if (!candidate.product_id || !candidate.store_id || !Number.isFinite(Number(candidate.price))) {
      return { applied: false, reason: "candidate_incomplete" };
    }

    const product = (products || []).find(item => item && item.id === candidate.product_id);
    if (!product) return { applied: false, reason: "product_not_found" };

    const storeId = candidate.store_id;
    const price = Number(candidate.price);
    product.prices = product.prices || {};

    const meta = ensureMeta(product, storeId);
    const existing = meta.shelf || null;
    const existingTs = existing && existing.observed_at ? new Date(existing.observed_at).getTime() : -Infinity;
    const candidateTs = candidate.observed_at ? new Date(candidate.observed_at).getTime() : -Infinity;

    if (existing && existing.kind === "retailer" && existing.freshness !== "expired" && existing.freshness !== "invalid") {
      return { applied: false, reason: "fresh_retailer_price_has_priority" };
    }
    if (Number.isFinite(existingTs) && Number.isFinite(candidateTs) && candidateTs < existingTs) {
      return { applied: false, reason: "older_than_existing_price" };
    }

    product.prices[storeId] = price;
    meta.shelf = {
      kind: "receipt",
      trust: "verified_receipt",
      freshness: candidate.freshness || "fresh",
      observed_at: candidate.observed_at || null,
      proof_ref: candidate.proof_ref || null,
      scope_verified: true,
      proof_verified: candidate.proof_verified === true,
      identity_verified: candidate.identity_verified === true,
      verification_kind: candidate.verification_kind || "receipt"
    };

    return { applied: true, product_id: product.id, store_id: storeId, price };
  }

  function applyPromotion(products, promotion) {
    const candidates = promotion && Array.isArray(promotion.candidates) ? promotion.candidates : [];
    const results = candidates.map(candidate => applyCandidate(products, candidate));
    return {
      applied: results.filter(result => result.applied).length,
      skipped: results.filter(result => !result.applied).length,
      results
    };
  }

  window.TDReceiptPriceAdapter = { applyCandidate, applyPromotion };
})();
