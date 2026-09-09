import { adaptPerekrestokCatalog } from "./perekrestok.mjs";
import { adaptMagnitCatalog } from "./magnit.mjs";
import { buildPriceOverlay } from "./sku-matcher.mjs";

const ADAPTERS = {
  perek: adaptPerekrestokCatalog,
  magnit: adaptMagnitCatalog
};

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

  return {
    ...overlay,
    channel: snapshot.channel || normalized[0]?.channel || "delivery_catalog",
    source_url: snapshot.source_url || null,
    source_schema: snapshot.schema || null,
    ...(snapshot.store_context ? { store_context: snapshot.store_context } : {}),
    normalized_count: normalized.length
  };
}
