(function () {
  "use strict";

  const MASS = { "г": 0.001, "кг": 1 };
  const VOLUME = { "мл": 0.001, "л": 1 };
  const COUNT = new Set(["шт", "штук", "пак"]);

  function parsePack(pack) {
    const text = String(pack || "").trim().toLowerCase().replace(",", ".");
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(кг|г|мл|л|шт|штук|пак)\b/u);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (MASS[unit]) return { amount, unit, baseAmount: amount * MASS[unit], baseUnit: "кг" };
    if (VOLUME[unit]) return { amount, unit, baseAmount: amount * VOLUME[unit], baseUnit: "л" };
    if (COUNT.has(unit)) return { amount, unit, baseAmount: amount, baseUnit: "шт" };
    return null;
  }

  function quote(price, pack) {
    const parsed = parsePack(pack);
    const numericPrice = Number(price);
    if (!parsed || !Number.isFinite(numericPrice) || numericPrice < 0) return null;
    return {
      value: numericPrice / parsed.baseAmount,
      unit: parsed.baseUnit,
      pack: parsed
    };
  }

  function format(price, pack) {
    const result = quote(price, pack);
    if (!result) return "";
    const value = result.value >= 100 ? Math.round(result.value) : Math.round(result.value * 10) / 10;
    return `${value.toLocaleString("ru-RU")} ₽/${result.unit}`;
  }

  window.TDUnitPrice = { parsePack, quote, format };
})();
