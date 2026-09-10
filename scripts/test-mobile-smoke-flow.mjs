import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read("index.html");
const geo = read("geo-store-map.js");
const bridge = read("store-id-bridge.js");
const cluster = read("map-cluster-priority.js");
const selected = read("selected-store-ui.js");
const oneTap = read("map-one-tap.js");
const bai = read("bai-assistant.js");
const layers = read("ui-layer-coordinator.js");

const order = [
  "store-id-bridge.js",
  "geo-store-map.js",
  "geo-store-map-theme.js",
  "map-cluster-priority.js",
  "selected-store-ui.js",
  "map-one-tap.js",
  "bai-assistant.js",
  "ui-layer-coordinator.js"
].map(name => html.indexOf(name));
assert(order.every(i => i >= 0), "all mobile flow scripts must be loaded by index.html");
assert(order.every((value, i) => i === 0 || value > order[i - 1]), "mobile flow scripts must load in dependency order");

assert(geo.includes("td:selected-store-point"), "geo flow must persist an exact store point");
assert(geo.includes("data-use-point"), "geo details must keep a verified point selection action");
assert(bridge.includes("verified:true") && bridge.includes("verified:false"), "store bridge must gate verified and unverified points");
assert(bridge.includes("complete?partialTotal:null"), "point basket must not expose a full total for partial coverage");

assert(cluster.includes("CLUSTER_DISTANCE"), "map clustering must keep an explicit visual distance threshold");
assert(cluster.includes("q?.basket?.verified") && cluster.includes("q?.match?.verified"), "map priority must only promote verified price/store states");
assert(cluster.includes("selected?100000") || cluster.includes("selected?100000:0"), "selected exact point must outrank cluster alternatives");
assert(cluster.includes("td-map-cluster"), "overlapping map points must expose an expandable cluster control");
assert(cluster.includes('id:"verified"') && cluster.includes('id:"saving"') && cluster.includes('id:"near"'), "map must expose verified, saving and one-kilometre filters");
assert(cluster.includes('item.quote?.match?.verified'), "verified filter must depend on the verified Store ID match");
assert(cluster.includes('item.quote?.basket?.verified') && cluster.includes('item.quote.basket.savings>0'), "saving filter must only expose verified positive basket savings");
assert(cluster.includes('Number(item.point.distanceKm)<=1'), "nearby filter must enforce a one-kilometre threshold");
assert(cluster.includes("setFilter(id)"), "map filters must remain programmatically refreshable");
assert(cluster.includes("patchLeaflet") && cluster.includes("mapInstance"), "map UI must capture the live Leaflet instance for card focusing");
assert(cluster.includes("flyTo([point.lat,point.lon]") && cluster.includes("duration:.38"), "card selection must smoothly focus the exact store point");
assert(cluster.includes("tdFocusScroll") && cluster.includes("visibleCardIndex"), "store list scrolling must synchronize the active map marker");
assert(cluster.includes("installCardFocus") && cluster.includes("focus:focusPoint"), "card focus behavior must be installed before one-tap capture and remain externally refreshable");

assert(oneTap.includes("if(!point||!match||!match.verified)return false"), "compare navigation must reject missing or unverified points");
assert(oneTap.includes("localStorage.setItem(KEY"), "one-tap selection must persist the exact verified point");
assert(oneTap.includes("td:selected-store-point-current"), "one-tap selection must announce the current exact point");
assert(oneTap.includes("cleanupTray"), "map flow must clean up the bottom tray");
assert(oneTap.includes("data-close-map"), "map close must participate in tray cleanup");
assert(oneTap.includes("pagehide"), "navigation/page hide must not leave a stale tray");

assert(selected.includes("Считаем по этой конкретной точке"), "compare screen must identify the exact point source");
assert(selected.includes("Подтверждено") && selected.includes("полный итог пока не показываем"), "selected point UI must label partial coverage honestly");

assert(layers.includes(".td-map-sheet,.td-point-detail,.td-one-tap"), "Bay coordinator must recognize all blocking map overlays");
assert(layers.includes("data-ui-parked"), "Bay must be parked while map overlays are active");
assert(layers.includes("app.inert=blocked"), "underlying app must be inert while an overlay is active when supported");
assert(bai.includes("bai-assistant"), "Bay assistant must remain independently mountable");

console.log("Mobile smoke flow checks passed: exact store selection, clustering, trusted filters, card focus sync, compare routing, overlay cleanup and Bay coordination are wired.");
