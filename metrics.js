(function () {
  window.YM_ID = 112427683;
  window.tdHit = function (screen) {
    try {
      if (!window.ym || !window.YM_ID) return;
      ym(window.YM_ID, "hit", "/tamdeshevle/" + (screen || "home"), { title: screen || "home" });
      ym(window.YM_ID, "reachGoal", "screen_" + (screen || "home"));
    } catch (e) {}
  };
  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    if (window.state) window.tdHit(state.screen);
  };
})();
