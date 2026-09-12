export type BasketProductId = "milk" | "bread" | "chicken" | "banana" | "oil" | "eggs" | "buck" | "sour" | "sugar" | "pasta";

export type LiveQuote = {
  productId: BasketProductId;
  sku: string;
  storeId: string;
  storeName: string;
  price: number;
  checkedAt: string;
  sourceUrl: string | null;
  sourceKind: "official" | "aggregator" | "unknown";
  confidence: number;
};

export type LiveComparison = {
  city: "msk" | "spb";
  basket: BasketProductId[];
  covered: number;
  totalItems: number;
  quotesByProduct: Record<string, LiveQuote[]>;
  bestByProduct: LiveQuote[];
  splitTotal: number | null;
  bestSingleStore: { storeId: string; storeName: string; total: number } | null;
  missing: BasketProductId[];
  newestCheckedAt: string | null;
};

type OverlayMatch = {
  sku?: string;
  price_rub?: number;
  source_url?: string;
  confidence?: number;
  comparison_eligible?: boolean;
  availability?: string;
};

type CatalogContext = {
  valid_from?: string;
  valid_to?: string;
  price_scope?: string;
  store_verified?: boolean;
};

type Overlay = {
  schema?: string;
  retailer?: string;
  store_id?: string;
  city?: string;
  checked_at?: string;
  prices?: Record<string, number>;
  matched?: OverlayMatch[];
  catalog_context?: CatalogContext;
};

type SnapshotRow = {
  id?: string;
  name?: string;
  price?: number;
  availability?: string;
  url?: string;
};

type RetailerSnapshot = {
  retailer?: string;
  city?: string;
  checked_at?: string;
  scope_verified?: boolean;
  rows?: SnapshotRow[];
};

const BASE = "https://eneonstudio-dev.github.io/tamdeshevle/data/retailers";
const MAGNIT_SAMPLE_URL = `${BASE}/magnit.sample.json`;
const OVERLAYS = [
  { storeId: "magnit", storeName: "Магнит", url: `${BASE}/magnit.overlay.json` },
  { storeId: "pyat", storeName: "Пятёрочка", url: `${BASE}/pyat.overlay.json` },
  { storeId: "perek", storeName: "Перекрёсток", url: `${BASE}/perekrestok.overlay.json` },
  { storeId: "lenta", storeName: "Лента", url: `${BASE}/lenta.overlay.json` },
  { storeId: "dixy", storeName: "Дикси", url: `${BASE}/dixy.overlay.json` }
];

const PRODUCT_TO_SKU: Record<BasketProductId, string> = {
  milk: "milk",
  bread: "bread_generic",
  chicken: "chicken_fil",
  banana: "banana",
  oil: "oil_sunflower",
  eggs: "eggs_c1",
  buck: "buckwheat",
  sour: "smetana",
  sugar: "sugar",
  pasta: "pasta"
};

const STORE_NAMES = new Map(OVERLAYS.map(x => [x.storeId, x.storeName]));
const cache = new Map<string, { at: number; value: Overlay | null }>();
let magnitSnapshotCache: { at: number; value: RetailerSnapshot | null } | null = null;
const CACHE_MS = 5 * 60_000;
const MAX_AGE_OFFICIAL_MS = 72 * 60 * 60_000;
const MAX_AGE_AGGREGATOR_MS = 24 * 60 * 60_000;
const MAX_AGE_VALID_CATALOG_MS = 7 * 24 * 60 * 60_000;

function sourceKind(url: string | null): LiveQuote["sourceKind"] {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (["magnit.ru", "lenta.com", "perekrestok.ru", "promo.perekrestok.ru", "5ka.ru"].includes(host)) return "official";
    if (host.endsWith("proshoper.ru")) return "aggregator";
  } catch {}
  return "unknown";
}

function catalogBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value) return null;
  const raw = String(value).trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00"}+03:00`
    : raw;
  const ts = Date.parse(isoDate);
  return Number.isFinite(ts) ? ts : null;
}

export function catalogWindowActive(context: CatalogContext | undefined, nowMs = Date.now()) {
  const from = catalogBoundary(context?.valid_from, false);
  const to = catalogBoundary(context?.valid_to, true);
  if (from == null && to == null) return false;
  if (from != null && nowMs < from) return false;
  if (to != null && nowMs > to) return false;
  return true;
}

export function overlayFresh(checkedAt: string, kind: LiveQuote["sourceKind"], context?: CatalogContext, nowMs = Date.now()) {
  const ts = Date.parse(checkedAt);
  if (!Number.isFinite(ts)) return false;
  const age = nowMs - ts;
  if (age < -10 * 60_000) return false;
  if (kind === "official") return age <= MAX_AGE_OFFICIAL_MS;
  if (kind === "aggregator") {
    if (age <= MAX_AGE_VALID_CATALOG_MS && catalogWindowActive(context, nowMs)) return true;
    return age <= MAX_AGE_AGGREGATOR_MS;
  }
  return age <= 12 * 60 * 60_000;
}

async function fetchOverlay(url: string): Promise<Overlay | null> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json() as Overlay;
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch {
    cache.set(url, { at: Date.now(), value: null });
    return null;
  }
}

