(()=>{
  "use strict";
  const HOST=/(^|\.)perekrestok\.ru$/i;
  function exact(url){try{const u=new URL(String(url||""),location.href);if(u.protocol!=="https:"||!HOST.test(u.hostname))return null;const m=u.pathname.match(/^\/cat\/\d+\/p\/.+-(\d+)\/?$/i);return m?{url:u.href,productId:m[1]}:null}catch{return null}}
  function match(product){const meta=window.TDPriceMeta?.get?.(product.id,product.storeId,"shelf")||window.TDPriceMeta?.get?.(product.id,"perek","shelf")||window.TDPriceMeta?.getEstimated?.(product.id,"perek","shelf")||null;const hit=exact(meta?.sourceUrl||product.sourceUrl||product.source_url);return hit?{retailer:"perek",verified:true,method:"official_product_url",name:product.name,...hit}:null}
  function prepare(items=[]){const exactItems=(items||[]).map(item=>{const hit=item.retailerProductId&&exact(item.url);return hit?{key:item.id||item.name,name:item.name,productId:String(item.retailerProductId),url:hit.url}:null}).filter(Boolean);return{retailer:"perek",publicCartDeepLink:false,exact:exactItems,total:(items||[]).length,ready:exactItems.length>0,note:"Точные карточки Перекрёстка можно открыть напрямую. Автоматическое наполнение корзины публичным стабильным deep-link не подтверждено."}}
  function openAll(items=[]){const plan=prepare(items);let opened=0,blocked=0;for(const item of plan.exact){const tab=window.open(item.url,"_blank","noopener,noreferrer");if(tab)opened++;else blocked++}return{...plan,opened,blocked}}
  window.TDPerekrestokProductFlowV1={exact,match,prepare,openAll};
})();
