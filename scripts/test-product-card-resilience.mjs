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

assert(cards.includes("grid-template-columns:76px minmax(0,1fr) auto"), "product text column must be allowed to shrink instead of overflowing");
assert(cards.includes("overflow-wrap:anywhere"), "long product names and price text must wrap safely");
assert(cards.includes("@media (max-width:380px)"), "very narrow Android product cards need an explicit layout guard");
assert(cards.includes("grid-template-columns:64px minmax(0,1fr) auto"), "360px product cards must use a compact thumbnail column");
assert(cards.includes("width:40px!important") && cards.includes("height:40px!important"), "compact layout must preserve quantity touch targets");
assert(cards.includes("object-fit:contain"), "product imagery must remain contain-fit in its visual frame");

assert(!productUI.includes("TDBai") && !productUI.includes("bai-"), "product image resilience must stay independent from Bai");
assert(!cards.includes("bai-"), "product card layout must stay independent from Bai");

console.log("Product card resilience checks passed: aspect-safe images, multi-stage fallback and 360px layout guards are wired.");
