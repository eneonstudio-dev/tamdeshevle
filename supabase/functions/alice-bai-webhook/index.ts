import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AliceRequest = {
  version?: string;
  request?: {
    type?: string;
    command?: string;
    original_utterance?: string;
  };
  session?: {
    new?: boolean;
    skill_id?: string;
    session_id?: string;
    user_id?: string;
  };
  state?: {
    session?: SessionState;
  };
};

type SessionState = {
  basket?: string[];
  city?: "msk" | "spb";
};

type PriceFile = {
  as_of?: string;
  stores?: Array<{ id: string; name: string; kind?: string }>;
  products?: Array<{ id: string; name: string; pack?: string }>;
  flat?: Record<string, Record<string, Record<string, number>>>;
};

const DATA_URL = "https://eneonstudio-dev.github.io/tamdeshevle/prices.json";
const SHOP_IDS = ["pyat", "magnit", "perek", "lenta", "dixy"];
const MAX_BASKET = 20;
const EXPECTED_SKILL_ID = (Deno.env.get("ALICE_SKILL_ID") || "").trim();

const ALIASES: Record<string, string[]> = {
  milk: ["молоко", "молока"],
  bread: ["хлеб", "батон"],
  chicken: ["курица", "курицу", "куриное филе", "филе курицы", "филе"],
  banana: ["банан", "бананы", "бананов"],
  oil: ["подсолнечное масло", "масло подсолнечное", "масло"],
  eggs: ["яйца", "яиц", "яйцо"],
  buck: ["гречка", "гречку", "гречки"],
  sour: ["сметана", "сметану", "сметаны"],
  sugar: ["сахар", "сахара"],
  pasta: ["макароны", "макарон", "паста"]
};

