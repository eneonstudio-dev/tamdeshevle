(function () {
  "use strict";
  if (window.__TDGsapMotionInitialized) return;
  window.__TDGsapMotionInitialized = true;

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastScreen = "";
  let playFrame = 0;

  function hasStylesheet(file) {
    return Boolean(document.querySelector(`link[data-td-v2-polish],link[href*="${file}"]`));
  }

  function hasScript(file) {
    return Boolean(document.querySelector(`script[data-td-v2-polish],script[src*="${file}"]`));
  }

  function loadV2Polish() {
    if (!hasStylesheet("v2-polish.css")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "v2-polish.css?v=20260912-v2-1";
      link.dataset.tdV2Polish = "1";
      document.head.appendChild(link);
    }
    if (!hasScript("v2-polish.js")) {
      const script = document.createElement("script");
      script.src = "v2-polish.js?v=20260912-v2-1";
      script.dataset.tdV2Polish = "1";
      document.body.appendChild(script);
    }
  }

  function playV2() {
    if (document.hidden || reduce || !window.gsap || !window.state || state.screen !== "home") return false;
    const root = document.querySelector(".v2-main");
    if (!root) return false;
    const screen = "v2-home";
    const fresh = screen !== lastScreen;
    lastScreen = screen;
    if (!fresh) return true;

    const hero = root.querySelector(".v2-hero");
    const copy = root.querySelector(".v2-hero-copy");
    const search = root.querySelector(".v2-search");
    const chips = root.querySelectorAll(".v2-categories button");
    const stores = root.querySelectorAll(".v2-store-strip > button");
    const cards = root.querySelectorAll(".v2-product-card");
    const basket = root.querySelector(".v2-basket-card");

    if (hero) gsap.fromTo(hero, { y: 18, opacity: 0, scale: .99 }, { y: 0, opacity: 1, scale: 1, duration: .55, ease: "power3.out" });
    if (copy) gsap.fromTo(copy, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .48, delay: .08, ease: "power3.out" });
    if (search) gsap.fromTo(search, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .42, delay: .16, ease: "power2.out" });
    if (chips.length) gsap.fromTo(chips, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: .035, delay: .2, ease: "power2.out" });
    if (stores.length) gsap.fromTo(stores, { x: 12, opacity: 0 }, { x: 0, opacity: 1, duration: .34, stagger: .04, delay: .16, ease: "power2.out" });
    if (cards.length) gsap.fromTo(cards, { y: 16, opacity: 0, scale: .98 }, { y: 0, opacity: 1, scale: 1, duration: .38, stagger: .045, delay: .12, ease: "power3.out" });
    if (basket && window.innerWidth > 1000) gsap.fromTo(basket, { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: .4, delay: .2, ease: "power2.out" });
    return true;
  }

  function play() {
    if (document.hidden) return;
    if (playV2()) return;
    if (reduce || !window.gsap || !window.state) return;
    const screen = state.screen || "home";
    const wrap = document.querySelector(".wrap");
    if (!wrap) return;
    const fresh = screen !== lastScreen;
    lastScreen = screen;
    if (!fresh) return;

    const hero = wrap.querySelector(".hero, .home-hero");
    const cards = wrap.querySelectorAll(".store, .sku, .item, .net, .plan, .home-net, .home-proof > div");
    const rest = wrap.querySelectorAll(".btn, .ghost, .note, .geo-box, .toggle, .home-actions, .home-address, .home-section-title");

    if (hero) {
      gsap.fromTo(hero, { y: 18, opacity: 0, scale: 0.985 }, { y: 0, opacity: 1, scale: 1, duration: 0.58, ease: "power3.out" });
      const title = hero.querySelector(".home-title");
      const copy = hero.querySelector(".home-copy");
      const prices = hero.querySelectorAll(".home-price");
      if (title) gsap.fromTo(title, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.48, ease: "power3.out", delay: 0.1 });
      if (copy) gsap.fromTo(copy, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out", delay: 0.18 });
      if (prices.length) gsap.fromTo(prices, { scale: 0.78, opacity: 0, rotation: -8 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.5, stagger: 0.08, ease: "back.out(1.7)", delay: 0.22 });
    }
    if (cards.length) gsap.fromTo(cards, { y: 18, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, stagger: 0.045, ease: "power3.out" });
    if (rest.length) gsap.fromTo(rest, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: "power2.out", delay: 0.08 });
    const best = wrap.querySelector(".plan.best .sum");
    if (best) gsap.fromTo(best, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: "back.out(1.6)", delay: 0.2 });
  }

  function queuePlay() {
    if (document.hidden || playFrame) return;
    playFrame = requestAnimationFrame(() => {
      playFrame = 0;
      play();
    });
  }

  loadV2Polish();
  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    queuePlay();
  };
  window.addEventListener("td:v2-rendered", queuePlay);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playFrame) {
      cancelAnimationFrame(playFrame);
      playFrame = 0;
    }
  });
  window.addEventListener("pagehide", () => {
    if (playFrame) cancelAnimationFrame(playFrame);
    playFrame = 0;
  }, { once: true });
  queuePlay();
})();
