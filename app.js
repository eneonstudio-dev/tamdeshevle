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

let PRICE_BOOK = null;

const saved = JSON.parse(localStorage.getItem("td") || "{}");
const state = {
  screen: saved.screen || "home",
  city: saved.city || "msk",
  filter: "Все",
  mode: "any",
  storeId: saved.storeId || "pyat",
  cart: saved.cart || { milk: 1, bread: 1, chicken: 1, banana: 1, oil: 1, eggs: 1 },
  q: "",
  address: saved.address || "",
  openWhy: null
};

function persist() {
  localStorage.setItem("td", JSON.stringify({
    screen: state.screen, city: state.city, storeId: state.storeId, cart: state.cart, address: state.address
  }));
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
  STORES.forEach(s => {
    if (fees[s.id] != null) s.delivery = fees[s.id];
  });
}

async function loadPrices() {
  try {
    const res = await fetch("prices.json?v=20260909b");
    if (!res.ok) throw new Error(String(res.status));
    PRICE_BOOK = await res.json();
    applyCityPrices();
    render();
  } catch (err) {
    console.warn("prices.json не загрузился, остаются встроенные цифры", err);
  }
}

const cityName = () => state.city === "msk" ? "Москва" : "Санкт-Петербург";
const storeBy = id => STORES.find(s => s.id === id);
const cartEntries = () => PRODUCTS.filter(p => state.cart[p.id] > 0);
const cartCount = () => cartEntries().reduce((a, p) => a + state.cart[p.id], 0);
const defaultChannel = id => {
  const s = storeBy(id);
  return s && s.kind === "delivery" ? "bring" : "shelf";
};
function priceOf(p, storeId, channel) {
  if (channel === "bring") return (p.bring && p.bring[storeId]) || p.prices[storeId] || 0;
  return p.prices[storeId] || 0;
}
const sumIn = (id, channel) => cartEntries().reduce((a, p) => a + priceOf(p, id, channel || defaultChannel(id)) * state.cart[p.id], 0);

function scenarios() {
  const originCh = defaultChannel(state.storeId);
  const originSum = sumIn(state.storeId, originCh);
  let list = STORES.filter(s => s.city.includes(state.city));
  if (state.mode === "walk") list = list.filter(s => s.kind !== "delivery");
  if (state.mode === "delivery") list = list.filter(s => s.has_bring);
  return list.map(s => {
    const channel = state.mode === "delivery" ? "bring" : state.mode === "walk" ? "shelf" : defaultChannel(s.id);
    const goods = sumIn(s.id, channel);
    const feeKnown = channel === "bring" && s.kind === "delivery";
    const delivery = feeKnown ? (s.delivery || 0) : 0;
    const total = goods + delivery;
    return {
      ...s,
      channel,
      goods,
      delivery,
      feeKnown,
      total,
      save: originSum - total,
      same: s.id === state.storeId && channel === originCh
    };
  }).sort((a, b) => a.total - b.total);
}

function setQty(id, d) {
  const n = Math.max(0, (state.cart[id] || 0) + d);
  if (n === 0) delete state.cart[id]; else state.cart[id] = n;
  persist(); render();
}

function logoSvg(size = 36) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#0F7B4A"/>
    <path d="M18 28h28l-3 14H21L18 28z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 28V22h8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 48v6M28 52h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

function header(title, sub, back) {
  return `<header class="app">
    <div class="row">
      ${back ? `<button class="back" onclick="go('${back}')">←</button>` : logoSvg()}
      <div class="grow"><h1>${title}</h1><div class="sub">${sub}</div></div>
      <button class="city" onclick="toggleCity()">${cityName()}</button>
    </div>
  </header>`;
}

function dockCart() {
  if (!cartCount()) return "";
  const best = scenarios().filter(x => !x.same && x.save > 0)[0];
  return `<div class="dock"><button class="btn yellow" onclick="go('cart')">
    <span>Корзина · ${cartCount()}</span>
    <span>${best ? "можно −" + best.save + " ₽" : sumIn(state.storeId) + " ₽"}</span>
  </button></div>`;
}

function screenHome() {
  return `${header("Тамдешевле", "Собери корзину — скажем, где дешевле")}
    <div class="wrap">
      <p class="note">Сравнение корзины. Не магазин, не доставка и не заказ. Цены учебные — витрина, не полка. Адрес сейчас ничего не считает.</p>
      <input class="addr" placeholder="Адрес в Москве или Питере (пока не считается)" value="${state.address}"
        onchange="state.address=this.value;persist()" />
      <button class="btn green" onclick="go('stores')">Выбрать магазин</button>
      <button class="ghost" onclick="go('cart')">Сразу к корзине</button>
    </div>`;
}

function screenStores() {
  const filters = ["Все", "Продукты", "Гипер"];
  const list = STORES.filter(s => s.city.includes(state.city) && (state.filter === "Все" || s.type === state.filter));
  return `${header("Магазины", "Сети для сравнения, не витрина заказа")}
    <div class="chips">${filters.map(f => `<button class="chip ${state.filter===f?"on":""}" onclick="state.filter='${f}';render()">${f}</button>`).join("")}</div>
    <div class="wrap"><div class="grid">${list.map(s => {
      const total = cartCount() ? sumIn(s.id) + (s.kind === "delivery" ? (s.delivery || 0) : 0) : null;
      const save = total != null ? sumIn(state.storeId) - total : 0;
      return `<button class="store" onclick="state.storeId='${s.id}';persist();go('catalog')">
        <div class="cover" style="background:${s.color}">${s.short}</div>
        <div class="meta">
          <div class="name">${s.name}</div>
          <div class="time">${s.kind === "delivery" ? s.time + " · доставка сети" : s.time + " · без адреса"}</div>
          ${total != null ? `<div style="margin-top:6px">${save>0?`<span class="badge">корзина −${save} ₽</span>`:`<span class="hint">${total} ₽</span>`}</div>` : ""}
        </div></button>`;
    }).join("")}</div></div>${dockCart()}`;
}

