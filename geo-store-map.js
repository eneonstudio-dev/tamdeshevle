(function(){
  "use strict";
  const RADIUS=3000, SEARCH_TIMEOUT=20000;
  const CHAINS=[
    {id:"pyat",label:"Пятёрочка",re:/пят[её]рочк|pyaterochka/i},
    {id:"magnit",label:"Магнит",re:/магнит|magnit/i},
    {id:"perek",label:"Перекрёсток",re:/перекр[её]сток|perekrestok/i},
    {id:"lenta",label:"Лента",re:/\bлента\b|\blenta\b/i},
    {id:"dixy",label:"Дикси",re:/дикси|dixy/i}
  ];
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let map=null,layer=null,lastPosition=null,nearby=[],leafletPromise=null;
  let searchController=null,searchTimer=0,locateSeq=0,mapSeq=0,locating=false,nearbyState="idle";
  let mapSheet=null,pointModal=null,mapOpener=null,pointOpener=null,previousOverflow="";
  let mapManualBack=false,pointManualBack=false;

  function css(){if(document.getElementById("td-geo-style"))return;const s=document.createElement("style");s.id="td-geo-style";s.textContent=`
    .td-geo-card{background:#fff;border-radius:20px;padding:14px;margin:12px 0;box-shadow:0 10px 26px rgba(22,20,16,.06)}.td-geo-card h3{font-size:15px;margin:0 0 5px}.td-geo-card p{font-size:12px;color:#6b6458;font-weight:650;line-height:1.45;margin:0 0 10px}.td-geo-actions{display:flex;gap:8px}.td-geo-actions button{border:0;border-radius:13px;padding:11px 12px;font:800 12px Manrope,sans-serif;cursor:pointer}.td-geo-actions button:disabled{opacity:.58;cursor:wait}.td-geo-main{background:#161410;color:#fff;flex:1}.td-geo-status{font-size:11px!important;margin:8px 0 0!important}.td-map-sheet{position:fixed;inset:0;z-index:80;background:#f4f1ea;display:flex;flex-direction:column;height:var(--td-vvh,100dvh);max-height:var(--td-vvh,100dvh);overscroll-behavior:contain}.td-map-head{padding:max(12px,env(safe-area-inset-top)) 16px 10px;display:flex;gap:10px;align-items:center;background:rgba(244,241,234,.96);backdrop-filter:blur(16px)}.td-map-head button{border:0;background:#fff;width:40px;height:40px;border-radius:12px;font-size:18px;flex:none}.td-map-head strong{font-size:16px}.td-map-head span{font-size:11px;color:#6b6458;display:block;line-height:1.35}.td-map{height:clamp(180px,46dvh,420px);min-height:0;background:#e9e5dd}.td-map-list{padding:12px 16px max(28px,env(safe-area-inset-bottom));overflow:auto;flex:1;-webkit-overflow-scrolling:touch}.td-map-store{background:#fff;border-radius:16px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start}.td-map-store-main{min-width:0;flex:1}.td-map-store b{font-size:13px}.td-map-store small{display:block;color:#70695e;margin-top:3px;line-height:1.35}.td-map-distance{margin-left:auto;font-size:12px;font-weight:800;white-space:nowrap}.td-map-price-state{display:inline-block;margin-top:5px;border-radius:999px;background:#f1ede6;padding:4px 7px;font-size:9px;font-weight:800}.td-map-price-state.ok{background:#e7f6ec;color:#0f7b4a}.td-map-basket{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.td-map-basket span{border-radius:9px;background:#f7f4ee;padding:5px 7px;font-size:10px;font-weight:800}.td-map-basket .good{background:#e7f6ec;color:#0f7b4a}.td-map-basket .save{background:#161410;color:#fff}.td-map-detail-btn{border:0;background:transparent;padding:7px 0 0;color:#0f7b4a;font:800 11px Manrope,sans-serif;cursor:pointer}.td-map-state{background:#fff;border-radius:16px;padding:16px;font-size:11px;font-weight:750;line-height:1.5;color:#6b6458}.td-map-state button{display:block;margin-top:10px;border:0;border-radius:12px;padding:10px 12px;background:#161410;color:#fff;font:900 11px Manrope,sans-serif}.td-point-detail{position:fixed;inset:0;z-index:95;background:rgba(22,20,16,.38);display:flex;align-items:flex-end;overscroll-behavior:contain}.td-point-panel{width:100%;max-height:min(82dvh,var(--td-vvh,100dvh));overflow:auto;background:#f8f6f1;border-radius:24px 24px 0 0;padding:16px 16px max(16px,env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}.td-point-top{display:flex;gap:10px;align-items:flex-start}.td-point-top h3{margin:0;font-size:18px}.td-point-top p{margin:4px 0 0;font-size:11px;color:#70695e}.td-point-close{margin-left:auto;border:0;background:#fff;border-radius:12px;width:38px;height:38px;font-size:18px;flex:none}.td-point-summary{background:#161410;color:#fff;border-radius:16px;padding:13px;margin:14px 0}.td-point-summary strong{font-size:22px}.td-point-summary small{display:block;margin-top:4px;opacity:.75}.td-point-line{background:#fff;border-radius:14px;padding:11px;margin:7px 0;display:flex;gap:9px;align-items:flex-start}.td-point-line .grow{flex:1;min-width:0}.td-point-line b{font-size:12px}.td-point-line small{font-size:10px;color:#746d62;display:block;margin-top:3px}.td-point-line .amount{font-size:12px;font-weight:900;white-space:nowrap}.td-point-missing{border:1px dashed #d8d1c5;background:#fbfaf7}.td-point-source{display:inline-block;margin-top:5px;font-size:10px;font-weight:800;color:#0f7b4a;text-decoration:none}.td-point-actions{position:sticky;bottom:-16px;background:linear-gradient(transparent,#f8f6f1 22%);padding:24px 0 4px}.td-point-actions button{width:100%;border:0;border-radius:14px;padding:13px;font:900 13px Manrope,sans-serif;background:#161410;color:#fff}.td-user-dot{width:18px;height:18px;border-radius:50%;background:#1677ff;border:4px solid #fff;box-shadow:0 0 0 2px rgba(22,119,255,.25)}
  `;document.head.appendChild(s);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function safeUrl(v){try{const u=new URL(String(v),location.href);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
  function chainFor(name){return CHAINS.find(c=>c.re.test(name||""))||null;}
  function distance(a,b){const rad=x=>x*Math.PI/180,R=6371;const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(Math.min(1,Math.max(0,x))),Math.sqrt(Math.max(0,1-x)));}
  function rub(value){return Math.round(value).toLocaleString("ru-RU")+" ₽";}
  function dateText(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
  function status(text){document.querySelectorAll(".td-geo-status").forEach(n=>{n.textContent=text;n.setAttribute("role","status");n.setAttribute("aria-live","polite");});}
  function safeFocus(target){if(!target||!document.contains(target)||typeof target.focus!=="function")return;try{target.focus({preventScroll:true});}catch{try{target.focus();}catch{}}}
  function trapTab(event,root){if(event.key!=="Tab"||!root)return;const items=[...root.querySelectorAll(FOCUSABLE)].filter(x=>!x.hidden&&x.getAttribute("aria-hidden")!=="true");if(!items.length){event.preventDefault();root.focus();return;}const first=items[0],last=items[items.length-1],active=document.activeElement;if(event.shiftKey&&(active===first||!root.contains(active))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(active===last||!root.contains(active))){event.preventDefault();first.focus();}}
  function setLocateBusy(value){locating=value;document.querySelectorAll(".td-geo-main").forEach(btn=>{btn.disabled=value;btn.setAttribute("aria-busy",value?"true":"false");btn.textContent=value?"Ищем магазины…":"Показать на карте";});}
  function clearSearch(){if(searchTimer){clearTimeout(searchTimer);searchTimer=0;}if(searchController){try{searchController.abort();}catch{}searchController=null;}}
  function destroyMap(){if(map&&typeof map.remove==="function"){try{map.remove();}catch(e){console.warn("map cleanup failed",e);}}map=null;layer=null;}
  function clearGeoHistoryState(){if(!window.history?.replaceState)return;try{const next={...history.state};delete next.tdGeoPoint;delete next.tdGeoMap;history.replaceState(next,"");}catch{}}
  function pushGeoState(kind){if(!window.history?.pushState)return;try{const next={...history.state,tdGeoMap:true};if(kind==="point")next.tdGeoPoint=true;history.pushState(next,"");}catch{}}

  function leaflet(){
    if(window.L&&typeof window.L.map==="function")return Promise.resolve();
    if(leafletPromise)return leafletPromise;
    leafletPromise=new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-td-leaflet]')){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";link.crossOrigin="anonymous";link.dataset.tdLeaflet="1";document.head.appendChild(link);}
      const existing=document.querySelector('script[data-td-leaflet]');
      const script=existing||document.createElement("script");
      const done=()=>window.L&&typeof window.L.map==="function"?resolve():reject(new Error("Leaflet unavailable"));
      if(existing){existing.addEventListener("load",done,{once:true});existing.addEventListener("error",()=>reject(new Error("Leaflet load failed")),{once:true});return;}
      script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";script.crossOrigin="anonymous";script.async=true;script.dataset.tdLeaflet="1";script.onload=done;script.onerror=()=>reject(new Error("Leaflet load failed"));document.head.appendChild(script);
    }).catch(err=>{leafletPromise=null;document.querySelector('script[data-td-leaflet]')?.remove();throw err;});
    return leafletPromise;
  }

  async function fetchNearby(lat,lon,radius){
    clearSearch();
    const controller=typeof AbortController==="function"?new AbortController():null;searchController=controller;
    searchTimer=setTimeout(()=>controller?.abort(),SEARCH_TIMEOUT);
    const q=`[out:json][timeout:18];(node[shop~"supermarket|convenience"](around:${radius},${lat},${lon});way[shop~"supermarket|convenience"](around:${radius},${lat},${lon});relation[shop~"supermarket|convenience"](around:${radius},${lat},${lon}););out center tags;`;
    try{
      const res=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"data="+encodeURIComponent(q),signal:controller?.signal});
      if(!res.ok)throw new Error("overpass_"+res.status);
      const data=await res.json();
      return (data.elements||[]).map(e=>{const t=e.tags||{},name=t.name||t.brand||"Магазин",chain=chainFor(`${name} ${t.brand||""}`),lat2=e.lat||(e.center&&e.center.lat),lon2=e.lon||(e.center&&e.center.lon);if(!Number.isFinite(lat2)||!Number.isFinite(lon2)||!chain)return null;const addr=[t["addr:street"],t["addr:housenumber"]].filter(Boolean).join(", ");return{id:`osm:${e.type}:${e.id}`,name,chainId:chain.id,chainLabel:chain.label,lat:lat2,lon:lon2,address:addr||"Адрес в OpenStreetMap не указан",osmTags:t};}).filter(Boolean);
    }finally{
      if(searchController===controller)searchController=null;
      if(searchTimer){clearTimeout(searchTimer);searchTimer=0;}
    }
  }

  function basketFor(point){if(!window.TDStoreIdBridge||typeof TDStoreIdBridge.basket!=="function")return null;return TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId});}
  function priceState(point){if(window.TDStoreIdBridge&&typeof TDStoreIdBridge.quote==="function")return TDStoreIdBridge.quote(point);return{verified:false,text:"цена точки пока не подтверждена"};}
  function basketHtml(point){const b=basketFor(point);if(!b||!b.match||!b.match.verified)return"";if(!b.totalItems)return'<div class="td-map-basket"><span>Добавь товары в корзину</span></div>';const coverage=`${b.coveredItems}/${b.totalItems} SKU`;if(b.verified){let html=`<div class="td-map-basket"><span class="good">Корзина ${rub(b.total)}</span><span>${coverage}</span>`;if(Number.isFinite(b.savings)&&b.savings>0)html+=`<span class="save">−${rub(b.savings)}</span>`;else if(Number.isFinite(b.savings)&&b.savings<0)html+=`<span>+${rub(Math.abs(b.savings))}</span>`;return html+"</div>";}return `<div class="td-map-basket"><span>Подтверждено ${coverage}</span>${b.partialTotal>0?`<span>подтверждено на ${rub(b.partialTotal)}</span>`:""}</div>`;}
  function renderList(){
    const box=document.querySelector(".td-map-list");if(!box)return;
    if(nearbyState==="loading"){box.innerHTML='<div class="td-map-state" role="status">Ищем поддерживаемые магазины рядом…</div>';return;}
    if(nearbyState==="error"){box.innerHTML='<div class="td-map-state" role="alert">Не удалось загрузить список магазинов. Карта может работать, но точки сейчас недоступны.<button type="button" data-retry-nearby>Повторить поиск</button></div>';box.querySelector("[data-retry-nearby]")?.addEventListener("click",()=>locate({reusePosition:true}));return;}
    if(!nearby.length){box.innerHTML='<div class="td-map-state">В радиусе 3 км пока не нашли поддерживаемые сети.</div>';return;}
    box.innerHTML=nearby.map((p,i)=>{const ps=priceState(p),canDetail=Boolean(ps.match&&ps.match.verified);return `<div class="td-map-store" tabindex="0"><div class="td-map-store-main"><b>${esc(p.chainLabel)}</b><small>${esc(p.address)}</small><span class="td-map-price-state${ps.verified?" ok":""}">${esc(ps.text)}</span>${basketHtml(p)}${canDetail?`<button class="td-map-detail-btn" type="button" data-point-index="${i}">Подробнее о корзине →</button>`:""}</div><div class="td-map-distance">${p.distanceKm<1?Math.round(p.distanceKm*1000)+" м":p.distanceKm.toFixed(1)+" км"}</div></div>`;}).join("");
    box.querySelectorAll("[data-point-index]").forEach(btn=>btn.addEventListener("click",()=>openPointDetails(nearby[Number(btn.dataset.pointIndex)],btn)));
  }
  function itemHtml(item){if(!item.verified)return `<div class="td-point-line td-point-missing"><div class="grow"><b>${esc(item.name)}</b><small>${esc(item.pack)} · ×${item.qty}</small><small>Для этой точки подтверждённой цены пока нет</small></div><div class="amount">—</div></div>`;const when=item.meta&&dateText(item.meta.checkedAt),url=item.meta&&safeUrl(item.meta.sourceUrl),sourceName=item.meta&&item.meta.retailerName;return `<div class="td-point-line"><div class="grow"><b>${esc(item.name)}</b><small>${esc(item.pack)} · ×${item.qty} · ${rub(item.price)} / шт.</small>${sourceName?`<small>У сети: ${esc(sourceName)}</small>`:""}${when?`<small>Проверено ${esc(when)}</small>`:""}${url?`<a class="td-point-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Источник цены ↗</a>`:""}</div><div class="amount">${rub(item.subtotal)}</div></div>`;}

  function closePointDetails({historyBack=true,restoreFocus=true}={}){
    const modal=pointModal||document.querySelector(".td-point-detail");if(!modal)return false;
    const opener=pointOpener;pointModal=null;pointOpener=null;modal.remove();window.TDUILayers?.refresh?.();
    if(historyBack&&history.state?.tdGeoPoint){pointManualBack=true;try{history.back();}catch{pointManualBack=false;}}
    if(restoreFocus)requestAnimationFrame(()=>safeFocus(opener));
    return true;
  }
  function openPointDetails(point,opener){
    if(!point)return;
    closePointDetails({historyBack:false,restoreFocus:false});
    const b=basketFor(point),ps=priceState(point),verifiedPoint=Boolean(ps.match&&ps.match.verified),overlay=ps.match&&ps.match.overlay,checked=overlay&&dateText(overlay.checkedAt),rows=b&&Array.isArray(b.items)?b.items.map(itemHtml).join(""):"";let summary="";
    if(!b||!b.totalItems)summary='<div class="td-point-summary"><strong>Корзина пустая</strong><small>Добавь товары — здесь появится расчёт конкретной точки.</small></div>';
    else if(b.verified)summary=`<div class="td-point-summary"><strong>${rub(b.total)}</strong><small>${b.coveredItems}/${b.totalItems} SKU подтверждены${Number.isFinite(b.savings)&&b.savings>0?` · экономия ${rub(b.savings)}`:""}</small></div>`;
    else summary=`<div class="td-point-summary"><strong>${b.coveredItems}/${b.totalItems} SKU</strong><small>Подтверждённая часть ${rub(b.partialTotal)}. Полный итог не показываем, пока нет цен на все позиции.</small></div>`;
    const modal=document.createElement("div");modal.className="td-point-detail";modal.tabIndex=-1;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
    modal.innerHTML=`<div class="td-point-panel"><div class="td-point-top"><div><h3 id="td-point-title">${esc(point.chainLabel)}</h3><p>${esc(point.address)}</p><p>Store ID: ${esc(ps.match&&ps.match.storeId||"—")}${checked?` · данные ${esc(checked)}`:""}</p></div><button class="td-point-close" type="button" aria-label="Закрыть">×</button></div>${summary}${rows||'<p class="hint">Нет товарных строк для этой корзины.</p>'}<p class="hint">Точная сумма показывается только по SKU с подтверждённой retailer-ценой именно для привязанного контекста точки. Учебные цены сети сюда не подмешиваются.</p>${verifiedPoint?'<div class="td-point-actions"><button type="button" data-use-point>Выбрать эту точку для сравнения</button></div>':""}</div>`;
    modal.setAttribute("aria-labelledby","td-point-title");document.body.appendChild(modal);pointModal=modal;pointOpener=opener||document.activeElement;pushGeoState("point");window.TDUILayers?.refresh?.();
    modal.querySelector(".td-point-close").addEventListener("click",()=>closePointDetails());modal.addEventListener("click",e=>{if(e.target===modal)closePointDetails();});modal.querySelector("[data-use-point]")?.addEventListener("click",()=>selectPoint(point,ps.match));requestAnimationFrame(()=>safeFocus(modal.querySelector(".td-point-close")));
  }

  function closeMap({historyBack=true,restoreFocus=true}={}){
    closePointDetails({historyBack:false,restoreFocus:false});
    const sheet=mapSheet||document.querySelector(".td-map-sheet");
    if(!sheet){mapSeq++;destroyMap();return false;}
    const opener=mapOpener;mapSheet=null;mapOpener=null;mapSeq++;destroyMap();sheet.remove();document.body.style.overflow=previousOverflow;previousOverflow="";window.TDUILayers?.refresh?.();
    if(historyBack&&history.state?.tdGeoMap){mapManualBack=true;try{history.back();}catch{mapManualBack=false;}}
    if(restoreFocus)requestAnimationFrame(()=>safeFocus(opener));
    return true;
  }
  function selectPoint(point,match){
    if(!window.state||!match||!match.verified)return;
    state.storeId=point.chainId;
    try{localStorage.setItem("td:selected-store-point",JSON.stringify({id:point.id,chainId:point.chainId,storeId:match.storeId,priceStoreId:match.priceStoreId||point.chainId,address:point.address,scopeMethod:match.method,scopeConfidence:match.confidence,selectedAt:new Date().toISOString()}));}catch{}
    clearGeoHistoryState();closePointDetails({historyBack:false,restoreFocus:false});closeMap({historyBack:false,restoreFocus:false});
    if(typeof window.go==="function")window.go("catalog");else if(typeof window.render==="function")window.render();
  }
  function popupHtml(p){const b=basketFor(p),parts=[`<b>${esc(p.chainLabel)}</b>`,esc(p.address),`<small>${Math.round(p.distanceKm*1000)} м</small>`];if(b&&b.verified)parts.push(`<strong>Корзина: ${rub(b.total)}</strong>`,`<small>Покрытие: ${b.coveredItems}/${b.totalItems} SKU</small>`);else if(b&&b.match&&b.match.verified&&b.totalItems)parts.push(`<small>Подтверждено: ${b.coveredItems}/${b.totalItems} SKU</small>`);if(b&&Number.isFinite(b.savings)&&b.savings>0)parts.push(`<small>Экономия: ${rub(b.savings)}</small>`);return parts.join("<br>");}

  function refreshMapMarkers({fit=true,emit=true}={}){
    if(!map||!layer||!lastPosition||!window.L)return false;
    try{
      if(typeof layer.clearLayers==="function")layer.clearLayers();
      nearby.forEach(p=>L.marker([p.lat,p.lon]).addTo(layer).bindPopup(popupHtml(p)));
      if(fit){
        if(nearby.length){const bounds=L.latLngBounds([[lastPosition.lat,lastPosition.lon],...nearby.map(p=>[p.lat,p.lon])]);map.fitBounds(bounds.pad(.15),{maxZoom:15});}
        else map.setView([lastPosition.lat,lastPosition.lon],14);
      }
      if(typeof map.invalidateSize==="function")map.invalidateSize(false);
      if(emit)window.dispatchEvent(new CustomEvent("td:geo-map-updated",{detail:{count:nearby.length}}));
      return true;
    }catch(err){console.warn("map marker refresh failed",err);return false;}
  }

  async function renderMapSurface(sheet=mapSheet){
    if(!sheet||sheet!==mapSheet||!document.contains(sheet)||!lastPosition)return false;
    const target=sheet.querySelector("#td-map");if(!target)return false;
    const seq=++mapSeq;
    try{
      await leaflet();
      if(seq!==mapSeq||!mapSheet||sheet!==mapSheet||!document.contains(sheet))return false;
      destroyMap();target.innerHTML="";
      map=L.map(target,{zoomControl:true}).setView([lastPosition.lat,lastPosition.lon],14);map.attributionControl.setPrefix(false);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(map);
      const userIcon=L.divIcon({className:"",html:'<div class="td-user-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]});L.marker([lastPosition.lat,lastPosition.lon],{icon:userIcon}).addTo(map).bindPopup("Вы здесь");
      layer=L.layerGroup().addTo(map);refreshMapMarkers({fit:true,emit:false});
      window.dispatchEvent(new CustomEvent("td:geo-map-ready",{detail:{count:nearby.length}}));
      return true;
    }catch(err){
      if(seq!==mapSeq||sheet!==mapSheet)return false;
      target.innerHTML='<div class="td-map-state" style="margin:16px">Карта не загрузилась, но список ближайших магазинов ниже доступен.</div>';console.warn("map load failed",err);return false;
    }
  }

  async function openMap(opener){
    if(!lastPosition)return locate({opener});
    css();
    if(mapSheet){renderList();if(!map)void renderMapSurface(mapSheet);return true;}
    mapOpener=opener||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const sheet=document.createElement("section");sheet.className="td-map-sheet";sheet.tabIndex=-1;sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");sheet.setAttribute("aria-labelledby","td-map-title");sheet.innerHTML=`<div class="td-map-head"><button type="button" data-close-map aria-label="Закрыть карту">←</button><div><strong id="td-map-title">Магазины рядом</strong><span>Геопозиция используется только сейчас и не сохраняется</span></div></div><div id="td-map" class="td-map" aria-label="Карта ближайших магазинов"></div><div class="td-map-list"></div>`;
    document.body.appendChild(sheet);mapSheet=sheet;if(!history.state?.tdGeoMap)pushGeoState("map");window.TDUILayers?.refresh?.();sheet.querySelector("[data-close-map]").addEventListener("click",()=>closeMap());renderList();requestAnimationFrame(()=>safeFocus(sheet.querySelector("[data-close-map]")));
    return renderMapSurface(sheet);
  }

  async function searchFromPosition(seq){
    nearbyState="loading";renderList();status("Ищем магазины в радиусе 3 км…");
    try{
      if(navigator.onLine===false)throw new Error("offline");
      const rows=await fetchNearby(lastPosition.lat,lastPosition.lon,RADIUS);if(seq!==locateSeq)return;
      nearby=rows;nearby.forEach(p=>p.distanceKm=distance(lastPosition,p));nearby.sort((a,b)=>a.distanceKm-b.distanceKm);nearbyState="ready";status(`Нашли ${nearby.length} поддерживаемых магазинов рядом`);renderList();refreshMapMarkers({fit:true});
    }catch(err){if(seq!==locateSeq)return;nearby=[];nearbyState="error";status(err?.name==="AbortError"?"Поиск магазинов занял слишком много времени":"Геопозицию получили, но список магазинов сейчас не загрузился");renderList();refreshMapMarkers({fit:true});console.warn("nearby stores failed",err);}
  }
  function locate(options={}){
    if(locating)return false;
    const reuse=options.reusePosition===true&&lastPosition;
    const seq=++locateSeq;setLocateBusy(true);
    if(reuse){nearbyState="loading";openMap(options.opener);searchFromPosition(seq).finally(()=>{if(seq===locateSeq)setLocateBusy(false);});return true;}
    if(!navigator.geolocation){status("Геопозиция не поддерживается этим браузером");setLocateBusy(false);return false;}
    status("Запрашиваем геопозицию…");
    navigator.geolocation.getCurrentPosition(pos=>{
      if(seq!==locateSeq)return;
      lastPosition={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};nearbyState="loading";openMap(options.opener);searchFromPosition(seq).finally(()=>{if(seq===locateSeq)setLocateBusy(false);});
    },err=>{if(seq!==locateSeq)return;const text=err.code===1?"Доступ к геопозиции не разрешён":err.code===3?"Не удалось определить геопозицию вовремя":"Не удалось определить геопозицию";status(text);setLocateBusy(false);},{enableHighAccuracy:false,timeout:10000,maximumAge:120000});
    return true;
  }

  function card(){return `<section class="td-geo-card" data-td-geo><h3>📍 Магазины рядом</h3><p>Разреши геопозицию — покажем ближайшие Пятёрочки, Магниты, Перекрёстки, Ленты и Дикси. Координаты не сохраняем.</p><div class="td-geo-actions"><button class="td-geo-main" type="button">Показать на карте</button></div><p class="td-geo-status" role="status" aria-live="polite">Для подтверждённой точки показываем реальную сумму корзины, SKU и источник каждой цены.</p></section>`;}
  function inject(){css();if(!window.state||!["home","stores"].includes(state.screen))return;const wrap=document.querySelector("#app .wrap");if(!wrap||wrap.querySelector("[data-td-geo]"))return;wrap.insertAdjacentHTML("afterbegin",card());const btn=wrap.querySelector(".td-geo-main");btn.addEventListener("click",()=>lastPosition?openMap(btn):locate({opener:btn}));setLocateBusy(locating);}

  document.addEventListener("keydown",event=>{if(pointModal&&document.contains(pointModal)){if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();closePointDetails();return;}trapTab(event,pointModal);return;}if(mapSheet&&document.contains(mapSheet)){if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();closeMap();return;}trapTab(event,mapSheet);}},true);
  window.addEventListener("popstate",event=>{if(pointManualBack){pointManualBack=false;return;}if(mapManualBack){mapManualBack=false;return;}if(pointModal&&!event.state?.tdGeoPoint)closePointDetails({historyBack:false});if(mapSheet&&!event.state?.tdGeoMap)closeMap({historyBack:false});});
  window.addEventListener("online",()=>{if(nearbyState==="error"&&lastPosition&&mapSheet)status("Соединение восстановлено. Можно повторить поиск магазинов.");});
  window.addEventListener("pagehide",()=>{locateSeq++;clearSearch();setLocateBusy(false);mapSeq++;destroyMap();});
  window.addEventListener("pageshow",()=>{
    if(!mapSheet||!document.contains(mapSheet)||!lastPosition)return;
    renderList();void renderMapSurface(mapSheet);
    if(nearbyState==="loading"&&!locating){const seq=++locateSeq;setLocateBusy(true);searchFromPosition(seq).finally(()=>{if(seq===locateSeq)setLocateBusy(false);});}
  });

  const obs=new MutationObserver(()=>requestAnimationFrame(inject));
  function start(){obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});inject();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("td:retailer-prices-applied",()=>{if(document.querySelector(".td-map-list")){renderList();refreshMapMarkers({fit:false});}});
  window.TDGeo={locate,openMap,closeMap,openPointDetails,closePointDetails,refreshMapMarkers,get position(){return lastPosition;},get nearby(){return nearby.slice();},get state(){return nearbyState;}};
})();
