const STORES = [
  { id: "pyat", name: "Пятёрочка", short: "Пятёрочка", kind: "shop", city: ["msk", "spb"], time: "сходить", walk: 12, color: "#e31e24", type: "Продукты", has_bring: true },
  { id: "magnit", name: "Магнит", short: "Магнит", kind: "shop", city: ["msk", "spb"], time: "сходить", walk: 18, color: "#c81e1e", type: "Продукты", has_bring: true },
  { id: "perek", name: "Перекрёсток", short: "Перекрёсток", kind: "shop", city: ["msk", "spb"], time: "сходить", walk: 9, color: "#0b5c3b", type: "Продукты", has_bring: true },
  { id: "lenta", name: "Лента", short: "Гипер Лента", kind: "hyper", city: ["msk", "spb"], time: "гипер, сходить", walk: 28, color: "#0033a0", type: "Гипер", has_bring: true },
  { id: "dixy", name: "Дикси", short: "Дикси", kind: "shop", city: ["msk", "spb"], time: "сходить", walk: 16, color: "#f36f21", type: "Продукты", has_bring: true },
  { id: "lavka", name: "Лавка", short: "Доставка Лавка", kind: "delivery", city: ["msk", "spb"], time: "20–40 мин", walk: 0, color: "#2f6bff", type: "Продукты", delivery: 199, has_bring: true },
  { id: "vprok", name: "Впрок", short: "Перекрёсток Впрок", kind: "delivery", city: ["msk", "spb"], time: "слот 2–4 ч", walk: 0, color: "#12805a", type: "Продукты", delivery: 99, has_bring: true }
];

const PRODUCTS = [
  { id: "milk", emoji: "🥛", name: "Молоко 2,5%", pack: "1 л", prices: { pyat: 104, magnit: 95, perek: 109, lenta: 99, dixy: 101, lavka: 129, vprok: 112 }, bring: { pyat: 119, magnit: 109, perek: 125, lenta: 115, dixy: 119, lavka: 129, vprok: 112 } },
  { id: "bread", emoji: "🍞", name: "Хлеб дарницкий", pack: "650 г", prices: { pyat: 69, magnit: 59, perek: 75, lenta: 64, dixy: 62, lavka: 89, vprok: 72 }, bring: { pyat: 79, magnit: 69, perek: 85, lenta: 75, dixy: 72, lavka: 89, vprok: 72 } },
  { id: "chicken", emoji: "🍗", name: "Филе куриное", pack: "1 кг", prices: { pyat: 379, magnit: 349, perek: 399, lenta: 359, dixy: 369, lavka: 449, vprok: 389 }, bring: { pyat: 419, magnit: 389, perek: 439, lenta: 399, dixy: 409, lavka: 449, vprok: 389 } },
  { id: "banana", emoji: "🍌", name: "Бананы", pack: "1 кг", prices: { pyat: 135, magnit: 119, perek: 145, lenta: 125, dixy: 129, lavka: 169, vprok: 139 }, bring: { pyat: 155, magnit: 139, perek: 165, lenta: 145, dixy: 149, lavka: 169, vprok: 139 } },
  { id: "oil", emoji: "🫙", name: "Масло подсолнечное", pack: "1 л", prices: { pyat: 155, magnit: 139, perek: 165, lenta: 145, dixy: 149, lavka: 189, vprok: 159 }, bring: { pyat: 175, magnit: 159, perek: 185, lenta: 165, dixy: 169, lavka: 189, vprok: 159 } },
  { id: "eggs", emoji: "🥚", name: "Яйца С1", pack: "10 шт", prices: { pyat: 115, magnit: 99, perek: 125, lenta: 105, dixy: 109, lavka: 139, vprok: 119 }, bring: { pyat: 129, magnit: 115, perek: 139, lenta: 119, dixy: 125, lavka: 139, vprok: 119 } },
  { id: "buck", emoji: "🌾", name: "Гречка", pack: "800 г", prices: { pyat: 95, magnit: 79, perek: 105, lenta: 85, dixy: 89, lavka: 119, vprok: 99 }, bring: { pyat: 109, magnit: 95, perek: 119, lenta: 99, dixy: 105, lavka: 119, vprok: 99 } },
  { id: "sour", emoji: "🥛", name: "Сметана 20%", pack: "300 г", prices: { pyat: 105, magnit: 89, perek: 115, lenta: 95, dixy: 99, lavka: 129, vprok: 109 }, bring: { pyat: 119, magnit: 105, perek: 129, lenta: 109, dixy: 115, lavka: 129, vprok: 109 } },
  { id: "sugar", emoji: "🧊", name: "Сахар", pack: "1 кг", prices: { pyat: 82, magnit: 72, perek: 89, lenta: 76, dixy: 79, lavka: 99, vprok: 84 }, bring: { pyat: 92, magnit: 82, perek: 99, lenta: 86, dixy: 89, lavka: 99, vprok: 84 } },
  { id: "pasta", emoji: "🍝", name: "Макароны", pack: "450 г", prices: { pyat: 75, magnit: 62, perek: 82, lenta: 68, dixy: 71, lavka: 95, vprok: 78 }, bring: { pyat: 85, magnit: 75, perek: 92, lenta: 79, dixy: 82, lavka: 95, vprok: 78 } }
];

