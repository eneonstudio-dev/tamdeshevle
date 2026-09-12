import { buildIdentityIndex, resolveProductIdentity, normalizeBarcode } from './product-identity.mjs';

function cleanText(value) {
  const text = String(value == null ? '' : value).trim();
  return text || null;
}

function safeEvidence(result) {
  if (!result || !result.matched) return null;
  return {
    method: 'exact_barcode',
    barcode: result.barcode,
    canonical_name: cleanText(result.identity?.canonical_name),
    brand: cleanText(result.identity?.brand),
    category: cleanText(result.identity?.category),
    quantity: cleanText(result.identity?.quantity),
    manufacturer: cleanText(result.identity?.manufacturer),
    primary_source: cleanText(result.primary_source),
    confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null,
    conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
    price_verified: false,
    store_scope_verified: false,
    rankable: false
  };
}

export function buildReceiptIdentitySources(recordsBySource = {}, options = {}) {
  return Object.entries(recordsBySource).map(([name, records]) => ({
    name,
    index: buildIdentityIndex(Array.isArray(records) ? records : [], {
      source: name,
      source_confidence: options.source_confidence || {}
    })
  }));
}

export function identifyReceiptLine(line, options = {}) {
  const source = line || {};
  const barcode = normalizeBarcode(source.barcode);
  if (!barcode) {
    return {
      ...source,
      identity_evidence: null,
      identity_status: 'missing_barcode'
    };
  }

  const result = resolveProductIdentity(barcode, options);
  if (!result.matched) {
    return {
      ...source,
      barcode,
      identity_evidence: null,
      identity_status: result.reason || 'barcode_not_found'
    };
  }

  return {
    ...source,
    barcode,
    identity_evidence: safeEvidence(result),
    identity_status: 'identified'
  };
}

export function identifyReceiptLines(lines, options = {}) {
  return (Array.isArray(lines) ? lines : []).map(line => identifyReceiptLine(line, options));
}

export function receiptIdentitySafety(line) {
  const evidence = line && line.identity_evidence;
  return {
    identity_found: Boolean(evidence),
    price_verified: false,
    store_scope_verified: false,
    rankable: false,
    may_auto_promote_price: false,
    may_auto_promote_store: false
  };
}
