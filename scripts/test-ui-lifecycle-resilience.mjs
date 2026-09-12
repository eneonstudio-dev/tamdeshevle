import fs from "node:fs";

const productUI=fs.readFileSync("product-ui.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8");

function assert(condition,message){if(!condition)throw new Error(message);}

new Function(productUI);
new Function(polish);

assert(productUI.includes('window.addEventListener("pagehide",pause)'),"product UI must pause on every pagehide");
assert(productUI.includes('window.addEventListener("pageshow",resume)'),"product UI must resume after BFCache restore");
assert(!productUI.includes('pagehide",pause,{once:true}'),"product UI cleanup must not disappear after the first navigation");
assert(productUI.includes('window.addEventListener("online",retryImages)'),"product imagery must retry after connectivity returns");
assert(productUI.includes("delete card.dataset.productUiSignature"),"card image retry must invalidate decoration signature");
assert(productUI.includes("delete img.dataset.tdPreparedSource"),"tile image retry must invalidate prepared source signature");

assert(polish.includes('window.addEventListener("pageshow",hydrate)'),"V2 polish must rehydrate after BFCache restore");
assert(polish.includes('window.addEventListener("pagehide",()=>{'),"V2 polish must clean up pending animation work on pagehide");
assert(!polish.includes('}, {once:true})')&&!polish.includes('},{once:true})'),"V2 pagehide cleanup must remain active across repeated navigation cycles");
assert(polish.includes("cancelAnimationFrame(headerScrollFrame)"),"V2 polish must cancel pending scroll animation work when hidden or leaving");

assert(!productUI.includes("TDBai")&&!productUI.includes("bai-"),"product lifecycle recovery must remain independent from Bai");
assert(!polish.includes("TDBai")&&!polish.includes("bai-"),"V2 lifecycle cleanup must remain independent from Bai");

console.log("UI lifecycle resilience passed: product visuals and V2 polish recover across repeated Android/BFCache navigation and connectivity changes.");
