const SKU_RULES = [
  { sku: "milk", any: ["молоко"], none: ["кефир", "коктейл", "топлен", "сгущ"], percent: 2.5, pack: { value: 1000, unit: "ml", tolerance: 0.15 } },
  { sku: "kefir", any: ["кефир"], none: ["коктейл"], percent: 2.5, pack: { value: 930, unit: "ml", tolerance: 0.12 } },
  { sku: "smetana", any: ["сметан"], percent: 20, pack: { value: 300, unit: "g", tolerance: 0.08 } },
  { sku: "tvorog", any: ["творог"], none: ["запеканк", "сырок"], percent: 5, pack: { value: 200, unit: "g", tolerance: 0.12 } },
  { sku: "eggs_c1", any: ["яйц"], all: ["с1"], pack: { value: 10, unit: "pcs", tolerance: 0 } },
  { sku: "eggs_c0", any: ["яйц"], all: ["с0"], pack: { value: 10, unit: "pcs", tolerance: 0 } },
  { sku: "chicken_fil", any: ["филе курин", "филе грудки цыплен", "филе цыпленка-бройлера"], none: ["маринад", "стейк", "кусоч", "бедр", "индей", "наггет", "котлет", "фарш"], pack: { value: 1000, unit: "g", tolerance: 0.25 } },
  { sku: "potato", any: ["картоф"], none: ["батат", "фри", "чипс", "пюре", "готов", "салат"] },
  { sku: "onion", any: ["лук репчат"], none: ["зелён", "зелен", "марин", "жарен", "сушен"] },
  { sku: "carrot", any: ["морков"], none: ["по-корей", "готов", "салат", "сок", "пюре"] },
  { sku: "buckwheat", any: ["гречк", "гречнев"], none: ["готов", "каша", "хлоп", "котлет", "куриц"], pack: { value: 800, unit: "g", tolerance: 0.25 } },
  { sku: "pasta", any: ["макарон", "спагет", "вермиш"], none: ["по-флотски", "готов"], pack: { value: 450, unit: "g", tolerance: 0.25 } },
  { sku: "oil_sunflower", any: ["масло подсолнеч"], none: ["оливк"], pack: { value: 1000, unit: "ml", tolerance: 0.2 } },
  { sku: "sugar", any: ["сахар"], none: ["заменител", "пудр"], pack: { value: 1000, unit: "g", tolerance: 0.2 } },
  { sku: "bread_dark", any: ["хлеб"], all: ["дарниц"], pack: { value: 650, unit: "g", tolerance: 0.3 } },
  { sku: "banana", any: ["банан"], none: ["суш", "чипс", "пюре"] },
  { sku: "tea_black", any: ["чай черн"], none: ["листов", "листовой", "зелён", "зелен", "травян"], pack: { value: 100, unit: "pcs", tolerance: 0 } }
];

export const PEREKRESTOK_EXACT_SKU = Object.freeze({
  "2093081": "milk",
  "4121609": "smetana",
  "4121613": "tvorog"
});

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9%.,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function number(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePack(text) {
  const source = normalizeText(text);
  const patterns = [
    { re: /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?![a-zа-я])/i, unit: "g", factor: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:гр|г|g)(?![a-zа-я])/i, unit: "g", factor: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![a-zа-я])/i, unit: "ml", factor: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:л|l)(?![a-zа-я])/i, unit: "ml", factor: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:шт|pcs|пак(?:ет(?:ик)?(?:ов|а)?)?)(?![a-zа-я])/i, unit: "pcs", factor: 1 }
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern.re);
    if (!match) continue;
    const value = number(match[1]);
    if (value == null) continue;
    return { value: value * pattern.factor, unit: pattern.unit };
  }
  return null;
}

function parsePercent(text) {
  const source = normalizeText(text);
  const matches = [...source.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map(match => number(match[1]))
    .filter(value => value != null);
  return matches;
}

function includesAll(text, needles) {
  return (needles || []).every(needle => text.includes(normalizeText(needle)));
}

function includesAny(text, needles) {
  return !(needles || []).length || needles.some(needle => text.includes(normalizeText(needle)));
}

function includesNone(text, needles) {
  return !(needles || []).some(needle => text.includes(normalizeText(needle)));
}

function packMatches(actual, expected) {
  if (!expected) return true;
  if (!actual || actual.unit !== expected.unit) return false;
  const tolerance = expected.tolerance ?? 0;
  return Math.abs(actual.value - expected.value) <= expected.value * tolerance;
}

function percentMatches(actual, expected) {
  if (expected == null) return true;
  if (!actual.length) return false;
  return actual.some(value => Math.abs(value - expected) <= 0.11);
}

export function matchRetailerProduct(product, options = {}) {
  if (!product || !product.name) return { matched: false, reason: "missing_name" };

  const retailer = product.retailer || options.retailer || null;
  const retailerId = product.retailer_product_id != null ? String(product.retailer_product_id) : null;
  if (retailer === "perek" && retailerId && PEREKRESTOK_EXACT_SKU[retailerId]) {
    return { matched: true, sku: PEREKRESTOK_EXACT_SKU[retailerId], confidence: 1, method: "exact_retailer_id" };
  }

  const text = normalizeText(product.name);
  const pack = product.pack && Number.isFinite(product.pack.value)
    ? { value: Number(product.pack.value), unit: product.pack.unit }
    : parsePack(product.name);
  const percents = parsePercent(product.name);

  const candidates = SKU_RULES.filter(rule =>
    includesAny(text, rule.any) &&
    includesAll(text, rule.all) &&
    includesNone(text, rule.none) &&
    percentMatches(percents, rule.percent) &&
    packMatches(pack, rule.pack)
  );

  if (candidates.length !== 1) {
    return { matched: false, reason: candidates.length ? "ambiguous" : "no_rule_match", candidates: candidates.map(c => c.sku) };
  }

  const rule = candidates[0];
  return { matched: true, sku: rule.sku, confidence: 0.9, method: "conservative_rule" };
}

function betterCandidate(next, current) {
  if (!current) return true;
  if (next.confidence !== current.confidence) return next.confidence > current.confidence;
  if (next.price_rub !== current.price_rub) return next.price_rub < current.price_rub;
  return String(next.name).localeCompare(String(current.name), "ru") < 0;
}

export function buildPriceOverlay(products, options = {}) {
  const retailer = options.retailer || null;
  const city = options.city || "msk";
  const storeId = options.storeId || retailer;
  const selected = new Map();
  const unmatched = [];

  for (const product of products || []) {
    const result = matchRetailerProduct(product, { retailer });
    if (!result.matched) {
      unmatched.push({ name: product.name, retailer_product_id: product.retailer_product_id || null, reason: result.reason });
      continue;
    }
    if (!Number.isFinite(product.price_rub) || product.availability === "out_of_stock") continue;

    const candidate = {
      sku: result.sku,
      name: product.name,
      retailer_product_id: product.retailer_product_id || null,
      price_rub: product.price_rub,
      old_price_rub: Number.isFinite(product.old_price_rub) ? product.old_price_rub : null,
      promo: Boolean(product.promo),
      source_url: product.source_url || null,
      confidence: result.confidence,
      method: result.method
    };
    if (betterCandidate(candidate, selected.get(result.sku))) selected.set(result.sku, candidate);
  }

  const matched = [...selected.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const prices = Object.fromEntries(matched.map(item => [item.sku, item.price_rub]));

  return {
    schema: "tamdeshevle.retailer-price-overlay.v1",
    retailer,
    store_id: storeId,
    city,
    checked_at: options.checked_at || new Date().toISOString(),
    prices,
    matched,
    unmatched
  };
}
