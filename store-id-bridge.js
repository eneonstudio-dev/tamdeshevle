(function(){
  "use strict";
  const MAX_ADDRESS_DISTANCE_KM=.35;
  const normalize=v=>String(v||"").toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/g," ").trim();
  const tokens=v=>new Set(normalize(v).split(" ").filter(x=>x.length>1));
  function addressScore(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size);}
  function distance(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;const rad=x=>x*Math.PI/180,R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function candidates(point){const runtime=window.TDRetailerPriceState;if(!runtime||!Array.isArray(runtime.overlays))return[];return runtime.overlays.filter(o=>o.retailer===point.chainId&&o.storeContext).map(o=>({overlay:o,ctx:o.storeContext,address:o.storeContext.address||"",storeId:o.storeContext.shop_code||o.storeContext.sap_code||o.storeContext.store_code||o.storeId||null,priceStoreId:o.priceStoreId||o.storeId||o.retailer})).filter(x=>x.storeId);}
  function resolved(c,method,confidence){return{verified:true,method,storeId:String(c.storeId),priceStoreId:String(c.priceStoreId),overlay:c.overlay,confidence};}
  function resolve(point){const exactTag=point&&point.osmTags&&(point.osmTags.ref||point.osmTags["ref:store"]||point.osmTags["brand:ref"]);for(const c of candidates(point)){if(exactTag&&String(exactTag)===String(c.storeId))return resolved(c,"osm_store_ref",1);}
    let best=null;for(const c of candidates(point)){const score=addressScore(point.address,c.address);const km=distance(point,c.ctx);const geoOk=km!=null&&km<=MAX_ADDRESS_DISTANCE_KM;const combined=score+(geoOk?.35:0);if(!best||combined>best.combined)best={c,score,km,combined};}
    if(best&&best.score>=.66&&(best.km==null||best.km<=MAX_ADDRESS_DISTANCE_KM))return resolved(best.c,"address_match",Number(Math.min(.99,.75+best.score*.2).toFixed(2)));
    return{verified:false,method:null,storeId:null,priceStoreId:null,overlay:null,confidence:0};
  }
  function channelFor(overlay){return overlay&&overlay.channel==="delivery_catalog"?"bring":"shelf";}
  function quote(point){const match=resolve(point);if(!match.verified)return{verified:false,text:"цена точки пока не подтверждена",match};const o=match.overlay;if(!o.usable)return{verified:false,text:"точка привязана, но цены сейчас недоступны",match};const count=Number(o.count||0);return{verified:count>0,text:count>0?`точка привязана · ${count} подтвержд. цен`:`точка привязана · ждём цены`,match};}
  function basket(point,options){
    const opts=options||{},match=resolve(point),products=opts.products||[],cart=opts.cart||{};
    const result={verified:false,match,channel:null,quote:null,total:null,partialTotal:null,coveredItems:0,totalItems:0,coverage:0,savings:null,referenceTotal:null};
    if(!match.verified||!match.overlay||!match.overlay.usable||!window.TDCompare||typeof window.TDCompare.basketQuote!=="function")return result;
    const channel=channelFor(match.overlay),q=window.TDCompare.basketQuote(products,cart,match.priceStoreId,channel);
    Object.assign(result,{verified:q.verifiedComplete,channel,quote:q,total:q.verifiedComplete?q.goods:null,partialTotal:q.partialGoods,coveredItems:q.verifiedItems,totalItems:q.totalItems,coverage:q.verifiedCoverage});
    const referenceStoreId=opts.referenceStoreId;
    if(referenceStoreId&&q.verifiedComplete){
      const stores=opts.stores||[],referenceStore=stores.find(s=>s.id===referenceStoreId),referenceChannel=referenceStore&&window.TDCompare.defaultChannel?window.TDCompare.defaultChannel(referenceStore):"shelf";
      const rq=window.TDCompare.basketQuote(products,cart,referenceStoreId,referenceChannel);
      if(rq.verifiedComplete){result.referenceTotal=rq.goods;result.savings=rq.goods-q.goods;}
    }
    return result;
  }
  window.TDStoreIdBridge={resolve,quote,basket,addressScore};
  window.dispatchEvent(new CustomEvent("td:store-id-bridge-ready"));
})();
