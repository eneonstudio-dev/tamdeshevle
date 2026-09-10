(function(){
  "use strict";
  const WALK_KMH=4.5,ROUTE_FACTOR=1.25,MIN_SAVINGS_RUB=150,MIN_RUB_PER_TRAVEL_MIN=8;
  let activePointIndex=null;

  function evaluate(input){
    const distanceKm=Number(input&&input.distanceKm),savings=Number(input&&input.savings),verified=Boolean(input&&input.verified);
    if(!verified||!Number.isFinite(distanceKm)||distanceKm<0||!Number.isFinite(savings))return{state:"unknown",worth:null,walkMinutes:null,roundTripMinutes:null,rubPerMinute:null,title:"Пока не считаем",text:"Нужны подтверждённая корзина, экономия и расстояние до точки."};
    const walkMinutes=Math.max(1,Math.round(distanceKm/WALK_KMH*60*ROUTE_FACTOR));
    const roundTripMinutes=walkMinutes*2;
    const rubPerMinute=roundTripMinutes?Math.round(savings/roundTripMinutes):null;
    if(savings<=0)return{state:"no_saving",worth:false,walkMinutes,roundTripMinutes,rubPerMinute,title:"Идти ради цены не стоит",text:`Здесь нет подтверждённой экономии. Пешком примерно ${walkMinutes} мин в одну сторону.`};
    const worth=savings>=MIN_SAVINGS_RUB&&rubPerMinute>=MIN_RUB_PER_TRAVEL_MIN;
    return{state:worth?"worth":"marginal",worth,walkMinutes,roundTripMinutes,rubPerMinute,title:worth?"Стоит идти":"Экономия есть, но крюк спорный",text:worth?`Экономия ${Math.round(savings)} ₽ · около ${walkMinutes} мин пешком в одну сторону · ${rubPerMinute} ₽ экономии за минуту дороги.`:`Экономия ${Math.round(savings)} ₽ · около ${walkMinutes} мин пешком в одну сторону. Для рекомендации нужно хотя бы ${MIN_SAVINGS_RUB} ₽ и ${MIN_RUB_PER_TRAVEL_MIN} ₽ за минуту дороги.`};
  }

  function basketFor(point){
    if(!point||!window.TDStoreIdBridge||typeof TDStoreIdBridge.basket!=="function")return null;
    return TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId});
  }
  function forPoint(point){const b=basketFor(point);return evaluate({distanceKm:point&&point.distanceKm,savings:b&&b.savings,verified:Boolean(b&&b.verified)});}
  function ensureCss(){if(document.getElementById("td-worth-style"))return;const s=document.createElement("style");s.id="td-worth-style";s.textContent='.td-worth{margin-top:7px;border-radius:11px;padding:7px 9px;font-size:10px;font-weight:850;line-height:1.35;background:#f1ede6;color:#5f584e}.td-worth.worth{background:#e7f6ec;color:#0f7b4a}.td-worth.marginal{background:#fff4d6;color:#7a5900}.td-worth-detail{margin:0 0 12px;border-radius:15px;padding:12px;background:#fff}.td-worth-detail b{display:block;font-size:13px;margin-bottom:4px}.td-worth-detail p{font-size:11px;line-height:1.45;color:#6b6458;margin:0}.td-worth-detail.worth{background:#e7f6ec}.td-worth-detail.marginal{background:#fff4d6}';document.head.appendChild(s);}
  function decorateList(){
    ensureCss();if(!window.TDGeo||!Array.isArray(TDGeo.nearby))return;const points=TDGeo.nearby,cards=document.querySelectorAll('.td-map-list .td-map-store');cards.forEach((card,i)=>{card.querySelector('.td-worth')?.remove();const point=points[i];if(!point)return;const v=forPoint(point);if(v.state==='unknown')return;const main=card.querySelector('.td-map-store-main')||card;const el=document.createElement('div');el.className=`td-worth ${v.state}`;el.textContent=v.title+(v.walkMinutes?` · ${v.walkMinutes} мин пешком`:'');main.appendChild(el);});
  }
  function decorateDetail(){
    ensureCss();const panel=document.querySelector('.td-point-panel');if(!panel||panel.querySelector('.td-worth-detail')||activePointIndex==null||!window.TDGeo)return;const point=TDGeo.nearby[activePointIndex];if(!point)return;const v=forPoint(point);if(v.state==='unknown')return;const el=document.createElement('div');el.className=`td-worth-detail ${v.state}`;el.innerHTML=`<b>${v.title}</b><p>${v.text}</p>`;const summary=panel.querySelector('.td-point-summary');if(summary)summary.insertAdjacentElement('afterend',el);else panel.prepend(el);
  }
  document.addEventListener('click',e=>{const btn=e.target&&e.target.closest&&e.target.closest('[data-point-index]');if(btn)activePointIndex=Number(btn.dataset.pointIndex);},true);
  const obs=new MutationObserver(()=>{requestAnimationFrame(()=>{decorateList();decorateDetail();});});
  function start(){ensureCss();obs.observe(document.body,{childList:true,subtree:true});decorateList();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('td:retailer-prices-applied',decorateList);
  window.TDWorthIt={evaluate,forPoint,policy:{walkKmh:WALK_KMH,routeFactor:ROUTE_FACTOR,minSavingsRub:MIN_SAVINGS_RUB,minRubPerTravelMin:MIN_RUB_PER_TRAVEL_MIN}};
})();
