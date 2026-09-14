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
    const explicitNowMs = nowValue == null ? null : finiteDate(nowValue);
    const nowMs = nowValue == null ? Date.now() : explicitNowMs;
    if (checkedMs == null) return { status: "invalid", usable: false, ageHours: null, reason: "missing_or_invalid_timestamp" };
    if (nowMs == null) return { status: "invalid", usable: false, ageHours: null, reason: "invalid_reference_time" };
    const ageMs = nowMs - checkedMs;
    const futureTolerance = Number(policy.futureToleranceMinutes) * 60 * 1000;
    if (ageMs < -futureTolerance) return { status: "invalid", usable: false, ageHours: ageMs / HOUR, reason: "timestamp_in_future" };
    const ageHours = Math.max(0, ageMs / HOUR);
    if (ageHours <= Number(policy.freshHours)) return { status: "fresh", usable: true, ageHours, reason: null };
    if (ageHours <= Number(policy.staleHours)) return { status: "stale", usable: true, ageHours, reason: "older_than_fresh_window" };
    return { status: "expired", usable: false, ageHours, reason: "older_than_max_age" };
  }

  function calendarDate(value, timeZone) {
    const date = value == null ? new Date() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timeZone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      if (!values.year || !values.month || !values.day) return null;
      return `${values.year}-${values.month}-${values.day}`;
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  function assessCatalogPeriod(book, nowValue) {
    const context = book && book.catalog_context || {};
    const validFrom = typeof context.valid_from === "string" ? context.valid_from : null;
    const validTo = typeof context.valid_to === "string" ? context.valid_to : null;
    if (!validFrom && !validTo) {
      return { status: "not_applicable", usable: true, currentDate: null, validFrom, validTo, reason: null };
    }

    const timeZone = context.time_zone || (book && book.city === "msk" ? "Europe/Moscow" : "UTC");
    const currentDate = calendarDate(nowValue, timeZone);
    if (!currentDate) {
      return { status: "invalid", usable: false, currentDate: null, validFrom, validTo, reason: "invalid_reference_date" };
    }
    if (validFrom && currentDate < validFrom) {
      return { status: "not_started", usable: false, currentDate, validFrom, validTo, reason: "catalog_period_not_started" };
    }
    if (validTo && currentDate > validTo) {
      return { status: "expired", usable: false, currentDate, validFrom, validTo, reason: "catalog_period_expired" };
    }
    return { status: "current", usable: true, currentDate, validFrom, validTo, reason: null };
  }

  function assessOverlay(book, nowValue, policyValue) {
    if (!book || book.schema !== "tamdeshevle.retailer-price-overlay.v1") {
      return { status: "invalid", usable: false, estimateUsable: false, reason: "invalid_schema", ageHours: null };
    }

    const timestamp = assessTimestamp(book.checked_at, nowValue, policyValue);
    const catalogPeriod = assessCatalogPeriod(book, nowValue);
    if (book.scope_verified !== true) {
      return {
        status: "unverified",
        usable: false,
        estimateUsable: timestamp.usable && catalogPeriod.usable,
        reason: "scope_not_verified",
        ageHours: timestamp.ageHours,
        timeStatus: timestamp.status,
        timeReason: timestamp.reason,
        catalogPeriodStatus: catalogPeriod.status,
        catalogPeriodReason: catalogPeriod.reason
      };
    }

    if (!timestamp.usable) {
      return Object.assign({}, timestamp, {
        estimateUsable: false,
        timeStatus: timestamp.status,
        timeReason: timestamp.reason,
        catalogPeriodStatus: catalogPeriod.status,
        catalogPeriodReason: catalogPeriod.reason
      });
    }
    if (!catalogPeriod.usable) {
      return {
        status: "expired",
        usable: false,
        estimateUsable: false,
        reason: catalogPeriod.reason,
        ageHours: timestamp.ageHours,
        timeStatus: timestamp.status,
        timeReason: timestamp.reason,
        catalogPeriodStatus: catalogPeriod.status,
        catalogPeriodReason: catalogPeriod.reason
      };
    }
    return Object.assign({}, timestamp, {
      estimateUsable: false,
      timeStatus: timestamp.status,
      timeReason: timestamp.reason,
      catalogPeriodStatus: catalogPeriod.status,
      catalogPeriodReason: catalogPeriod.reason
    });
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

  return { DEFAULT_POLICY, assessTimestamp, assessCatalogPeriod, assessOverlay, metaQuality, basketQuality };
});
