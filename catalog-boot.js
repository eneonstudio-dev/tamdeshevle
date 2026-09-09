(function () {
  const IDS = ["pyat", "magnit", "perek", "lenta", "dixy", "lavka", "vprok"];
  const LEGACY = { bread: "bread_dark", chicken: "chicken_fil", oil: "oil_sunflower", eggs: "eggs_c1", buck: "buckwheat", sour: "smetana" };
  const rub = n => Math.max(9, Math.round(n));
  fetch("catalog.json?v=20260909e").then(r => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then(book => {
    if (!book || !book.products || typeof PRODUCTS === "undefined") return;
    const base = book.base || {};
    const mult = book.mult || {};
    const bm = book.bring_mult || 1.14;
    PRODUCTS.length = 0;
    book.products.forEach(m => {
      const b = base[m.id] || 99;
      const prices = {};
      const bring = {};
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
    if (typeof render === "function") render();
  }).catch(err => console.warn("catalog.json не сел", err));
})();
