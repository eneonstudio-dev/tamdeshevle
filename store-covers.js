(function () {
  const U = "https://images.unsplash.com/";
  const W = "?auto=format&fit=crop&w=800&h=360&q=65";
  const STORE_IMG = {
    "Пятёрочка": U + "photo-1578916171728-46686eac8d58" + W,
    "Магнит": U + "photo-1542838132-92c53300491e" + W,
    "Перекрёсток": U + "photo-1604719312566-8912e9227c6a" + W,
    "Лента": U + "photo-1583258292688-d021cb446ea8" + W,
    "Дикси": U + "photo-1534723452862-4c874018d66d" + W,
    "Лавка": U + "photo-1526367790999-0150786686a2" + W,
    "Впрок": U + "photo-1578575437130-527eed3abbec" + W
  };
  function dress() {
    document.querySelectorAll(".store").forEach(card => {
      const name = card.querySelector(".name");
      const cover = card.querySelector(".cover");
      if (!name || !cover) return;
      const src = STORE_IMG[name.textContent.trim()];
      if (!src) return;
      cover.style.backgroundImage = "linear-gradient(180deg,transparent 25%,rgba(0,0,0,.52)),url('" + src + "')";
      cover.style.backgroundPosition = "center";
    });
  }
  const prev = window.render;
  window.render = function () {
    if (typeof prev === "function") prev();
    dress();
  };
  dress();
})();
