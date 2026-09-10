const MONTHS = {
  января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
  июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11
};

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(html) {
  return decodeHtml(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseRubles(text) {
  const values = [];
  const re = /(\d{1,5})(?:[\s\u00a0.,]+)(\d{2})\s*₽/g;
  for (const match of String(text || "").matchAll(re)) {
    const value = Number(`${match[1]}.${match[2]}`);
    if (Number.isFinite(value) && value >= 0.01 && value < 100000) values.push(value);
  }
  return values;
}

function slugify(text, index) {
  const base = String(text || "product")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `proshoper-${base || "product"}-${index + 1}`;
}

function parsePeriod(html) {
  const text = plainText(html).toLowerCase();
  const match = text.match(/\bс\s+(\d{1,2})(?:\s+([а-яё]+))?\s+по\s+(\d{1,2})\s+([а-яё]+)\s+(20\d{2})\b/i);
  if (!match) return { valid_from: null, valid_to: null };
  const [, fromDay, explicitFromMonth, toDay, toMonth, yearText] = match;
  const endMonth = MONTHS[toMonth];
  const startMonth = MONTHS[explicitFromMonth || toMonth];
  const year = Number(yearText);
  if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth)) return { valid_from: null, valid_to: null };
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  let fromYear = year;
  if (startMonth > endMonth) fromYear -= 1;
  return { valid_from: iso(fromYear, startMonth, Number(fromDay)), valid_to: iso(year, endMonth, Number(toDay)) };
}

function extractAlt(tag) {
  const match = String(tag).match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return decodeHtml(match ? (match[1] ?? match[2] ?? "") : "").replace(/\s+/g, " ").trim();
}

function likelyProductName(name) {
  if (!name || name.length < 3 || name.length > 220) return false;
  if (/логотип|иконк|logo|arrow|стрелк|баннер|каталог/i.test(name)) return false;
  return /[а-яёa-z]/i.test(name);
}

export function parseProshoperCatalog(html, sourceUrl) {
  const source = String(html || "");
  const imageRe = /<img\b[^>]*>/gi;
  const images = [...source.matchAll(imageRe)];
  const rows = [];
  const seen = new Set();

  for (let i = 0; i < images.length; i += 1) {
    const tag = images[i][0];
    const name = extractAlt(tag);
    if (!likelyProductName(name)) continue;
    const start = images[i].index + tag.length;
    const end = i + 1 < images.length ? images[i + 1].index : Math.min(source.length, start + 5000);
    const segment = source.slice(start, Math.min(end, start + 3500));
    const text = plainText(segment);
    const prices = parseRubles(text);
    if (!prices.length) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const price = prices[0];
    const oldPrice = prices.find(value => value > price) ?? null;
    rows.push({
      id: slugify(name, rows.length),
      name,
      price,
      ...(oldPrice != null ? { old_price: oldPrice } : {}),
      availability: "каталог",
      url: sourceUrl
    });
  }

  return rows;
}

export async function collectProshoperRegionalSnapshot(config = {}) {
  const sourceUrl = config.source_url;
  if (!sourceUrl) throw new Error("Proshoper collector requires source_url");
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "TamDeshevleBot/1.0 (+https://github.com/eneonstudio-dev/tamdeshevle; low-frequency public catalog check)",
      accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(Number(config.timeout_ms || 20000))
  });
  if (!response.ok) throw new Error(`Proshoper HTTP ${response.status}`);
  const html = await response.text();
  const rows = parseProshoperCatalog(html, sourceUrl);
  const minimum = Number(config.min_products || 20);
  if (rows.length < minimum) throw new Error(`Proshoper parser found only ${rows.length} products; minimum is ${minimum}`);
  const period = parsePeriod(html);
  if (!period.valid_from || !period.valid_to) throw new Error("Could not verify current Proshoper catalog period");

  return {
    schema: "tamdeshevle.retailer-snapshot.v1",
    retailer: config.retailer || "pyat",
    store_id: config.store_id || `${config.retailer || "pyat"}_msk_catalog`,
    city: config.city || "msk",
    channel: "regional_catalog",
    source_url: sourceUrl,
    source_name: "proshoper.ru",
    source_kind: "aggregator_catalog",
    checked_at: new Date().toISOString(),
    method: "public_regional_catalog_collector",
    scope_verified: false,
    catalog_context: {
      type: "regional_promotional_catalog",
      region: config.region || "Москва",
      valid_from: period.valid_from,
      valid_to: period.valid_to,
      location_verified: true,
      store_verified: false,
      price_scope: "regional_catalog",
      note: "Региональный каталог-агрегатор: цена ориентировочная и может отличаться в конкретном магазине."
    },
    collector: {
      discovered: rows.length,
      accepted: rows.length,
      source: "proshoper.ru",
      errors: []
    },
    rows
  };
}
