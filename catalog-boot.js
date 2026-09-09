(function () {
  const IDS = ["pyat", "magnit", "perek", "lenta", "dixy", "lavka", "vprok"];
  const LEGACY = { bread: "bread_dark", chicken: "chicken_fil", oil: "oil_sunflower", eggs: "eggs_c1", buck: "buckwheat", sour: "smetana" };
  const MSK = { lat: 55.7558, lon: 37.6173 };
  const SPB = { lat: 59.9343, lon: 30.3351 };
  const rub = n => Math.max(9, Math.round(n));
  let POINTS = [];
  let BOOK = null;

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

  function paint() {
    if (!window.state) return;
    if (!state.radius) state.radius = 10;
    if (!state.category) state.category = "Все";
    const header = document.querySelector("header.app");
    const wrap = document.querySelector(".wrap");
    if (!header || !wrap) return;

    if (state.screen === "home" && !document.querySelector(".geo-box")) {
      const box = document.createElement("div");
      box.className = "geo-box";
      const hint = state.geoStatus === "ok" ? "Место есть · учебные точки в " + state.radius + " км"
        : state.geoStatus === "far" ? "Не Москва и не Питер — кольцо выключено"
        : state.geoStatus === "wait" ? "Спрашиваю место…"
        : state.geoStatus === "denied" ? "Гео запрещено"
        : "Без места — сети города без км";
      box.innerHTML = `<button class="btn green" onclick="askGeo()">${state.geo ? "Обновить место" : "Определить место"}</button>
        <div class="chips" style="padding:10px 0 0">${[5,10,15].map(r => `<button class="chip ${state.radius===r?"on":""}" onclick="setRadius(${r})">${r} км</button>`).join("")}</div>
        <p class="hint" style="margin:8px 0 12px">${hint}</p>`;
      wrap.insertBefore(box, wrap.querySelector(".addr") || wrap.querySelector(".btn"));
    }

    if (state.screen === "stores") {
      if (!document.querySelector(".extra-chips")) {
        header.after(chipRow(["5 км", "10 км", "15 км"], state.radius + " км", "setRadiusLabel"));
      }
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

    if (state.screen === "catalog") {
      if (!document.querySelector(".extra-chips")) header.after(chipRow(cats(), state.category, "setCat"));
      document.querySelectorAll(".item").forEach(el => {
        const title = el.querySelector(".title");
        if (!title) return;
        const p = PRODUCTS.find(x => x.name === title.textContent);
        el.style.display = (state.category === "Все" || (p && p.category === state.category)) ? "" : "none";
      });
    }
  }

  window.setRadiusLabel = function (label) {
    const n = parseInt(label, 10);
    if (n) window.setRadius(n);
  };

  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    paint();
  };

  fetch("catalog.json?v=20260909f").then(r => {
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
