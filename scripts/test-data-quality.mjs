import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const quality = require("../data-quality.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = "2026-09-10T12:00:00Z";
assert(quality.assessTimestamp("2026-09-10T00:00:00Z", now).status === "fresh", "12h should be fresh");
assert(quality.assessTimestamp("2026-09-08T18:00:00Z", now).status === "stale", "42h should be stale");
assert(quality.assessTimestamp("2026-09-06T00:00:00Z", now).status === "expired", "older than 72h should expire");
assert(quality.assessTimestamp("2026-09-11T00:00:00Z", now).status === "invalid", "future timestamp should be invalid");
assert(quality.assessTimestamp("2026-09-10T00:00:00Z", "not-a-date").usable === false, "invalid reference time must fail closed");

const unverified = quality.assessOverlay({ schema: "tamdeshevle.retailer-price-overlay.v1", scope_verified: false, checked_at: now }, now);
assert(unverified.status === "unverified" && unverified.usable === false, "unverified scope must be blocked from verified truth");
assert(unverified.estimateUsable === true, "fresh unscoped observation may remain an estimate when no catalog period applies");

const regionalCurrent = quality.assessOverlay({
  schema: "tamdeshevle.retailer-price-overlay.v1",
  scope_verified: false,
  city: "msk",
  checked_at: "2026-09-10T00:00:00Z",
  catalog_context: { price_scope: "regional_catalog", valid_from: "2026-09-08", valid_to: "2026-09-14" }
}, now);
assert(regionalCurrent.status === "unverified", "regional catalog must remain unverified for exact-store truth");
assert(regionalCurrent.estimateUsable === true, "fresh regional catalog inside validity period may be shown only as an estimate");
assert(regionalCurrent.timeStatus === "fresh", "regional estimate must preserve observation freshness");
assert(regionalCurrent.catalogPeriodStatus === "current", "regional estimate must preserve catalog validity");

const regionalOldSnapshot = quality.assessOverlay({
  schema: "tamdeshevle.retailer-price-overlay.v1",
  scope_verified: false,
  city: "msk",
  checked_at: "2026-09-06T00:00:00Z",
  catalog_context: { price_scope: "regional_catalog", valid_from: "2026-09-01", valid_to: "2026-09-14" }
}, now);
assert(regionalOldSnapshot.estimateUsable === false, "expired regional snapshot must not surface as a current estimate");
assert(regionalOldSnapshot.timeStatus === "expired", "expired estimate must expose timestamp expiry");

const regionalExpiredPeriod = quality.assessOverlay({
  schema: "tamdeshevle.retailer-price-overlay.v1",
  scope_verified: false,
  city: "msk",
  checked_at: "2026-09-10T00:00:00Z",
  catalog_context: { price_scope: "regional_catalog", valid_from: "2026-09-01", valid_to: "2026-09-09" }
}, now);
assert(regionalExpiredPeriod.estimateUsable === false, "catalog outside declared period must not surface as a current estimate");
assert(regionalExpiredPeriod.catalogPeriodStatus === "expired", "expired catalog period must be explicit");

assert(quality.assessOverlay({ schema: "tamdeshevle.retailer-price-overlay.v1", checked_at: now }, now).usable === false, "missing scope proof must fail closed");
assert(quality.assessOverlay({ schema: "tamdeshevle.retailer-price-overlay.v1", scope_verified: true, checked_at: now }, now).usable === true, "explicit scope proof may be used while fresh");
assert(quality.assessOverlay({ schema: "wrong", checked_at: now }, now).usable === false, "wrong overlay schema must be blocked");

const products = [
  { id: "a", priceMeta: { shop: { shelf: { kind: "retailer", checkedAt: "2026-09-10T00:00:00Z" } } } },
  { id: "b", priceMeta: { shop: { shelf: { kind: "retailer", checkedAt: "2026-09-08T18:00:00Z" } } } },
  { id: "c" }
];
const basket = quality.basketQuality(products, "shop", "shelf", now);
assert(basket.fresh === 1 && basket.stale === 1 && basket.estimated === 1 && basket.verified === 2, "basket quality counters failed");

const health = JSON.parse(fs.readFileSync("data/retailers/collector-health.json", "utf8"));
assert(health.schema === "tamdeshevle.collector-health.v1", "collector health schema mismatch");
assert(health.collectors && health.collectors.magnit && health.collectors.pyat, "collector health must track Magnit and Pyaterochka");

console.log("Data quality tests passed: freshness, scope, regional estimate expiry, basket provenance and collector health.");
