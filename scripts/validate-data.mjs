import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const catalog = read("catalog.json");
const prices = read("prices.json");
const storesBook = read("stores.json");

const errors = [];
const warnings = [];
const storeIds = new Set((storesBook.stores || []).map((s) => s.id));
const catalogIds = new Set((catalog.products || []).map((p) => p.id));
const priceIds = new Set((prices.products || []).map((p) => p.id));

const aliases = {
  bread_dark: "bread",
  chicken_fil: "chicken",
  oil_sunflower: "oil",
  eggs_c1: "eggs",
  buckwheat: "buck",
  smetana: "sour"
};

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) errors.push(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

unique((storesBook.stores || []).map((s) => s.id), "store id");
unique((catalog.products || []).map((p) => p.id), "catalog product id");
unique((prices.products || []).map((p) => p.id), "price product id");

for (const store of storesBook.stores || []) {
  if (!store.id || !store.name || !store.kind || !Array.isArray(store.city) || !store.city.length) {
    errors.push(`invalid store record: ${JSON.stringify(store)}`);
  }
}

for (const id of catalog.start_cart || []) {
  if (!catalogIds.has(id)) errors.push(`start_cart references missing catalog product: ${id}`);
}

for (const [id, product] of Object.entries(catalog.base || {})) {
  if (!catalogIds.has(id)) warnings.push(`catalog.base has no product metadata: ${id}`);
  if (!Number.isFinite(product)) errors.push(`catalog.base price is not numeric: ${id}`);
}

for (const id of catalogIds) {
  if (!Number.isFinite(catalog.base && catalog.base[id])) errors.push(`catalog product missing base price: ${id}`);
}

for (const storeId of Object.keys(catalog.mult || {})) {
  if (!storeIds.has(storeId)) errors.push(`catalog.mult references unknown store: ${storeId}`);
}

for (const [catalogId, priceId] of Object.entries(aliases)) {
  if (!catalogIds.has(catalogId)) errors.push(`price alias source missing in catalog: ${catalogId}`);
  if (!priceIds.has(priceId)) errors.push(`price alias target missing in prices.json: ${priceId}`);
}

for (const city of prices.cities || []) {
  const cityId = city.id;
  for (const channelName of ["flat", "flat_bring"]) {
    const channel = prices[channelName] && prices[channelName][cityId];
    if (!channel) {
      errors.push(`${channelName} missing city: ${cityId}`);
      continue;
    }
    for (const [productId, row] of Object.entries(channel)) {
      if (!priceIds.has(productId)) errors.push(`${channelName}.${cityId} has unknown product: ${productId}`);
      for (const [storeId, value] of Object.entries(row || {})) {
        if (!storeIds.has(storeId)) errors.push(`${channelName}.${cityId}.${productId} has unknown store: ${storeId}`);
        if (!Number.isFinite(value) || value < 0) errors.push(`${channelName}.${cityId}.${productId}.${storeId} invalid price: ${value}`);
      }
    }
  }
}

for (const storeId of Object.keys(prices.delivery_fee || {})) {
  if (!storeIds.has(storeId)) errors.push(`delivery_fee references unknown store: ${storeId}`);
}

for (const point of catalog.points || []) {
  if (!storeIds.has(point.storeId)) errors.push(`catalog point references unknown store: ${point.id}`);
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) errors.push(`catalog point has invalid coordinates: ${point.id}`);
}

if (warnings.length) {
  console.warn("Data warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error("Data validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Data validation passed: ${storeIds.size} stores, ${catalogIds.size} catalog products, ${priceIds.size} priced products.`);
