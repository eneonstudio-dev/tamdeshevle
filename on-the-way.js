(function(){
  "use strict";
  const WALK_KMH=4.5,ROUTE_FACTOR=1.25,MAX_DETOUR_MIN=12,MIN_SAVINGS_RUB=100,MIN_RUB_PER_DETOUR_MIN=12,GEOCODE_TIMEOUT_MS=8000;
  let destination=null,lastAddress="",raf=0,started=false;

  function haversine(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;const rad=x=>x*Math.PI/180,R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function evaluate(input){
    const origin=input&&input.origin,dest=input&&input.destination,store=input&&input.store,savings=Number(input&&input.savings),verified=Boolean(input&&input.verified);
    if(!verified||!origin||!dest||!store||!Number.isFinite(savings))return{state:"unknown",onWay:null,detourKm:null,detourMinutes:null,rubPerDetourMin:null,title:"Маршрут пока не считаем",text:"Нужны точка назначения, подтверждённая корзина и экономия."};
    const direct=haversine(origin,dest),a=haversine(origin,store),b=haversine(store,dest);if(![direct,a,b].every(Number.isFinite))return{state:"unknown",onWay:null,detourKm:null,detourMinutes:null,rubPerDetourMin:null,title:"Маршрут пока не считаем",text:"Не хватает координат."};
    const detourKm=Math.max(0,a+b-direct),detourMinutes=Math.max(0,Math.round(detourKm/WALK_KMH*60*ROUTE_FACTOR)),rubPerDetourMin=detourMinutes===0?savings:Math.round(savings/detourMinutes);
    if(savings<=0)return{state:"no_saving",onWay:false,detourKm,detourMinutes,rubPerDetourMin,title:"По пути, но не дешевле",text:`Крюк около ${detourMinutes} мин, подтверждённой экономии нет.`};
    const onWay=detourMinutes<=MAX_DETOUR_MIN&&savings>=MIN_SAVINGS_RUB&&rubPerDetourMin>=MIN_RUB_PER_DETOUR_MIN;
    return{state:onWay?"on_way":"detour",onWay,detourKm,detourMinutes,rubPerDetourMin,title:onWay?"По пути — стоит зайти":"Крюк уже спорный",text:onWay?`Крюк примерно ${detourMinutes} мин · экономия ${Math.round(savings)} ₽ · ${rubPerDetourMin} ₽ за минуту крюка.`:`Крюк примерно ${detourMinutes} мин · экономия ${Math.round(savings)} ₽. Для «по пути» держим до ${MAX_DETOUR_MIN} мин и минимум ${MIN_SAVINGS_RUB} ₽.`};
  }
  function referenceStore(point){const selected=point&&point.referenceStoreId,current=window.state&&state.storeId,chain=point&&point.chainId;if(selected&&selected!==chain)return selected;if(current&&current!==chain)return current;return null;}
  function basketFor(point){if(!point||!window.TDStoreIdBridge||typeof TDStoreIdBridge.basket!=="function")return null;try{return TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:referenceStore(point)});}catch{return null;}}
  function forPoint(point){const b=basketFor(point),origin=window.TDGeo&&TDGeo.position;return evaluate({origin,destination,store:point,savings:b&&b.savings,verified:Boolean(b&&b.verified)});}
  async function geocode(address){
    const q=String(address||"").trim();if(!q)throw new Error("empty_address");
    const controller=typeof AbortController==="function"?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),GEOCODE_TIMEOUT_MS):0;
    try{
      const res=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q="+encodeURIComponent(q),{headers:{"Accept":"application/json"},signal:controller&&controller.signal});
      if(!res.ok)throw new Error("geocode_"+res.status);const rows=await res.json(),hit=rows&&rows[0];if(!hit)throw new Error("not_found");
      const lat=Number(hit.lat),lon=Number(hit.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("not_found");
      return{lat,lon,label:hit.display_name||q};
    }catch(error){if(error&&error.name==="AbortError")throw new Error("timeout");throw error;}finally{if(timer)clearTimeout(timer);}
  }
  function ensureCss(){if(document.getElementById("td-way-style"))return;const s=document.createElement("style");s.id="td-way-style";s.textContent='.td-way-btn{border:0;border-radius:12px;padding:9px 10px;background:#fff;font:800 11px Manrope,sans-serif;cursor:pointer;white-space:nowrap}.td-way-status{margin-top:7px;border-radius:11px;padding:7px 9px;font-size:10px;font-weight:850;line-height:1.35;background:#eef1f4;color:#4d5965}.td-way-status.on_way{background:#e7f6ec;color:#0f7b4a}.td-way-status.detour{background:#fff4d6;color:#7a5900}.td-way-destination{font-size:10px;color:#6b6458;margin:6px 0 0;font-weight:700}';document.head.appendChild(s);}
  function decorate(){ensureCss();if(!destination||!window.TDGeo)return;const points=TDGeo.nearby||[],cards=document.querySelectorAll('.td-map-list .td-map-store');cards.forEach((card,i)=>{card.querySelector('.td-way-status')?.remove();const p=points[i];if(!p)return;const v=forPoint(p);if(v.state==='unknown')return;const main=card.querySelector('.td-map-store-main')||card,el=document.createElement('div');el.className=`td-way-status ${v.state}`;el.textContent=v.title+(Number.isFinite(v.detourMinutes)?` · +${v.detourMinutes} мин`:"");main.appendChild(el);});}
  function decorateHeader(){const head=document.querySelector('.td-map-head');if(!head||head.querySelector('[data-way-btn]'))return;const btn=document.createElement('button');btn.type='button';btn.className='td-way-btn';btn.dataset.wayBtn='1';btn.textContent='По пути';btn.addEventListener('click',chooseDestination);head.appendChild(btn);if(destination){const info=document.createElement('div');info.className='td-way-destination';info.textContent='Куда: '+(destination.label||lastAddress);head.appendChild(info);}}
  async function chooseDestination(){let address=(window.state&&state.address||"").trim();if(!address)address=window.prompt('Куда идёшь? Введи адрес назначения')||"";if(!address)return;const buttons=document.querySelectorAll('[data-way-btn]');buttons.forEach(b=>{b.disabled=true;b.textContent='Ищем…';});try{destination=await geocode(address);lastAddress=address;if(window.state){state.address=address;if(typeof window.persist==='function')window.persist();}buttons.forEach(b=>{b.disabled=false;b.textContent='По пути ✓';});decorate();document.querySelectorAll('.td-way-destination').forEach(n=>n.remove());const head=document.querySelector('.td-map-head');if(head){const info=document.createElement('div');info.className='td-way-destination';info.textContent='Куда: '+address;head.appendChild(info);}}catch(err){buttons.forEach(b=>{b.disabled=false;b.textContent='По пути';});const message=err&&err.message==='not_found'?'Адрес не нашли. Попробуй уточнить.':err&&err.message==='timeout'?'Сервис маршрута отвечает слишком долго. Попробуй ещё раз.':'Не удалось построить направление сейчас.';window.alert(message);}}
  function injectButtons(){ensureCss();const actions=document.querySelector('.td-geo-actions');if(actions&&!actions.querySelector('[data-way-btn]')){const btn=document.createElement('button');btn.type='button';btn.className='td-way-btn';btn.dataset.wayBtn='1';btn.textContent=destination?'По пути ✓':'По пути';btn.addEventListener('click',async()=>{if(!window.TDGeo||!TDGeo.position){if(TDGeo&&typeof TDGeo.locate==='function')TDGeo.locate();return;}await chooseDestination();if(typeof TDGeo.openMap==='function')TDGeo.openMap();});actions.appendChild(btn);}decorateHeader();decorate();}
  function scheduleInject(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{raf=0;injectButtons();});}
  const obs=new MutationObserver(scheduleInject);
  function start(){if(started)return;started=true;ensureCss();const root=document.getElementById('app')||document.body;if(root)obs.observe(root,{childList:true,subtree:true});scheduleInject();}
  function stop(){if(!started)return;started=false;obs.disconnect();cancelAnimationFrame(raf);raf=0;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',start);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){cancelAnimationFrame(raf);raf=0;}else if(started)scheduleInject();else start();});
  window.addEventListener('td:retailer-prices-applied',scheduleInject);
  window.addEventListener('td:selected-store-point',scheduleInject);
  window.addEventListener('td:selected-store-point-cleared',scheduleInject);
  window.TDOnTheWay={evaluate,haversine,geocode,forPoint,referenceStore,get destination(){return destination;},setDestination(v){destination=v;scheduleInject();},policy:{walkKmh:WALK_KMH,routeFactor:ROUTE_FACTOR,maxDetourMin:MAX_DETOUR_MIN,minSavingsRub:MIN_SAVINGS_RUB,minRubPerDetourMin:MIN_RUB_PER_DETOUR_MIN,geocodeTimeoutMs:GEOCODE_TIMEOUT_MS}};
})();
