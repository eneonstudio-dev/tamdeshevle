const API_BASE = "https://5d.5ka.ru/api";

function number(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normal(value) {
  return String(value || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function addressFromStore(payload) {
  const candidates = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const key of ["address", "shop_address", "storeAddress", "shopAddress", "formatted_address", "formattedAddress"]) {
      if (typeof value[key] === "string") candidates.push(value[key]);
    }
    for (const child of Object.values(value)) if (child && typeof child === "object") visit(child);
  };
  visit(payload);
  return candidates.find(Boolean) || "";
}

function sapCodeFromStore(payload) {
  let found = null;
  const visit = value => {
    if (found || !value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const key of ["sapCode", "sap_code", "storeSapCode", "store_id", "storeId"]) {
      if (value[key] != null) { found = String(value[key]); return; }
    }
    for (const child of Object.values(value)) if (child && typeof child === "object") visit(child);
  };
  visit(payload);
  return found;
}

export function verifyPyatStore(payload, config) {
  const expectedSap = String(config?.store_context?.sap_code || "");
  if (!expectedSap) throw new Error("Pyaterochka collector requires store_context.sap_code");
  const actualSap = sapCodeFromStore(payload);
  if (actualSap && actualSap !== expectedSap) throw new Error(`Pyaterochka store mismatch: ${actualSap} != ${expectedSap}`);
  const address = addressFromStore(payload);
  if (!address) throw new Error("Pyaterochka store address not found");
  const haystack = normal(address);
  const tokens = (config.expected_address_tokens || []).map(normal).filter(Boolean);
  if (!tokens.every(token => haystack.includes(token))) {
    throw new Error(`Pyaterochka store address mismatch: ${address}`);
  }
  return { sap_code: expectedSap, address };
}

function productPrice(raw) {
  const prices = raw && typeof raw.prices === "object" ? raw.prices : {};
  const regular = number(prices.regular ?? prices.price ?? raw.price);
  const candidates = [prices.discount, prices.cpd_promo_price, prices.markdown, raw.price].map(number).filter(v => v != null);
  const price = candidates.length ? candidates[0] : regular;
  const oldPrice = regular != null && price != null && regular > price ? regular : number(raw.old_price ?? raw.oldPrice);
  return { price, old_price: oldPrice };
}

function productUrl(raw) {
  const plu = String(raw.plu ?? raw.id ?? "");
  const slug = String(raw.slug ?? raw.url_key ?? raw.seo_url ?? "").replace(/^\/+|\/+$/g, "");
  if (slug && plu) return `https://5ka.ru/product/${slug}-${plu}/`;
  if (plu) return `https://5ka.ru/product/${plu}/`;
  return "https://5ka.ru/";
}

export function normalizePyatSearchProduct(raw) {
  if (!raw || !raw.name) return null;
  const { price, old_price } = productPrice(raw);
  if (price == null || price < 0) return null;
  return {
    id: raw.plu != null ? String(raw.plu) : raw.id != null ? String(raw.id) : null,
    name: String(raw.name).trim(),
    brand: raw.brand_name || raw.brand || null,
    pack_text: raw.property_clarification || raw.size || raw.quantity || "",
    price,
    old_price,
    availability: raw.is_available === false ? "Нет в наличии" : "В наличии",
    url: productUrl(raw)
  };
}

function productsFromSearch(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["products", "items", "results", "data"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

async function getJson(path, params = {}, options = {}) {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeout_ms || 15000),
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "ru-RU,ru;q=0.9",
      "user-agent": options.user_agent || "TamdeshevlePublicCatalogCollector/1.0",
      origin: "https://5ka.ru",
      referer: "https://5ka.ru/"
    }
  });
  if (!response.ok) throw new Error(`Pyaterochka public API HTTP ${response.status}: ${path}`);
  return await response.json();
}

export async function collectPyatSnapshot(config, options = {}) {
  if (!config || config.retailer !== "pyat") throw new Error("Collector config retailer must be pyat");
  const sapCode = String(config?.store_context?.sap_code || "");
  if (!sapCode) throw new Error("Collector config requires store_context.sap_code");

  const storePayload = await getJson(`/cita/v1/stores/${encodeURIComponent(sapCode)}`, {}, options);
  const verifiedStore = verifyPyatStore(storePayload, config);
  const rowsById = new Map();
  const errors = [];

  for (const query of config.queries || []) {
    try {
      const payload = await getJson(`/catalog/v3/stores/${encodeURIComponent(sapCode)}/search`, {
        q: query,
        mode: "store",
        offset: 0,
        limit: config.limit_per_query || 30,
        include_restrict: "true"
      }, options);
      for (const raw of productsFromSearch(payload)) {
        const row = normalizePyatSearchProduct(raw);
        if (row && row.id && !rowsById.has(row.id)) rowsById.set(row.id, row);
      }
    } catch (error) {
      errors.push({ query, error: String(error?.message || error) });
    }
  }

  const rows = [...rowsById.values()];
  if (!rows.length) throw new Error(`Pyaterochka collector found no usable store-scoped products (${errors.length} query errors)`);
  return {
    schema: "tamdeshevle.retailer-snapshot.v1",
    retailer: "pyat",
    store_id: config.store_id || "pyat",
    city: config.city || "msk",
    channel: config.channel || "delivery_catalog",
    source_url: "https://5ka.ru/",
    checked_at: options.checked_at || new Date().toISOString(),
    method: "public_store_scoped_catalog_api",
    scope_verified: true,
    store_context: verifiedStore,
    catalog_context: {
      type: "store_scoped_public_catalog",
      location_verified: true,
      sap_code: verifiedStore.sap_code,
      address: verifiedStore.address
    },
    collector: { queries: (config.queries || []).length, accepted: rows.length, errors },
    rows
  };
}