const SCREENS = new Set(["home", "stores", "catalog", "cart", "compare"]);
const CITIES = new Set(["msk", "spb"]);
const STORE_IDS = new Set(STORES.map(store => store.id));
const PRODUCT_IDS = new Set(PRODUCTS.map(product => product.id));
let PRICE_BOOK = null;
let priceLoad = { status: "loading", error: "", seq: 0, promise: null };

function readSavedState() {
  try {
    const raw = localStorage.getItem("td");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.warn("Сохранённое состояние повреждено — запускаем безопасно", err);
    return {};
  }
}
function normalizeCart(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const cart = {};
  Object.entries(value).forEach(([id, rawQty]) => {
    if (!PRODUCT_IDS.has(id)) return;
    const qty = Number(rawQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    cart[id] = Math.min(99, Math.max(1, Math.floor(qty)));
  });
  return cart;
}
const saved = readSavedState();
const savedCartIsExplicit = saved.cartTouched === true;
const state = {
  screen: SCREENS.has(saved.screen) ? saved.screen : "home",
  city: CITIES.has(saved.city) ? saved.city : "msk",
  filter: "Все",
  mode: "any",
  storeId: STORE_IDS.has(saved.storeId) ? saved.storeId : "pyat",
  cart: savedCartIsExplicit ? normalizeCart(saved.cart) : {},
  cartTouched: savedCartIsExplicit,
  q: "",
  address: typeof saved.address === "string" ? saved.address.slice(0, 240) : "",
  openWhy: null
};
function persist() {
  try {
    localStorage.setItem("td", JSON.stringify({
      screen: state.screen, city: state.city, storeId: state.storeId, cart: state.cart, cartTouched: state.cartTouched === true, address: state.address
    }));
    return true;
  } catch (err) {
    console.warn("Не удалось сохранить локальное состояние", err);
    return false;
  }
}
function applyCityPrices() {
  if (!PRICE_BOOK) return;
  const shelf = PRICE_BOOK.flat && PRICE_BOOK.flat[state.city];
  const bring = PRICE_BOOK.flat_bring && PRICE_BOOK.flat_bring[state.city];
  PRODUCTS.forEach(p => {
    if (shelf && shelf[p.id]) p.prices = Object.assign({}, p.prices, shelf[p.id]);
    if (bring && bring[p.id]) p.bring = Object.assign({}, p.bring || {}, bring[p.id]);
  });
  const fees = PRICE_BOOK.delivery_fee || {};
  STORES.forEach(s => { if (fees[s.id] != null) s.delivery = fees[s.id]; });
}
function loadPrices() {
  if (priceLoad.promise) return priceLoad.promise;
  const seq = ++priceLoad.seq;
  priceLoad.status = "loading";
  priceLoad.error = "";
  render();
  const task = (async () => {
    try {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
      let res;
      try { res = await fetch("prices.json?v=20260909d", controller ? { signal: controller.signal } : undefined); }
      finally { if (timeout) clearTimeout(timeout); }
      if (!res.ok) throw new Error(String(res.status));
      const book = await res.json();
      if (seq !== priceLoad.seq) return false;
      PRICE_BOOK = book;
      applyCityPrices();
      priceLoad.status = "ready";
      priceLoad.error = "";
      return true;
    } catch (err) {
      if (seq !== priceLoad.seq) return false;
      console.warn("prices.json не загрузился", err);
      priceLoad.status = "error";
      priceLoad.error = err && err.name === "AbortError" ? "timeout" : "network";
      return false;
    } finally {
      if (seq === priceLoad.seq) {
        priceLoad.promise = null;
        render();
      }
    }
  })();
  priceLoad.promise = task;
  return task;
}
function priceNotice() {
  if (priceLoad.status === "loading") return `<div class="hint" role="status" aria-live="polite">Обновляем цены… Пока показываем сохранённые или базовые оценки.</div>`;
  if (priceLoad.status === "error") return `<div class="hint" role="alert">Свежие цены не загрузились. Корзина сохранена, можно продолжить с оценками. <button class="ghost" style="margin-top:8px" onclick="loadPrices()">Повторить загрузку</button></div>`;
  return "";
}
const cityName = () => state.city === "msk" ? "Москва" : "Санкт-Петербург";
const EASTER_EGG_DEADLINE = Date.UTC(2026, 8, 13, 20, 59, 59);
const EASTER_EGG_TELEGRAM = "kaipovich";
const storeBy = id => STORES.find(s => s.id === id);
const cartEntries = () => TDCompare.cartEntries(PRODUCTS, state.cart || {});
const cartCount = () => cartEntries().reduce((a, p) => a + Number(state.cart[p.id] || 0), 0);
const defaultChannel = id => TDCompare.defaultChannel(storeBy(id));
const selectedChannel = store => state.mode === "delivery" && store && store.has_bring ? "bring" : defaultChannel(store.id);
function priceOf(p, storeId, channel) {
  return TDCompare.unitPrice(p, storeId, channel || defaultChannel(storeId));
}
function displayPrice(p, storeId, channel, quantity = 1) {
  const slot = channel || defaultChannel(storeId);
  const unit = priceOf(p, storeId, slot);
  if (!Number.isFinite(unit)) return "цена уточняется";
  const count = Number(quantity);
  const qty = Number.isFinite(count) && count > 0 ? count : 1;
  const verified = Boolean(window.TDPriceMeta && TDPriceMeta.get(p.id, storeId, slot));
  return `${verified ? "" : "≈ "}${Math.round(unit * qty)} ₽`;
}
const sumIn = (id, channel) => TDCompare.goodsTotal(PRODUCTS, state.cart || {}, id, channel || defaultChannel(id));
function scenarios() {
  return TDCompare.compare({ stores: STORES, products: PRODUCTS, cart: state.cart || {}, city: state.city, mode: state.mode, originStoreId: state.storeId });
}
function setQty(id, d) {
  if (!PRODUCT_IDS.has(id)) return false;
  const delta = Number(d);
  if (!Number.isFinite(delta) || delta === 0) return false;
  const n = Math.min(99, Math.max(0, (Number(state.cart[id]) || 0) + delta));
  if (n === 0) delete state.cart[id]; else state.cart[id] = Math.floor(n);
  state.cartTouched = true;
  persist(); render();
  return true;
}
function logoSvg(size = 36) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#102018"/>
    <path d="M15 20h25M27.5 20v25M37 25h8c6 0 9 3 9 9s-3 10-9 10h-8V25z" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M49 14v10m0 0-5-5m5 5 5-5" fill="none" stroke="#35D981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function header(title, sub, back) {
  return `<header class="app">
    <div class="row">
      ${back ? `<button class="back" onclick="go('${back}')">←</button>` : `<button class="brand-home" onclick="go('home')" aria-label="На главную">${logoSvg()}</button>`}
      <div class="grow"><h1>${title}</h1><div class="sub">${sub}</div></div>
      <button class="city" onclick="toggleCity()">${cityName()}</button>
    </div>
  </header>`;
}
function dockCart() {
  if (!cartCount()) return "";
  const rows=scenarios(),best=rows.find(x=>!x.same&&x.rankable&&x.save>0),current=rows.find(x=>x.same);
  const amount=current&&Number.isFinite(current.total)?`${current.verifiedComplete?"":"≈ "}${Math.round(current.total)} ₽`:"итог уточняется";
  return `<div class="dock"><button class="btn yellow" onclick="go('cart')">
    <span>Корзина · ${cartCount()}</span>
    <span>${best ? "можно −" + Math.round(best.save) + " ₽" : amount}</span>
  </button></div>`;
}
function screenHome() {
  return `${header("Тамдешевле", "Собери корзину — скажем, где дешевле")}
    <div class="wrap">
      ${priceNotice()}
      <p class="note">Сравнение корзины. Не магазин, не доставка и не заказ. Цены учебные — витрина, не полка. Адрес сейчас ничего не считает.</p>
      <input class="addr" placeholder="Адрес в Москве или Питере (пока не считается)" value="${state.address}"
        onchange="state.address=this.value;persist()" />
      <button class="btn green" onclick="go('stores')">Выбрать магазин</button>
      <button class="ghost" onclick="go('cart')">Сразу к корзине</button>
      ${saleEasterEgg()}
    </div>`;
}
function saleEasterEgg() {
  const telegram = EASTER_EGG_TELEGRAM.trim().replace(/^@/, "");
  const contact = telegram
    ? `<a class="sale-contact" href="https://t.me/${encodeURIComponent(telegram)}" target="_blank" rel="noopener noreferrer">Написать в Telegram ↗</a>`
    : `<span class="sale-contact pending">Telegram владельца: добавь @username</span>`;
  return `<section class="sale-easter-egg" aria-label="Пасхалка о продаже проекта">
    <div class="sale-kicker">если вдруг есть лишнее</div>
    <div class="sale-title">Там Дешевле продаётся</div>
    <div class="sale-price">20 000 000 ₽</div>
    <div class="sale-note">Не публичная оферта. Просто очень дорогая кнопка для разговора.</div>
    <div class="sale-timer" aria-live="polite"><span>до исчезновения</span><b data-sale-timer>72:00:00</b></div>
    ${contact}
  </section>`;
}
function updateSaleTimer() {
  const node = document.querySelector("[data-sale-timer]");
  if (!node) return;
  const left = Math.max(0, EASTER_EGG_DEADLINE - Date.now());
  const seconds = Math.floor(left / 1000);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  node.textContent = `${hours}:${minutes}:${secs}`;
}
function screenStores() {
  const stores = STORES.filter(s => s.city.includes(state.city));
  return `${header("Магазины", "Выбери, где обычно покупаешь", "home")}
    <div class="wrap">
      ${stores.map(s => `<button class="store" onclick="state.storeId='${s.id}';persist();go('catalog')">
        <span class="store-dot" style="background:${s.color}"></span>
        <span><b>${s.name}</b><small>${s.type}</small></span><span>→</span>
      </button>`).join("")}
    </div>${dockCart()}`;
}
function screenCatalog() {
  const s = storeBy(state.storeId);
  const ch = selectedChannel(s);
  const filtered = PRODUCTS.filter(p => !state.q || p.name.toLowerCase().includes(state.q.toLowerCase()));
  return `${header(s.name, "Добавь товары в корзину", "stores")}
    <div class="wrap">
      ${priceNotice()}
      <input class="addr" placeholder="Поиск товара" value="${state.q}" oninput="state.q=this.value;render()" />
      <div class="products">${filtered.map(p => `<div class="item">
        <div class="thumb">${p.emoji}</div>
        <div><div class="title">${p.name}</div><div class="pack">${p.pack}</div><div class="price">${displayPrice(p, s.id, ch)}</div></div>
        <div class="step"><button onclick="setQty('${p.id}',-1)" aria-label="Уменьшить ${p.name}">−</button><b>${state.cart[p.id]||0}</b><button onclick="setQty('${p.id}',1)" aria-label="Добавить ${p.name}">+</button></div>
      </div>`).join("")}</div>
    </div>${dockCart()}`;
}
function emptyCartState() {
  return `<section class="hint" role="status"><b style="display:block;font-size:18px;color:var(--ink);margin-bottom:6px">Корзина пока пустая</b><span>Добавь хотя бы один товар — тогда сравним одинаковую корзину между магазинами.</span><button class="btn green" style="margin-top:14px" onclick="go('catalog')">Добавить товары</button></section>`;
}
function screenCart() {
  const s = storeBy(state.storeId);
  const entries = cartEntries();
  if (!entries.length) return `${header("Корзина", s.name + " · " + cityName(), "catalog")}<div class="wrap">${priceNotice()}${emptyCartState()}</div>`;
  const ch = selectedChannel(s);
  const quote=TDCompare.basketQuote(PRODUCTS,state.cart||{},s.id,ch),fee=TDCompare.feeQuote(s,ch);
  const total=quote.complete&&fee.known?quote.goods+fee.value:null,verified=quote.verifiedComplete&&fee.known;
  const best = scenarios().find(x => !x.same && x.rankable && x.save > 0);
  return `${header("Корзина", s.name + " · " + cityName(), "catalog")}
    <div class="wrap">${priceNotice()}${entries.map(p => `<div class="item">
      <div class="thumb">${p.emoji}</div>
      <div>
        <div class="title">${p.name}</div>
        <div class="pack">${p.pack} · ${displayPrice(p, s.id, ch)}</div>
        <div class="step"><button onclick="setQty('${p.id}',-1)" aria-label="Уменьшить ${p.name}">−</button><b>${state.cart[p.id]}</b><button onclick="setQty('${p.id}',1)" aria-label="Добавить ${p.name}">+</button></div>
      </div>
      <div class="price">${displayPrice(p, s.id, ch, state.cart[p.id])}</div>
    </div>`).join("")}</div>
    <div class="dock">
      <div style="background:#fff;border-radius:16px;padding:12px 14px;margin-bottom:8px;font-weight:800;display:flex;justify-content:space-between">
        <span>${verified?"Итого здесь":"Оценка здесь"}</span><span>${total==null?"уточняется":`${verified?"":"≈ "}${Math.round(total)} ₽`}</span>
      </div>
      ${best ? `<div style="background:var(--soft);border-radius:14px;padding:10px 12px;margin-bottom:8px;font-weight:700;color:#0f7b4a">Эту корзину можно собрать дешевле на ${best.save} ₽</div>` : ""}
      <button class="btn dark" onclick="go('compare')">Где выгоднее</button>
      <button class="ghost" onclick="go('stores')">Оставить в «${s.name}»</button>
    </div>`;
}
function planHint(p) {
  if (p.channel === "bring" && p.feeKnown) return "товар " + p.goods + " ₽ + доставка сети " + p.delivery + " ₽ · " + p.time;
  if (p.channel === "bring") return "товар доставки сети " + p.goods + " ₽ · тариф доставки не заложен";
  return "сходить, полка · без адреса";
}
function comparisonLead(plans) {
  const winner = plans.find(plan => plan.rankable && Number.isFinite(plan.total));
  if (!winner) return `<section class="v2-verdict v2-verdict-wait"><div><span>ЧЕСТНЫЙ РЕЗУЛЬТАТ</span><h2>Победителя пока нет</h2><p>Для всей корзины недостаточно подтверждённых цен конкретных магазинов. Оценки покажем ниже, но не назовём их фактом.</p></div><button onclick="window.TDGeo&&TDGeo.openMap?TDGeo.openMap():go('stores')">Найти магазин на карте →</button></section>`;
  return `<section class="v2-verdict"><div><span>ЛУЧШИЙ ПОДТВЕРЖДЁННЫЙ ВАРИАНТ</span><h2>${winner.name}</h2><strong>${Math.round(winner.total)} ₽</strong><p>${winner.save>0?`Экономия ${Math.round(winner.save)} ₽ относительно текущего выбора.`:"Полная корзина подтверждена для сравнения."}</p></div><button onclick="window.TDPurchase?TDPurchase.start('${winner.id}','${winner.channel}') : choosePlan('${winner.id}')">Купить здесь →</button></section>`;
}
function screenCompare() {
  if (!cartCount()) return `${header("Где выгоднее", "Сначала собери корзину", "cart")}<div class="wrap">${emptyCartState()}</div>`;
  const origin = storeBy(state.storeId);
  const plans = scenarios();
  return `${header("Где выгоднее", "Та же корзина · " + cartCount() + " позиций", "cart")}
    <div class="wrap">
      ${priceNotice()}
      <div class="toggle">
        <button class="${state.mode==="any"?"on":""}" onclick="state.mode='any';render()">Все</button>
        <button class="${state.mode==="walk"?"on":""}" onclick="state.mode='walk';render()">Сходить</button>
        <button class="${state.mode==="delivery"?"on":""}" onclick="state.mode='delivery';render()">Привезти</button>
      </div>
      ${comparisonLead(plans)}
      ${plans.map((p,i) => `
        <div class="plan ${i===0&&p.rankable?"best":""}">
          <div class="row"><h3 class="grow">${p.same ? p.name + ", как есть" : p.channel==="bring" && p.kind!=="delivery" ? p.name + ", привезти" : p.name}</h3>${i===0&&p.rankable?"<span class='badge'>лучший</span>":""}</div>
          <div class="sum">${p.total==null?"Итог уточняется":`${p.verifiedComplete?"":"≈ "}${Math.round(p.total)} ₽`}</div>
          <div class="${p.save>0?"delta":"hint"}">${p.save>0 ? "−"+Math.round(p.save)+" ₽ к «"+origin.name+"»" : p.save<0 ? "+"+Math.abs(Math.round(p.save))+" ₽" : p.rankable&&p.same ? "текущий выбор" : "оценка · вне рейтинга"}</div>
          <div class="hint">${planHint(p)}</div>
          <button class="ghost" style="margin-top:8px" onclick="state.openWhy='${p.id}_${p.channel}';render()">Почему так</button>
          ${state.openWhy===p.id+"_"+p.channel ? whyBlock(p) : ""}
        </div>`).join("")}
      <p class="hint">«Привезти» — цена товара в доставке сети. Тариф доставки заложен только у Лавки и Впрока. Тамдешевле сам ничего не везёт.</p>
    </div>`;
}
function choosePlan(storeId) { const selected=storeBy(storeId);if (!selected) return;const plan=scenarios().find(x=>x.id===storeId&&x.rankable);state.storeId=storeId;persist();window.dispatchEvent(new CustomEvent("td:plan-selected",{detail:{storeId,total:plan?.total??null,saving:plan?.save??null,verified:Boolean(plan?.verifiedComplete),cart:{...state.cart},city:state.city}}));go("catalog"); }
function whyBlock(p) {
  const originCh = defaultChannel(state.storeId);
  const rows = cartEntries().map(x => {
    const quantity = Number(state.cart[x.id]) || 0;
    const hereUnit = priceOf(x, state.storeId, originCh);
    const thereUnit = priceOf(x, p.id, p.channel);
    if (!Number.isFinite(thereUnit)) return `<div class="why-line"><span>${x.name}</span><span>цена уточняется</span></div>`;
    const there = Math.round(thereUnit * quantity);
    let delta = "";
    if (Number.isFinite(hereUnit) && p.save != null) {
      const here = Math.round(hereUnit * quantity);
      delta = there < here ? " · −" + (here - there) : there > here ? " · +" + (there - here) : "";
    }
    return `<div class="why-line"><span>${x.name}</span><span>${p.verifiedComplete?"":"≈ "}${there} ₽${delta}</span></div>`;
  }).join("");
  return `<div style="margin-top:8px">${rows}</div>`;
}
function navigate(screen, options = {}) {
  const next = SCREENS.has(screen) ? screen : "home";
  state.screen = next;
  persist();
  if (!options.fromPop && window.history && typeof history.pushState === "function") {
    const method = options.replace ? "replaceState" : "pushState";
    history[method]({ ...(history.state || {}), tdScreen: next }, "");
  }
  render();
}
function go(screen) { navigate(screen); }
function toggleCity() {
  state.city = state.city === "msk" ? "spb" : "msk";
  applyCityPrices();
  persist();
  render();
}
function render() {
  const map = { home: screenHome, stores: screenStores, catalog: screenCatalog, cart: screenCart, compare: screenCompare };
  document.getElementById("app").innerHTML = (map[state.screen] || screenHome)();
  updateSaleTimer();
}
window.addEventListener("popstate", event => {
  const target = event.state && event.state.tdScreen;
  if (SCREENS.has(target)) navigate(target, { fromPop: true });
});
window.go = go; window.setQty = setQty; window.toggleCity = toggleCity; window.choosePlan = choosePlan; window.saleEasterEgg = saleEasterEgg; window.state = state; window.render = render; window.loadPrices = loadPrices;
if (window.history && typeof history.replaceState === "function") history.replaceState({ ...(history.state || {}), tdScreen: state.screen }, "");
render();
setInterval(updateSaleTimer, 1000);
loadPrices();