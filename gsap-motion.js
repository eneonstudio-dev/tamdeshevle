(function () {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastScreen = "";
  function play() {
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
    if (cards.length) {
      gsap.fromTo(cards, { y: 18, opacity: 0, scale: 0.97 }, {
        y: 0, opacity: 1, scale: 1, duration: 0.42, stagger: 0.045, ease: "power3.out"
      });
    }
    if (rest.length) {
      gsap.fromTo(rest, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: "power2.out", delay: 0.08 });
    }
    const best = wrap.querySelector(".plan.best .sum");
    if (best) gsap.fromTo(best, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: "back.out(1.6)", delay: 0.2 });
  }
  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    requestAnimationFrame(play);
  };
  requestAnimationFrame(play);
})();
