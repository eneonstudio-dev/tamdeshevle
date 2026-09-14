const SOURCE_URL = "https://online.metro-cc.ru/dynamic/moloko-2-5-28460?attributes=1710000046%3Atetra-pak&page=2";
const EXPECTED_ADDRESS = ["Ленинградское", "71Г"];
const EXPECTED_PRODUCT = ["Молоко Эконом", "2.5%", "1л"];
const STOCK_MARKERS = ["Товара много", "Товара мало", "Товара достаточно", "Заканчивается", "Раскупили"];

function normalize(value) {
  return String(value || "")
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requireTokens(text, tokens, label) {
  const lower = text.toLowerCase();
  const missing = tokens.filter(token => !lower.includes(String(token).toLowerCase()));
  if (missing.length) throw new Error(`${label} missing: ${missing.join(", ")}`);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
let response;
try {
  response = await fetch(SOURCE_URL, {
    signal: controller.signal,
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "VotonobayTruthProbe/1.0"
    }
  });
} finally {
  clearTimeout(timer);
}

if ([401, 403, 429].includes(response.status)) {
  throw new Error(`METRO public surface blocked probe with HTTP ${response.status}; stop without retry`);
}
if (!response.ok) throw new Error(`METRO public surface HTTP ${response.status}`);

const html = await response.text();
const text = normalize(html);
requireTokens(text, EXPECTED_ADDRESS, "exact-store context");
requireTokens(text, EXPECTED_PRODUCT, "canonical product context");
if (!STOCK_MARKERS.some(marker => text.toLowerCase().includes(marker.toLowerCase()))) {
  throw new Error("current availability marker missing");
}
if (!/\b95(?:[.,]00)?\s*(?:₽|р|руб|д)\b/i.test(text)) {
  throw new Error("expected product price marker missing");
}

const productIndex = text.toLowerCase().indexOf("молоко эконом");
const windowText = productIndex >= 0 ? text.slice(Math.max(0, productIndex - 300), productIndex + 1500) : "";
if (!STOCK_MARKERS.some(marker => windowText.toLowerCase().includes(marker.toLowerCase()))) {
  throw new Error("availability marker is not near the target product; page-level stock text is insufficient proof");
}
if (!/\b95(?:[.,]00)?\s*(?:₽|р|руб|д)\b/i.test(windowText)) {
  throw new Error("price marker is not near the target product; page-level price text is insufficient proof");
}

console.log(JSON.stringify({
  ok: true,
  source_url: SOURCE_URL,
  final_url: response.url,
  exact_store_tokens: EXPECTED_ADDRESS,
  product_tokens: EXPECTED_PRODUCT,
  has_local_price: true,
  has_local_availability: true,
  checked_at: new Date().toISOString()
}, null, 2));
