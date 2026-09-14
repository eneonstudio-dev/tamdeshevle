(function () {
  "use strict";

  const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_FUTURE_TOLERANCE_MS = 15 * 60 * 1000;
  const STRONG_MATCH = new Set(["barcode", "sku"]);

  function ageMs(observedAt, now) {
    const observed = new Date(observedAt).getTime();
    const current = now == null ? Date.now() : new Date(now).getTime();
    if (!Number.isFinite(observed) || !Number.isFinite(current)) return Infinity;
    return Math.max(0, current - observed);
  }

  function verifyObservation(observation, options) {
    const opts = options || {};
    const maxAgeMs = Number.isFinite(opts.maxAgeMs) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;
    const futureToleranceMs = Number.isFinite(opts.futureToleranceMs)
      ? Math.max(0, opts.futureToleranceMs)
      : DEFAULT_FUTURE_TOLERANCE_MS;
    const now = opts.now;
    const contract = window.TDReceiptObservations;
    const validation = contract && typeof contract.validate === "function"
      ? contract.validate(observation)
      : { ok: false, errors: ["receipt observation contract unavailable"] };

    const reasons = [];
    if (!validation.ok) reasons.push(...validation.errors);
    if (!observation || !observation.verification || observation.verification.store_scope_verified !== true) {
      reasons.push("exact store scope required");
    }
    const proof = observation && observation.proof || {};
    if (!(proof.image_ref || proof.fiscal_sign || proof.raw_text_ref)) reasons.push("receipt proof required");

    if (observation) {
      const observedMs = new Date(observation.observed_at).getTime();
      const currentMs = now == null ? Date.now() : new Date(now).getTime();
      if (!Number.isFinite(observedMs) || !Number.isFinite(currentMs)) {
        reasons.push("invalid receipt timestamp");
      } else if (observedMs - currentMs > futureToleranceMs) {
        reasons.push("receipt timestamp is in the future");
      } else if (currentMs - observedMs > maxAgeMs) {
        reasons.push("receipt is stale");
      }
    }

    return {
      ok: reasons.length === 0,
      status: reasons.length === 0 ? "verified_receipt" : "rejected",
      reasons,
      observed_at: observation && observation.observed_at || null,
      store: observation && observation.store || null,
      eligible_for_history: reasons.length === 0,
      // A receipt proves a purchase-time observation, not current stock. Store-plan ranking
      // therefore needs a separate, explicit current-availability signal downstream.
      eligible_for_ranking: false
    };
  }

  function promote(observation, options) {
    const gate = verifyObservation(observation, options);
    if (!gate.ok) return { gate, candidates: [] };

    const raw = window.TDReceiptObservations.toPriceCandidates(observation);
    const candidates = raw.map(candidate => {
      const item = observation.items.find(line =>
        line.product_id === candidate.product_id && Number(line.unit_price) === Number(candidate.price)
      );
      const strongIdentity = Boolean(item && STRONG_MATCH.has(item.match_method));
      // Receipt evidence alone can establish a fresh purchase-price observation, but it
      // cannot establish that the item is still available for a new purchase right now.
      const rankingEligible = strongIdentity && candidate.scope_verified === true &&
        candidate.availability_verified === true && candidate.availability === "in_stock";

      return Object.assign({}, candidate, {
        verification_kind: "receipt",
        freshness: "fresh",
        proof_verified: true,
        identity_verified: strongIdentity,
        availability: candidate.availability || null,
        availability_verified: candidate.availability_verified === true,
        eligible_for_history: true,
        eligible_for_ranking: rankingEligible,
        // Keep legacy rankable false until an explicit adapter writes this into product priceMeta.
        // Even then, comparison requires separately verified current availability.
        rankable: false,
        promotion_reason: rankingEligible
          ? "Exact-store fresh receipt price plus independently verified current availability."
          : strongIdentity
            ? "Receipt verifies exact-store purchase price and identity, but not current availability; keep it history-only/non-rankable until stock is independently verified."
            : "Receipt is valid price evidence, but product identity is not strong enough for ranking."
      });
    });

    return { gate, candidates };
  }

  window.TDReceiptVerification = {
    DEFAULT_MAX_AGE_MS,
    DEFAULT_FUTURE_TOLERANCE_MS,
    ageMs,
    verifyObservation,
    promote
  };
})();
