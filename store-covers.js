(function () {
  "use strict";

  const STORE_IMG = {
    "Пятёрочка": "https://unsplash.com/photos/rWMIbqmOxrY/download?force=true&w=900",
    "Магнит": "https://unsplash.com/photos/1t-mONY1Vbk/download?force=true&w=900",
    "Перекрёсток": "https://unsplash.com/photos/GMTaA26Yj9M/download?force=true&w=900",
    "Лента": "https://unsplash.com/photos/e3xe2Fs8I3E/download?force=true&w=900",
    "Дикси": "https://unsplash.com/photos/rWMIbqmOxrY/download?force=true&w=900",
    "Лавка": "https://unsplash.com/photos/M_6XyaoPjyE/download?force=true&w=900",
    "Впрок": "https://unsplash.com/photos/1t-mONY1Vbk/download?force=true&w=900"
  };

  function ensureStyles() {
    if (document.getElementById("td-home-refresh-styles")) return;
    const style = document.createElement("style");
    style.id = "td-home-refresh-styles";
    style.textContent = `
      .home-refresh{padding-top:4px}
      .home-hero{position:relative;overflow:hidden;min-height:298px;border-radius:28px;padding:22px 18px;background:
        radial-gradient(circle at 84% 16%,rgba(255,225,74,.9),transparent 28%),
        radial-gradient(circle at 12% 88%,rgba(22,163,74,.45),transparent 35%),
        linear-gradient(145deg,#121711 0%,#1d2a20 52%,#0d6a40 100%);color:#fff;box-shadow:0 20px 44px rgba(15,75,45,.18)}
      .home-hero:before{content:"";position:absolute;width:180px;height:180px;border:1px solid rgba(255,255,255,.12);border-radius:50%;right:-60px;bottom:-80px;box-shadow:0 0 0 28px rgba(255,255,255,.035),0 0 0 58px rgba(255,255,255,.02)}
      .home-kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#d9fbe4}
      .home-dot{width:7px;height:7px;border-radius:50%;background:#54e884;box-shadow:0 0 0 5px rgba(84,232,132,.12)}
      .home-title{max-width:330px;margin-top:18px;font-size:35px;line-height:.98;letter-spacing:-.06em;font-weight:800}
      .home-title em{font-style:normal;color:#ffe14a}
      .home-copy{max-width:310px;margin-top:12px;font-size:13px;line-height:1.5;color:#d7e5da;font-weight:650}
      .home-price-cloud{position:absolute;right:12px;bottom:18px;width:156px;height:92px;pointer-events:none}
      .home-price{position:absolute;padding:8px 10px;border-radius:13px;background:#fff;color:#151713;font-size:12px;font-weight:800;box-shadow:0 10px 22px rgba(0,0,0,.2);animation:tdFloat 4.2s ease-in-out infinite}
      .home-price:nth-child(1){right:0;top:0;transform:rotate(5deg)}
      .home-price:nth-child(2){left:0;top:30px;animation-delay:-1.4s;transform:rotate(-5deg)}
      .home-price:nth-child(3){right:4px;bottom:0;animation-delay:-2.6s;transform:rotate(2deg);background:#ffe14a}
      @keyframes tdFloat{0%,100%{translate:0 0}50%{translate:0 -7px}}
      .home-actions{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:12px}
      .home-primary{border:0;border-radius:17px;background:#ffe14a;padding:14px 15px;font:800 14px Manrope;color:#17150f;cursor:pointer;text-align:left;box-shadow:0 8px 20px rgba(255,225,74,.18)}
      .home-cart{width:52px;border:0;border-radius:17px;background:#fff;font-size:20px;cursor:pointer}
      .home-address{margin-top:10px;background:rgba(255,255,255,.92);box-shadow:0 8px 25px rgba(22,20,16,.06)}
      .home-section-title{display:flex;justify-content:space-between;align-items:end;margin:20px 2px 9px;font-size:13px;font-weight:800}
      .home-section-title span{color:var(--muted);font-size:11px}
      .home-nets{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .home-net{position:relative;overflow:hidden;border:0;border-radius:18px;min-height:108px;padding:10px;background:#fff;text-align:left;cursor:pointer;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease}
      .home-net:hover{transform:translateY(-3px);box-shadow:0 16px 30px rgba(22,20,16,.12)}
      .home-net-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(.95);transform:scale(1.03);transition:transform .45s ease}
      .home-net:hover .home-net-bg{transform:scale(1.09)}
      .home-net:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.62))}
      .home-net b,.home-net small{position:absolute;z-index:1;left:10px;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.45)}
      .home-net b{bottom:23px;font-size:12px}.home-net small{bottom:9px;font-size:9px;font-weight:700;opacity:.9}
      .home-proof{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
      .home-proof>div{background:#fff;border:1px solid #ece6db;border-radius:15px;padding:11px 9px}
      .home-proof b{display:block;font-size:15px;letter-spacing:-.03em}.home-proof span{display:block;margin-top:2px;color:var(--muted);font-size:9px;font-weight:700;line-height:1.25}
      .store .cover{position:relative;isolation:isolate;background-color:#222!important;background-size:cover!important;transition:background-size .5s ease,transform .25s ease}
      .store .cover:after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.5))}
      .store:hover .cover{background-size:112%!important}
      .store{transition:transform .2s ease,box-shadow .2s ease}.store:hover{transform:translateY(-3px);box-shadow:0 18px 34px rgba(22,20,16,.13)}
      @media (prefers-reduced-motion:reduce){.home-price{animation:none}.home-net,.store{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function imageFor(name) {
    return STORE_IMG[name] || STORE_IMG["Перекрёсток"];
  }

  function dressStores() {
    document.querySelectorAll(".store").forEach(card => {
      const name = card.querySelector(".name");
      const cover = card.querySelector(".cover");
      if (!name || !cover) return;
      const src = imageFor(name.textContent.trim());
      cover.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.02) 20%,rgba(0,0,0,.5)),url('${src}')`;
      cover.style.backgroundPosition = "center";
    });
  }

  function homeNet(storeId, name, subtitle) {
    return `<button class="home-net" onclick="state.storeId='${storeId}';persist();go('catalog')">
      <span class="home-net-bg" style="background-image:url('${imageFor(name)}')"></span>
      <b>${name}</b><small>${subtitle}</small>
    </button>`;
  }

  function dressHome() {
    if (!window.state || state.screen !== "home") return;
    const wrap = document.querySelector(".wrap");
    if (!wrap || wrap.dataset.homeRefresh === "1") return;
    wrap.dataset.homeRefresh = "1";
    wrap.classList.add("home-refresh");
    wrap.innerHTML = `
      <section class="home-hero">
        <div class="home-kicker"><span class="home-dot"></span> сравниваем корзину целиком</div>
        <div class="home-title">Одна корзина.<br><em>Разные цены.</em></div>
        <div class="home-copy">Собери привычные продукты — покажем, где тот же набор выходит дешевле: в магазине или с доставкой.</div>
        <div class="home-price-cloud" aria-hidden="true">
          <span class="home-price">молоко 72 ₽</span>
          <span class="home-price">яйца 115 ₽</span>
          <span class="home-price">−187 ₽ корзина</span>
        </div>
      </section>
      <div class="home-actions">
        <button class="home-primary" onclick="go('stores')">Найти магазин дешевле →</button>
        <button class="home-cart" aria-label="Открыть корзину" onclick="go('cart')">🛒</button>
      </div>
      <input class="addr home-address" placeholder="Адрес — скоро учтём ближайшие магазины" value="${state.address || ""}" onchange="state.address=this.value;persist()" />
      <div class="home-section-title">Популярные сети <span>быстрый вход</span></div>
      <div class="home-nets">
        ${homeNet("perek", "Перекрёсток", "есть реальные цены")}
        ${homeNet("pyat", "Пятёрочка", "сравнить корзину")}
        ${homeNet("magnit", "Магнит", "сравнить корзину")}
      </div>
      <div class="home-proof">
        <div><b>79</b><span>товаров в базовом каталоге</span></div>
        <div><b>7</b><span>сетей в сравнении</span></div>
        <div><b>4</b><span>SKU Перекрёстка уже из публичного каталога</span></div>
      </div>`;
  }

  function dress() {
    ensureStyles();
    dressHome();
    dressStores();
  }

  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    dress();
  };
  dress();
})();
