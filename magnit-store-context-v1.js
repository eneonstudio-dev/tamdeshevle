(()=>{
  "use strict";
  const HOST=/(^|\.)magnit\.ru$/i;
  const CONTEXTS=Object.freeze([
    Object.freeze({chainId:"magnit",shopCode:"770105",shopType:"1",address:"г Москва, ул Чертановская, д 47 к 2",addressTokens:["чертановская","47"]})
  ]);
  function norm(v){return String(v||"").toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/g," ").replace(/\s+/g," ").trim()}
  function selected(){try{return JSON.parse(localStorage.getItem("td:selected-store-point")||"null")}catch{return null}}
  function get(){const point=selected();if(!point||point.chainId!=="magnit")return{retailer:"magnit",verified:false,reason:"no_selected_magnit_point",point:null};const address=norm(point.address);const match=CONTEXTS.find(x=>x.addressTokens.every(t=>address.includes(norm(t))));if(!match)return{retailer:"magnit",verified:false,reason:"selected_point_not_mapped",point};return{retailer:"magnit",verified:true,reason:"verified_address_match",point,shopCode:match.shopCode,shopType:match.shopType,address:match.address}}
  function apply(url){try{const u=new URL(String(url||""),location.href);if(!HOST.test(u.hostname))return url;u.searchParams.delete("shopCode");u.searchParams.delete("shopType");const ctx=get();if(ctx.verified){u.searchParams.set("shopCode",ctx.shopCode);u.searchParams.set("shopType",ctx.shopType)}return u.href}catch{return url}}
  function label(){const ctx=get();if(ctx.verified)return`Точка подтверждена · ${ctx.address}`;if(ctx.reason==="selected_point_not_mapped")return"Выбранная точка пока без подтверждённого shopCode";return"Точка Магнита не выбрана"}
  window.TDMagnitStoreContextV1={get,apply,label,contexts:CONTEXTS};
})();