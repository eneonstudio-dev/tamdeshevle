(function(){
  "use strict";

  const MIN_SAVINGS_RUB=20;
  const ALT_PRODUCTS=[
    {id:"milk_value",emoji:"🥛",name:"Молоко 2,5% · выгодная марка",pack:"1 л",substituteFor:"milk",substituteGroup:"milk-25-1l",prices:{pyat:89,magnit:82,perek:94,lenta:84,dixy:87,lavka:109,vprok:96},bring:{pyat:99,magnit:92,perek:104,lenta:94,dixy:97,lavka:109,vprok:96}},
    {id:"bread_value",emoji:"🍞",name:"Хлеб ржано-пшеничный · выгодный",pack:"650 г",substituteFor:"bread",substituteGroup:"dark-bread-650",prices:{pyat:55,magnit:49,perek:59,lenta:52,dixy:51,lavka:72,vprok:58},bring:{pyat:65,magnit:59,perek:69,lenta:62,dixy:61,lavka:72,vprok:58}},
    {id:"buck_value",emoji:"🌾",name:"Гречка · выгодная марка",pack:"800 г",substituteFor:"buck",substituteGroup:"buckwheat-800",prices:{pyat:76,magnit:66,perek:84,lenta:70,dixy:73,lavka:99,vprok:81},bring:{pyat:86,magnit:76,perek:94,lenta:80,dixy:83,lavka:99,vprok:81}},
    {id:"pasta_value",emoji:"🍝",name:"Макароны · выгодная марка",pack:"450 г",substituteFor:"pasta",substituteGroup:"pasta-450",prices:{pyat:56,magnit:49,perek:63,lenta:53,dixy:55,lavka:74,vprok:61},bring:{pyat:66,magnit:59,perek:73,lenta:63,dixy:65,lavka:74,vprok:61}}
  ];

  function installCatalog(){
    if(typeof PRODUCTS==="undefined"||!Array.isArray(PRODUCTS))return false;
    ALT_PRODUCTS.forEach(p=>{if(!PRODUCTS.some(x=>x.id===p.id))PRODUCTS.push({...p});});
    return true;
  }
  function store(){return typeof STORES!=="undefined"&&window.state?STORES.find(s=>s.id===state.storeId):null;}
  function channel(){const s=store();return s&&window.TDCompare?TDCompare.defaultChannel(s):"shelf";}
  function unitPrice(product){if(!product||!window.state)return null;const ch=channel();const source=ch==="bring"?product.bring:product.prices;const v=source&&source[state.storeId];return Number.isFinite(v)?v:null;}
  function suggestions(){
    if(!installCatalog()||!window.state)return[];
    const out=[];
    Object.entries(state.cart||{}).forEach(([id,qtyRaw])=>{
      const qty=Number(qtyRaw)||0;if(qty<=0)return;
      const original=PRODUCTS.find(p=>p.id===id);if(!original||original.substituteFor)return;
      const originalPrice=unitPrice(original);if(!Number.isFinite(originalPrice))return;
      PRODUCTS.filter(p=>p.substituteFor===id).forEach(alt=>{
        const altPrice=unitPrice(alt);if(!Number.isFinite(altPrice))return;
        const save=(originalPrice-altPrice)*qty;if(save<MIN_SAVINGS_RUB)return;
        out.push({original,alt,qty,originalPrice,altPrice,save});
      });
    });
    return out.sort((a,b)=>b.save-a.save);
  }
  function apply(originalId,altId){
    if(!window.state)return false;const qty=Number(state.cart&&state.cart[originalId]||0);if(qty<=0)return false;
    delete state.cart[originalId];state.cart[altId]=(Number(state.cart[altId])||0)+qty;
    if(typeof window.persist==="function")window.persist();else try{localStorage.setItem("td",JSON.stringify({screen:state.screen,city:state.city,storeId:state.storeId,cart:state.cart,address:state.address}));}catch{}
    if(typeof window.render==="function")window.render();
    window.dispatchEvent(new CustomEvent("td:substitution-applied",{detail:{originalId,altId,qty}}));return true;
  }
  function ensureCss(){if(document.getElementById("td-sub-style"))return;const s=document.createElement("style");s.id="td-sub-style";s.textContent='.td-sub-box{margin:0 16px 12px;background:#161410;color:#fff;border-radius:20px;padding:14px}.td-sub-box h3{font-size:14px;margin:0 0 4px}.td-sub-box>p{font-size:11px;opacity:.7;margin:0 0 10px}.td-sub-card{background:#fff;color:#161410;border-radius:14px;padding:11px;margin-top:8px}.td-sub-card b{font-size:12px;display:block}.td-sub-card small{display:block;color:#6b6458;font-size:10px;margin-top:3px}.td-sub-row{display:flex;align-items:center;gap:8px;margin-top:9px}.td-sub-save{font-weight:900;color:#0f7b4a;font-size:12px}.td-sub-btn{margin-left:auto;border:0;background:#e7f6ec;color:#0f7b4a;border-radius:10px;padding:8px 10px;font:900 11px Manrope,sans-serif;cursor:pointer}';document.head.appendChild(s);}
  function renderBox(){
    document.querySelector(".td-sub-box")?.remove();if(!window.state||state.screen!=="cart")return;const list=suggestions();if(!list.length)return;ensureCss();
    const box=document.createElement("section");box.className="td-sub-box";box.innerHTML=`<h3>Умные замены</h3><p>Похожие товары в том же магазине. Ничего не меняем без твоего нажатия.</p>${list.slice(0,4).map((s,i)=>`<div class="td-sub-card"><b>${s.original.name} → ${s.alt.name}</b><small>${s.original.pack} · ${s.originalPrice} ₽ → ${s.altPrice} ₽ · ×${s.qty}</small><div class="td-sub-row"><span class="td-sub-save">−${Math.round(s.save)} ₽</span><button class="td-sub-btn" type="button" data-sub="${i}">Заменить</button></div></div>`).join("")}`;
    const wrap=document.querySelector("#app .wrap");if(wrap)wrap.insertAdjacentElement("afterend",box);else return;
    box.querySelectorAll("[data-sub]").forEach(btn=>btn.addEventListener("click",()=>{const s=list[Number(btn.dataset.sub)];if(s)apply(s.original.id,s.alt.id);}));
  }
  const obs=new MutationObserver(()=>requestAnimationFrame(renderBox));
  function start(){installCatalog();ensureCss();obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});renderBox();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.TDSmartSubstitutions={suggestions,apply,installCatalog,policy:{minSavingsRub:MIN_SAVINGS_RUB},alternatives:ALT_PRODUCTS.slice()};
})();
