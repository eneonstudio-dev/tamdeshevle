(function(){
  "use strict";
  const DELIVERY={lavka:"https://lavka.yandex.ru/",vprok:"https://www.vprok.ru/"};
  function plan(storeId,channel){return window.TDCompare?.fromWindow().find(x=>x.id===storeId&&x.channel===channel)||null;}
  function start(storeId,channel){
    const p=plan(storeId,channel);
    if(!p||!p.rankable||!Number.isFinite(p.total)){window.TDBai?.setState("suspicious","Сначала нужна подтверждённая полная корзина",2600);return false;}
    window.TDSavingsLedger?.record({storeId:p.id,storeName:p.name,total:p.total,saving:Math.max(0,Number(p.save)||0),verified:p.verifiedComplete===true,channel:p.channel,cart:{...(window.state?.cart||{})}});
    window.dispatchEvent(new CustomEvent("td:purchase-started",{detail:{storeId,channel,total:p.total,saving:p.save,verified:true}}));
    if(channel==="bring"&&DELIVERY[storeId]){window.open(DELIVERY[storeId],"_blank","noopener,noreferrer");return true;}
    if(window.TDGeo?.openMap){window.TDGeo.openMap();return true;}
    if(typeof window.choosePlan==="function")window.choosePlan(storeId);return true;
  }
  window.TDPurchase={start,plan,deliveryLinks:{...DELIVERY}};
})();
