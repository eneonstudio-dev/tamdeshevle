import assert from "node:assert/strict";
import { buildPriceOverlay } from "../retailers/sku-matcher.mjs";

function pasta(overrides = {}) {
  return {
    schema: "tamdeshevle.retailer-product.v1",
    retailer: "magnit",
    retailer_product_id: "fixture-pasta",
    name: "Макароны спагетти 450г",
    brand: "Fixture",
    pack: { value: 450, unit: "g" },
    price_rub: 79,
    old_price_rub: null,
    promo: false,
    availability: "in_stock",
    source_url: "https://example.invalid/pasta",
    channel: "delivery_catalog",
    checked_at: "2026-09-14T10:00:00Z",
    ...overrides
  };
}

const unknownLoyaltyPromo = buildPriceOverlay([
  pasta({
    retailer_product_id: "promo-unknown",
    price_rub: 49,
    old_price_rub: 79,
    promo: true
  }),
  pasta({
    retailer_product_id: "regular",
    price_rub: 79,
    promo: false
  })
], {
  retailer: "magnit",
  storeId: "magnit",
  city: "msk",
  checked_at: "2026-09-14T10:00:00Z"
});

assert.equal(
  unknownLoyaltyPromo.prices.pasta,
  79,
  "MVP-027: an unverified promo/loyalty price must not replace the guaranteed regular price"
);
assert.equal(unknownLoyaltyPromo.matched.length, 1);
assert.equal(unknownLoyaltyPromo.matched[0].retailer_product_id, "regular");
assert.equal(unknownLoyaltyPromo.alternatives.length, 1);
assert.equal(unknownLoyaltyPromo.alternatives[0].retailer_product_id, "promo-unknown");
assert.equal(unknownLoyaltyPromo.alternatives[0].reason, "promo_eligibility_unverified");

const onlyUnknownPromo = buildPriceOverlay([
  pasta({
    retailer_product_id: "only-promo",
    price_rub: 49,
    old_price_rub: 79,
    promo: true
  })
], {
  retailer: "magnit",
  storeId: "magnit",
  city: "msk",
  checked_at: "2026-09-14T10:00:00Z"
});
assert.equal(
  onlyUnknownPromo.prices.pasta,
  undefined,
  "MVP-027: a conditional price with unknown eligibility must not become rankable truth"
);
assert.equal(onlyUnknownPromo.matched.length, 0);
assert.equal(onlyUnknownPromo.alternatives[0].reason, "promo_eligibility_unverified");

const verifiedPromo = buildPriceOverlay([
  pasta({
    retailer_product_id: "verified-promo",
    price_rub: 49,
    old_price_rub: 79,
    promo: true,
    promo_eligibility_verified: true,
    promo_terms_verified: true
  })
], {
  retailer: "magnit",
  storeId: "magnit",
  city: "msk",
  checked_at: "2026-09-14T10:00:00Z"
});
assert.equal(verifiedPromo.prices.pasta, 49);
assert.equal(verifiedPromo.matched.length, 1);
assert.equal(verifiedPromo.matched[0].promo, true);
assert.equal(verifiedPromo.matched[0].promo_eligibility_verified, true);
assert.equal(verifiedPromo.matched[0].promo_terms_verified, true);

console.log("MVP-027 promo eligibility regression passed: unknown conditional prices fail closed; verified promo terms remain rankable.");
