(function () {
  "use strict";
  const DAY_MS = 24 * 60 * 60 * 1000;
  function status(row, now) {
    const expires = Date.parse(row && row.expires_at), clock = now == null ? Date.now() : Number(now);
    return Number.isFinite(expires) && Number.isFinite(clock) && clock < expires ? "fresh" : "expired";
  }
  function remainingMs(row, now) {
    const expires = Date.parse(row && row.expires_at), clock = now == null ? Date.now() : Number(now);
    return Number.isFinite(expires) && Number.isFinite(clock) ? Math.max(0, expires - clock) : 0;
  }
  window.TDReceiptPriceHistory = { DAY_MS, status, remainingMs };
})();

