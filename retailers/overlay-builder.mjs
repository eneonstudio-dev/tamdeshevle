import { adaptPerekrestokCatalog } from "./perekrestok.mjs";
import { adaptMagnitCatalog } from "./magnit.mjs";
import { adaptPyatCatalog } from "./pyat.mjs";
import { adaptLentaCatalog } from "./lenta.mjs";
import { adaptDixyCatalog } from "./dixy.mjs";
import { buildPriceOverlay, comparisonEligibility, matchRetailerProduct } from "./sku-matcher.mjs";

const ADAPTERS = {
  perek: adaptPerekrestokCatalog,
  magnit: adaptMagnitCatalog,
  pyat: adaptPyatCatalog,
  lenta: adaptLentaCatalog,
  dixy: adaptDixyCatalog
};

function explicitUnavailableProducts(normalized, overlay, retailer) {
  const availableSkus = new Set((overlay.matched || []).map(item => item.sku));
  const unavailableBySku = new Map();

  for (const product of normalized || []) {
    if (product?.availability !== "out_of_stock") continue;
    const result = matchRetailerProduct(product, { retailer });
    if (!result.matched || availableSkus.has(result.sku) || unavailableBySku.has(result.sku)) continue;

    // Availability is already explicitly known as negative. Re-run only the
    // identity/pack eligibility checks with availability neutralized so that a
    // different pack or ambiguous match cannot suppress the canonical SKU.
    const identityEligibility = comparisonEligibility({ ...product, availability: "in_stock" }, result);
    if (!identityEligibility.eligible) continue;

    unavailableBySku.set(result.sku, {
      sku: result.sku,
      name: product.name,
      retailer_product_id: product.retailer_product_id || null,
      source_url: product.source_url || null,
      confidence: result.confidence,
      method: result.method,
      comparison_eligible: false,
      source_pack: identityEligibility.source_pack,
      requested_pack: identityEligibility.requested_pack,
      availability: "out_of_stock"
    });
  }

  return [...unavailableBySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function buildOverlayFromSnapshot(snapshot) {
  if (!snapshot || !snapshot.retailer) throw new Error("Retailer snapshot requires retailer");
  const adapter = ADAPTERS[snapshot.retailer];
  if (!adapter) throw new Error(`Unsupported retailer: ${snapshot.retailer}`);
  if (!Array.isArray(snapshot.rows)) throw new Error("Retailer snapshot requires rows[]");

  const normalized = adapter(snapshot.rows, snapshot);
  const overlay = buildPriceOverlay(normalized, {
    retailer: snapshot.retailer,
    storeId: snapshot.store_id || snapshot.retailer,
    city: snapshot.city || "msk",
    checked_at: snapshot.checked_at,
    channel: snapshot.channel || normalized[0]?.channel || "delivery_catalog"
  });
  const unavailable = explicitUnavailableProducts(normalized, overlay, snapshot.retailer);

  return {
    ...overlay,
    ...(unavailable.length ? { unavailable } : {}),
    channel: snapshot.channel || normalized[0]?.channel || "delivery_catalog",
    source_url: snapshot.source_url || null,
    source_schema: snapshot.schema || null,
    ...(snapshot.store_context ? { store_context: snapshot.store_context } : {}),
    ...(snapshot.catalog_context ? { catalog_context: snapshot.catalog_context } : {}),
    scope_verified: snapshot.scope_verified === true,
    normalized_count: normalized.length
  };
}
