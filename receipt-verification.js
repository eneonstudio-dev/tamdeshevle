(function () {
  "use strict";

  const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
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
    if (observation && ageMs(observation.observed_at, now) > maxAgeMs) reasons.push("receipt is stale");

    return {
      ok: reasons.length === 0,
      status: reasons.length === 0 ? "verified_receipt" : "rejected",
      reasons,
      observed_at: observation && observation.observed_at || null,
      store: observation && observation.store || null,
      eligible_for_history: reasons.length === 0,
      // Ranking promotion is intentionally per-item and requires a strong identity match.
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
      const rankingEligible = strongIdentity && candidate.scope_verified === true;

      return Object.assign({}, candidate, {
        verification_kind: "receipt",
        freshness: "fresh",
        proof_verified: true,
        identity_verified: strongIdentity,
        eligible_for_history: true,
        eligible_for_ranking: rankingEligible,
        // Keep legacy rankable false until an explicit adapter writes this into product priceMeta.
        // This prevents accidental bypass of TDCompare's current retailer-only trust gate.
        rankable: false,
        promotion_reason: rankingEligible
          ? "Exact-store fresh receipt with strong product identity. Ready for explicit receipt-price adapter."
          : "Receipt is valid evidence, but product identity is not strong enough for ranking."
      });
    });

    return { gate, candidates };
  }

  window.TDReceiptVerification = {
    DEFAULT_MAX_AGE_MS,
    ageMs,
    verifyObservation,
    promote
  };
})();
