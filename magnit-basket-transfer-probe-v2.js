(()=>{
  "use strict";
  const HOST=/(^|\.)magnit\.ru$/i;
  function official(url){try{const u=new URL(String(url||""),location.href);return u.protocol==="https:"&&HOST.test(u.hostname)&&/^\/product\/\d+-/.test(u.pathname)?u.href:null}catch{return null}}
  function status(){return Object.freeze({retailer:"magnit",publicCartDeepLink:false,bulkProductOpen:true,reason:"no_verified_public_cart_deeplink",note:"Публичный стабильный URL для наполнения корзины не подтверждён. Можно одним нажатием открыть точные карточки товаров в выбранной точке."})}
  function prepare(items=[]){const ctx=window.TDMagnitStoreContextV1?.get?.()||{verified:false};const exact=(items||[]).map(item=>{const raw=official(item.url);if(!raw||!item.retailerProductId)return null;const url=window.TDMagnitStoreContextV1?.apply?.(raw)||raw;return{key:item.id||item.name,name:item.name,productId:String(item.retailerProductId),url}}).filter(Boolean);return{...status(),storeVerified:Boolean(ctx.verified),store:ctx,exact,total:(items||[]).length,ready:exact.length>0}}
  function openAll(items=[]){const plan=prepare(items);let opened=0,blocked=0;for(const item of plan.exact){const tab=window.open(item.url,"_blank","noopener,noreferrer");if(tab)opened++;else blocked++}return{...plan,opened,blocked}}
  window.TDMagnitBasketTransferProbeV2={status,prepare,openAll};
})();