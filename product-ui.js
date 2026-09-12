(function () {
  "use strict";
  if (window.__TDProductUIInitialized) return;
  window.__TDProductUIInitialized = true;

  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const rub=value=>Number.isFinite(value)?`${new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(value)} ₽`:"";
  let frame=0;
  let observing=false;

  function style(){
    if(document.getElementById("td-product-ui-style"))return;
    const node=document.createElement("style");
    node.id="td-product-ui-style";
    node.textContent=`
      .item{position:relative;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}.item:has(.td-product-trust.real){border-color:rgba(43,228,135,.2)}.item.td-in-cart:after{content:"в корзине";position:absolute;right:12px;top:10px;border:1px solid rgba(43,228,135,.24);background:rgba(43,228,135,.12);color:#bfffdc;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
      .thumb.td-retailer-photo{background:#f5f7f5;border:1px solid rgba(255,255,255,.1);padding:5px}.thumb.td-retailer-photo img{object-fit:contain;background:#f5f7f5}.td-photo-tag{position:absolute;left:18px;top:18px;background:rgba(5,10,7,.86);color:#d9eee1;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px 6px;font-size:8px;font-weight:800;letter-spacing:.02em;z-index:2}
      .thumb.td-image-fallback,.sku-plate.td-image-fallback{background:linear-gradient(145deg,#101b14,#0a130e);border:1px solid rgba(255,255,255,.08)}.td-image-fallback-mark{display:grid;place-items:center;width:100%;height:100%;min-height:44px;font-size:30px;line-height:1;color:#7e9588;text-align:center}
      .td-product-trust{grid-column:2/-1;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:-5px;padding-top:8px;border-top:1px solid rgba(255,255,255,.075);font-size:10px;font-weight:800;color:#8fa398}.td-product-trust.real{color:#9fe9bf}
      .td-product-trust .verified{display:inline-flex;align-items:center;gap:5px;background:rgba(43,228,135,.10);border:1px solid rgba(43,228,135,.16);border-radius:999px;padding:5px 8px;color:#bfffdc}.td-product-trust .verified.stale{background:rgba(255,217,134,.08);border-color:rgba(255,217,134,.15);color:#ead497}.td-product-trust .estimated{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.075);border-radius:999px;padding:5px 8px;color:#adbbb3}.td-product-trust .promo{background:rgba(255,217,134,.1);color:#f0d98e;border:1px solid rgba(255,217,134,.14);border-radius:999px;padding:5px 8px}.td-product-trust .cart-state{background:rgba(43,228,135,.13);color:#c8ffe0;border-radius:999px;padding:5px 8px}.td-product-trust a{color:#a8dabb;text-decoration:none;border-bottom:1px solid currentColor;opacity:.95}
      .td-retailer-name{grid-column:2/-1;margin-top:-6px;color:#8fa398;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.td-retailer-name strong{color:#eafff1}.td-old-price{text-decoration:line-through;color:#75867c;font-size:12px;font-weight:700;margin-left:6px}.td-match-note{grid-column:2/-1;font-size:10px;color:#819389;font-weight:700;margin-top:-5px}
      @media (hover:hover){.item:has(.td-product-trust.real):hover{transform:translateY(-1px)}}`;
    document.head.appendChild(node);
  }

  function channel(storeId){if(typeof STORES==="undefined")return"shelf";const store=STORES.find(item=>item.id===storeId);return window.TDCompare?(window.state&&window.state.mode==="delivery"&&store&&store.has_bring?"bring":TDCompare.defaultChannel(store)):(store&&store.kind==="delivery"?"bring":"shelf");}
  function product(card){const title=card.querySelector(".title");if(!title||typeof PRODUCTS==="undefined")return null;return PRODUCTS.find(item=>item.name===title.textContent.trim())||null;}
  function date(value){if(!value)return"";const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return"";return parsed.toLocaleDateString("ru-RU",{day:"numeric",month:"short"}).replace(".","");}
  function safeImage(value){if(!value)return null;try{const url=new URL(String(value),location.href);return url.protocol==="https:"?url.toString():null;}catch{return null;}}
  function normalizeImageUrl(value){
    const safe=safeImage(value);if(!safe)return null;
    try{
      const url=new URL(safe);
      if(url.hostname==="images.unsplash.com"){
        url.searchParams.set("fit","max");
        url.searchParams.set("w",String(Math.max(320,Number(url.searchParams.get("w"))||0)));
        url.searchParams.set("h",String(Math.max(320,Number(url.searchParams.get("h"))||0)));
        if(!url.searchParams.has("q"))url.searchParams.set("q","68");
      }
      return url.toString();
    }catch{return safe;}
  }
  function clearDecor(card){card.querySelectorAll(".td-retailer-name,.td-product-trust,.td-match-note,.td-photo-tag").forEach(node=>node.remove());card.querySelectorAll(".td-old-price").forEach(node=>node.remove());}

  function prepareImage(img){
    img.loading="lazy";
    img.decoding="async";
    img.setAttribute("fetchpriority","low");
  }

  function clearFallback(holder,img){
    holder.classList.remove("td-image-fallback");
    holder.querySelector(".td-image-fallback-mark")?.remove();
    if(img){img.hidden=false;img.removeAttribute("aria-hidden");}
  }

  function showImageFallback(holder,img,item){
    if(!holder)return;
    holder.classList.remove("td-retailer-photo");
    holder.classList.add("td-image-fallback");
    if(img){img.hidden=true;img.setAttribute("aria-hidden","true");}
    let mark=holder.querySelector(".td-image-fallback-mark");
    if(!mark){mark=document.createElement("span");mark.className="td-image-fallback-mark";holder.appendChild(mark);}
    const label=item&&item.name?`Изображение товара «${item.name}» недоступно`:"Изображение товара недоступно";
    mark.setAttribute("role","img");mark.setAttribute("aria-label",label);mark.textContent=item&&item.emoji?item.emoji:"◻";
    holder.closest(".item")?.querySelector(".td-photo-tag")?.remove();
  }

  function setImageSource({img,holder,card,item,source,fallback=null,retailer=false}){
    if(!img||!holder||!source){showImageFallback(holder,img,item);return false;}
    prepareImage(img);clearFallback(holder,img);
    img.onerror=()=>{
      if(retailer){holder.classList.remove("td-retailer-photo");card?.querySelector(".td-photo-tag")?.remove();}
      if(fallback&&fallback!==source){setImageSource({img,holder,card,item,source:fallback,fallback:null,retailer:false});return;}
      showImageFallback(holder,img,item);
    };
    img.onload=()=>clearFallback(holder,img);
    if(img.getAttribute("src")!==source)img.src=source;
    return true;
  }

  function applyImage(card,meta,item){
    const thumb=card.querySelector(".thumb"),img=thumb&&thumb.querySelector("img");
    if(!thumb||!img)return;
    const rawBase=img.dataset.tdOriginalSrc||img.getAttribute("src")||img.src;
    if(!img.dataset.tdOriginalSrc&&rawBase)img.dataset.tdOriginalSrc=rawBase;
    const baseImage=normalizeImageUrl(img.dataset.tdOriginalSrc||rawBase);
    const retailerImage=normalizeImageUrl(meta&&meta.imageUrl);
    card.querySelector(".td-photo-tag")?.remove();
    if(!retailerImage){
      thumb.classList.remove("td-retailer-photo");
      setImageSource({img,holder:thumb,card,item,source:baseImage});
      return;
    }
    thumb.classList.add("td-retailer-photo");
    setImageSource({img,holder:thumb,card,item,source:retailerImage,fallback:baseImage,retailer:true});
    const tag=document.createElement("span");tag.className="td-photo-tag";tag.textContent="фото сети";card.appendChild(tag);
  }

  function prepareTileImage(img){
    const holder=img.closest(".sku-plate");if(!holder)return;
    const raw=img.dataset.tdOriginalSrc||img.getAttribute("src")||img.src;
    if(!img.dataset.tdOriginalSrc&&raw)img.dataset.tdOriginalSrc=raw;
    const source=normalizeImageUrl(img.dataset.tdOriginalSrc||raw);
    if(img.dataset.tdPreparedSource===source&&!img.hidden)return;
    img.dataset.tdPreparedSource=source||"";
    setImageSource({img,holder,item:null,source});
  }

  function decorateCard(card){
    if(!window.state)return;
    const item=product(card);if(!item)return;
    const storeId=state.storeId,slot=channel(storeId),meta=window.TDPriceMeta&&TDPriceMeta.get(item.id,storeId,slot),quantity=Math.max(0,Number(state.cart?.[item.id])||0);
    card.classList.toggle("td-in-cart",quantity>0);
    card.dataset.tdCartQty=String(quantity);
    card.dataset.tdProductId=item.id;
    const signature=[storeId,slot,meta&&meta.checkedAt,meta&&meta.price,meta&&meta.imageUrl,meta&&meta.promo,meta&&meta.freshness,quantity].join("|");
    if(card.dataset.productUiSignature===signature)return;
    card.dataset.productUiSignature=signature;
    clearDecor(card);applyImage(card,meta,item);
    const price=card.querySelector(".price");
    const name=document.createElement("div");name.className="td-retailer-name";
    if(meta&&meta.retailerName)name.innerHTML=`Цена в сети: <strong>${esc(meta.retailerName)}</strong>`;else name.textContent="Ориентир для сравнения корзины";
    card.appendChild(name);
    const trust=document.createElement("div");trust.className=`td-product-trust${meta?" real":""}`;
    if(meta){
      const checked=date(meta.checkedAt),stale=meta.freshness==="stale";
      trust.innerHTML=`<span class="verified${stale?" stale":""}">${stale?"данные устаревают":"подтверждено сетью"}${checked?` · ${esc(checked)}`:""}</span>${meta.promo?`<span class="promo">акция</span>`:""}${quantity>0?`<span class="cart-state">в корзине · ${quantity}</span>`:""}${meta.sourceUrl?`<a href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">источник ↗</a>`:""}`;
      if(price&&Number.isFinite(meta.oldPrice)&&meta.oldPrice>meta.price)price.insertAdjacentHTML("beforeend",`<span class="td-old-price">${esc(rub(meta.oldPrice))}</span>`);
    }else trust.innerHTML=`<span class="estimated">≈ оценка</span><span>не подтверждено каталогом сети</span>${quantity>0?`<span class="cart-state">в корзине · ${quantity}</span>`:""}`;
    card.appendChild(trust);
    if(meta&&meta.method&&meta.method!=="exact_retailer_id"){
      const note=document.createElement("div");note.className="td-match-note";note.textContent=meta.confidence!=null?`Совместимый товар · уверенность ${Math.round(meta.confidence*100)}%`:"Совместимый товар";card.appendChild(note);
    }
  }

  function decorate(){
    style();
    document.querySelectorAll("#app .item").forEach(decorateCard);
    document.querySelectorAll("#app .sku-plate img").forEach(prepareTileImage);
  }

  function queueDecorate(){
    if(document.hidden||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;decorate();});
  }

  function containsProductVisual(node){return node&&node.nodeType===1&&(node.matches?.(".item,.sku")||node.querySelector?.(".item,.sku"));}
  function needsDecorate(records){return records.some(record=>[...record.addedNodes].some(containsProductVisual));}

  const observer=new MutationObserver(records=>{if(needsDecorate(records))queueDecorate();});
  function observe(){
    if(observing||document.hidden)return;
    const target=document.getElementById("app");
    if(!target)return;
    observer.observe(target,{childList:true,subtree:true});
    observing=true;
  }
  function pause(){
    if(observing){observer.disconnect();observing=false;}
    if(frame){cancelAnimationFrame(frame);frame=0;}
  }
  function start(){style();observe();queueDecorate();}
  function retryImages(){
    document.querySelectorAll("#app .item").forEach(card=>{delete card.dataset.productUiSignature;});
    document.querySelectorAll("#app .sku-plate img").forEach(img=>{delete img.dataset.tdPreparedSource;});
    queueDecorate();
  }
  function resume(){observe();queueDecorate();}

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("td:retailer-prices-applied",queueDecorate);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();else resume();});
  window.addEventListener("pagehide",pause);
  window.addEventListener("pageshow",resume);
  window.addEventListener("online",retryImages);
})();
