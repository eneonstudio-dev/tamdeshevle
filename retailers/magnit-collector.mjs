const PRODUCT_LINK_RE = /href=["']([^"']*\/product\/[^"'#?]+(?:\?[^"'#]*)?)["']/gi;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value) { return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function number(value) { if (value == null || value === "") return null; const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return Number.isFinite(parsed) ? parsed : null; }

function jsonLdProducts(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of String(html || "").matchAll(re)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        if (item["@type"] === "Product" || (Array.isArray(item["@type"]) && item["@type"].includes("Product"))) out.push(item);
      }
    } catch {}
  }
  return out;
}

function offerPrice(offers) {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list) { const value = number(offer && (offer.price ?? offer.lowPrice)); if (value != null) return value; }
  return null;
}

function articleFromUrl(url) { const match = String(url || "").match(/\/product\/(\d+)(?:-|\/|\?|$)/); return match ? match[1] : null; }

export function withMagnitStore(url, storeContext) {
  if (!storeContext || storeContext.shop_code == null) throw new Error("Magnit collector requires shop_code");
  const value = new URL(url, "https://magnit.ru");
  if (value.hostname !== "magnit.ru" && value.hostname !== "www.magnit.ru") throw new Error(`Unsupported Magnit host: ${value.hostname}`);
  value.protocol = "https:"; value.hostname = "magnit.ru";
  value.searchParams.set("shopCode", String(storeContext.shop_code));
  value.searchParams.set("shopType", String(storeContext.shop_type || 1));
  return value.toString();
}

export function discoverMagnitProductUrls(html, baseUrl, storeContext) {
  const urls = new Set();
  for (const match of String(html || "").matchAll(PRODUCT_LINK_RE)) {
    try { urls.add(withMagnitStore(new URL(decodeHtml(match[1]), baseUrl).toString(), storeContext)); } catch {}
  }
  return [...urls].sort();
}

function normalizedKeyword(value) {
  return decodeURIComponent(String(value || "")).toLowerCase().replace(/[^a-zа-яё0-9]+/g, " ").trim();
}

export function rankMagnitProductUrls(urls, keywords = [], pinned = []) {
  const remaining = new Set(urls || []);
  const result = [];
  for (const url of pinned || []) if (remaining.delete(url)) result.push(url);
  const groups = keywords.map(keyword => {
    const needle = normalizedKeyword(keyword);
    return needle ? [...remaining].filter(url => normalizedKeyword(url).includes(needle)).sort() : [];
  });
  // Round-robin keeps a small request budget spread across basket categories.
  while (groups.some(group => group.length)) {
    for (const group of groups) {
      while (group.length && !remaining.has(group[0])) group.shift();
      const url = group.shift();
      if (url && remaining.delete(url)) result.push(url);
    }
  }
  return result.concat([...remaining].sort());
}

function pageTitle(html) {
  const h1 = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (h1) return stripTags(h1[1]);
  const og = String(html || "").match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) || String(html || "").match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (og) return stripTags(og[1]).split(" – купить")[0].trim();
  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i); return title ? stripTags(title[1]).split(" – купить")[0].trim() : null;
}

