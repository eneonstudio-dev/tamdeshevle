import assert from "node:assert/strict";
import { classifyPyatHttpStatus, normalizePyatSearchProduct, verifyPyatStore } from "../retailers/pyat-collector.mjs";

assert.deepEqual(classifyPyatHttpStatus(403),{code:"PYAT_ACCESS_BLOCKED",retryable:false});
assert.deepEqual(classifyPyatHttpStatus(429),{code:"PYAT_RATE_LIMITED",retryable:true});
assert.deepEqual(classifyPyatHttpStatus(503),{code:"PYAT_UPSTREAM_ERROR",retryable:true});

const config = {
  store_context: { sap_code: "S105" },
  expected_address_tokens: ["Кировоградская", "17"]
};

const verified = verifyPyatStore({
  sapCode: "S105",
  address: "г Москва, Кировоградская улица, д 17"
}, config);
assert.equal(verified.sap_code, "S105");
assert.match(verified.address, /Кировоградская/);

assert.throws(() => verifyPyatStore({ sapCode: "S999", address: "Кировоградская улица, 17" }, config), /store mismatch/);
assert.throws(() => verifyPyatStore({ sapCode: "S105", address: "Тверская улица, 6" }, config), /address mismatch/);

const promo = normalizePyatSearchProduct({
  plu: 4192464,
  name: "Молоко 2.5% 1л",
  brand_name: "Тест",
  property_clarification: "1 л",
  prices: { regular: 109.99, discount: 89.99 },
  is_available: true,
  slug: "moloko-test"
});
assert.equal(promo.id, "4192464");
assert.equal(promo.price, 89.99);
assert.equal(promo.old_price, 109.99);
assert.equal(promo.availability, "В наличии");
assert.match(promo.url, /4192464/);

const regular = normalizePyatSearchProduct({
  plu: "1",
  name: "Сахар 1кг",
  prices: { regular: 79.99 },
  is_available: false
});
assert.equal(regular.price, 79.99);
assert.equal(regular.old_price, null);
assert.equal(regular.availability, "Нет в наличии");

console.log("Pyaterochka collector tests passed: SAP/address scope verification and search product normalization.");
