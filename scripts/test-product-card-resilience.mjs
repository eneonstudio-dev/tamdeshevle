import fs from "node:fs";

const productUI = fs.readFileSync("product-ui.js", "utf8");
const cards = fs.readFileSync("cards.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(productUI);

assert(productUI.includes("function normalizeImageUrl"), "product images must have one URL normalization path");
assert(productUI.includes('url.hostname==="images.unsplash.com"'), "Unsplash fallback images must be recognized explicitly");
assert(productUI.includes('url.searchParams.set("fit","max")'), "Unsplash fallback images must preserve their aspect ratio instead of crop-to-fill");
assert(productUI.includes("function showImageFallback"), "broken product images need a visible final fallback");
assert(productUI.includes("td-image-fallback-mark"), "broken image fallback must have a dedicated accessible marker");
assert(productUI.includes("fallback:baseImage"), "retailer image failure must fall back to the base product image");
assert(productUI.includes("showImageFallback(holder,img,item)"), "base image failure must not leave a browser broken-image icon");
assert(productUI.includes('document.querySelectorAll("#app .sku-plate img").forEach(prepareTileImage)'), "home/catalog product tiles must use the same image hardening");
assert(productUI.includes('img.loading="lazy"') && productUI.includes('img.decoding="async"'), "product images must stay lazy and async decoded");
assert(productUI.includes('setAttribute("fetchpriority","low")'), "non-critical product images should stay low priority");
assert(productUI.includes('window.addEventListener("pagehide",pause)') && productUI.includes('window.addEventListener("pageshow",resume)'), "product decorators must pause and resume across Android/BFCache page lifecycle");
assert(!productUI.includes('window.addEventListener("pagehide",pause,{once:true})'), "pagehide cleanup must work on every navigation, not only the first one");
assert(productUI.includes("function retryImages"), "product images need an explicit retry path after connectivity returns");
assert(productUI.includes('window.addEventListener("online",retryImages)'), "failed image sources must retry after the browser comes back online");
assert(productUI.includes("delete card.dataset.productUiSignature") && productUI.includes("delete img.dataset.tdPreparedSource"), "online recovery must invalidate stale image/decorator signatures before retrying");

assert(productUI.includes('card.classList.toggle("td-in-cart",quantity>0)'), "product cards must expose whether the item is already in the cart");
assert(productUI.includes("tdCartQty"), "product card state must retain its visible cart quantity");
assert(productUI.includes("подтверждено сетью"), "verified retailer prices must use calm provenance copy");
assert(productUI.includes("данные устаревают"), "stale retailer prices must be called out without pretending they are current");
assert(productUI.includes("≈ оценка"), "unverified product prices must remain visibly approximate");
assert(productUI.includes("в корзине ·"), "catalog cards must show the current cart quantity");
assert(!productUI.includes("✓ подтверждено"), "Votonobay product trust must not use the rejected checkmark treatment");
assert(productUI.includes("rgba(43,228,135,.10)"), "product trust states must use the Votonobay mint treatment rather than the old beige UI");

assert(cards.includes("grid-template-columns:76px minmax(0,1fr) auto"), "product text column must be allowed to shrink instead of overflowing");
assert(cards.includes("overflow-wrap:anywhere"), "long product names and price text must wrap safely");
assert(cards.includes("@media (max-width:380px)"), "very narrow Android product cards need an explicit layout guard");
assert(cards.includes("grid-template-columns:64px minmax(0,1fr) auto"), "360px product cards must use a compact thumbnail column");
assert(cards.includes("width:40px!important") && cards.includes("height:40px!important"), "compact layout must preserve quantity touch targets");
assert(cards.includes("object-fit:contain"), "product imagery must remain contain-fit in its visual frame");

assert(!productUI.includes("TDBai") && !productUI.includes("bai-"), "product image resilience must stay independent from Bai");
assert(!cards.includes("bai-"), "product card layout must stay independent from Bai");

console.log("Product card resilience checks passed: dark trust states, in-cart feedback, aspect-safe images, multi-stage fallback, connectivity retry, BFCache resume and 360px layout guards are wired.");