function screenCatalog() {
  const s = storeBy(state.storeId);
  const q = state.q.trim().toLowerCase();
  const items = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q));
  const ch = defaultChannel(s.id);
  return `${header(s.name, "Клади товары, сравнение потом", "stores")}
    <div class="wrap">
      <input class="search" placeholder="Молоко, курица, гречка" value="${state.q}" oninput="state.q=this.value;render()" />
      ${items.map(p => `<div class="item">
        <div class="thumb">${p.emoji}</div>
        <div><div class="title">${p.name}</div><div class="pack">${p.pack}</div><div class="price">${priceOf(p, s.id, ch)} ₽</div></div>
        <div class="step"><button onclick="setQty('${p.id}',-1)">−</button><b>${state.cart[p.id]||0}</b><button onclick="setQty('${p.id}',1)">+</button></div>
      </div>`).join("")}
    </div>${dockCart()}`;
}

function screenCart() {
  const s = storeBy(state.storeId);
  const ch = defaultChannel(s.id);
  const total = sumIn(s.id, ch);
  const best = scenarios().filter(x => !x.same && x.save > 0)[0];
  return `${header("Корзина", s.name + " · " + cityName(), "catalog")}
    <div class="wrap">${cartEntries().map(p => `<div class="item">
      <div class="thumb">${p.emoji}</div>
      <div>
        <div class="title">${p.name}</div>
        <div class="pack">${p.pack} · ${priceOf(p, s.id, ch)} ₽</div>
        <div class="step"><button onclick="setQty('${p.id}',-1)">−</button><b>${state.cart[p.id]}</b><button onclick="setQty('${p.id}',1)">+</button></div>
      </div>
      <div class="price">${priceOf(p, s.id, ch)*state.cart[p.id]} ₽</div>
    </div>`).join("") || "<p class='hint'>Корзина пустая</p>"}</div>
    <div class="dock">
      <div style="background:#fff;border-radius:16px;padding:12px 14px;margin-bottom:8px;font-weight:800;display:flex;justify-content:space-between">
        <span>Итого здесь</span><span>${total} ₽</span>
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

function screenCompare() {
  const origin = storeBy(state.storeId);
  const plans = scenarios();
  return `${header("Где выгоднее", "Та же корзина · " + cartCount() + " позиций", "cart")}
    <div class="wrap">
      <div class="toggle">
        <button class="${state.mode==="any"?"on":""}" onclick="state.mode='any';render()">Все</button>
        <button class="${state.mode==="walk"?"on":""}" onclick="state.mode='walk';render()">Сходить</button>
        <button class="${state.mode==="delivery"?"on":""}" onclick="state.mode='delivery';render()">Привезти</button>
      </div>
      ${plans.map((p,i) => `
        <div class="plan ${i===0?"best":""}">
          <div class="row"><h3 class="grow">${p.same ? p.name + ", как есть" : p.channel==="bring" && p.kind!=="delivery" ? p.name + ", привезти" : p.name}</h3>${i===0?"<span class='badge'>лучший</span>":""}</div>
          <div class="sum">${p.total} ₽</div>
          <div class="${p.save>0?"delta":"hint"}">${p.save>0 ? "−"+p.save+" ₽ к «"+origin.name+"»" : p.save<0 ? "+"+Math.abs(p.save)+" ₽" : "текущий выбор"}</div>
          <div class="hint">${planHint(p)}</div>
          <button class="ghost" style="margin-top:8px" onclick="state.openWhy='${p.id}_${p.channel}';render()">Почему так</button>
          ${state.openWhy===p.id+"_"+p.channel ? whyBlock(p) : ""}
        </div>`).join("")}
      <p class="hint">«Привезти» — цена товара в доставке сети. Тариф доставки заложен только у Лавки и Впрока. Тамдешевле сам ничего не везёт.</p>
    </div>`;
}

function whyBlock(p) {
  const originCh = defaultChannel(state.storeId);
  const rows = cartEntries().map(x => {
    const here = priceOf(x, state.storeId, originCh) * state.cart[x.id];
    const there = priceOf(x, p.id, p.channel) * state.cart[x.id];
    return `<div class="why-line"><span>${x.name}</span><span>${there} ₽ ${there<here?" · −"+(here-there):there>here?" · +"+(there-here):""}</span></div>`;
  }).join("");
  return `<div style="margin-top:8px">${rows}</div>`;
}

function go(screen) { state.screen = screen; persist(); render(); }
function toggleCity() {
  state.city = state.city === "msk" ? "spb" : "msk";
  applyCityPrices();
  persist();
  render();
}

function render() {
  const map = { home: screenHome, stores: screenStores, catalog: screenCatalog, cart: screenCart, compare: screenCompare };
  document.getElementById("app").innerHTML = (map[state.screen] || screenHome)();
}
window.go = go; window.setQty = setQty; window.toggleCity = toggleCity; window.state = state; window.render = render;
render();
loadPrices();
