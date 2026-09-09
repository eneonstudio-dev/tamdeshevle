(function () {
  "use strict";
  async function load() {
    try {
      const response = await fetch("data/retailers/collector-health.json?v=20260910a", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.schema !== "tamdeshevle.collector-health.v1") throw new Error("invalid collector health schema");
      window.TDCollectorHealth = data;
      window.dispatchEvent(new CustomEvent("td:collector-health", { detail: data }));
    } catch (error) {
      window.TDCollectorHealth = { schema: "tamdeshevle.collector-health-runtime-error.v1", error: String(error && error.message || error), collectors: {} };
      window.dispatchEvent(new CustomEvent("td:collector-health", { detail: window.TDCollectorHealth }));
      console.warn("collector health не загрузился", error);
    }
  }
  load();
})();
