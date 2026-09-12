const DEFAULT_SOURCE_PRIORITY = Object.freeze([
  "canonical",
  "ru_barcode",
  "universe_htt",
  "open_food_facts"
]);

const DEFAULT_SOURCE_CONFIDENCE = Object.freeze({
  canonical: 1,
  ru_barcode: 0.86,
  universe_htt: 0.8,
  open_food_facts: 0.72
});

function cleanText(value) {
  const text = String(value == null ? "" : value).trim();
  return text || null;
}

export function normalizeBarcode(value) {
  const digits = String(value == null ? "" : value).replace(/\D+/g, "");
  return digits || null;
}

export function isValidGtin(value) {
  const barcode = normalizeBarcode(value);
  if (!barcode || ![8, 12, 13, 14].includes(barcode.length)) return false;
  const digits = barcode.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

function normalizeRecord(record, sourceName, sourceConfidence) {
  const source = record || {};
  const barcode = normalizeBarcode(source.barcode || source.gtin || source.ean || source.upc);
  if (!barcode) return null;
  return {
    barcode,
    canonical_name: cleanText(source.canonical_name || source.product_name || source.name),
    brand: cleanText(source.brand),
    category: cleanText(source.category),
    quantity: cleanText(source.quantity || source.pack || source.package_size),
    manufacturer: cleanText(source.manufacturer || source.producer),
    source: sourceName,
    source_confidence: Number.isFinite(Number(source.source_confidence))
      ? Math.max(0, Math.min(1, Number(source.source_confidence)))
      : sourceConfidence,
    source_ref: cleanText(source.source_ref || source.url || source.id),
    last_verified: cleanText(source.last_verified || source.updated_at || source.checked_at)
  };
}

function fieldConflict(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLocaleLowerCase("ru-RU") !== String(b).trim().toLocaleLowerCase("ru-RU");
}

function confidenceFor(source, overrides = {}) {
  const raw = overrides[source] ?? DEFAULT_SOURCE_CONFIDENCE[source] ?? 0.5;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.5;
}

export function buildIdentityIndex(records, options = {}) {
  const source = cleanText(options.source) || "unknown";
  const confidence = confidenceFor(source, options.source_confidence || {});
  const index = new Map();
  for (const row of records || []) {
    const normalized = normalizeRecord(row, source, confidence);
    if (!normalized) continue;
    const bucket = index.get(normalized.barcode) || [];
    bucket.push(normalized);
    index.set(normalized.barcode, bucket);
  }
  return index;
}

function sourceIndexMap(sources, confidenceOverrides) {
  const result = new Map();
  for (const source of sources || []) {
    const name = cleanText(source && source.name);
    if (!name || result.has(name)) continue;
    result.set(name, source.index instanceof Map
      ? source.index
      : buildIdentityIndex(source.records || [], { source: name, source_confidence: confidenceOverrides }));
  }
  return result;
}

export function resolveProductIdentity(barcodeInput, options = {}) {
  const barcode = normalizeBarcode(barcodeInput);
  if (!barcode) return { matched: false, reason: "missing_barcode", barcode: null, rankable: false };
  if (!isValidGtin(barcode)) return { matched: false, reason: "invalid_gtin", barcode, rankable: false };

  const priority = Array.isArray(options.priority) && options.priority.length
    ? options.priority.map(cleanText).filter(Boolean)
    : [...DEFAULT_SOURCE_PRIORITY];
  const sourceMap = sourceIndexMap(options.sources || [], options.source_confidence || {});
  const candidates = [];

  for (const source of priority) {
    const rows = sourceMap.get(source)?.get(barcode) || [];
    for (const row of rows) candidates.push(row);
  }

  if (!candidates.length) {
    return { matched: false, reason: "barcode_not_found", barcode, rankable: false, candidates: [] };
  }

  const primary = candidates[0];
  const merged = {
    barcode,
    canonical_name: primary.canonical_name,
    brand: primary.brand,
    category: primary.category,
    quantity: primary.quantity,
    manufacturer: primary.manufacturer
  };
  const conflicts = [];

  for (const candidate of candidates.slice(1)) {
    for (const field of ["canonical_name", "brand", "category", "quantity", "manufacturer"]) {
      if (!merged[field] && candidate[field]) merged[field] = candidate[field];
      else if (fieldConflict(merged[field], candidate[field])) {
        conflicts.push({ field, kept: merged[field], rejected: candidate[field], rejected_source: candidate.source });
      }
    }
  }

  const evidence = candidates.map(candidate => ({
    source: candidate.source,
    confidence: candidate.source_confidence,
    source_ref: candidate.source_ref,
    last_verified: candidate.last_verified,
    canonical_name: candidate.canonical_name,
    brand: candidate.brand,
    category: candidate.category,
    quantity: candidate.quantity,
    manufacturer: candidate.manufacturer
  }));

  const primaryConfidence = confidenceFor(primary.source, options.source_confidence || {});
  const effectiveConfidence = Math.min(primary.source_confidence, primaryConfidence);

  return {
    matched: true,
    method: "exact_barcode",
    barcode,
    identity: merged,
    primary_source: primary.source,
    confidence: Number(effectiveConfidence.toFixed(3)),
    conflicts,
    evidence,
    rankable: false,
    price_verified: false,
    store_scope_verified: false,
    note: "Identity evidence only. Barcode matching never verifies price, stock, store scope, or receipt proof."
  };
}

export const PRODUCT_IDENTITY_DEFAULTS = Object.freeze({
  priority: DEFAULT_SOURCE_PRIORITY,
  confidence: DEFAULT_SOURCE_CONFIDENCE
});
