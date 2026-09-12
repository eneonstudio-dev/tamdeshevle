import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getLiveComparison, type BasketProductId } from "./live-price-source.ts";

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
  basket?: BasketProductId[];
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

const ALIASES: Record<BasketProductId, string[]> = {
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

const PRODUCT_NAMES: Record<BasketProductId, string> = {
  milk: "молоко",
  bread: "хлеб",
  chicken: "куриное филе",
  banana: "бананы",
  oil: "подсолнечное масло",
  eggs: "яйца С1",
  buck: "гречка",
  sour: "сметана",
  sugar: "сахар",
  pasta: "макароны"
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

function detectProducts(text: string): BasketProductId[] {
  const normalized = normalize(text);
  const found: BasketProductId[] = [];
  for (const [id, aliases] of Object.entries(ALIASES) as Array<[BasketProductId, string[]]>) {
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

function basketList(basket: BasketProductId[]) {
  return basket.map(id => PRODUCT_NAMES[id] || id).join(", ");
}

function rubles(value: number) {
  return `${Math.round(value * 100) / 100}`.replace(".", ",") + " ₽";
}

function sourceLabel(kind: "official" | "aggregator" | "partner" | "unknown") {
  if (kind === "official") return "официальный каталог";
  if (kind === "aggregator") return "публичный агрегатор";
  if (kind === "partner") return "партнёрский источник";
  return "публичный источник";
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

function compareSimulator(data: PriceFile, basket: BasketProductId[], city: "msk" | "spb") {
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
  return totals[0];
}

async function describeComparison(state: SessionState) {
  const basket = state.basket || [];
  if (!basket.length) return "Корзина пустая. Назови продукты, например: молоко, яйца, хлеб и курица.";

  const city = state.city || "msk";
  const cityName = city === "spb" ? "Санкт-Петербург" : "Москва";
  const live = await getLiveComparison(basket, city);

  if (live.covered === live.totalItems && live.totalItems > 0) {
    const split = live.splitTotal == null ? "" : ` По лучшим подтверждённым ценам по магазинам — ${rubles(live.splitTotal)}.`;
    if (live.bestSingleStore) {
      const saving = live.splitTotal != null ? Math.max(0, live.bestSingleStore.total - live.splitTotal) : 0;
      const savingText = saving >= 1 ? ` Разбивка дешевле ещё на ${rubles(saving)}.` : " Разбивать дальше смысла нет.";
      return `Живые цены покрывают всю корзину. ${cityName}: один магазин — ${live.bestSingleStore.storeName}, ${rubles(live.bestSingleStore.total)}.${split}${savingText}`;
    }
    const details = live.bestByProduct.slice(0, 5).map(q => `${PRODUCT_NAMES[q.productId]} — ${q.storeName} ${rubles(q.price)}`).join("; ");
    return `Живые цены покрывают всю корзину, но одного магазина с подтверждёнными ценами на всё пока нет. ${details}.${split}`;
  }

  if (live.covered > 0) {
    const details = live.bestByProduct.slice(0, 5).map(q => `${PRODUCT_NAMES[q.productId]} — ${q.storeName} ${rubles(q.price)} (${sourceLabel(q.sourceKind)})`).join("; ");
    const missing = live.missing.map(id => PRODUCT_NAMES[id]).join(", ");
    return `Нашёл живые цены на ${live.covered} из ${live.totalItems}: ${details}. Пока не подтверждены: ${missing}. Полный итог не считаю — смешивать реальные и учебные цены было бы враньём.`;
  }

  const simulator = await getPrices();
  const fallback = simulator ? compareSimulator(simulator, basket, city) : null;
  if (!fallback) return "Живые источники сейчас не дали сопоставимых цен. Ничего не придумал — попробуй позже.";
  return `Живые источники сейчас не дали сопоставимых цен. Резервный учебный расчёт: ${fallback.storeName}, ${rubles(fallback.total)}. Это симулятор, не текущий ценник.`;
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
    return aliceResponse("Я Бай из Votonobay. Назови продукты обычной фразой — например: собери молоко, яйца, хлеб и курицу. Я запомню корзину и проверю живые цены.", state);
  }

  if (/что ты умеешь|помощ|команд/.test(text)) {
    return aliceResponse("Могу собрать корзину, добавить или убрать позиции и проверить подтверждённые цены по магазинам. Скажи, например: собери молоко, яйца, хлеб и курицу.", state);
  }

  if (/очист|сброс|заново/.test(text)) {
    state.basket = [];
    return aliceResponse("Очистил. Что собираем теперь?", state);
  }

  const mentioned = detectProducts(text);

  if (/что.*корзин|покажи.*корзин|корзина$/.test(text)) {
    if (!state.basket?.length) return aliceResponse("Корзина пустая.", state);
    return aliceResponse(`Сейчас в корзине: ${basketList(state.basket)}.`, state);
  }

  if (/убер|удал|без /.test(text) && mentioned.length) {
    state.basket = (state.basket || []).filter(id => !mentioned.includes(id));
    return aliceResponse(`Убрал ${mentioned.length === 1 ? "позицию" : "позиции"}. ${await describeComparison(state)}`, state);
  }

  if (/добав/.test(text) && mentioned.length) {
    state.basket = unique([...(state.basket || []), ...mentioned]).slice(0, MAX_BASKET);
    return aliceResponse(`Добавил. ${await describeComparison(state)}`, state);
  }

  if (/сравн|дешев|где купить|посчитай|итого|цены|цена/.test(text)) {
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
