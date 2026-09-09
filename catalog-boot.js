(function () {
  const IDS = ["pyat", "magnit", "perek", "lenta", "dixy", "lavka", "vprok"];
  const LEGACY = { bread: "bread_dark", chicken: "chicken_fil", oil: "oil_sunflower", eggs: "eggs_c1", buck: "buckwheat", sour: "smetana" };
  const MSK = { lat: 55.7558, lon: 37.6173 };
  const SPB = { lat: 59.9343, lon: 30.3351 };
  const rub = n => Math.max(9, Math.round(n));
  let POINTS = [];
  let BOOK = null;

  function packClass(p) {
    const c = (p && p.category) || "";
    if (c.indexOf("Молоч") === 0) return "packaging-dairy";
    if (c.indexOf("Мясо") === 0 || c.indexOf("Колб") === 0) return "packaging-meat";
    if (c.indexOf("Овощ") === 0) return "packaging-veggie";
    if (c.indexOf("Фрук") === 0) return "packaging-fruit";
    if (c.indexOf("Хлеб") === 0) return "packaging-bakery";
    if (c.indexOf("Напи") === 0) return "packaging-drink";
    return "packaging-grocery";
  }
  function hav(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function save() {
    try {
      const raw = JSON.parse(localStorage.getItem("td") || "{}");
      if (window.state) {
        raw.cart = state.cart; raw.city = state.city; raw.radius = state.radius; raw.geo = state.geo;
      }
      localStorage.setItem("td", JSON.stringify(raw));
    } catch (e) {}
  }
  function storeKm(name) {
    if (!window.state || !state.geo || !POINTS.length) return null;
    const s = typeof STORES !== "undefined" ? STORES.find(x => x.name === name || x.short === name) : null;
    if (!s) return null;
    const pts = POINTS.filter(p => p.storeId === s.id && p.city === state.city);
    if (!pts.length) return null;
    return Math.min.apply(null, pts.map(p => hav(state.geo, p)));
  }
  function cats() {
    const o = [];
    PRODUCTS.forEach(p => { if (p.category && o.indexOf(p.category) < 0) o.push(p.category); });
    return ["Все"].concat(o);
  }
  function chipRow(items, current, fnName) {
    const d = document.createElement("div");
    d.className = "chips extra-chips";
    d.innerHTML = items.map(x => `<button class="chip ${x === current ? "on" : ""}" onclick="${fnName}('${x}')">${x}</button>`).join("");
    return d;
  }
  function sumStore(id) {
    return PRODUCTS.reduce((a, p) => a + ((p.prices[id] || 0) * ((window.state && state.cart[p.id]) || 0)), 0);
  }
  function bestStore() {
    if (typeof STORES === "undefined") return null;
    const city = window.state ? state.city : "msk";
    return STORES.filter(s => s.city.includes(city)).map(s => {
      const goods = sumStore(s.id);
      const fee = s.kind === "delivery" ? (s.delivery || 0) : 0;
      return { s: s, total: goods + fee };
    }).sort((a, b) => a.total - b.total)[0];
  }
  function dressItems() {
    document.querySelectorAll(".item").forEach(el => {
      const title = el.querySelector(".title");
      const thumb = el.querySelector(".thumb");
      if (!title) return;
      const p = PRODUCTS.find(x => x.name === title.textContent);
      if (state.screen === "catalog") {
        el.style.display = (state.category === "Все" || (p && p.category === state.category)) ? "" : "none";
      }
      if (thumb && p) {
        thumb.className = "thumb product-packaging " + packClass(p);
        thumb.textContent = p.emoji || p.name.split(" ")[0];
        thumb.style.background = "";
        thumb.style.fontSize = "32px";
        thumb.style.alignItems = "center";
      }
      el.classList.add("product-card");
    });
  }

  window.setRadius = function (r) {
    if (!window.state) return;
    state.radius = Number(r);
    save(); if (typeof render === "function") render();
  };
  window.setCat = function (c) {
    if (!window.state) return;
    state.category = c;
    if (typeof render === "function") render();
  };
  window.askGeo = function () {
    if (!window.state || !navigator.geolocation) {
      if (window.state) state.geoStatus = "denied";
      if (typeof render === "function") render();
      return;
    }
    state.geoStatus = "wait";
    if (typeof render === "function") render();
    navigator.geolocation.getCurrentPosition(pos => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const dM = hav(here, MSK), dS = hav(here, SPB);
      if (Math.min(dM, dS) > 80) { state.geo = null; state.geoStatus = "far"; }
      else { state.geo = here; state.geoStatus = "ok"; state.city = dS < dM ? "spb" : "msk"; }
      POINTS = (BOOK && BOOK.points || []).filter(p => p.city === state.city);
      save(); if (typeof render === "function") render();
    }, () => { state.geoStatus = "denied"; save(); if (typeof render === "function") render(); }, { timeout: 8000, maximumAge: 600000 });
  };
  window.setRadiusLabel = function (label) {
    const n = parseInt(label, 10);
    if (n) window.setRadius(n);
  };

  function paintHome(wrap) {
    const sid = (window.state && state.storeId) || "pyat";
    const cart = PRODUCTS.filter(p => state.cart[p.id] > 0);
    const n = cart.reduce((a, p) => a + state.cart[p.id], 0);
    const best = bestStore();
    const here = sumStore(sid);
    const hint = state.geoStatus === "ok" ? "Место есть · кольцо " + state.radius + " км"
      : state.geoStatus === "far" ? "Не Москва и не Питер — без км"
      : state.geoStatus === "wait" ? "Спрашиваю место…"
      : state.geoStatus === "denied" ? "Гео запрещено"
      : "Без места — сети города";
    const tiles = (cart.length ? cart : PRODUCTS).slice(0, 6).map(p => {
      return `<button class="sku" onclick="go('catalog')"><span class="sku-plate ${packClass(p)}" style="font-size:36px;align-items:center;justify-content:center">${p.emoji || p.name.split(" ")[0]}</span><span class="sku-name">${p.name}</span><span class="sku-meta">${p.pack} · ${p.prices[sid] || "—"} ₽</span></button>`;
    }).join("");
    const nets = (typeof STORES === "undefined" ? [] : STORES.filter(s => s.city.includes(state.city))).slice(0, 4).map(s => {
      const total = n ? sumStore(s.id) + (s.kind === "delivery" ? (s.delivery || 0) : 0) : null;
      return `<button class="net" onclick="state.storeId='${s.id}';go('catalog')"><i style="background:${s.color}">${s.short.charAt(0)}</i><b>${s.short}</b><span>${total != null ? total + " ₽" : s.type}</span></button>`;
    }).join("");
    wrap.innerHTML = `
      <div class="hero">
        <div class="kicker">Сравнение покупки</div>
        <div class="hero-title">Где эта корзина дешевле</div>
        <div class="hero-sum">${best ? "от " + best.total + " ₽ · " + best.s.name : here + " ₽"}${n ? " · " + n + " поз." : ""}</div>
      </div>
      <div class="sec">Корзина на входе</div>
      <div class="shelf">${tiles}</div>
      <button class="btn dark" onclick="go('compare')">Где выгоднее</button>
      <button class="ghost" onclick="go('stores')">Все сети</button>
      <div class="sec">Сети города</div>
      <div class="nets">${nets}</div>
      <div class="geo-box">
        <button class="ghost" onclick="askGeo()">${state.geo ? "Обновить место" : "Определить место"}</button>
        <div class="chips" style="padding:10px 0 0">${[5,10,15].map(r => `<button class="chip ${state.radius===r?"on":""}" onclick="setRadius(${r})">${r} км</button>`).join("")}</div>
        <p class="hint" style="margin:8px 0 12px">${hint}</p>
      </div>
      <p class="note">Не магазин, не доставка и не заказ. Цены учебные — витрина, не полка.</p>`;
  }

  function paint() {
    if (!window.state) return;
    if (!state.radius) state.radius = 10;
    if (!state.category) state.category = "Все";
    const header = document.querySelector("header.app");
    const wrap = document.querySelector(".wrap");
    if (!header || !wrap) return;
    const sub = header.querySelector(".sub");
    if (state.screen === "home" && sub) sub.textContent = "Сравни сети по одной корзине";
    if (state.screen === "home") paintHome(wrap);
    if (state.screen === "stores") {
      if (!document.querySelector(".extra-chips")) header.after(chipRow(["5 км", "10 км", "15 км"], state.radius + " км", "setRadiusLabel"));
      document.querySelectorAll(".store").forEach(card => {
        const name = card.querySelector(".name");
        const time = card.querySelector(".time");
        if (!name || !time) return;
        const km = storeKm(name.textContent);
        if (km == null) return;
        const ok = km <= state.radius;
        time.textContent = (ok ? "~" + km.toFixed(1) + " км · в кольце" : "~" + km.toFixed(1) + " км · вне " + state.radius + " км");
        card.style.opacity = ok ? "1" : ".55";
      });
    }
    if (state.screen === "catalog" && !document.querySelector(".extra-chips")) header.after(chipRow(cats(), state.category, "setCat"));
    if (state.screen === "catalog" || state.screen === "cart") dressItems();
  }

  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    paint();
  };

  fetch("catalog.json?v=20260909h").then(r => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then(book => {
    BOOK = book;
    if (!book || !book.products || typeof PRODUCTS === "undefined") return;
    const base = book.base || {}, mult = book.mult || {}, bm = book.bring_mult || 1.14;
    PRODUCTS.length = 0;
    book.products.forEach(m => {
      const b = base[m.id] || 99, prices = {}, bring = {};
      IDS.forEach(sid => {
        prices[sid] = rub(b * (mult[sid] || 1));
        bring[sid] = (sid === "lavka" || sid === "vprok") ? prices[sid] : rub(prices[sid] * bm);
      });
      PRODUCTS.push({ id: m.id, emoji: m.emoji, name: m.name, pack: m.pack, category: m.category, prices: prices, bring: bring });
    });
    if (window.state && state.cart) {
      const next = {};
      Object.keys(state.cart).forEach(k => {
        const id = LEGACY[k] || k;
        if (PRODUCTS.some(p => p.id === id)) next[id] = (next[id] || 0) + state.cart[k];
      });
      state.cart = next;
    }
    POINTS = (book.points || []).filter(p => window.state ? p.city === state.city : p.city === "msk");
    if (typeof render === "function") render();
  }).catch(err => console.warn("catalog.json не сел", err));
})();
