import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("comparison-engine.js", "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: "comparison-engine.js" });

const { TDCompare } = context.window;
if (!TDCompare) throw new Error("TDCompare was not exported");

const stores = [
  { id: "shop", name: "Shop", kind: "shop", city: ["msk", "spb"], has_bring: true },
  { id: "hyper", name: "Hyper", kind: "hyper", city: ["msk"], has_bring: true },
  { id: "delivery", name: "Delivery", kind: "delivery", city: ["msk", "spb"], has_bring: true, delivery: 50 }
];

const products = [
  { id: "a", prices: { shop: 100, hyper: 80, delivery: 120 }, bring: { shop: 115, hyper: 95, delivery: 120 } },
  { id: "b", prices: { shop: 40, hyper: 50, delivery: 60 }, bring: { shop: 45, hyper: 55, delivery: 60 } }
];

const cart = { a: 2, b: 1 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(TDCompare.unitPrice(products[0], "shop", "shelf") === 100, "shelf unit price failed");
assert(TDCompare.unitPrice(products[0], "shop", "bring") === 115, "bring unit price failed");
assert(TDCompare.unitPrice({ id: "x", prices: { shop: 25 } }, "shop", "bring") === null, "bring must not fall back to shelf");
assert(TDCompare.goodsTotal(products, cart, "shop", "shelf") === 240, "goods total failed");

const any = TDCompare.compare({ stores, products, cart, city: "msk", mode: "any", originStoreId: "shop" });
assert(any.length === 3, "any mode should include three stores");
assert(any.every(row => row.rankable === false), "educational baskets must stay outside the ranking");
assert(any.find(row => row.id === "delivery").total === 350, "delivery fee in any mode failed");
assert(any.find(row => row.id === "hyper").save === null, "estimated prices must not claim verified savings");
assert(any.find(row => row.id === "hyper").indicativeSave === 30, "indicative savings should remain available");
assert(any.find(row => row.id === "hyper").verifiedItems === 0, "educational prices must not count as verified");
assert(any.every(row => row.referenceAvailable === true && row.referenceStoreId === "shop"), "eligible origin should be exposed as the comparison reference");

const verifiedProducts = products.map(product => ({
  ...product,
  priceMeta: {
    shop: { shelf: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "fresh" } },
    hyper: { shelf: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "stale" } }
  }
}));
const verified = TDCompare.compare({ stores: stores.slice(0, 2), products: verifiedProducts, cart, city: "msk", mode: "walk", originStoreId: "shop" });
const verifiedHyper = verified.find(row => row.id === "hyper");
assert(verifiedHyper.verifiedComplete === true, "fresh/stale retailer-backed basket should be verified complete");
assert(verifiedHyper.verifiedItems === 2 && verifiedHyper.estimatedItems === 0, "verified coverage counters failed");
assert(verifiedHyper.save === 30, "fully verified basket may claim savings");
assert(verified.every(row => row.rankable), "fully verified baskets may enter the ranking");

const mixedProducts = verifiedProducts.map(product => ({
  ...product,
  priceMeta: { shop: product.priceMeta.shop }
}));
const mixed = TDCompare.compare({ stores: stores.slice(0, 2), products: mixedProducts, cart, city: "msk", mode: "walk", originStoreId: "shop" });
assert(mixed[0].id === "shop" && mixed[0].rankable, "verified basket must rank before a cheaper educational basket");
assert(mixed.find(row => row.id === "hyper").rankable === false, "unverified basket must not enter the ranking");

const walk = TDCompare.compare({ stores, products, cart, city: "msk", mode: "walk", originStoreId: "shop" });
assert(walk.length === 2, "walk mode should exclude delivery stores");
assert(walk.every(row => row.channel === "shelf"), "walk mode channel failed");

const delivery = TDCompare.compare({ stores, products, cart, city: "msk", mode: "delivery", originStoreId: "shop" });
assert(delivery.length === 3, "delivery mode should include bring-capable stores");
assert(delivery.every(row => row.channel === "bring"), "delivery mode channel failed");
assert(delivery.find(row => row.id === "delivery").delivery === 50, "known delivery fee failed");
assert(delivery.find(row => row.id === "shop").feeKnown === false, "shop bring mode must mark unknown delivery fee");
assert(delivery.find(row => row.id === "shop").total === null, "unknown delivery fee must not produce a total");
assert(delivery[0].id === "delivery", "known complete delivery scenario must rank before unknown-fee scenarios");

