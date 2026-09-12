const DEFAULT_GIGACHAT_URL = "https://api.giga.chat/v1/chat/completions";
const DEFAULT_GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_GIGACHAT_MODEL = "GigaChat-2-Pro";
const REQUEST_TIMEOUT_MS = 1800;
let cachedGigaToken = null;

const PRODUCT_RULES = {
  milk: { sku: "milk", any: ["молоко"], none: ["сгущ", "сухое", "коктейл", "кефир", "сливк"], pack: { min: 850, max: 1100, unit: "ml" } },
  bread: { sku: "bread_generic", any: ["хлеб", "батон"], none: ["сухар", "гренк", "лаваш", "тостов", "булоч", "сладк"], pack: { min: 300, max: 800, unit: "g" } },
  chicken: { sku: "chicken_fil", any: ["филе кур", "филе цыплен", "филе груд"], none: ["индей", "маринад", "котлет", "наггет", "фарш"], pack: { min: 700, max: 1300, unit: "g" } },
  banana: { sku: "banana", any: ["банан"], none: ["йогурт", "пюре", "шоколад", "сок"] },
  oil: { sku: "oil_sunflower", any: ["масло подсолнеч"], none: ["оливк", "кукуруз"], pack: { min: 850, max: 1100, unit: "ml" } },
  eggs: { sku: "eggs_c1", any: ["яйц"], required: ["с1"], pack: { min: 10, max: 10, unit: "pcs" } },
  buck: { sku: "buckwheat", any: ["гречк", "гречнев"], none: ["каша", "лапша", "макарон"], pack: { min: 650, max: 1000, unit: "g" } },
  sour: { sku: "smetana", any: ["сметан"], none: ["соус"], pack: { min: 250, max: 400, unit: "g" } },
  sugar: { sku: "sugar", any: ["сахар"], none: ["пудр", "тростников", "заменител"], pack: { min: 800, max: 1200, unit: "g" } },
  pasta: { sku: "pasta", any: ["макарон", "спагет", "вермиш"], none: ["готов", "гречнев", "рисов"], pack: { min: 350, max: 550, unit: "g" } }
};

function env(name) {
  try {
    if (globalThis.Deno?.env?.get) return globalThis.Deno.env.get(name) || "";
  } catch {}
  try {
    if (globalThis.process?.env) return globalThis.process.env[name] || "";
  } catch {}
  return "";
}

function text(value) {
  return String(value ?? "").toLowerCase().replace(/ё/g, "е").replace(/\bc([012])\b/g, "с$1").replace(/\s+/g, " ").trim();
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePack(name) {
  const source = text(name);
  const patterns = [
    { re: /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?![a-zа-я])/i, unit: "g", factor: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:гр|г|g)(?![a-zа-я])/i, unit: "g", factor: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![a-zа-я])/i, unit: "ml", factor: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:л|l)(?![a-zа-я])/i, unit: "ml", factor: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:шт|pcs)(?![a-zа-я])/i, unit: "pcs", factor: 1 }
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern.re);
    if (!match) continue;
    const value = number(match[1]);
    if (value != null) return { value: value * pattern.factor, unit: pattern.unit };
  }
  return null;
}

function matchesRule(name, rule) {
  const normalized = text(name);
  if (!rule.any.some(term => normalized.includes(text(term)))) return false;
  if ((rule.required || []).some(term => !normalized.includes(text(term)))) return false;
  if ((rule.none || []).some(term => normalized.includes(text(term)))) return false;
  if (!rule.pack) return true;
  const pack = parsePack(name);
  if (!pack || pack.unit !== rule.pack.unit) return false;
  return pack.value >= rule.pack.min && pack.value <= rule.pack.max;
}

function firstArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["offers", "products", "items", "results", "data"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = firstArray(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function readOffer(raw) {
  const name = raw?.name ?? raw?.title ?? raw?.product_name ?? raw?.product?.name ?? raw?.offer?.name;
  const price = number(raw?.price_rub ?? raw?.price ?? raw?.current_price ?? raw?.sale_price ?? raw?.pricing?.price);
  if (!name || price == null || price <= 0) return null;
  const storeName = String(raw?.store_name ?? raw?.store?.name ?? raw?.merchant_name ?? raw?.merchant?.name ?? "Купер");
  const storeId = String(raw?.store_id ?? raw?.store?.id ?? raw?.merchant_id ?? raw?.merchant?.id ?? `kuper:${text(storeName).replace(/[^a-zа-я0-9]+/g, "-")}`);
  const sourceUrl = raw?.url ?? raw?.deeplink ?? raw?.web_url ?? raw?.product?.url ?? null;
  const checkedAt = String(raw?.checked_at ?? raw?.updated_at ?? raw?.timestamp ?? new Date().toISOString());
  const availability = text(raw?.availability ?? raw?.stock_status ?? raw?.status ?? "in_stock");
  if (["out_of_stock", "unavailable", "нет в наличии", "sold_out"].some(x => availability.includes(x))) return null;
  return { name: String(name), price, storeName, storeId, sourceUrl: sourceUrl ? String(sourceUrl) : null, checkedAt };
}

export function normalizeKuperPayload(payload, basket, city) {
  const rows = firstArray(payload);
  const quotes = [];
  for (const raw of rows) {
    const offer = readOffer(raw);
    if (!offer) continue;
    const rawCity = text(raw?.city ?? raw?.store?.city ?? raw?.location?.city ?? "");
    if (rawCity && city === "msk" && !rawCity.includes("моск")) continue;
    if (rawCity && city === "spb" && !rawCity.includes("петер") && !rawCity.includes("спб")) continue;
    for (const productId of basket) {
      const rule = PRODUCT_RULES[productId];
      if (!rule || !matchesRule(offer.name, rule)) continue;
      quotes.push({
        productId,
        sku: rule.sku,
        storeId: offer.storeId,
        storeName: offer.storeName,
        price: offer.price,
        checkedAt: offer.checkedAt,
        sourceUrl: offer.sourceUrl,
        sourceKind: "partner",
        confidence: 0.88,
        sourceProvider: "kuper"
      });
    }
  }
  return quotes;
}

export async function fetchKuperQuotes(basket, city) {
  const url = env("KUPER_PRICE_FEED_URL");
  if (!url) return [];
  const token = env("KUPER_API_TOKEN");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ city, products: basket }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) return [];
    return normalizeKuperPayload(await response.json(), basket, city);
  } catch {
    return [];
  }
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

async function getGigaChatAccessToken() {
  const provided = env("GIGACHAT_ACCESS_TOKEN");
  if (provided) return provided;
  const authKey = env("GIGACHAT_AUTHORIZATION_KEY");
  if (!authKey) return "";
  const now = Date.now();
  if (cachedGigaToken?.token && cachedGigaToken.expiresAt - 60_000 > now) return cachedGigaToken.token;
  try {
    const response = await fetch(env("GIGACHAT_OAUTH_URL") || DEFAULT_GIGACHAT_OAUTH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        RqUID: crypto.randomUUID(),
        Authorization: authKey.startsWith("Basic ") ? authKey : `Basic ${authKey}`
      },
      body: new URLSearchParams({ scope: env("GIGACHAT_SCOPE") || "GIGACHAT_API_PERS" }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) return "";
    const payload = await response.json();
    const token = String(payload?.access_token || "");
    if (!token) return "";
    const rawExpiry = Number(payload?.expires_at);
    const expiresAt = Number.isFinite(rawExpiry) ? (rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry) : now + 25 * 60_000;
    cachedGigaToken = { token, expiresAt };
    return token;
  } catch {
    return "";
  }
}

export async function verifyQuotesWithGigaChat(quotes) {
  const token = await getGigaChatAccessToken();
  if (!token || !quotes.length) return quotes;
  const endpoint = env("GIGACHAT_API_URL") || DEFAULT_GIGACHAT_URL;
  const model = env("GIGACHAT_MODEL") || DEFAULT_GIGACHAT_MODEL;
  const compact = quotes.slice(0, 30).map((quote, index) => ({
    index,
    productId: quote.productId,
    sku: quote.sku,
    storeName: quote.storeName,
    price: quote.price,
    sourceUrl: quote.sourceUrl
  }));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "Ты проверяешь сопоставление продуктовых офферов. Не придумывай цены и факты. Верни ТОЛЬКО JSON вида {\"accepted\":[индексы],\"rejected\":[{\"index\":0,\"reason\":\"...\"}]}. При сомнении отклоняй."
          },
          { role: "user", content: JSON.stringify(compact) }
        ]
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) return quotes;
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const verdict = typeof raw === "string" ? safeJson(raw.replace(/^```json\s*|\s*```$/g, "")) : null;
    if (!verdict || !Array.isArray(verdict.accepted)) return quotes;
    const accepted = new Set(verdict.accepted.map(Number).filter(Number.isInteger));
    return quotes.filter((_, index) => accepted.has(index)).map(quote => ({ ...quote, confidence: Math.min(0.95, quote.confidence + 0.04), verifiedBy: "gigachat" }));
  } catch {
    return quotes;
  }
}

export async function getSberPriceQuotes(basket, city) {
  const kuper = await fetchKuperQuotes(basket, city);
  return verifyQuotesWithGigaChat(kuper);
}

export const sberPriceIntelligenceStatus = Object.freeze({
  kuperConfigured: Boolean(env("KUPER_PRICE_FEED_URL")),
  gigachatConfigured: Boolean(env("GIGACHAT_ACCESS_TOKEN") || env("GIGACHAT_AUTHORIZATION_KEY"))
});
