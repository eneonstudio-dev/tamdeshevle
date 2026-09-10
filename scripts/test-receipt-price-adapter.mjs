import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../comparison-engine.js", import.meta.url), "utf8"), context);
vm.runInContext(fs.readFileSync(new URL("../receipt-price-adapter.js", import.meta.url), "utf8"), context);

const products = [{ id: "milk", prices: {}, priceMeta: {} }];
const verified = {
  product_id: "milk",
  store_id: "pyat",
  price: 79,
  observed_at: "2026-09-10T09:00:00.000Z",
  scope_verified: true,
  proof_verified: true,
  identity_verified: true,
  eligible_for_ranking: true,
  verification_kind: "receipt",
  freshness: "fresh",
  proof_ref: "receipt-1"
};

let result = context.window.TDReceiptPriceAdapter.applyCandidate(products, verified);
assert.equal(result.applied, true);
assert.equal(products[0].prices.pyat, 79);
assert.equal(products[0].priceMeta.pyat.shelf.kind, "receipt");
assert.equal(context.window.TDCompare.isVerifiedPrice(products[0], "pyat", "shelf"), true);

const weak = structuredClone(verified);
weak.store_id = "magnit";
weak.identity_verified = false;
weak.eligible_for_ranking = false;
result = context.window.TDReceiptPriceAdapter.applyCandidate(products, weak);
assert.equal(result.applied, false);
assert.equal(products[0].prices.magnit, undefined);

const retailerProduct = [{
  id: "bread",
  prices: { pyat: 55 },
  priceMeta: { pyat: { shelf: { kind: "retailer", freshness: "fresh", observed_at: "2026-09-10T08:00:00.000Z" } } }
}];
const receiptAgainstRetailer = { ...verified, product_id: "bread", price: 49 };
result = context.window.TDReceiptPriceAdapter.applyCandidate(retailerProduct, receiptAgainstRetailer);
assert.equal(result.applied, false);
assert.equal(result.reason, "fresh_retailer_price_has_priority");
assert.equal(retailerProduct[0].prices.pyat, 55);

const forgedMeta = {
  id: "fake",
  prices: { pyat: 10 },
  priceMeta: { pyat: { shelf: { kind: "receipt", trust: "verified_receipt", freshness: "fresh", scope_verified: true, proof_verified: false, identity_verified: true } } }
};
assert.equal(context.window.TDCompare.isVerifiedPrice(forgedMeta, "pyat", "shelf"), false);

console.log("receipt price adapter tests passed");