const incompleteProducts = [
  { id: "a", prices: { shop: 100, hyper: 1 } },
  { id: "b", prices: { shop: 40 } }
];
const incomplete = TDCompare.compare({ stores: stores.slice(0, 2), products: incompleteProducts, cart: { a: 1, b: 1 }, city: "msk", mode: "walk", originStoreId: "shop" });
const incompleteHyper = incomplete.find(row => row.id === "hyper");
assert(incomplete[0].id === "shop", "incomplete cheap basket must not outrank a complete basket");
assert(incompleteHyper.complete === false && incompleteHyper.rankable === false, "incomplete basket must be unrankable");
assert(incompleteHyper.total === null, "incomplete basket must not have a fake total");
assert(incompleteHyper.partialGoods === 1, "partial subtotal should remain available for diagnostics");
assert(incompleteHyper.coveredItems === 1 && incompleteHyper.totalItems === 2, "coverage counters failed");
assert(incompleteHyper.coverage === 0.5, "coverage ratio failed");
assert(incompleteHyper.missingProductIds.length === 1 && incompleteHyper.missingProductIds[0] === "b", "missing product ids failed");
assert(incompleteHyper.save === null, "incomplete basket must not claim savings");

const spb = TDCompare.compare({ stores, products, cart, city: "spb", mode: "any", originStoreId: "shop" });
assert(spb.length === 2 && !spb.some(row => row.id === "hyper"), "city filtering failed");

const empty = TDCompare.compare({ stores: [], products, cart, city: "msk", mode: "any", originStoreId: "shop" });
assert(Array.isArray(empty) && empty.length === 0, "empty stores case failed");

console.log("Comparison engine tests passed: strict channels, coverage safety and verified-vs-estimated savings.");
for (const delivery of [null, undefined, '', -1, NaN]) assert(!TDCompare.feeQuote({delivery},'bring').known, 'missing/invalid fee is not free delivery');
assert(TDCompare.feeQuote({delivery:0},'bring').known, 'explicit zero fee is valid');
assert(!TDCompare.basketQuote(verifiedProducts,{},'shop','shelf').verifiedComplete, 'empty cart cannot claim verified comparison');
assert(!TDCompare.basketQuote(verifiedProducts,{a:1,deleted_sku:1},'shop','shelf').complete, 'unknown cart item cannot silently disappear');
const unsafe = {...verifiedProducts[0],priceMeta:{shop:{shelf:{kind:'retailer',freshness:'fresh'}}}};
assert(!TDCompare.isVerifiedPrice(unsafe,'shop','shelf'), 'retailer name alone does not prove scope and equivalence');
const channelsProduct = {id:'a',prices:{shop:100},bring:{shop:150,delivery:170}};
const channelResult = TDCompare.compare({stores:[{...stores[0],delivery:0}, {...stores[2],delivery:0}],products:[channelsProduct],cart:{a:1},mode:'delivery',city:'msk',originStoreId:'shop'});
assert(channelResult.find(x=>x.id==='shop').indicativeSave===0,'delivery origin must use delivery prices');
assert(!TDCompare.basketQuote(verifiedProducts,{a:Infinity},'shop','shelf').complete,'infinite quantity rejected');
assert(!TDCompare.basketQuote(verifiedProducts,{a:0.5},'shop','shelf').complete,'half a packaged item cannot be bought');
assert(TDCompare.goodsTotal([{id:'x',prices:{shop:0.1}}],{x:3},'shop','shelf')===0.3,'money accumulates in kopecks');

const unavailableCityOrigin = TDCompare.compare({ stores, products, cart, city: "spb", mode: "any", originStoreId: "hyper" });
assert(unavailableCityOrigin.length === 2 && unavailableCityOrigin.every(row => row.referenceAvailable === false), "origin outside the active city must not become a hidden savings baseline");
assert(unavailableCityOrigin.every(row => row.referenceStoreId === null && row.save === null && row.indicativeSave === null), "unavailable-city origin must suppress relative savings");
assert(unavailableCityOrigin.every(row => row.same === false), "fallback store must not be presented as the user's current choice");

const unavailableModeOrigin = TDCompare.compare({ stores, products, cart, city: "msk", mode: "walk", originStoreId: "delivery" });
assert(unavailableModeOrigin.length === 2 && unavailableModeOrigin.every(row => row.referenceAvailable === false), "delivery-only origin must not anchor walk-mode savings");
assert(unavailableModeOrigin.every(row => row.save === null && row.indicativeSave === null && row.same === false), "walk mode must not claim savings against a store excluded from walk mode");

const noBringStore = { id: "pickup", name: "Pickup only", kind: "shop", city: ["msk"], has_bring: false };
const deliveryWithoutOrigin = TDCompare.compare({ stores: [noBringStore, stores[2]], products, cart, city: "msk", mode: "delivery", originStoreId: "pickup" });
assert(deliveryWithoutOrigin.length === 1 && deliveryWithoutOrigin[0].id === "delivery", "delivery mode must exclude stores that cannot deliver");
assert(deliveryWithoutOrigin[0].referenceAvailable === false && deliveryWithoutOrigin[0].same === false, "excluded pickup-only origin must not become an implicit delivery reference");