let priceCache: { at: number; data: PriceFile } | null = null;

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9%.,\-\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliceResponse(text: string, state: SessionState = {}, endSession = false, status = 200) {
  return new Response(JSON.stringify({
    response: {
      text: text.slice(0, 900),
      end_session: endSession
    },
    session_state: state,
    version: "1.0"
  }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function detectProducts(text: string) {
  const normalized = normalize(text);
  const found: string[] = [];
  for (const [id, aliases] of Object.entries(ALIASES)) {
    if (aliases.some(alias => normalized.includes(normalize(alias)))) found.push(id);
  }
  return unique(found).slice(0, MAX_BASKET);
}

function cleanState(raw: SessionState | undefined): SessionState {
  const basket = Array.isArray(raw?.basket)
    ? unique(raw!.basket!.filter(id => Object.prototype.hasOwnProperty.call(ALIASES, id))).slice(0, MAX_BASKET)
    : [];
  return { basket, city: raw?.city === "spb" ? "spb" : "msk" };
}

async function getPrices(): Promise<PriceFile | null> {
  if (priceCache && Date.now() - priceCache.at < 5 * 60_000) return priceCache.data;
  try {
    const response = await fetch(DATA_URL, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) return null;
    const data = await response.json() as PriceFile;
    priceCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

function productNames(data: PriceFile, basket: string[]) {
  const names = new Map((data.products || []).map(p => [p.id, p.name]));
  return basket.map(id => names.get(id) || id);
}

function compareBasket(data: PriceFile, basket: string[], city: "msk" | "spb") {
  const cityPrices = data.flat?.[city];
  if (!cityPrices || !basket.length) return null;

  const storeNames = new Map((data.stores || []).map(s => [s.id, s.name]));
  const totals = SHOP_IDS.map(storeId => {
    let total = 0;
    for (const productId of basket) {
      const price = Number(cityPrices?.[productId]?.[storeId]);
      if (!Number.isFinite(price) || price <= 0) return null;
      total += price;
    }
    return { storeId, storeName: storeNames.get(storeId) || storeId, total };
  }).filter(Boolean) as Array<{ storeId: string; storeName: string; total: number }>;

  if (!totals.length) return null;
  totals.sort((a, b) => a.total - b.total);

  let splitTotal = 0;
  const split: Array<{ productId: string; storeId: string; price: number }> = [];
  for (const productId of basket) {
    const variants = SHOP_IDS
      .map(storeId => ({ storeId, price: Number(cityPrices?.[productId]?.[storeId]) }))
      .filter(v => Number.isFinite(v.price) && v.price > 0)
      .sort((a, b) => a.price - b.price);
    if (!variants.length) return null;
    splitTotal += variants[0].price;
    split.push({ productId, ...variants[0] });
  }

  return {
    oneStore: totals[0],
    splitTotal,
    split,
    saving: Math.max(0, totals[0].total - splitTotal)
  };
}

function basketList(data: PriceFile, basket: string[]) {
  return productNames(data, basket).join(", ");
}

async function describeComparison(state: SessionState) {
  const basket = state.basket || [];
  if (!basket.length) return "Корзина пустая. Назови продукты, например: молоко, яйца, хлеб и курица.";

  const data = await getPrices();
  if (!data) return "Корзину запомнил, но ценовой файл сейчас не ответил. Ничего не придумал — попробуй сравнить ещё раз.";

  const result = compareBasket(data, basket, state.city || "msk");
  if (!result) return "Корзину запомнил, но для части товаров пока нет сопоставимых цен. Показывать липовый итог не буду.";

  const cityName = state.city === "spb" ? "Санкт-Петербург" : "Москва";
  const saving = result.saving > 0
    ? ` Если разбить по магазинам — ${result.splitTotal} ₽, экономия ${result.saving} ₽.`
    : " Разбивать по магазинам смысла нет: дешевле не станет.";

  return `Корзина: ${basketList(data, basket)}. ${cityName}: один магазин — ${result.oneStore.storeName}, ${result.oneStore.total} ₽.${saving} Это пока тестовый ценовой контур Votonobay, не живой ценник конкретной точки.`;
}

function isExit(text: string) {
  return /^(выход|выйти|хватит|стоп|закончить)$/i.test(text.trim());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: AliceRequest;
  try {
    body = await req.json();
  } catch {
    return aliceResponse("Некорректный запрос.", {}, true, 400);
  }

  const utterance = String(body.request?.original_utterance || body.request?.command || "").trim();
  if (normalize(utterance) === "ping") return aliceResponse("pong", {}, true);

  if (body.version !== "1.0" || !body.session?.skill_id || !body.request?.type) {
    return aliceResponse("Некорректный запрос Алисы.", {}, true, 400);
  }

  if (EXPECTED_SKILL_ID && body.session.skill_id !== EXPECTED_SKILL_ID) {
    return new Response("Forbidden", { status: 403 });
  }

  const state = cleanState(body.state?.session);
  const text = normalize(body.request?.command || utterance);

  if (isExit(text)) return aliceResponse("Есть. Корзину оставляю здесь. Возвращайся, когда снова захочется сравнивать макароны.", state, true);

  if (body.session.new && !text) {
    return aliceResponse("Я Бай из Votonobay. Назови продукты обычной фразой — например: собери молоко, яйца, хлеб и курицу. Я запомню корзину и сравню варианты.", state);
  }

  if (/что ты умеешь|помощ|команд/.test(text)) {
    return aliceResponse("Могу собрать корзину из названных продуктов, добавить или убрать позиции, показать корзину и сравнить её по магазинам. Скажи, например: собери молоко, яйца, хлеб и курицу.", state);
  }

  if (/очист|сброс|заново/.test(text)) {
    state.basket = [];
    return aliceResponse("Очистил. Что собираем теперь?", state);
  }

  const mentioned = detectProducts(text);

  if (/что.*корзин|покажи.*корзин|корзина$/.test(text)) {
    if (!state.basket?.length) return aliceResponse("Корзина пустая.", state);
    const data = await getPrices();
    const names = data ? basketList(data, state.basket) : state.basket.join(", ");
    return aliceResponse(`Сейчас в корзине: ${names}.`, state);
  }

  if (/убер|удал|без /.test(text) && mentioned.length) {
    state.basket = (state.basket || []).filter(id => !mentioned.includes(id));
    return aliceResponse(`Убрал ${mentioned.length === 1 ? "позицию" : "позиции"}. ${await describeComparison(state)}`, state);
  }

  if (/добав/.test(text) && mentioned.length) {
    state.basket = unique([...(state.basket || []), ...mentioned]).slice(0, MAX_BASKET);
    return aliceResponse(`Добавил. ${await describeComparison(state)}`, state);
  }

  if (/сравн|дешев|где купить|посчитай|итого/.test(text)) {
    if (mentioned.length) state.basket = unique([...(state.basket || []), ...mentioned]).slice(0, MAX_BASKET);
    return aliceResponse(await describeComparison(state), state);
  }

  if (mentioned.length) {
    state.basket = /собер|состав|корзин/.test(text)
      ? mentioned
      : unique([...(state.basket || []), ...mentioned]).slice(0, MAX_BASKET);
    return aliceResponse(await describeComparison(state), state);
  }

  return aliceResponse("Не понял, что менять в корзине. Скажи проще: «собери молоко, яйца, хлеб и курицу» или «убери хлеб».", state);
});
