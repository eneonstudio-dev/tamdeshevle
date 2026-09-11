(function(){
  "use strict";
  const FACTOR={г:1,кг:1000,мл:1,л:1000,"шт":1,"пак":1};
  function parse(pack){const m=String(pack||"").toLowerCase().replace(",",".").match(/(\d+(?:\.\d+)?)\s*(кг|г|мл|л|шт|пак)/);if(!m)return null;const raw=m[2],base=raw==="кг"||raw==="г"?"г":raw==="л"||raw==="мл"?"мл":"шт";return{value:Number(m[1])*FACTOR[raw],base};}
  function quote(product,price){const p=parse(product?.pack),n=Number(price);if(!p||!Number.isFinite(n)||n<=0)return null;const scale=p.base==="г"||p.base==="мл"?1000:1;return{value:n/p.value*scale,label:p.base==="г"?"кг":p.base==="мл"?"л":"шт"};}
  function format(product,price){const q=quote(product,price);return q?`${Math.round(q.value).toLocaleString("ru-RU")} ₽/${q.label}`:"";}
  function decorate(){document.querySelectorAll(".item,.product-card").forEach(card=>{if(card.querySelector("[data-unit-price]"))return;const p=window.PRODUCTS?.find(x=>card.textContent.includes(x.name));if(!p)return;const s=window.STORES?.find(x=>x.id===window.state?.storeId);const price=window.TDCompare?.unitPrice(p,s?.id,window.TDCompare?.defaultChannel(s));const label=format(p,price);const pack=card.querySelector(".pack");if(label&&pack)pack.insertAdjacentHTML("beforeend",` <span data-unit-price>· ${label}</span>`);});}
  window.addEventListener("td:runtime-ready",()=>requestAnimationFrame(decorate));document.addEventListener("click",()=>requestAnimationFrame(decorate));if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>requestAnimationFrame(decorate),{once:true});else requestAnimationFrame(decorate);
  window.TDUnitEconomics={parse,quote,format,decorate};
})();