async function fetchMagnitSnapshot(): Promise<RetailerSnapshot | null> {
  if (magnitSnapshotCache && Date.now() - magnitSnapshotCache.at < CACHE_MS) return magnitSnapshotCache.value;
  try {
    const response = await fetch(MAGNIT_SAMPLE_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json() as RetailerSnapshot;
    magnitSnapshotCache = { at: Date.now(), value };
    return value;
  } catch {
    magnitSnapshotCache = { at: Date.now(), value: null };
    return null;
  }
}

function genericBreadPackGrams(name: string) {
  const match = name.toLowerCase().replace(/ё/g, "е").match(/(\d+(?:[.,]\d+)?)\s*(?:гр|г)(?![а-яa-z])/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function genericBreadEligible(row: SnapshotRow) {
  const name = String(row.name || "").toLowerCase().replace(/ё/g, "е");
  if (!name.includes("хлеб")) return false;
  if (["сухар", "гренк", "лаваш", "тостов", "сладк", "булоч", "злаков", "сухофрукт", "сэндвич"].some(term => name.includes(term))) return false;
  const grams = genericBreadPackGrams(name);
  return grams != null && grams >= 400 && grams <= 600;
}

async function magnitGenericBreadQuote(city: "msk" | "spb"): Promise<LiveQuote | null> {
  if (city !== "msk") return null;
  const snapshot = await fetchMagnitSnapshot();
  const checkedAt = String(snapshot?.checked_at || "");
  if (!snapshot || snapshot.retailer !== "magnit" || snapshot.city !== city || snapshot.scope_verified !== true) return null;
  if (!checkedAt || !overlayFresh(checkedAt, "official")) return null;

  const candidates = (snapshot.rows || [])
    .filter(row => genericBreadEligible(row) && row.availability !== "Нет в наличии")
    .map(row => ({ row, price: Number(row.price) }))
    .filter(item => Number.isFinite(item.price) && item.price > 0)
    .sort((a, b) => a.price - b.price || String(a.row.name).localeCompare(String(b.row.name), "ru"));
  const best = candidates[0];
  if (!best) return null;
  return {
    productId: "bread",
    sku: "bread_generic",
    storeId: "magnit",
    storeName: "Магнит",
    price: best.price,
    checkedAt,
    sourceUrl: best.row.url ? String(best.row.url) : "https://magnit.ru/",
    sourceKind: "official",
    confidence: 0.85
  };
}

function matchForSku(overlay: Overlay, sku: string) {
  return (overlay.matched || []).find(item =>
    item?.sku === sku && item?.comparison_eligible !== false && item?.availability !== "out_of_stock"
  ) || null;
}

function quoteFromOverlay(productId: BasketProductId, overlay: Overlay, storeId: string): LiveQuote | null {
  const sku = PRODUCT_TO_SKU[productId];
  const match = matchForSku(overlay, sku);
  const price = Number(match?.price_rub ?? overlay.prices?.[sku]);
  const checkedAt = String(overlay.checked_at || "");
  const sourceUrl = match?.source_url ? String(match.source_url) : null;
  const kind = sourceKind(sourceUrl);
  if (!Number.isFinite(price) || price <= 0 || !checkedAt || !overlayFresh(checkedAt, kind, overlay.catalog_context)) return null;
  const confidence = Math.max(0, Math.min(1, Number(match?.confidence ?? 0.7)));
  if (confidence < 0.75) return null;
  return {
    productId,
    sku,
    storeId,
    storeName: STORE_NAMES.get(storeId) || storeId,
    price,
    checkedAt,
    sourceUrl,
    sourceKind: kind,
    confidence
  };
}

export async function getLiveComparison(basket: BasketProductId[], city: "msk" | "spb"): Promise<LiveComparison> {
  const uniqueBasket = [...new Set(basket)];
  const [pairs, genericBread] = await Promise.all([
    Promise.all(OVERLAYS.map(async source => ({ source, overlay: await fetchOverlay(source.url) }))),
    uniqueBasket.includes("bread") ? magnitGenericBreadQuote(city) : Promise.resolve(null)
  ]);
  const quotesByProduct: Record<string, LiveQuote[]> = {};

  for (const productId of uniqueBasket) {
    const quotes: LiveQuote[] = [];
    for (const { source, overlay } of pairs) {
      if (!overlay || overlay.city !== city || overlay.retailer !== source.storeId) continue;
      const quote = quoteFromOverlay(productId, overlay, source.storeId);
      if (quote) quotes.push(quote);
    }
    if (productId === "bread" && genericBread) quotes.push(genericBread);
    quotes.sort((a, b) => a.price - b.price || b.confidence - a.confidence);
    quotesByProduct[productId] = quotes;
  }

  const bestByProduct = uniqueBasket.flatMap(productId => quotesByProduct[productId]?.[0] ? [quotesByProduct[productId][0]] : []);
  const missing = uniqueBasket.filter(productId => !quotesByProduct[productId]?.length);
  const splitTotal = missing.length ? null : bestByProduct.reduce((sum, quote) => sum + quote.price, 0);

  const singleStoreTotals: Array<{ storeId: string; storeName: string; total: number }> = [];
  for (const source of OVERLAYS) {
    let total = 0;
    let complete = true;
    for (const productId of uniqueBasket) {
      const quote = quotesByProduct[productId]?.find(item => item.storeId === source.storeId);
      if (!quote) { complete = false; break; }
      total += quote.price;
    }
    if (complete && uniqueBasket.length) singleStoreTotals.push({ storeId: source.storeId, storeName: source.storeName, total });
  }
  singleStoreTotals.sort((a, b) => a.total - b.total);

  const newestCheckedAt = bestByProduct
    .map(quote => quote.checkedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;

  return {
    city,
    basket: uniqueBasket,
    covered: bestByProduct.length,
    totalItems: uniqueBasket.length,
    quotesByProduct,
    bestByProduct,
    splitTotal,
    bestSingleStore: singleStoreTotals[0] || null,
    missing,
    newestCheckedAt
  };
}
