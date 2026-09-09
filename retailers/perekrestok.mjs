const PACK_PATTERNS = [
  { unit: "g", re: /(\d+(?:[.,]\d+)?)\s*(?:г|гр|g)\b/i, factor: 1 },
  { unit: "kg", re: /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)\b/i, factor: 1000 },
  { unit: "ml", re: /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)\b/i, factor: 1 },
  { unit: "l", re: /(\d+(?:[.,]\d+)?)\s*(?:л|l)\b/i, factor: 1000 },
  { unit: "pcs", re: /(\d+(?:[.,]\d+)?)\s*(?:шт|pcs)\b/i, factor: 1 }
];

function number(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePack(text) {
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

export function normalizeAvailability(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.includes("нет в наличии") || text.includes("законч")) return "out_of_stock";
  if (text.includes("в наличии")) return "in_stock";
  return "unknown";
}

export function adaptPerekrestokProduct(raw, context = {}) {
  if (!raw || !raw.name) throw new Error("Perekrestok product requires name");
  const price = number(raw.price);
  if (price == null || price < 0) throw new Error(`Invalid price for ${raw.name}`);

  const oldPrice = number(raw.old_price ?? raw.oldPrice);
  const pack = raw.pack || parsePack(raw.name);
  const checkedAt = context.checked_at || context.checkedAt || new Date().toISOString();

  return {
    schema: "tamdeshevle.retailer-product.v1",
    retailer: "perek",
    retailer_product_id: raw.id ? String(raw.id) : null,
    name: String(raw.name).trim(),
    brand: raw.brand ? String(raw.brand).trim() : null,
    pack,
    price_rub: price,
    old_price_rub: oldPrice != null && oldPrice >= price ? oldPrice : null,
    promo: oldPrice != null && oldPrice > price,
    availability: normalizeAvailability(raw.availability),
    source_url: raw.url || context.source_url || null,
    city: context.city || "msk",
    store_context: context.store_context || null,
    channel: context.channel || "delivery_catalog",
    checked_at: checkedAt,
    source: {
      site: "perekrestok.ru",
      method: context.method || "public_catalog_snapshot"
    }
  };
}

export function adaptPerekrestokCatalog(rows, context = {}) {
  if (!Array.isArray(rows)) throw new Error("Catalog rows must be an array");
  return rows.map(row => adaptPerekrestokProduct(row, context));
}
