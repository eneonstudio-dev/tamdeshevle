(function () {
  window.YM_ID = 0;

  window.tdHit = function (screen) {
    try {
      if (!window.ym || !window.YM_ID) return;
      const path = "/tamdeshevle/" + (screen || "home");
      ym(window.YM_ID, "hit", path, { title: screen || "home" });
      ym(window.YM_ID, "reachGoal", "screen_" + (screen || "home"));
    } catch (e) {}
  };

  if (!window.YM_ID) return;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  ym(window.YM_ID, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false
  });

  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    if (window.state) window.tdHit(state.screen);
  };
})();
