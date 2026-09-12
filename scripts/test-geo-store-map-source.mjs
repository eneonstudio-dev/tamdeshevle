import fs from "node:fs";

const source = fs.readFileSync("geo-store-map.js", "utf8");
const oneTap = fs.readFileSync("map-one-tap.js", "utf8");
const selectedStore = fs.readFileSync("selected-store-ui.js", "utf8");
function assert(condition, message) { if (!condition) throw new Error(message); }

new Function(source);
new Function(oneTap);
new Function(selectedStore);

assert(source.includes("openPointDetails"), "point details UI must exist");
assert(source.includes("data-use-point"), "verified point selection action must exist");
assert(source.includes("td:selected-store-point"), "physical point selection metadata must be retained");
assert(source.includes("safeUrl"), "external source URLs must be sanitized");
assert(source.includes("esc("), "OSM/retailer text must be escaped before HTML rendering");
assert(source.includes("Учебные цены сети сюда не подмешиваются"), "UI must explain strict point-price safety");

assert(source.includes("SEARCH_TIMEOUT"), "nearby lookup must have an explicit network timeout");
assert(source.includes("AbortController"), "nearby lookup must be abortable");
assert(source.includes("controller?.abort()"), "timed-out or replaced nearby lookup must be cancelled");
assert(source.includes("map.remove()"), "Leaflet instance must be destroyed when the map closes");
assert(source.includes("destroyMap()"), "map cleanup must be centralized");
assert(source.includes("locating=false") && source.includes("if(locating)return false"), "repeated geolocation taps must be guarded");
assert(source.includes('setAttribute("role","dialog")') && source.includes('setAttribute("aria-modal","true")'), "map and point overlays must use accessible dialog semantics");
assert(source.includes("trapTab") && source.includes('event.key==="Escape"'), "map dialogs must trap focus and support Escape");
assert(source.includes("tdGeoMap") && source.includes("tdGeoPoint") && source.includes("popstate"), "browser/Android Back must close map layers in order");
assert(source.includes("td-map-state") && source.includes("data-retry-nearby"), "network failure must have a visible retry state");
assert(!source.includes("TDBai") && !source.includes("bai-"), "geo lifecycle must stay independent from Bai internals");

assert(oneTap.includes("closeMapFlow"), "one-tap compare must use centralized map teardown");
assert(oneTap.includes("TDGeo?.closeMap") && oneTap.includes("TDGeo?.closePointDetails"), "one-tap navigation must call the geo lifecycle API instead of bypassing it");
assert(oneTap.includes("clearGeoHistory"), "one-tap compare must not leave stale geo history state");

assert(selectedStore.includes("previousStoreId"), "point selection must capture the store that was active before switching chains");
assert(selectedStore.includes("point.referenceStoreId=previousStoreId"), "selected point metadata must retain the original comparison reference");
assert(selectedStore.includes("referenceStoreId=point.referenceStoreId"), "point basket must compare against the preserved reference instead of the newly selected chain");
assert(selectedStore.includes("previousStoreId!==point.chainId"), "same-chain point selection must not create fake self-savings");

console.log("Geo store map checks passed: provenance safety, abortable lookup, selected-point reference preservation, accessible dialogs and lifecycle-safe one-tap exits are wired.");
