(()=>{
  "use strict";
  const VERSION="price-freshness-v2";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const shortDate=v=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})};
  const safeUrl=v=>{try{const u=new URL(String(v||""),location.href);return u.protocol==="https:"?u.href:""}catch{return""}};
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id||"магазин";
  function style(){if(document.querySelector(`style[data-${VERSION}]`))return;const s=document.createElement("style");s.dataset[VERSION.replace(/-/g,"")]="1";s.textContent=`
    .td-freshness{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px;font:800 9px/1.2 Manrope,sans-serif}
    .td-freshness-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;background:#eee8de;color:#665f55}
    .td-freshness-pill.fresh{background:#e6f6eb;color:#0d6d42}.td-freshness-pill.stale{background:#fff1d8;color:#805200}.td-freshness-pill.estimated{background:#eee8de;color:#6b6458}.td-freshness-pill.unknown{background:#f3e8e5;color:#8a4638}
    .td-freshness a{color:inherit;text-decoration:none;border-bottom:1px solid currentColor;opacity:.9}.td-ai-line .td-freshness{margin-top:4px}.td-item-freshness{grid-column:2/-1;margin-top:-4px}
  `;document.head.appendChild(s)}
  function metaFor(id,storeId){if(!id||!storeId)return null;const real=window.TDPriceMeta?.get?.(id,storeId,"shelf")||null;if(real)return{meta:real,estimated:false};const estimated=window.TDPriceMeta?.getEstimated?.(id,storeId,"shelf")||null;return estimated?{meta:estimated,estimated:true}:null}
  function info(id,storeId,lineQuality){const found=metaFor(id,storeId);if(found){const {meta,estimated}=found;if(estimated){const d=shortDate(meta.checkedAt),region=meta.catalogContext?.region||"регион";return{kind:"estimated",label:"Оценочная",detail:`каталог · ${region}${d?` · ${d}`:""}`,url:meta.sourceUrl||""}}
      const q=window.TDDataQuality?.metaQuality?.(meta)||null,status=q?.status||"fresh",d=shortDate(meta.checkedAt),source=meta.retailerName||storeName(storeId);
      if(status==="fresh")return{kind:"fresh",label:"Свежая",detail:`${source}${d?` · ${d}`:""}`,url:meta.sourceUrl||""};
      if(status==="stale")return{kind:"stale",label:"Старая",detail:`${source}${d?` · ${d}`:""}`,url:meta.sourceUrl||""};
      return{kind:"unknown",label:"Не подтверждена",detail:source,url:meta.sourceUrl||""};
    }
    if(lineQuality==="LIVE")return{kind:"unknown",label:"Источник не раскрыт",detail:"актуальность заявлена, метаданных нет",url:""};
    if(lineQuality==="UNKNOWN")return{kind:"unknown",label:"Не подтверждена",detail:"проверь перед покупкой",url:""};
    return{kind:"estimated",label:"Оценочная",detail:"ориентировочная цена",url:""};
  }
  function html(x){const url=safeUrl(x.url);return `<span class="td-freshness-pill ${esc(x.kind)}">${esc(x.label)}</span><span>${esc(x.detail)}</span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">источник ↗</a>`:""}`}
  function decorateBai(){const plan=window.TDShoppingState?.get?.().lastPlans?.[0];if(!plan?.products?.length)return;document.querySelectorAll(".td-ai-summary .td-ai-line").forEach((row,i)=>{if(row.querySelector(".td-freshness"))return;const line=plan.products[i];if(!line)return;const box=document.createElement("div");box.className="td-freshness";box.innerHTML=html(info(line.id,line.storeId,line.quality));const span=row.querySelector("span");span?.appendChild(box)})}
  function productIdFromCard(card){const title=card.querySelector(".title,.sku-name");if(!title||typeof PRODUCTS==="undefined")return null;const name=title.textContent.trim();return PRODUCTS.find(p=>p.name===name)?.id||null}
  function decorateCatalog(){if(!window.state)return;const storeId=window.state.storeId;document.querySelectorAll(".item,.product-card").forEach(card=>{if(card.querySelector(".td-item-freshness"))return;const id=productIdFromCard(card);if(!id||!storeId)return;const box=document.createElement("div");box.className="td-freshness td-item-freshness";box.innerHTML=html(info(id,storeId));card.appendChild(box)})}
  function decorate(){style();decorateBai();decorateCatalog()}
  const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
  function boot(){decorate();observer.observe(document.body,{subtree:true,childList:true});window.addEventListener("td:shopping-state",decorate);window.addEventListener("td:retailer-prices-applied",decorate);window.addEventListener("td:comparison-plan-applied",decorate)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.TDPriceFreshnessV2={info,decorate};
})();
