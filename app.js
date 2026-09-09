const STORES = [
  { id: "pyat", name: "Пятёрочка", short: "Пятёрочка", kind: "shop", city: ["msk", "spb"], time: "10–20 мин", walk: 12, color: "#e31e24", type: "Продукты" },
  { id: "magnit", name: "Магнит", short: "Магнит", kind: "shop", city: ["msk", "spb"], time: "10–20 мин", walk: 18, color: "#c81e1e", type: "Продукты" },
  { id: "perek", name: "Перекрёсток", short: "Перекрёсток", kind: "shop", city: ["msk", "spb"], time: "5–15 мин", walk: 9, color: "#0b5c3b", type: "Продукты" },
  { id: "lenta", name: "Лента", short: "Гипер Лента", kind: "hyper", city: ["msk", "spb"], time: "гипер", walk: 28, color: "#0033a0", type: "Гипер" },
  { id: "dixy", name: "Дикси", short: "Дикси", kind: "shop", city: ["msk", "spb"], time: "15–25 мин", walk: 16, color: "#f36f21", type: "Продукты" },
  { id: "lavka", name: "Лавка", short: "Доставка Лавка", kind: "delivery", city: ["msk", "spb"], time: "20–40 мин", walk: 0, color: "#2f6bff", type: "Продукты", delivery: 199 },
  { id: "vprok", name: "Впрок", short: "Перекрёсток Впрок", kind: "delivery", city: ["msk", "spb"], time: "слот 2–4 ч", walk: 0, color: "#12805a", type: "Продукты", delivery: 99 }
];

const PRODUCTS = [
  { id: "milk", emoji: "🧕", name: "Молоко 2,5%", pack: "1 л", prices: { pyat: 89, magnit: 79, perek: 95, lenta: 84, dixy: 86, lavka: 109, vprok: 92 } },
  { id: "bread", emoji: "🍞", name: "Хлеб дарницкий", pack: "650 г", prices: { pyat: 49, magnit: 45, perek: 55, lenta: 47, dixy: 46, lavka: 69, vprok: 52 } },
  { id: "chicken", emoji: "🍗", name: "Филе куриное", pack: "1 кг", prices: { pyat: 329, magnit: 279, perek: 349, lenta: 289, dixy: 299, lavka: 389, vprok: 319 } },
  { id: "banana", emoji: "🍌", name: "Бананы", pack: "1 кг", prices: { pyat: 129, magnit: 119, perek: 139, lenta: 109, dixy: 125, lavka: 159, vprok: 129 } },
  { id: "oil", emoji: "🫙", name: "Масло подсолнечное", pack: "1 л", prices: { pyat: 139, magnit: 119, perek: 145, lenta: 125, dixy: 129, lavka: 169, vprok: 135 } },
  { id: "eggs", emoji: "🥚", name: "Яйца С1", pack: "10 шт", prices: { pyat: 109, magnit: 99, perek: 119, lenta: 102, dixy: 105, lavka: 135, vprok: 112 } },
  { id: "buck", emoji: "🌾", name: "Гречка", pack: "800 г", prices: { pyat: 89, magnit: 75, perek: 95, lenta: 79, dixy: 82, lavka: 119, vprok: 85 } },
  { id: "sour", emoji: "🧕", name: "Сметана 20%", pack: "300 г", prices: { pyat: 79, magnit: 69, perek: 85, lenta: 72, dixy: 74, lavka: 99, vprok: 77 } },
  { id: "sugar", emoji: "🧊", name: "Сахар", pack: "1 кг", prices: { pyat: 75, magnit: 69, perek: 79, lenta: 71, dixy: 72, lavka: 95, vprok: 74 } },
  { id: "pasta", emoji: "🍝", name: "Макароны", pack: "450 г", prices: { pyat: 69, magnit: 59, perek: 75, lenta: 62, dixy: 64, lavka: 89, vprok: 68 } }
];

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

const cityName = () => state.city === "msk" ? "Москва" : "Санкт-Петербург";
const storeBy = id => STORES.find(s => s.id === id);
const cartEntries = () => PRODUCTS.filter(p => state.cart[p.id] > 0);
const cartCount = () => cartEntries().reduce((a, p) => a + state.cart[p.id], 0);
const sumIn = (id) => cartEntries().reduce((a, p) => a + p.prices[id] * state.cart[p.id], 0);

