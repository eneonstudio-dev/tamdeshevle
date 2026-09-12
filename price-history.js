(function(){
  "use strict";
  if(window.__TDPriceHistoryInitialized)return;
  window.__TDPriceHistoryInitialized=true;

  const MIN_POINTS=4,MIN_FAKE_GAP_PCT=8;
  const DEMO={
    milk:{pyat:{prices:[119,115,112,109,104],claimedDiscountPct:25},magnit:{prices:[108,104,101,99,95],claimedDiscountPct:20},perek:{prices:[124,119,115,112,109],claimedDiscountPct:22}},
    eggs:{pyat:{prices:[129,124,121,119,115],claimedDiscountPct:20},magnit:{prices:[116,111,106,103,99],claimedDiscountPct:18}},
    oil:{pyat:{prices:[174,169,164,160,155],claimedDiscountPct:30},magnit:{prices:[158,153,148,144,139],claimedDiscountPct:25}},
    chicken:{pyat:{prices:[405,399,392,385,379],claimedDiscountPct:15},magnit:{prices:[379,371,363,356,349],claimedDiscountPct:18}}
  };
  let frame=0,observing=false;

  function median(values){const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function historyFor(productId,storeId){const live=window.TDPriceHistoryData&&window.TDPriceHistoryData[productId]&&window.TDPriceHistoryData[productId][storeId];if(live)return Object.assign({verified:false},live);const demo=DEMO[productId]&&DEMO[productId][storeId];return demo?Object.assign({verified:false,demo:true},demo):null;}
  function analyse(input){const prices=(input&&input.prices||[]).map(Number).filter(Number.isFinite),current=Number(input&&input.current),claimed=Number(input&&input.claimedDiscountPct),verified=Boolean(input&&input.verified);if(prices.length<MIN_POINTS||!Number.isFinite(current))return{state:"unknown",verified,baseline:null,realDiscountPct:null,fakeGapPct:null};const baseline=median(prices.slice(0,-1).length?prices.slice(0,-1):prices),realDiscountPct=Math.max(0,Math.round((baseline-current)/baseline*100)),fakeGapPct=Number.isFinite(claimed)?Math.max(0,claimed-realDiscountPct):null;let state="normal";if(Number.isFinite(fakeGapPct)&&fakeGapPct>=MIN_FAKE_GAP_PCT)state="inflated_claim";else if(realDiscountPct>=10)state="good_price";return{state,verified,baseline:Math.round(baseline),realDiscountPct,fakeGapPct,claimedDiscountPct:Number.isFinite(claimed)?claimed:null,points:prices.length};}
  function currentPrice(product,storeId){if(!product)return null;const store=typeof STORES!=="undefined"?STORES.find(s=>s.id===storeId):null;const ch=window.TDCompare&&store?window.TDCompare.defaultChannel(store):"shelf";const src=ch==="bring"?product.bring:product.prices;const v=src&&src[storeId];return Number.isFinite(v)?v:null;}
  function forProduct(product){if(!product||!window.state)return null;const h=historyFor(product.id,state.storeId);if(!h)return null;return Object.assign({history:h},analyse({prices:h.prices,current:currentPrice(product,state.storeId),claimedDiscountPct:h.claimedDiscountPct,verified:h.verified}));}
  function spark(prices,current){const a=(prices||[]).map(Number).filter(Number.isFinite);if(Number.isFinite(current))a.push(current);if(a.length<2)return"";const min=Math.min(...a),max=Math.max(...a),span=max-min||1;return a.map(v=>{const h=Math.round(6+(max-v)/span*18);return `<i style="height:${h}px" title="${Math.round(v)} ₽"></i>`;}).join("");}
  function ensureCss(){if(document.getElementById("td-history-style"))return;const s=document.createElement("style");s.id="td-history-style";s.textContent='.td-price-history{grid-column:2/4;margin-top:-4px;border-top:1px solid #eee7dc;padding-top:8px}.td-history-row{display:flex;align-items:center;gap:8px}.td-history-label{font-size:10px;font-weight:900}.td-history-label.good{color:#0f7b4a}.td-history-label.warn{color:#9a5b00}.td-history-sub{font-size:9px;color:#746d62;margin-top:3px}.td-spark{margin-left:auto;height:26px;display:flex;align-items:flex-end;gap:2px}.td-spark i{width:3px;border-radius:3px;background:#b8c9bc;display:block}.td-history-demo{font-size:8px;border-radius:999px;background:#f1ede6;padding:2px 5px;color:#746d62}';document.head.appendChild(s);}

  function decorate(){
    if(!window.state||state.screen!=="catalog"||typeof PRODUCTS==="undefined")return;
    ensureCss();
    document.querySelectorAll("#app .item").forEach(card=>{
      const title=card.querySelector(".title")?.textContent?.trim(),p=PRODUCTS.find(x=>x.name===title),a=p&&forProduct(p),current=p&&currentPrice(p,state.storeId),signature=a&&a.state!=="unknown"?[state.storeId,p.id,current,a.state,a.baseline,a.realDiscountPct,a.claimedDiscountPct,a.verified].join("|"):"";
      if(card.dataset.tdHistorySignature===signature)return;
      card.querySelector(".td-price-history")?.remove();card.dataset.tdHistorySignature=signature;
      if(!p||!a||a.state==="unknown")return;
      let label="Цена около обычной",cls="";
      if(a.state==="good_price"){label=`Хорошая цена · реально −${a.realDiscountPct}%`;cls="good";}
      if(a.state==="inflated_claim"){label=a.verified?`Скидка на ценнике −${a.claimedDiscountPct}%, реально около −${a.realDiscountPct}%`:`Демо антифейка: заявлено −${a.claimedDiscountPct}%, по истории около −${a.realDiscountPct}%`;cls="warn";}
      const box=document.createElement("div");box.className="td-price-history";box.innerHTML=`<div class="td-history-row"><span class="td-history-label ${cls}">${label}</span>${a.history.demo?'<span class="td-history-demo">учебная история</span>':''}<span class="td-spark">${spark(a.history.prices,current)}</span></div><div class="td-history-sub">Обычная цена по медиане истории: ${a.baseline} ₽ · ${a.points} наблюдений${a.verified?' · подтверждено':' · не использовать как факт о магазине'}</div>`;card.appendChild(box);
    });
  }

  function queueDecorate(){if(document.hidden||frame)return;frame=requestAnimationFrame(()=>{frame=0;decorate();});}
  function containsItem(node){return node&&node.nodeType===1&&(node.matches?.(".item")||node.querySelector?.(".item"));}
  function needsDecorate(records){return records.some(record=>[...record.addedNodes].some(containsItem));}
  const obs=new MutationObserver(records=>{if(needsDecorate(records))queueDecorate();});
  function observe(){if(observing||document.hidden)return;const target=document.getElementById("app");if(!target)return;obs.observe(target,{childList:true,subtree:true});observing=true;}
  function pause(){if(observing){obs.disconnect();observing=false;}if(frame){cancelAnimationFrame(frame);frame=0;}}
  function start(){ensureCss();observe();queueDecorate();}

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("td:retailer-prices-applied",queueDecorate);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();else{observe();queueDecorate();}});
  window.addEventListener("pagehide",pause,{once:true});
  window.TDPriceHistory={analyse,median,historyFor,forProduct,policy:{minPoints:MIN_POINTS,minFakeGapPct:MIN_FAKE_GAP_PCT}};
})();
