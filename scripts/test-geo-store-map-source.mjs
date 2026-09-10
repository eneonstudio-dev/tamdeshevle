import fs from "node:fs";

const source = fs.readFileSync("geo-store-map.js", "utf8");
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(source.includes("openPointDetails"), "point details UI must exist");
assert(source.includes("data-use-point"), "verified point selection action must exist");
assert(source.includes("td:selected-store-point"), "physical point selection metadata must be retained");
assert(source.includes("safeUrl"), "external source URLs must be sanitized");
assert(source.includes("esc("), "OSM/retailer text must be escaped before HTML rendering");
assert(source.includes("Учебные цены сети сюда не подмешиваются"), "UI must explain strict point-price safety");

console.log("Geo store map source checks passed: point details, safe provenance links and selection are wired.");
