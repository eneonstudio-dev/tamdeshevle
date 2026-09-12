(function(){
  "use strict";
  const KEY="td:selected-store-point", POINT_VERSION=2;

  function safeText(value,max=160){
    const text=typeof value==="string"?value.trim():String(value==null?"":value).trim();
    return text&&text.length<=max?text:null;
  }

  function normalizePoint(raw){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
    const id=safeText(raw.id,180),chainId=safeText(raw.chainId,80),storeId=safeText(raw.storeId,120);
    if(!id||!chainId||!storeId)return null;
    const point={
      id,
      chainId,
      storeId,
      version:Number.isFinite(Number(raw.version))?Number(raw.version):1
    };
    const priceStoreId=safeText(raw.priceStoreId,120),address=safeText(raw.address,500),city=safeText(raw.city,40),referenceStoreId=safeText(raw.referenceStoreId,80),scopeMethod=safeText(raw.scopeMethod,80),selectedAt=safeText(raw.selectedAt,80);
    if(priceStoreId)point.priceStoreId=priceStoreId;
    if(address)point.address=address;
    if(city)point.city=city;
    if(referenceStoreId&&referenceStoreId!==chainId)point.referenceStoreId=referenceStoreId;
    if(scopeMethod)point.scopeMethod=scopeMethod;
    const confidence=Number(raw.scopeConfidence);
    if(Number.isFinite(confidence)&&confidence>=0&&confidence<=1)point.scopeConfidence=confidence;
    if(selectedAt&&!Number.isNaN(Date.parse(selectedAt)))point.selectedAt=selectedAt;
    return point;
  }

  function readPoint(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw)return null;
      const point=normalizePoint(JSON.parse(raw));
      if(!point){localStorage.removeItem(KEY);return null;}
      return point;
    }catch{
      try{localStorage.removeItem(KEY);}catch{}
      return null;
    }
  }

  function appStores(){
    try{return typeof STORES!=="undefined"&&Array.isArray(STORES)?STORES:[];}catch{return[];}
  }
  function appProducts(){
    try{return typeof PRODUCTS!=="undefined"&&Array.isArray(PRODUCTS)?PRODUCTS:[];}catch{return[];}
  }

  function chainName(id){
    const store=appStores().find(s=>s.id===id);
    return store&&store.name?store.name:id;
  }

  function rub(value){
    return `${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  }

  function persistPoint(point){
    const normalized=normalizePoint(point);
    if(!normalized)return false;
    normalized.version=POINT_VERSION;
    try{localStorage.setItem(KEY,JSON.stringify(normalized));return true;}catch{return false;}
  }

  function storeEligible(store,city,mode){
    if(!store)return false;
    if(city&&Array.isArray(store.city)&&!store.city.includes(city))return false;
    if(mode==="walk"&&store.kind==="delivery")return false;
    if(mode==="delivery"&&store.has_bring!==true)return false;
    return true;
  }

  function pointContextStatus(point,{ignoreStoreMismatch=false}={}){
    if(!point)return{ok:false,reason:"missing"};
    if(!window.state)return{ok:true,deferred:true,reason:"state_pending"};
    const stores=appStores();
    if(!stores.length)return{ok:true,deferred:true,reason:"stores_pending"};
    const chain=stores.find(s=>s.id===point.chainId);
    if(!chain)return{ok:false,reason:"unknown_chain"};
    const city=state.city||null,mode=state.mode||"any";
    if(point.city&&city&&point.city!==city)return{ok:false,reason:"city_changed"};
    if(!storeEligible(chain,city,mode))return{ok:false,reason:"chain_unavailable"};
    if(!ignoreStoreMismatch&&state.storeId&&state.storeId!==point.chainId)return{ok:false,reason:"store_changed"};
    return{ok:true,deferred:false,reason:"ok",chain};
  }

  function persistCurrentChain(point){
    if(!point||!point.chainId)return false;
    if(window.state)state.storeId=point.chainId;
    try{
      const parsed=JSON.parse(localStorage.getItem("td")||"{}");
      const saved=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};
      saved.storeId=point.chainId;
      localStorage.setItem("td",JSON.stringify(saved));
      return true;
    }catch{return false;}
  }

  function dropSelection(reason="invalid",notify=true){
    try{localStorage.removeItem(KEY);}catch{}
    document.querySelector("[data-td-selected-store]")?.remove();
    document.querySelectorAll("[data-point-selected]").forEach(el=>el.removeAttribute("data-point-selected"));
    if(notify)window.dispatchEvent(new CustomEvent("td:selected-store-point-cleared",{detail:{reason}}));
    return null;
  }

  function reconcileSelectedPoint(){
    const point=readPoint();
    if(!point)return null;
    const status=pointContextStatus(point);
    if(!status.ok)return dropSelection(status.reason,true);
    if(status.deferred)return point;

    let changed=false;
    const city=state.city||null,mode=state.mode||"any",stores=appStores();
    if(!point.city&&city){point.city=city;changed=true;}
    if(point.version!==POINT_VERSION){point.version=POINT_VERSION;changed=true;}
    if(point.referenceStoreId){
      const reference=stores.find(s=>s.id===point.referenceStoreId);
      if(!reference||point.referenceStoreId===point.chainId||!storeEligible(reference,city,mode)){
        delete point.referenceStoreId;
        changed=true;
      }
    }
    if(changed)persistPoint(point);
    return point;
  }

  function basketState(point){
    if(!window.state)return{kind:"none",text:""};
    const products=appProducts(),stores=appStores(),cart=state.cart||{};
    const totalItems=products.filter(p=>Number(cart[p.id]||0)>0).length;
    if(!totalItems)return{kind:"empty",text:"Добавьте товары — здесь появится итог по этой точке."};
    if(!window.TDStoreIdBridge||typeof TDStoreIdBridge.basket!=="function")return{kind:"pending",text:"Проверяем цены именно для этой точки…"};

    const referenceStoreId=point.referenceStoreId&&point.referenceStoreId!==point.chainId&&stores.some(s=>s.id===point.referenceStoreId&&storeEligible(s,state.city,state.mode))?point.referenceStoreId:null;
    let quote;
    try{
      quote=TDStoreIdBridge.basket(point,{products,cart,stores,referenceStoreId});
    }catch{
      return{kind:"pending",text:"Проверяем цены именно для этой точки…"};
    }
    if(!quote)return{kind:"pending",text:"Проверяем цены именно для этой точки…"};
    if(quote.verified&&Number.isFinite(quote.total)){
      const saving=Number(quote.savings);
      return{
        kind:"verified",
        total:quote.total,
        saving:Number.isFinite(saving)&&saving>0?saving:null,
        text:`Корзина в этой точке · ${rub(quote.total)}`
      };
    }
    if(Number(quote.coveredItems)>0&&Number(quote.totalItems)>0){
      return{kind:"partial",text:`Подтверждено ${quote.coveredItems} из ${quote.totalItems} товаров · полный итог пока не показываем.`};
    }
    return{kind:"unverified",text:"Цена корзины для этой точки пока не подтверждена."};
  }

  function injectStyles(){
    if(document.getElementById("td-selected-store-style"))return;
    const s=document.createElement("style");
    s.id="td-selected-store-style";
    s.textContent=`
      .td-selected-store{margin:0 0 12px;background:#fff;border:1px solid rgba(15,123,74,.18);border-radius:18px;padding:12px 12px 12px 13px;box-shadow:0 10px 26px rgba(22,20,16,.06)}
      .td-selected-store[data-quote="verified"]{border-color:rgba(15,123,74,.34);background:linear-gradient(180deg,#fff 0%,#f6fbf7 100%)}
      .td-selected-store-top{display:flex;align-items:flex-start;gap:10px}
      .td-selected-store-pin{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:none;background:#0f7b4a;color:#fff;font-size:16px;box-shadow:0 6px 14px rgba(15,123,74,.18)}
      .td-selected-store-copy{min-width:0;flex:1}
      .td-selected-store-kicker{font-size:9px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#0f7b4a;margin-bottom:3px}
      .td-selected-store-title{font-size:14px;font-weight:900;letter-spacing:-.02em;color:#161410}
      .td-selected-store-address{font-size:11px;line-height:1.35;font-weight:650;color:#6b6458;margin-top:3px;overflow-wrap:anywhere}
      .td-selected-store-quote{margin-top:10px;border-radius:13px;background:#f3f0e9;padding:9px 10px;font-size:11px;line-height:1.35;font-weight:800;color:#5f594f}
      .td-selected-store[data-quote="verified"] .td-selected-store-quote{background:#eaf6ee;color:#0f6d43}
      .td-selected-store-saving{display:inline-flex;margin-left:6px;border-radius:999px;background:#0f7b4a;color:#fff;padding:3px 6px;font-size:9px;font-weight:900;white-space:nowrap}
      .td-selected-store-actions{display:flex;gap:7px;margin-top:10px}
      .td-selected-store-actions button{border:0;border-radius:11px;padding:9px 10px;font:800 11px Manrope,system-ui,sans-serif;cursor:pointer}
      .td-selected-store-change{background:#161410;color:#fff;flex:1}
      .td-selected-store-clear{background:#f3f0e9;color:#5f594f}
      .td-map-store[data-point-selected="true"]{border-color:#0f7b4a!important;box-shadow:0 12px 30px rgba(15,123,74,.14)!important}
      .td-map-store[data-point-selected="true"]::after{content:"выбран";position:absolute;right:10px;bottom:10px;border-radius:999px;background:#0f7b4a;color:#fff;padding:4px 7px;font-size:9px;font-weight:900}
      @media (prefers-reduced-motion:reduce){.td-selected-store *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(s);
  }

  function clearSelection(){
    dropSelection("user",true);
    sync();
  }

  function changeSelection(){
    if(window.TDGeo&&typeof window.TDGeo.locate==="function"){
      window.TDGeo.locate();
      return;
    }
    if(typeof window.go==="function")window.go("stores");
  }

  function bannerHtml(point,quote){
    const name=chainName(point.chainId);
    const address=point.address||"Точка магазина выбрана";
    const saving=quote.saving?`<span class="td-selected-store-saving">экономия ${escapeHtml(rub(quote.saving))}</span>`:"";
    const kicker=window.state&&state.screen==="compare"?"Считаем по этой конкретной точке":"Текущая точка для расчёта";
    return `<section class="td-selected-store" data-td-selected-store data-quote="${escapeHtml(quote.kind)}">
      <div class="td-selected-store-top">
        <div class="td-selected-store-pin" aria-hidden="true">⌖</div>
        <div class="td-selected-store-copy">
          <div class="td-selected-store-kicker">${escapeHtml(kicker)}</div>
          <div class="td-selected-store-title">${escapeHtml(name)}</div>
          <div class="td-selected-store-address">${escapeHtml(address)}</div>
        </div>
      </div>
      <div class="td-selected-store-quote">${escapeHtml(quote.text)}${saving}</div>
      <div class="td-selected-store-actions">
        <button type="button" class="td-selected-store-change">Сменить точку</button>
        <button type="button" class="td-selected-store-clear">Сбросить</button>
      </div>
    </section>`;
  }

  function escapeHtml(v){
    return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  function renderBanner(point){
    injectStyles();
    const current=document.querySelector("[data-td-selected-store]");
    if(!point||!window.state||state.storeId!==point.chainId||!["catalog","cart","compare","stores"].includes(state.screen)){
      if(current)current.remove();
      return;
    }

    const wrap=document.querySelector("#app .wrap");
    if(!wrap)return;
    const quote=basketState(point);
    const signature=JSON.stringify({id:point.id,storeId:point.storeId,chainId:point.chainId,city:point.city||null,referenceStoreId:point.referenceStoreId||null,address:point.address||"",screen:state.screen,kind:quote.kind,text:quote.text,saving:quote.saving||null});
    if(current&&current.dataset.signature===signature)return;

    const holder=document.createElement("div");
    holder.innerHTML=bannerHtml(point,quote);
    const banner=holder.firstElementChild;
    banner.dataset.signature=signature;
    current?.remove();
    wrap.insertAdjacentElement("afterbegin",banner);
    banner.querySelector(".td-selected-store-change")?.addEventListener("click",changeSelection);
    banner.querySelector(".td-selected-store-clear")?.addEventListener("click",clearSelection);
  }

  function markMapCard(point){
    const cards=[...document.querySelectorAll(".td-map-store")];
    cards.forEach(card=>card.removeAttribute("data-point-selected"));
    if(!point||!window.TDGeo||!Array.isArray(window.TDGeo.nearby))return;
    const nearby=window.TDGeo.nearby;
    const idx=nearby.findIndex(p=>p&&p.id===point.id);
    if(idx>=0&&cards[idx])cards[idx].dataset.pointSelected="true";
  }

  function sync(){
    const point=reconcileSelectedPoint();
    renderBanner(point);
    markMapCard(point);
  }

  let raf=0;
  const obs=new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(sync);
  });
  function start(){
    sync();
    obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});
  }

  document.addEventListener("click",e=>{
    if(!e.target.closest("[data-use-point]"))return;
    const previousStoreId=window.state&&state.storeId;
    const selectedCity=window.state&&state.city;
    const selectedMode=window.state&&state.mode||"any";
    const finish=()=>{
      const point=readPoint();
      if(!point)return;
      if(selectedCity)point.city=selectedCity;
      point.version=POINT_VERSION;
      const stores=appStores(),previousStore=stores.find(s=>s.id===previousStoreId);
      if(previousStoreId&&previousStoreId!==point.chainId&&storeEligible(previousStore,selectedCity,selectedMode)&&!point.referenceStoreId)point.referenceStoreId=previousStoreId;
      persistPoint(point);
      persistCurrentChain(point);
      sync();
      window.dispatchEvent(new CustomEvent("td:selected-store-point-current",{detail:{point}}));
    };
    if(typeof queueMicrotask==="function")queueMicrotask(finish);else setTimeout(finish,0);
  },true);

  window.addEventListener("storage",e=>{if(e.key===KEY||e.key==="td")sync();});
  window.addEventListener("td:retailer-prices-applied",sync);
  window.addEventListener("td:store-id-bridge-ready",sync);
  window.addEventListener("td:runtime-resume",sync);
  window.TDSelectedStore={
    get:reconcileSelectedPoint,
    clear:clearSelection,
    change:changeSelection,
    refresh:sync,
    validate:point=>pointContextStatus(normalizePoint(point)),
    basket:()=>{const p=reconcileSelectedPoint();return p?basketState(p):null;},
    makeCurrent:()=>{const p=readPoint();if(!p)return null;const status=pointContextStatus(p,{ignoreStoreMismatch:true});if(!status.ok)return dropSelection(status.reason,true);persistCurrentChain(p);sync();return p;}
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