function scenarios() {
  const originSum = sumIn(state.storeId);
  let list = STORES.filter(s => s.city.includes(state.city));
  if (state.mode === "walk") list = list.filter(s => s.kind !== "delivery");
  if (state.mode === "delivery") list = list.filter(s => s.kind === "delivery" || s.id === state.storeId);
  return list.map(s => {
    const goods = sumIn(s.id);
    const delivery = s.kind === "delivery" ? (s.delivery || 0) : 0;
    const total = goods + delivery;
    return { ...s, goods, delivery, total, save: originSum - total, same: s.id === state.storeId };
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
      <p class="note">Рабочая версия. Цены учебные, как витрина, не ценник конкретной полки. Адрес нужен, чтобы потом считать зону доставки.</p>
      <input class="addr" placeholder="Адрес в Москве или Питере (необязательно)" value="${state.address}"
        onchange="state.address=this.value;persist()" />
      <button class="btn green" onclick="go('stores')">Выбрать магазин</button>
      <button class="ghost" onclick="go('cart')">Сразу к корзине</button>
    </div>`;
}

function screenStores() {
  const filters = ["Все", "Продукты", "Гипер"];
  const list = STORES.filter(s => s.city.includes(state.city) && (state.filter === "Все" || s.type === state.filter));
  return `${header("Магазины", "Как в привычном приложении доставки")}
    <div class="chips">${filters.map(f => `<button class="chip ${state.filter===f?"on":""}" onclick="state.filter='${f}';render()">${f}</button>`).join("")}</div>
    <div class="wrap"><div class="grid">${list.map(s => {
      const total = cartCount() ? sumIn(s.id) + (s.delivery || 0) : null;
      const save = total != null ? sumIn(state.storeId) - total : 0;
      return `<button class="store" onclick="state.storeId='${s.id}';persist();go('catalog')">
        <div class="cover" style="background:${s.color}">${s.short}</div>
        <div class="meta">
          <div class="name">${s.name}</div>
          <div class="time">${s.kind === "delivery" ? s.time + " · доставка" : s.time}</div>
          ${total != null ? `<div style="margin-top:6px">${save>0?`<span class="badge">корзина −${save} ₽</span>`:`<span class="hint">${total} ₽</span>`}</div>` : ""}
        </div></button>`;
    }).join("")}</div></div>${dockCart()}`;
}

function screenCatalog() {
  const s = storeBy(state.storeId);
  const q = state.q.trim().toLowerCase();
  const items = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q));
  return `${header(s.name, "Клади товары, сравнение потом", "stores")}
    <div class="wrap">
      <input class="search" placeholder="Молоко, курица, гречка" value="${state.q}" oninput="state.q=this.value;render()" />
      ${items.map(p => `<div class="item">
        <div class="thumb">${p.emoji}</div>
        <div><div class="title">${p.name}</div><div class="pack">${p.pack}</div><div class="price">${p.prices[s.id]} ₽</div></div>
        <div class="step"><button onclick="setQty('${p.id}',-1)">−</button><b>${state.cart[p.id]||0}</b><button onclick="setQty('${p.id}',1)">+</button></div>
      </div>`).join("")}
    </div>${dockCart()}`;
}

function screenCart() {
  const s = storeBy(state.storeId);
  const total = sumIn(s.id);
  const best = scenarios().filter(x => !x.same && x.save > 0)[0];
  return `${header("Корзина", s.name + " · " + cityName(), "catalog")}
    <div class="wrap">${cartEntries().map(p => `<div class="item">
      <div class="thumb">${p.emoji}</div>
      <div>
        <div class="title">${p.name}</div>
        <div class="pack">${p.pack} · ${p.prices[s.id]} ₽</div>
        <div class="step"><button onclick="setQty('${p.id}',-1)">−</button><b>${state.cart[p.id]}</b><button onclick="setQty('${p.id}',1)">+</button></div>
      </div>
      <div class="price">${p.prices[s.id]*state.cart[p.id]} ₽</div>
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
          <div class="row"><h3 class="grow">${p.same ? p.name + ", как есть" : p.name}</h3>${i===0?"<span class='badge'>лучший</span>":""}</div>
          <div class="sum">${p.total} ₽</div>
          <div class="${p.save>0?"delta":"hint"}">${p.save>0 ? "−"+p.save+" ₽ к «"+origin.name+"»" : p.save<0 ? "+"+Math.abs(p.save)+" ₽" : "текущий выбор"}</div>
          <div class="hint">${p.kind==="delivery" ? "товары "+p.goods+" ₽ + доставка "+p.delivery+" ₽ · "+p.time : p.walk+" мин пешком"}</div>
          <button class="ghost" style="margin-top:8px" onclick="state.openWhy='${p.id}';render()">Почему так</button>
          ${state.openWhy===p.id ? whyBlock(p) : ""}
        </div>`).join("")}
      <p class="hint">Онлайн-доставка и офлайн-полка считаются отдельно. Цифры учебные, пока нет адреса точки.</p>
    </div>`;
}

function whyBlock(p) {
  const rows = cartEntries().map(x => {
    const here = x.prices[state.storeId] * state.cart[x.id];
    const there = x.prices[p.id] * state.cart[x.id];
    return `<div class="why-line"><span>${x.name}</span><span>${there} ₽ ${there<here?" · −"+(here-there):there>here?" · +"+(there-here):""}</span></div>`;
  }).join("");
  return `<div style="margin-top:8px">${rows}</div>`;
}

function go(screen) { state.screen = screen; persist(); render(); }
function toggleCity() { state.city = state.city === "msk" ? "spb" : "msk"; persist(); render(); }

function render() {
  const map = { home: screenHome, stores: screenStores, catalog: screenCatalog, cart: screenCart, compare: screenCompare };
  document.getElementById("app").innerHTML = (map[state.screen] || screenHome)();
}
window.go = go; window.setQty = setQty; window.toggleCity = toggleCity; window.state = state; window.render = render;
render();
