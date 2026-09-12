(function () {
  "use strict";

  import("./brand-votonobay-v1.js?v=20260912-v1").catch(error=>console.warn("[Brand Votonobay] load failed",error));

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const cityName = () => window.state && state.city === "spb" ? "Санкт-Петербург" : "Москва";
  const storeById = id => typeof STORES !== "undefined" ? STORES.find(store => store.id === id) : null;
  const products = () => typeof PRODUCTS !== "undefined" ? PRODUCTS : [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const IMAGE_BY_ID = {
    milk:"https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=max&w=420&h=320&q=76",
    eggs_c1:"https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=max&w=420&h=320&q=76",
    chicken_fil:"https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=max&w=420&h=320&q=76",
    bread_dark:"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=max&w=420&h=320&q=76",
    banana:"https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=max&w=420&h=320&q=76",
    apple:"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=max&w=420&h=320&q=76",
    pasta:"https://images.unsplash.com/photo-1551462147-ff29893d2640?auto=format&fit=max&w=420&h=320&q=76"
  };
  const cartCount = () => products().reduce((sum, product) => sum + Number(state.cart && state.cart[product.id] || 0), 0);
  const productImage = product => IMAGE_BY_ID[product && product.id] || "";
  const productPrice = product => {
    const values = Object.values(product && product.prices || {}).filter(Number.isFinite);
    return values.length ? Math.min(...values) : null;
  };
  const productHigh = product => {
    const values = Object.values(product && product.prices || {}).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  const productStore = product => {
    const entries = Object.entries(product && product.prices || {}).filter(([, value]) => Number.isFinite(value)).sort((a, b) => a[1] - b[1]);
    return entries.length ? storeById(entries[0][0]) : null;
  };

  function Brand() {
    return `<button class="v2-brand" type="button" onclick="go('home')" aria-label="Votonobay — на главную"><span>Votonobay</span></button>`;
  }

  function Header() {
    return `<header class="app v2-header"><div class="v2-header-inner">
      ${Brand()}
      <nav class="v2-nav" aria-label="Основная навигация">
        <button onclick="go('catalog')">Товары</button><button onclick="go('stores')">Магазины</button><button onclick="go('cart')">Списки</button><button onclick="window.TDGeo&&TDGeo.openMap?TDGeo.openMap():go('stores')">Карта</button><button onclick="tdV2About()">О проекте</button>
      </nav>
      <div class="v2-header-actions"><button class="v2-city" onclick="toggleCity()"><span>●</span>${esc(cityName())}</button><button class="v2-favorite" aria-label="Избранное" onclick="go('cart')">♡</button><button class="td-profile-btn v2-profile" aria-label="Открыть профиль">○</button><button class="v2-menu" aria-label="Открыть меню" aria-expanded="false" onclick="tdV2Menu(this)">☰</button></div>
    </div><div class="v2-mobile-nav" hidden><button onclick="go('catalog')">Товары</button><button onclick="go('stores')">Магазины</button><button onclick="go('cart')">Списки</button><button onclick="window.TDGeo&&TDGeo.openMap?TDGeo.openMap():go('stores')">Карта</button><button onclick="tdV2About()">О проекте</button></div></header>`;
  }

  function HeroSearch() {
    const categories=["Молоко","Яйца","Курица","Сыр","Хлеб","Яблоки","Для дома"];
    return `<section class="v2-hero v2-bay-first" data-bay-first="true" aria-label="Решить покупку с Баем или самостоятельно">
      <div class="v2-hero-copy"><div class="v2-eyebrow"><i></i> Бай — умный помощник покупок</div><h1>Покупки. <em>Как лучше.</em></h1><p>Скажи Баю, что хочешь решить. Он уточнит только важное, сравнит варианты по цене, удобству и времени и объяснит, что лучше именно в твоей ситуации.</p></div>
      <button class="v2-hero-bai" type="button" onclick="tdBayFirstAsk()" aria-label="Спросить Бая"><span>Расскажи задачу.<br>Я разберусь.</span><img src="assets/bai/bai-peek.webp" alt="Бай — помощник Votonobay"></button>
      <div class="v2-bay-actions"><button class="v2-bay-primary" type="button" onclick="tdBayFirstAsk()">Спросить Бая</button><button class="v2-bay-secondary" type="button" onclick="tdBayFirstSelfSearch()">Искать самому</button><div class="v2-bay-scenarios" aria-label="Быстрые задачи для Бая"><button type="button" onclick="tdBayFirstAsk('Помоги собрать корзину под мой бюджет')">Собрать корзину</button><button type="button" onclick="tdBayFirstAsk('Сравни варианты и скажи, какой лучше выбрать')">Что лучше выбрать?</button><button type="button" onclick="tdBayFirstAsk('Проверь, настоящая ли скидка и стоит ли покупать сейчас')">Проверить скидку</button><button type="button" onclick="tdBayFirstAsk('Найди лучший вариант с учётом цены, удобства и времени')">Найти лучший вариант</button></div></div>
      <div class="v2-self-search"><div class="v2-self-label">Или выбери сам</div><form class="v2-search" role="search" onsubmit="tdV2Search(event)"><span aria-hidden="true">⌕</span><input type="search" name="query" autocomplete="off" enterkeyhint="search" autocapitalize="none" spellcheck="false" value="${esc(state.q || "")}" placeholder="Найти товар самому" aria-label="Поиск товара"><button type="submit">Найти</button></form><div class="v2-categories" aria-label="Быстрые категории">${categories.map(label => `<button type="button" onclick="tdV2Quick('${label}')">${label}</button>`).join("")}</div></div>
      <div class="v2-hero-proof"><span>✓ Бай объясняет почему</span><span>✓ Сравнивает весь сценарий</span><span>✓ Можно пользоваться без Бая</span></div>
    </section>`;
  }

  function StoreStrip() {
    const list = (typeof STORES === "undefined" ? [] : STORES).filter(store => store.city.includes(state.city));
    return `<section class="v2-section"><div class="v2-section-head"><div><span>МАГАЗИНЫ</span><h2>Знакомые магазины рядом</h2></div><button onclick="go('stores')">Все магазины →</button></div><div class="v2-store-strip">${list.map(store => `<button onclick="state.storeId='${store.id}';persist();go('catalog')"><i style="--store:${store.color}">${esc(store.short.charAt(0))}</i><span><b>${esc(store.short)}</b><small>${store.kind === "delivery" ? "доставка" : "магазин"}</small></span></button>`).join("")}</div></section>`;
  }

  function ProductCard(product) {
    const low = productPrice(product), high = productHigh(product), store = productStore(product);
    const saving = low != null && high > low ? Math.round((high - low) / high * 100) : 0;
    const image = productImage(product);
    return `<article class="v2-product-card">
      <button class="v2-product-image" onclick="state.storeId='${store && store.id || state.storeId}';state.q='${esc(product.name)}';go('catalog')">${image ? `<img src="${esc(image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="420" height="320">` : `<span>${esc(product.emoji || "•")}</span>`}${saving ? `<em>−${saving}%</em>` : ""}</button>
      <div class="v2-product-body"><div class="v2-product-name">${esc(product.name)}</div><div class="v2-product-pack">${esc(product.pack || "")}</div><div class="v2-product-price"><strong>${low == null ? "—" : `≈ ${low} ₽`}</strong>${high > low ? `<del>${high} ₽</del>` : ""}</div><div class="v2-product-store"><span style="--store:${store && store.color || "#0f7b4a"}"></span>${esc(store && store.short || "цена уточняется")}</div></div>
      <button class="v2-add" onclick="setQty('${product.id}',1)" aria-label="Добавить ${esc(product.name)}">${state.cart && state.cart[product.id] ? esc(state.cart[product.id]) : "+"}</button>
    </article>`;
  }

  function ProductGrid() {
    return `<section class="v2-section"><div class="v2-section-head"><div><span>ПОПУЛЯРНОЕ</span><h2>Если хочешь выбирать сам</h2></div><small>≈ — ориентир, подтверждённые цены отмечаем отдельно</small></div><div class="v2-product-grid">${products().slice(0, 8).map(ProductCard).join("")}</div></section>`;
  }

  function ShoppingList() {
    const items = products().filter(product => state.cart && state.cart[product.id] > 0);
    return `<aside class="v2-basket-card"><div class="v2-basket-top"><span>ТВОЙ СПИСОК</span><b>${cartCount()} шт.</b></div><h2>${items.length ? "Корзина готова. Сравним варианты." : "Добавь нужные товары"}</h2><div class="v2-basket-lines">${items.slice(0, 5).map(product => `<div><span>${esc(product.name)}</span><div><button onclick="setQty('${product.id}',-1)">−</button><b>${state.cart[product.id]}</b><button onclick="setQty('${product.id}',1)">+</button></div></div>`).join("") || "<p>Можно добавить товары самому или попросить Бая собрать список.</p>"}</div>${items.length > 5 ? `<div class="v2-more">Ещё ${items.length - 5} поз.</div>` : ""}<button class="v2-compare" onclick="go('compare')" ${items.length ? "" : "disabled"}>Сравнить варианты <span>→</span></button><button class="v2-edit" onclick="go('cart')">Открыть список</button></aside>`;
  }

  function Footer() {
    return `<footer class="v2-footer" id="about"><div>${Brand()}<p>Помогаем решить, как лучше купить: учитываем цену, удобство, время и подтверждённость данных.</p></div><div><b>Главное</b><button onclick="tdBayFirstAsk()">Спросить Бая</button><button onclick="go('catalog')">Товары</button><button onclick="go('cart')">Моя корзина</button></div><div><b>Доверие</b><span>Откуда цена</span><span>Когда проверили</span><span>Без платных первых мест</span></div></footer>`;
  }

  function Home() {
    return `${Header()}<main class="v2-main"><div class="v2-content">${HeroSearch()}${StoreStrip()}${ProductGrid()}</div>${ShoppingList()}</main>${Footer()}${typeof window.saleEasterEgg === "function" ? `<div class="v2-easter">${window.saleEasterEgg()}</div>` : ""}${MobileDock()}`;
  }

  function MobileDock() {
    return `<nav class="v2-bottom-nav" aria-label="Мобильная навигация"><button class="is-active" onclick="go('home')"><i>⌂</i><span>Главная</span></button><button onclick="tdBayFirstAsk()"><i>✦</i><span>Бай</span></button><button onclick="go('catalog')"><i>⌕</i><span>Поиск</span></button><button onclick="go('cart')"><i>☷</i><span>Список</span></button><button class="td-profile-btn"><i>○</i><span>Профиль</span></button></nav>`;
  }

  function tuneAssistant() {
    const root=document.querySelector(".td-ai");
    if(!root)return false;
    const title=root.querySelector(".td-ai-bai h2"),copy=root.querySelector(".td-ai-bai p"),area=root.querySelector("textarea");
    if(title)title.textContent="Что хочешь решить?";
    if(copy)copy.textContent="Расскажи своими словами. Я уточню только то, что реально влияет на решение.";
    if(area)area.placeholder="Например: собери ужин на четверых до 2500 ₽ или помоги выбрать наушники";
    return true;
  }

  async function waitForAssistant() {
    for(let i=0;i<14;i++){
      if(window.TDShoppingAssistant?.open)return window.TDShoppingAssistant;
      await delay(80);
    }
    return null;
  }

  async function openBay(prompt="") {
    window.TDBai?.setState?.("curious","Рассказывай. Разберёмся, как лучше.",1700,false);
    const assistant=await waitForAssistant();
    if(!assistant){
      window.dispatchEvent(new CustomEvent("bai:hint",{detail:{state:"suspicious",text:"Помощник не загрузился. Можно продолжить через обычный поиск.",ms:2300}}));
      focusSelfSearch();
      return false;
    }
    await assistant.open();
    tuneAssistant();
    if(prompt)setTimeout(()=>assistant.submit?.(prompt),90);
    return true;
  }

  function focusSelfSearch() {
    const input=document.querySelector(".v2-self-search .v2-search input,.v2-search input");
    input?.focus({preventScroll:true});
    input?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function enhanceScreen() {
    if (!window.state) return;
    const app = document.getElementById("app");
    app.dataset.screen = state.screen;
    app.classList.toggle("v2-inner-screen", state.screen !== "home");
    if (state.screen === "home") app.innerHTML = Home();
    window.dispatchEvent(new CustomEvent("td:v2-rendered", { detail: { screen: state.screen } }));
  }

  window.tdBayFirstAsk = openBay;
  window.tdBayFirstSelfSearch = focusSelfSearch;
  window.tdBayFirstTuneAssistant = tuneAssistant;
  window.tdV2Search = event => { event.preventDefault(); const query = new FormData(event.currentTarget).get("query"); state.q = String(query || "").trim(); window.dispatchEvent(new CustomEvent("bai:checking")); go("catalog"); };
  window.tdV2Quick = label => { state.q = label === "Для дома" ? "" : label; state.category = label === "Для дома" ? "Бакалея" : "Все"; go("catalog"); };
  window.tdV2Menu = button => { const menu = document.querySelector(".v2-mobile-nav"); if (!menu) return; menu.hidden = !menu.hidden; button.setAttribute("aria-expanded", String(!menu.hidden)); };
  window.tdV2About = () => { if (state.screen !== "home") { go("home"); requestAnimationFrame(() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })); } else document.getElementById("about")?.scrollIntoView({ behavior: "smooth" }); };
  window.TDV2Components = { Header, HeroSearch, StoreStrip, ProductGrid, ProductCard, ShoppingList, Footer, MobileDock, Home };

  const previous = window.render;
  window.render = function () { previous(); enhanceScreen(); };
  enhanceScreen();
})();
