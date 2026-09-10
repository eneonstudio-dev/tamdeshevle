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
assert(quality.assessOverlay({ schema: "tamdeshevle.retailer-price-overlay.v1", scope_verified: false, checked_at: now }, now).status === "unverified", "unverified scope must be blocked");
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

console.log("Data quality tests passed: freshness windows, scope gating, basket provenance and collector health schema.");
