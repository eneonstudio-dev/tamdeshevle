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
assert(TDCompare.goodsTotal(products, cart, "shop", "shelf") === 240, "goods total failed");

const any = TDCompare.compare({ stores, products, cart, city: "msk", mode: "any", originStoreId: "shop" });
assert(any.length === 3, "any mode should include three stores");
assert(any[0].id === "hyper" && any[0].total === 210, "any mode ranking failed");
assert(any.find(row => row.id === "delivery").total === 350, "delivery fee in any mode failed");

const walk = TDCompare.compare({ stores, products, cart, city: "msk", mode: "walk", originStoreId: "shop" });
assert(walk.length === 2, "walk mode should exclude delivery stores");
assert(walk.every(row => row.channel === "shelf"), "walk mode channel failed");

const delivery = TDCompare.compare({ stores, products, cart, city: "msk", mode: "delivery", originStoreId: "shop" });
assert(delivery.length === 3, "delivery mode should include bring-capable stores");
assert(delivery.every(row => row.channel === "bring"), "delivery mode channel failed");
assert(delivery.find(row => row.id === "delivery").delivery === 50, "known delivery fee failed");
assert(delivery.find(row => row.id === "shop").delivery === 0, "shop bring mode must not invent a delivery fee");

const spb = TDCompare.compare({ stores, products, cart, city: "spb", mode: "any", originStoreId: "shop" });
assert(spb.length === 2 && !spb.some(row => row.id === "hyper"), "city filtering failed");

const empty = TDCompare.compare({ stores: [], products, cart, city: "msk", mode: "any", originStoreId: "shop" });
assert(Array.isArray(empty) && empty.length === 0, "empty stores case failed");

console.log("Comparison engine tests passed.");
