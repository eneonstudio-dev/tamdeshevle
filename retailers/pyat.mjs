const PACK_PATTERNS = [
  { unit: "kg", re: /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?![a-zа-яё])/i, factor: 1000, out: "g" },
  { unit: "g", re: /(\d+(?:[.,]\d+)?)\s*(?:гр|г|g)(?![a-zа-яё])/i, factor: 1, out: "g" },
  { unit: "ml", re: /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![a-zа-яё])/i, factor: 1, out: "ml" },
  { unit: "l", re: /(\d+(?:[.,]\d+)?)\s*(?:л|l)(?![a-zа-яё])/i, factor: 1000, out: "ml" },
  { unit: "pcs", re: /(\d+(?:[.,]\d+)?)\s*(?:шт|pcs)(?![a-zа-яё])/i, factor: 1, out: "pcs" }
];

function number(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePyatPack(text) {
  const source = String(text || "");
  for (const pattern of PACK_PATTERNS) {
    const match = source.match(pattern.re);
    if (!match) continue;
    const value = number(match[1]);
    if (value == null) continue;
    return { value: value * pattern.factor, unit: pattern.out, source: match[0] };
  }
  return null;
}

export function normalizePyatAvailability(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.includes("нет в наличии") || text.includes("законч")) return "out_of_stock";
  if (text.includes("в корзину") || text.includes("в наличии") || text.includes("каталог")) return "in_stock";
  return "unknown";
}

export function adaptPyatProduct(raw, context = {}) {
  if (!raw || !raw.name) throw new Error("Pyaterochka product requires name");
  const price = number(raw.price);
  if (price == null || price < 0) throw new Error(`Invalid price for ${raw.name}`);
  const oldPrice = number(raw.old_price ?? raw.oldPrice);
  const checkedAt = context.checked_at || context.checkedAt || new Date().toISOString();
  const sourceName = context.source_name || context.source?.name || "5ka.ru";
  const sourceKind = context.source_kind || context.source?.kind || "retailer_catalog";

  return {
    schema: "tamdeshevle.retailer-product.v1",
    retailer: "pyat",
    retailer_product_id: raw.id != null ? String(raw.id) : null,
    name: String(raw.name).trim(),
    brand: raw.brand ? String(raw.brand).trim() : null,
    pack: raw.pack || parsePyatPack(`${raw.name} ${raw.pack_text || ""}`),
    price_rub: price,
    old_price_rub: oldPrice != null && oldPrice >= price ? oldPrice : null,
    promo: oldPrice != null && oldPrice > price,
    availability: normalizePyatAvailability(raw.availability),
    source_url: raw.url || context.source_url || null,
    city: context.city || null,
    channel: context.channel || "delivery_catalog",
    checked_at: checkedAt,
    catalog_context: context.catalog_context || null,
    scope_verified: context.scope_verified === true,
    source: {
      site: sourceName,
      kind: sourceKind,
      method: context.method || "public_catalog_snapshot"
    }
  };
}

export function adaptPyatCatalog(rows, context = {}) {
  if (!Array.isArray(rows)) throw new Error("Catalog rows must be an array");
  return rows.map(row => adaptPyatProduct(row, context));
}
