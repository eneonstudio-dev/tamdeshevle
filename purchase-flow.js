(function(){
  "use strict";
  const DELIVERY={pyat:"https://5ka.ru/",magnit:"https://magnit.ru/",perek:"https://www.perekrestok.ru/",lenta:"https://lenta.com/",dixy:"https://dixy.ru/shop-map/",lavka:"https://lavka.yandex.ru/",vprok:"https://www.vprok.ru/"};
  const LOCK_MS=1500;
  let lockKey="",lockAt=0;
  function plan(storeId,channel){return window.TDCompare?.fromWindow().find(x=>x.id===storeId&&x.channel===channel)||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch{}}
  function blocked(reason,storeId,channel){emit("td:purchase-blocked",{reason,storeId,channel});return false;}
  function start(storeId,channel){
    const key=`${String(storeId||"")}:${String(channel||"")}`,now=Date.now();
    if(key===lockKey&&now-lockAt<LOCK_MS)return blocked("duplicate",storeId,channel);
    const p=plan(storeId,channel);
    if(!p||!p.rankable||!Number.isFinite(p.total)){
      window.TDBai?.setState("suspicious","Сначала нужна подтверждённая полная корзина",2600);
      return blocked("incomplete",storeId,channel);
    }
    lockKey=key;lockAt=now;
    window.TDSavingsLedger?.record({storeId:p.id,storeName:p.name,total:p.total,saving:Math.max(0,Number(p.save)||0),verified:p.verifiedComplete===true,channel:p.channel,cart:{...(window.state?.cart||{})}});
    emit("td:purchase-started",{storeId,channel,total:p.total,saving:p.save,verified:true});
    if(channel==="bring"&&DELIVERY[storeId]){window.open(DELIVERY[storeId],"_blank","noopener,noreferrer");return true;}
    if(window.TDGeo?.openMap){window.TDGeo.openMap();return true;}
    if(typeof window.choosePlan==="function")window.choosePlan(storeId);return true;
  }
  window.TDPurchase={start,plan,deliveryLinks:{...DELIVERY},get locked(){return Boolean(lockKey&&Date.now()-lockAt<LOCK_MS)}};
})();
