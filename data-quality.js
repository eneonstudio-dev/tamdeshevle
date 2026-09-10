(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.window === root) root.TDDataQuality = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HOUR = 60 * 60 * 1000;
  const DEFAULT_POLICY = Object.freeze({
    freshHours: 36,
    staleHours: 72,
    futureToleranceMinutes: 15
  });

  function finiteDate(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function assessTimestamp(value, nowValue, policyValue) {
    const policy = Object.assign({}, DEFAULT_POLICY, policyValue || {});
    const checkedMs = finiteDate(value);
    const nowMs = finiteDate(nowValue) == null ? Date.now() : finiteDate(nowValue);
    if (checkedMs == null) return { status: "invalid", usable: false, ageHours: null, reason: "missing_or_invalid_timestamp" };
    const ageMs = nowMs - checkedMs;
    const futureTolerance = Number(policy.futureToleranceMinutes) * 60 * 1000;
    if (ageMs < -futureTolerance) return { status: "invalid", usable: false, ageHours: ageMs / HOUR, reason: "timestamp_in_future" };
    const ageHours = Math.max(0, ageMs / HOUR);
    if (ageHours <= Number(policy.freshHours)) return { status: "fresh", usable: true, ageHours, reason: null };
    if (ageHours <= Number(policy.staleHours)) return { status: "stale", usable: true, ageHours, reason: "older_than_fresh_window" };
    return { status: "expired", usable: false, ageHours, reason: "older_than_max_age" };
  }

  function assessOverlay(book, nowValue, policyValue) {
    if (!book || book.schema !== "tamdeshevle.retailer-price-overlay.v1") {
      return { status: "invalid", usable: false, reason: "invalid_schema", ageHours: null };
    }
    if (book.scope_verified !== true) {
      return { status: "unverified", usable: false, reason: "scope_not_verified", ageHours: null };
    }
    return assessTimestamp(book.checked_at, nowValue, policyValue);
  }

  function metaQuality(meta, nowValue, policyValue) {
    if (!meta || meta.kind !== "retailer") return { status: "estimated", usable: false, ageHours: null, reason: "not_retailer_price" };
    return assessTimestamp(meta.checkedAt, nowValue, policyValue);
  }

  function basketQuality(products, storeId, channel, nowValue, policyValue) {
    const list = Array.isArray(products) ? products : [];
    let fresh = 0, stale = 0, estimated = 0, expired = 0;
    for (const product of list) {
      const meta = product && product.priceMeta && product.priceMeta[storeId]
        ? product.priceMeta[storeId][channel === "bring" || channel === "delivery_catalog" ? "bring" : "shelf"]
        : null;
      const quality = metaQuality(meta, nowValue, policyValue);
      if (quality.status === "fresh") fresh += 1;
      else if (quality.status === "stale") stale += 1;
      else if (quality.status === "expired") expired += 1;
      else estimated += 1;
    }
    return { total: list.length, fresh, stale, expired, estimated, verified: fresh + stale };
  }

  return { DEFAULT_POLICY, assessTimestamp, assessOverlay, metaQuality, basketQuality };
});