function pagePrice(html) {
  for (const product of jsonLdProducts(html)) { const value = offerPrice(product.offers); if (value != null) return value; }
  for (const re of [/(?:finalPrice|currentPrice|salePrice|price)["']?\s*[:=]\s*["']?(\d+(?:[.,]\d+)?)/i, /(\d+(?:[.,]\d+)?)\s*(?:&#8381;|₽)/i]) {
    const match = String(html || "").match(re); const value = match ? number(match[1]) : null; if (value != null) return value;
  }
  return null;
}

function normalizeImageUrl(value) {
  const raw = Array.isArray(value) ? value[0] : value && typeof value === "object" ? (value.url || value.contentUrl) : value;
  if (!raw) return null;
  try { const url = new URL(decodeHtml(String(raw))); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}

export function pageImage(html) {
  for (const product of jsonLdProducts(html)) {
    const image = normalizeImageUrl(product.image);
    if (image) return image;
  }
  const source = String(html || "");
  const match = source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) || source.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  return match ? normalizeImageUrl(match[1]) : null;
}

export function pageUnitPrice(html) {
  const text = stripTags(html);
  for (const pattern of [{ re: /(\d+(?:[.,]\d+)?)\s*₽?\s*\/\s*1\s*(?:кг|kg)(?![a-zа-яё])/i, unit: "kg" }, { re: /(\d+(?:[.,]\d+)?)\s*₽?\s*\/\s*1\s*(?:л|l)(?![a-zа-яё])/i, unit: "l" }]) {
    const match = text.match(pattern.re); const value = match ? number(match[1]) : null; if (value != null) return { price: value, unit: pattern.unit };
  }
  return null;
}

function expectedAddressPresent(html, tokens) { const wanted = (tokens || []).map(x => String(x).toLowerCase().trim()).filter(Boolean); if (!wanted.length) return true; const haystack = stripTags(html).toLowerCase(); return wanted.every(token => haystack.includes(token)); }

export function verifyMagnitScopeConfig(config) {
  const shopCode = String(config?.store_context?.shop_code || "").trim();
  const address = String(config?.store_context?.address || "").trim();
  const tokens = (config?.expected_address_tokens || []).map(x => String(x).trim()).filter(Boolean);
  if (!shopCode) throw new Error("Magnit collector requires store_context.shop_code");
  if (!address) throw new Error("Magnit collector requires store_context.address");
  if (!tokens.length) throw new Error("Magnit collector requires expected_address_tokens");
  const normalizedAddress = address.toLowerCase();
  if (!tokens.every(token => normalizedAddress.includes(token.toLowerCase()))) throw new Error("Magnit configured address does not match expected_address_tokens");
  return { shop_code: shopCode, address, shop_type: String(config.store_context.shop_type || 1) };
}

export function parseMagnitProductPage(html, url, context) {
  if (!expectedAddressPresent(html, context.expected_address_tokens)) throw new Error("Magnit page does not match expected store address");
  const product = jsonLdProducts(html)[0] || null;
  const name = (product && product.name ? stripTags(product.name) : null) || pageTitle(html);
  const price = (product ? offerPrice(product.offers) : null) ?? pagePrice(html);
  const unitPrice = pageUnitPrice(html);
  if (!name) throw new Error("Magnit product name not found");
  if (price == null) throw new Error(`Magnit price not found: ${name}`);
  const sourceUrl = withMagnitStore(url, context.store_context);
  return {
    id: articleFromUrl(sourceUrl), name,
    brand: product && product.brand ? stripTags(typeof product.brand === "object" ? product.brand.name : product.brand) : null,
    price, unit_price: unitPrice ? unitPrice.price : null, unit_price_unit: unitPrice ? unitPrice.unit : null,
    old_price: null, image_url: pageImage(html),
    availability: /(?:В корзину|Добавить в корзину)/i.test(stripTags(html)) ? "В наличии" : "unknown",
    shop_code: String(context.store_context.shop_code), url: sourceUrl
  };
}

async function getText(url, options = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeout_ms || 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": options.user_agent || "TamdeshevleCatalogResearch/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`); return await response.text();
  } finally { clearTimeout(timer); }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function collectMagnitSnapshot(config, options = {}) {
  if (!config || config.retailer !== "magnit") throw new Error("Collector config retailer must be magnit");
  const verifiedStore = verifyMagnitScopeConfig(config);
  const delay = Math.max(0, Number(config.delay_ms ?? 500)); const maxProducts = Math.max(1, Number(config.max_products ?? 40));
  const pinned = (config.product_urls || []).map(url => withMagnitStore(url, config.store_context)); const productUrls = new Set(pinned);
  for (const raw of config.catalog_urls || []) {
    const url = withMagnitStore(raw, config.store_context); const html = await getText(url, options);
    for (const productUrl of discoverMagnitProductUrls(html, url, config.store_context)) productUrls.add(productUrl);
    if (delay) await sleep(delay);
  }
  const rankedUrls = rankMagnitProductUrls([...productUrls], config.priority_keywords || [], pinned); const rows = []; const errors = [];
  for (const url of rankedUrls.slice(0, maxProducts)) {
    try { const html = await getText(url, options); rows.push(parseMagnitProductPage(html, url, config)); } catch (error) { errors.push({ url, error: String(error && error.message || error) }); }
    if (delay) await sleep(delay);
  }
  if (!rows.length) throw new Error(`Magnit collector found no usable products (${errors.length} errors)`);
  return { schema:"tamdeshevle.retailer-snapshot.v1", retailer:"magnit", city:config.city || "msk", store_id:config.store_id || "magnit", channel:config.channel || "delivery_catalog", checked_at:options.checked_at || new Date().toISOString(), source_url:config.source_url || "https://magnit.ru/", method:"public_store_scoped_catalog_collector", scope_verified:true, store_context:verifiedStore, catalog_context:{ type:"store_scoped_public_catalog", location_verified:true, shop_code:verifiedStore.shop_code, address:verifiedStore.address }, collector:{ discovered:productUrls.size, attempted:Math.min(rankedUrls.length, maxProducts), accepted:rows.length, errors }, rows };
}
