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
    const hero = wrap.querySelector(".hero");
    const cards = wrap.querySelectorAll(".store, .sku, .item, .net, .plan");
    const rest = wrap.querySelectorAll(".btn, .ghost, .note, .geo-box, .toggle");
    if (hero) {
      gsap.fromTo(hero, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
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
