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

assert(source.includes("refreshMapMarkers"), "nearby results must update markers without rebuilding the sheet");
assert(source.includes("renderMapSurface"), "Leaflet surface setup must be reusable after page restore");
assert(source.includes('window.addEventListener("pageshow"'), "BFCache/Android return must restore an open map");
assert(source.includes('window.addEventListener("pagehide"'), "background navigation must stop active map/network work");
assert(source.includes("if(!lastPosition)return locate({opener})"), "first geolocation request must preserve the map opener for focus restoration");
assert(!source.includes('if(mapSheet){closeMap({historyBack:false,restoreFocus:false})'), "nearby refresh must never close/reopen the visible map sheet");
assert(!source.includes("suppressMapRemoval") && !source.includes("suppressPointRemoval"), "unused popstate suppression flags must not obscure overlay lifecycle");
assert(source.includes('refreshMapMarkers({fit:false})'), "retailer price refresh must update visible marker popups in place");

assert(oneTap.includes("closeMapFlow"), "one-tap compare must use centralized map teardown");
assert(oneTap.includes("TDGeo?.closeMap") && oneTap.includes("TDGeo?.closePointDetails"), "one-tap navigation must call the geo lifecycle API instead of bypassing it");
assert(oneTap.includes("clearGeoHistory"), "one-tap compare must not leave stale geo history state");

assert(selectedStore.includes("previousStoreId"), "point selection must capture the store that was active before switching chains");
assert(selectedStore.includes("point.referenceStoreId=previousStoreId"), "selected point metadata must retain the original comparison reference");
assert(selectedStore.includes("referenceStoreId=point.referenceStoreId"), "point basket must compare against the preserved reference instead of the newly selected chain");
assert(selectedStore.includes("previousStoreId!==point.chainId"), "same-chain point selection must not create fake self-savings");
assert(selectedStore.includes('reason:"store_changed"'), "manual store changes must invalidate an old exact point instead of restoring it");
assert(selectedStore.includes('reason:"city_changed"'), "selected point must be scoped to the active city");
assert(selectedStore.includes("storeEligible(reference,city,mode)"), "comparison reference must be revalidated after mode/city changes");
assert(selectedStore.includes("td:runtime-resume"), "selected point must reconcile again after page/runtime restore");
assert(!selectedStore.includes("if(point&&window.state&&state.storeId!==point.chainId)persistCurrentChain(point)"), "startup reconciliation must never let stale point storage hijack the current store");

await import("./test-selected-store-state.mjs");

console.log("Geo store map checks passed: provenance safety, in-place marker refresh, BFCache restore, stale-point reconciliation and lifecycle-safe overlay exits are wired.");
