(function(){
  "use strict";
  const DELIVERY={pyat:"https://5ka.ru/",magnit:"https://magnit.ru/",perek:"https://www.perekrestok.ru/",lenta:"https://lenta.com/",dixy:"https://dixy.ru/shop-map/",lavka:"https://lavka.yandex.ru/",vprok:"https://www.vprok.ru/"};
  const LOCK_MS=1500;
  let lockKey="",lockAt=0;
  function plan(storeId,channel){return window.TDCompare?.fromWindow().find(x=>x.id===storeId&&x.channel===channel)||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch{}}
  function feedback(message,tone="warn"){
    if(typeof document==="undefined"||!document.body||!message)return false;
    let node=document.getElementById("td-purchase-feedback");
    if(!node){
      node=document.createElement("div");node.id="td-purchase-feedback";node.setAttribute("role",tone==="error"?"alert":"status");node.setAttribute("aria-live",tone==="error"?"assertive":"polite");
      Object.assign(node.style,{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:"calc(84px + env(safe-area-inset-bottom))",zIndex:"140",width:"min(398px,calc(100% - 32px))",padding:"11px 13px",borderRadius:"14px",background:"#161410",color:"#fff",font:"700 12px Manrope,system-ui,sans-serif",lineHeight:"1.45",boxShadow:"0 12px 28px rgba(22,20,16,.22)"});
      document.body.appendChild(node);
    }
    node.dataset.tone=tone;node.textContent=String(message);node.hidden=false;return true;
  }
  function clearFeedback(){if(typeof document==="undefined")return;const node=document.getElementById("td-purchase-feedback");if(node)node.hidden=true;}
  function blocked(reason,storeId,channel,message){emit("td:purchase-blocked",{reason,storeId,channel});if(message)feedback(message,reason==="handoff_error"?"error":"warn");return false;}
  function record(p){
    try{
      return window.TDSavingsLedger?.record?.({storeId:p.id,storeName:p.name,total:p.total,saving:Math.max(0,Number(p.save)||0),verified:p.verifiedComplete===true,channel:p.channel,cart:{...(window.state?.cart||{})}})||null;
    }catch(error){console.warn("Savings ledger unavailable; retailer handoff continues",error);return null}
  }
  function start(storeId,channel){
    const key=`${String(storeId||"")}:${String(channel||"")}`,now=Date.now();
    if(key===lockKey&&now-lockAt<LOCK_MS)return blocked("duplicate",storeId,channel);
    const p=plan(storeId,channel);
    if(!p||!p.rankable||!Number.isFinite(p.total)){
      return blocked("incomplete",storeId,channel,"Для перехода нужен полный подтверждённый расчёт этой корзины. Проверь цены или выбери другой вариант.");
    }
    lockKey=key;lockAt=now;clearFeedback();record(p);
    emit("td:purchase-started",{storeId,channel,total:p.total,saving:p.save,verified:p.verifiedComplete===true});
    if(channel==="bring"&&DELIVERY[storeId]){
      try{window.open(DELIVERY[storeId],"_blank","noopener,noreferrer");return true}catch(error){console.warn("Retailer handoff failed",error);lockKey="";lockAt=0;return blocked("handoff_error",storeId,channel,"Не получилось открыть сайт магазина. Попробуй ещё раз.")}
    }
    if(window.TDGeo?.openMap){
      try{window.TDGeo.openMap();return true}catch(error){console.warn("Store map handoff failed",error)}
    }
    if(typeof window.choosePlan==="function"){
      try{return window.choosePlan(storeId,channel)!==false}catch(error){console.warn("Plan selection fallback failed",error)}
    }
    lockKey="";lockAt=0;
    return blocked("handoff_error",storeId,channel,"Следующий шаг сейчас недоступен. Корзина сохранена — можно выбрать другой вариант.");
  }
  window.TDPurchase={start,plan,feedback,deliveryLinks:{...DELIVERY},get locked(){return Boolean(lockKey&&Date.now()-lockAt<LOCK_MS)}};
})();
