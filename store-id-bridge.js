(function(){
  "use strict";
  const MAX_ADDRESS_DISTANCE_KM=.35;
  const normalize=v=>String(v||"").toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/g," ").trim();
  const tokens=v=>new Set(normalize(v).split(" ").filter(x=>x.length>1));
  function addressScore(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size);}
  function distance(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;const rad=x=>x*Math.PI/180,R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function candidates(point){const runtime=window.TDRetailerPriceState;if(!runtime||!Array.isArray(runtime.overlays))return[];return runtime.overlays.filter(o=>o.retailer===point.chainId&&o.storeContext).map(o=>({overlay:o,ctx:o.storeContext,address:o.storeContext.address||"",storeId:o.storeContext.shop_code||o.storeContext.sap_code||o.storeContext.store_code||o.storeId||null})).filter(x=>x.storeId);}
  function resolve(point){const exactTag=point&&point.osmTags&&(point.osmTags.ref||point.osmTags["ref:store"]||point.osmTags["brand:ref"]);for(const c of candidates(point)){if(exactTag&&String(exactTag)===String(c.storeId))return{verified:true,method:"osm_store_ref",storeId:String(c.storeId),overlay:c.overlay,confidence:1};}
    let best=null;for(const c of candidates(point)){const score=addressScore(point.address,c.address);const km=distance(point,c.ctx);const geoOk=km!=null&&km<=MAX_ADDRESS_DISTANCE_KM;const combined=score+(geoOk?.35:0);if(!best||combined>best.combined)best={c,score,km,combined};}
    if(best&&best.score>=.66&&(best.km==null||best.km<=MAX_ADDRESS_DISTANCE_KM))return{verified:true,method:"address_match",storeId:String(best.c.storeId),overlay:best.c.overlay,confidence:Number(Math.min(.99,.75+best.score*.2).toFixed(2))};
    return{verified:false,method:null,storeId:null,overlay:null,confidence:0};
  }
  function quote(point){const match=resolve(point);if(!match.verified)return{verified:false,text:"цена точки пока не подтверждена",match};const o=match.overlay;if(!o.usable)return{verified:false,text:"точка привязана, но цены сейчас недоступны",match};const count=Number(o.count||0);return{verified:count>0,text:count>0?`точка привязана · ${count} подтвержд. цен`:`точка привязана · ждём цены`,match};}
  window.TDStoreIdBridge={resolve,quote,addressScore};
  window.dispatchEvent(new CustomEvent("td:store-id-bridge-ready"));
})();
