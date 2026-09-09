const PACK_PATTERNS = [
  { unit: "g", re: /(\d+(?:[.,]\d+)?)\s*(?:гр|г|g)(?![a-zа-яё])/i, factor: 1 },
  { unit: "kg", re: /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?![a-zа-яё])/i, factor: 1000 },
  { unit: "ml", re: /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![a-zа-яё])/i, factor: 1 },
  { unit: "l", re: /(\d+(?:[.,]\d+)?)\s*(?:л|l)(?![a-zа-яё])/i, factor: 1000 },
  { unit: "pcs", re: /(\d+(?:[.,]\d+)?)\s*(?:шт|pcs)(?![a-zа-яё])/i, factor: 1 }
];

const KG_COMPARISON_PRODUCTS = /(?:картоф|лук\s+репчат|морков|банан)/i;

function number(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMagnitPack(text) {
  const source = String(text || "");
  for (const pattern of PACK_PATTERNS) {
    const match = source.match(pattern.re);
    if (!match) continue;
    const value = number(match[1]);
    if (value == null) continue;
    if (pattern.unit === "kg") return { value: value * pattern.factor, unit: "g", source: match[0] };
    if (pattern.unit === "l") return { value: value * pattern.factor, unit: "ml", source: match[0] };
    return { value: value * pattern.factor, unit: pattern.unit, source: match[0] };
  }
  return null;
}

export function normalizeMagnitAvailability(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.includes("нет в наличии") || text.includes("законч")) return "out_of_stock";
  if (text.includes("в корзину") || text.includes("в наличии")) return "in_stock";
  return "unknown";
}

function contextShopCode(context) {
  return context && context.store_context && context.store_context.shop_code != null
    ? String(context.store_context.shop_code)
    : null;
}

function comparisonPrice(raw) {
  const packagePrice = number(raw.price);
  const unitPrice = number(raw.unit_price ?? raw.unitPrice);
  const unit = String(raw.unit_price_unit ?? raw.unitPriceUnit ?? "").toLowerCase();
  if (KG_COMPARISON_PRODUCTS.test(String(raw.name || "")) && unit === "kg" && unitPrice != null && unitPrice >= 0) {
    return {
      value: unitPrice,
      basis: "per_kg",
      source_package_price_rub: packagePrice,
      source_unit_price_rub: unitPrice
    };
  }
  return {
    value: packagePrice,
    basis: "package",
    source_package_price_rub: packagePrice,
    source_unit_price_rub: unitPrice
  };
}

export function adaptMagnitProduct(raw, context = {}) {
  if (!raw || !raw.name) throw new Error("Magnit product requires name");
  const shopCode = contextShopCode(context);
  if (!shopCode) throw new Error("Magnit snapshot requires store_context.shop_code");
  if (raw.shop_code != null && String(raw.shop_code) !== shopCode) {
    throw new Error(`Magnit row shop_code mismatch: ${raw.shop_code} != ${shopCode}`);
  }

  const normalizedPrice = comparisonPrice(raw);
  const price = normalizedPrice.value;
  if (price == null || price < 0) throw new Error(`Invalid price for ${raw.name}`);
  const oldPrice = number(raw.old_price ?? raw.oldPrice);
  const checkedAt = context.checked_at || context.checkedAt || new Date().toISOString();

  return {
    schema: "tamdeshevle.retailer-product.v1",
    retailer: "magnit",
    retailer_product_id: raw.id != null ? String(raw.id) : null,
    name: String(raw.name).trim(),
    brand: raw.brand ? String(raw.brand).trim() : null,
    pack: raw.pack || parseMagnitPack(raw.name),
    price_rub: price,
    source_package_price_rub: normalizedPrice.source_package_price_rub,
    source_unit_price_rub: normalizedPrice.source_unit_price_rub,
    comparison_price_basis: normalizedPrice.basis,
    old_price_rub: normalizedPrice.basis === "package" && oldPrice != null && oldPrice >= price ? oldPrice : null,
    promo: normalizedPrice.basis === "package" && oldPrice != null && oldPrice > price,
    availability: normalizeMagnitAvailability(raw.availability),
    source_url: raw.url || context.source_url || null,
    city: context.city || "msk",
    store_context: {
      shop_code: shopCode,
      address: context.store_context.address || null,
      shop_type: context.store_context.shop_type || null
    },
    channel: context.channel || "delivery_catalog",
    checked_at: checkedAt,
    source: {
      site: "magnit.ru",
      method: context.method || "public_product_pages"
    }
  };
}

export function adaptMagnitCatalog(rows, context = {}) {
  if (!Array.isArray(rows)) throw new Error("Catalog rows must be an array");
  const shopCode = contextShopCode(context);
  if (!shopCode) throw new Error("Magnit snapshot requires store_context.shop_code");
  return rows.map(row => adaptMagnitProduct(row, context));
}
