(()=>{
  "use strict";
  const HOST=/(^|\.)magnit\.ru$/i;
  function status(){return Object.freeze({retailer:"magnit",sharedRetailerSession:true,directCartRead:false,directCartWrite:false,reason:"cross_origin_cart_state_unavailable",note:"Карточки Магнита открываются на одном официальном origin, поэтому сам Магнит может сохранять корзину своей сессией. «Проще» не читает cookie/localStorage Магнита и не считает открытие карточки добавлением."})}
  function sameOriginItems(items=[]){return(items||[]).filter(x=>{try{const u=new URL(String(x.url||""),location.href);return u.protocol==="https:"&&HOST.test(u.hostname)&&/^\/product\/\d+-/.test(u.pathname)}catch{return false}})}
  function prepare(items=[]){const exact=sameOriginItems(items);return{...status(),exact,total:(items||[]).length,ready:exact.length>0,instruction:exact.length>1?"Открой первую карточку, добавь товар в корзину Магнита и продолжай по следующим карточкам. Корзина остаётся на стороне Магнита.":"Открой карточку и добавь товар в корзину Магнита."}}
  window.TDMagnitCartSessionProbeV1={status,prepare};
})();