(function(){
  "use strict";
  const MAX_ADDRESS_DISTANCE_KM=.35;
  const normalize=v=>String(v||"").toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/g," ").trim();
  const tokens=v=>new Set(normalize(v).split(" ").filter(x=>x.length>1));

  function addressScore(a,b){
    const A=tokens(a),B=tokens(b);
    if(!A.size||!B.size)return 0;
    let hit=0;
    A.forEach(x=>{if(B.has(x))hit++});
    return hit/Math.max(A.size,B.size);
  }

  function distance(a,b){
    if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;
    const rad=x=>x*Math.PI/180,R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
    const raw=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
    const q=Math.min(1,Math.max(0,raw));
    return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
  }

  function candidates(point){
    if(!point||!point.chainId)return[];
    const runtime=window.TDRetailerPriceState;
    if(!runtime||!Array.isArray(runtime.overlays))return[];
    return runtime.overlays
      .filter(o=>o&&o.retailer===point.chainId&&o.storeContext&&typeof o.storeContext==="object")
      .map(o=>({
        overlay:o,
        ctx:o.storeContext,
        address:o.storeContext.address||"",
        storeId:o.storeContext.shop_code||o.storeContext.sap_code||o.storeContext.store_code||o.storeId||null,
        priceStoreId:o.priceStoreId||o.storeId||o.retailer||null
      }))
      .filter(x=>x.storeId&&x.priceStoreId);
  }

  function unresolved(){return{verified:false,method:null,storeId:null,priceStoreId:null,overlay:null,confidence:0};}
  function resolved(c,method,confidence){return{verified:true,method,storeId:String(c.storeId),priceStoreId:String(c.priceStoreId),overlay:c.overlay,confidence};}

  function resolve(point){
    if(!point||typeof point!=="object"||!point.chainId)return unresolved();
    const list=candidates(point);
    if(!list.length)return unresolved();
    const exactTag=point.osmTags&&(point.osmTags.ref||point.osmTags["ref:store"]||point.osmTags["brand:ref"]);
    for(const c of list){if(exactTag&&String(exactTag)===String(c.storeId))return resolved(c,"osm_store_ref",1);}
    let best=null;
    for(const c of list){
      const score=addressScore(point.address,c.address),km=distance(point,c.ctx),geoOk=km!=null&&km<=MAX_ADDRESS_DISTANCE_KM;
      const combined=score+(geoOk?.35:0);
      if(!best||combined>best.combined)best={c,score,km,combined};
    }
    if(best&&best.score>=.66&&(best.km==null||best.km<=MAX_ADDRESS_DISTANCE_KM))return resolved(best.c,"address_match",Number(Math.min(.99,.75+best.score*.2).toFixed(2)));
    return unresolved();
  }

  function channelFor(overlay){return overlay&&overlay.channel==="delivery_catalog"?"bring":"shelf";}

  function quote(point){
    const match=resolve(point);
    if(!match.verified)return{verified:false,text:"цена точки пока не подтверждена",match};
    const o=match.overlay;
    if(!o||!o.usable)return{verified:false,text:"точка привязана, но цены сейчас недоступны",match};
    const count=Number(o.count||0),verified=Number.isFinite(count)&&count>0;
    return{verified,text:verified?`точка привязана · ${Math.floor(count)} подтвержд. цен`:`точка привязана · ждём цены`,match};
  }

  function verifiedLines(products,cart,priceStoreId,channel){
    const list=Array.isArray(products)?products:[];
    const basket=cart&&typeof cart==="object"&&!Array.isArray(cart)?cart:{};
    const entries=window.TDCompare&&typeof window.TDCompare.cartEntries==="function"
      ?window.TDCompare.cartEntries(list,basket)
      :list.filter(p=>Number(basket[p&&p.id])>0);
    return entries.filter(Boolean).map(product=>{
      const rawQty=Number(basket[product.id]),qtyValid=Number.isInteger(rawQty)&&rawQty>0&&rawQty<=99,qty=qtyValid?rawQty:0;
      const meta=window.TDCompare&&typeof window.TDCompare.priceMeta==="function"?window.TDCompare.priceMeta(product,priceStoreId,channel):null;
      const sourceVerified=Boolean(window.TDCompare&&typeof window.TDCompare.isVerifiedPrice==="function"&&window.TDCompare.isVerifiedPrice(product,priceStoreId,channel));
      const rawPrice=sourceVerified&&window.TDCompare&&typeof window.TDCompare.unitPrice==="function"?window.TDCompare.unitPrice(product,priceStoreId,channel):null;
      const priceValid=Number.isFinite(rawPrice)&&rawPrice>0;
      const verified=sourceVerified&&qtyValid&&priceValid;
      const price=verified?rawPrice:null;
      return{
        id:product.id,
        name:product.name||product.id,
        pack:product.pack||"",
        qty,
        verified,
        price,
        subtotal:verified?price*qty:null,
        meta:verified&&meta?{
          checkedAt:meta.checkedAt||null,
          freshness:meta.freshness||null,
          sourceUrl:meta.sourceUrl||null,
          retailerName:meta.retailerName||null,
          retailerProductId:meta.retailerProductId||null,
          promo:Boolean(meta.promo),
          oldPrice:Number.isFinite(meta.oldPrice)&&meta.oldPrice>0?meta.oldPrice:null
        }:null
      };
    });
  }

  function basket(point,options){
    const opts=options||{},match=resolve(point),products=Array.isArray(opts.products)?opts.products:[],cart=opts.cart&&typeof opts.cart==="object"&&!Array.isArray(opts.cart)?opts.cart:{};
    const result={verified:false,reason:null,match,channel:null,quote:null,total:null,partialTotal:null,coveredItems:0,totalItems:0,coverage:0,savings:null,referenceTotal:null,items:[]};
    if(!match.verified){result.reason="unresolved_point";return result;}
    if(!match.overlay||!match.overlay.usable){result.reason="prices_unavailable";return result;}
    if(!window.TDCompare){result.reason="comparison_unavailable";return result;}
    const channel=channelFor(match.overlay),items=verifiedLines(products,cart,match.priceStoreId,channel),coveredItems=items.filter(x=>x.verified).length,totalItems=items.length;
    const partialTotal=items.reduce((sum,x)=>sum+(Number.isFinite(x.subtotal)?x.subtotal:0),0),complete=totalItems>0&&totalItems===coveredItems;
    Object.assign(result,{verified:complete,reason:totalItems?complete?null:"partial":"empty_cart",channel,total:complete?partialTotal:null,partialTotal,coveredItems,totalItems,coverage:totalItems?coveredItems/totalItems:0,items});
    const referenceStoreId=opts.referenceStoreId;
    if(referenceStoreId&&complete){
      const stores=Array.isArray(opts.stores)?opts.stores:[],referenceStore=stores.find(s=>s&&s.id===referenceStoreId),referenceChannel=referenceStore&&window.TDCompare.defaultChannel?window.TDCompare.defaultChannel(referenceStore):"shelf";
      const rq=window.TDCompare.basketQuote(products,cart,referenceStoreId,referenceChannel);
      if(rq&&rq.verifiedComplete&&Number.isFinite(rq.goods)){result.referenceTotal=rq.goods;result.savings=rq.goods-partialTotal;}
    }
    return result;
  }

  window.TDStoreIdBridge={resolve,quote,basket,addressScore,distance};
  window.dispatchEvent(new CustomEvent("td:store-id-bridge-ready"));
})();
