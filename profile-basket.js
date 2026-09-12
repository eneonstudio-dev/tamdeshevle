(function(){
  "use strict";

  const PROFILE_KEY="td:profile";
  const HISTORY_KEY="td:basket-history";
  const MAX_HISTORY=90;
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let storageFault=false,activeProfile=null,profileOpener=null,previousOverflow="";

  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||"null");return v==null?fallback:v;}catch{return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));storageFault=false;return true;}catch(error){storageFault=true;console.warn("Profile storage unavailable",error);return false;}}
  function profile(){const p=readJson(PROFILE_KEY,{});return{name:String(p.name||"Покупатель").slice(0,40),createdAt:p.createdAt||new Date().toISOString()};}
  function saveProfile(next){const current=profile();const p={...current,...(next&&typeof next==="object"?next:{})};p.name=String(p.name||"Покупатель").trim().slice(0,40)||"Покупатель";if(!p.createdAt)p.createdAt=new Date().toISOString();return writeJson(PROFILE_KEY,p)?p:null;}
  function dayKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`;}
  function getStore(id){return typeof STORES!=="undefined"&&Array.isArray(STORES)?STORES.find(s=>s.id===id):null;}
  function currentTotal(){
    if(!window.state||typeof PRODUCTS==="undefined"||!Array.isArray(PRODUCTS)||!window.TDCompare)return null;
    const store=getStore(state.storeId);if(!store)return null;
    const channel=TDCompare.defaultChannel(store);
    const quote=TDCompare.basketQuote(PRODUCTS,state.cart||{},store.id,channel),fee=TDCompare.feeQuote(store,channel);
    if(!quote.verifiedComplete||!fee.known)return null;
    const total=quote.goods+fee.value;
    return Number.isFinite(total)?Math.round(total):null;
  }
  function cartCount(){if(!window.state)return 0;return Object.values(state.cart||{}).reduce((a,v)=>a+(Number(v)||0),0);}
  function sameCart(a,b){try{return JSON.stringify(a||{})===JSON.stringify(b||{});}catch{return false;}}
  function snapshot(){
    if(!window.state||!cartCount())return null;
    const total=currentTotal();if(!Number.isFinite(total))return null;
    const record={date:dayKey(),at:new Date().toISOString(),city:state.city,storeId:state.storeId,total,items:cartCount(),cart:{...(state.cart||{})},verified:true};
    const current=readJson(HISTORY_KEY,[]),rows=Array.isArray(current)?current:[],existing=rows.find(x=>x&&x.date===record.date);
    if(existing&&existing.city===record.city&&existing.storeId===record.storeId&&Number(existing.total)===record.total&&Number(existing.items)===record.items&&sameCart(existing.cart,record.cart))return existing;
    const next=rows.filter(x=>x&&x.date!==record.date);next.push(record);next.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(!writeJson(HISTORY_KEY,next.slice(-MAX_HISTORY)))return null;
    try{window.dispatchEvent(new CustomEvent("td:basket-history-changed",{detail:{record}}));}catch{}
    return record;
  }
  function history(){const rows=readJson(HISTORY_KEY,[]);return(Array.isArray(rows)?rows:[]).filter(x=>x&&x.verified===true&&Number.isFinite(Number(x.total))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function previousComparable(today){const h=history().filter(x=>x.date<today.date&&x.city===today.city);return h.length?h[h.length-1]:null;}
  function stats(){const h=history();if(!h.length)return{days:0,best:null,latest:null,change:null,savedVsPrevious:0};const latest=h[h.length-1],prev=h.length>1?h[h.length-2]:null,change=prev?latest.total-prev.total:null;return{days:h.length,best:Math.min(...h.map(x=>Number(x.total))),latest,change,savedVsPrevious:change<0?Math.abs(change):0};}
  function money(v){return Math.round(Number(v)||0).toLocaleString("ru-RU")+" ₽";}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function trend(today){const prev=previousComparable(today);if(!prev)return{prev:null,text:"Сохраним сегодняшнюю цену и сравним при следующем визите.",kind:"neutral"};const d=today.total-prev.total;if(d<0)return{prev,text:`Сегодня дешевле на ${money(Math.abs(d))}`,kind:"good"};if(d>0)return{prev,text:`Сегодня дороже на ${money(d)}`,kind:"bad"};return{prev,text:"Цена корзины не изменилась",kind:"neutral"};}
  function safeFocus(target){if(!target||typeof target.focus!=="function")return;try{target.focus({preventScroll:true});}catch{try{target.focus();}catch{}}}
  function trapTab(event,root){if(event.key!=="Tab"||!root)return;const items=[...root.querySelectorAll(FOCUSABLE)].filter(node=>!node.hidden&&node.getAttribute("aria-hidden")!=="true");if(!items.length){event.preventDefault();safeFocus(root);return;}const first=items[0],last=items[items.length-1],active=document.activeElement;if(event.shiftKey&&(active===first||!root.contains(active))){event.preventDefault();safeFocus(last);}else if(!event.shiftKey&&(active===last||!root.contains(active))){event.preventDefault();safeFocus(first);}}
  function closeProfile({restore=true}={}){const sheet=activeProfile||document.querySelector(".td-profile-sheet");if(sheet)sheet.remove();activeProfile=null;if(document.body)document.body.style.overflow=previousOverflow;if(restore)safeFocus(profileOpener);profileOpener=null;}
  function ensureCss(){if(document.getElementById("td-profile-style"))return;const s=document.createElement("style");s.id="td-profile-style";s.textContent=`
    .td-profile-btn{border:0;background:#fff;width:38px;height:38px;border-radius:50%;font:900 13px Manrope,sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 12px rgba(22,20,16,.06)}
    .td-today-card{background:#fff;border-radius:20px;padding:15px;margin:0 0 12px;box-shadow:0 10px 26px rgba(22,20,16,.06)}.td-today-kicker{font-size:10px;font-weight:900;color:#6b6458;text-transform:uppercase;letter-spacing:.08em}.td-today-total{font-size:30px;font-weight:900;letter-spacing:-.05em;margin:5px 0}.td-today-trend{display:inline-block;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;background:#f1ede6}.td-today-trend.good{background:#e7f6ec;color:#0f7b4a}.td-today-trend.bad{background:#fff0ed;color:#a23525}.td-today-meta{font-size:11px;color:#6b6458;margin-top:7px;font-weight:650}
    .td-profile-sheet{position:fixed;inset:0;z-index:120;background:#f4f1ea;overflow:auto;overscroll-behavior:contain}.td-profile-head{position:sticky;top:0;background:rgba(244,241,234,.96);backdrop-filter:blur(14px);display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 16px 10px}.td-profile-back{border:0;background:#fff;width:38px;height:38px;border-radius:12px;font-size:18px;cursor:pointer}.td-profile-body{padding:6px 16px max(40px,env(safe-area-inset-bottom))}.td-profile-hero{background:#161410;color:#fff;border-radius:24px;padding:18px;margin-bottom:12px}.td-profile-avatar{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#ffe14a;color:#161410;font-size:20px;font-weight:900;margin-bottom:12px}.td-profile-name{font-size:24px;font-weight:900;letter-spacing:-.04em}.td-profile-edit{margin-top:10px;display:flex;gap:8px}.td-profile-edit input{flex:1;border:0;border-radius:12px;padding:11px;font:700 13px Manrope,sans-serif;min-width:0}.td-profile-edit button{border:0;border-radius:12px;padding:0 13px;background:#ffe14a;font:900 12px Manrope,sans-serif}.td-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}.td-profile-stat{background:#fff;border-radius:16px;padding:12px}.td-profile-stat b{display:block;font-size:20px}.td-profile-stat span{font-size:10px;color:#6b6458;font-weight:700}.td-profile-block{background:#fff;border-radius:18px;padding:14px;margin-bottom:10px}.td-profile-block h3{font-size:13px;margin-bottom:9px}.td-history-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eee8de;font-size:11px}.td-history-row:first-of-type{border-top:0}.td-history-row span{color:#6b6458}.td-history-row b{font-size:12px}.td-profile-note{font-size:10px;line-height:1.5;color:#6b6458}.td-profile-storage{border-radius:14px;padding:10px 12px;margin-bottom:10px;background:#fff0ed;color:#8d3426;font-size:11px;font-weight:750;line-height:1.45}
  `;document.head.appendChild(s);}
  function initials(name){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"ТД";}
  function injectProfileButton(){document.querySelectorAll("header.app .row").forEach(row=>{const city=row.querySelector(".city");if(!city)return;let b=row.querySelector(".td-profile-btn");if(!b){b=document.createElement("button");b.className="td-profile-btn";b.type="button";b.title="Профиль";b.setAttribute("aria-label","Открыть профиль");b.addEventListener("click",openProfile);city.insertAdjacentElement("beforebegin",b);}b.textContent=initials(profile().name);});}
  function todayRecord(){return snapshot()||history().find(x=>x.date===dayKey())||null;}
  function injectToday(){
    const existing=document.querySelector(".td-today-card");if(!window.state||state.screen!=="home"){existing?.remove();return;}const today=todayRecord();if(!today){existing?.remove();return;}const t=trend(today),store=getStore(today.storeId),wrap=document.querySelector("#app .wrap");if(!wrap)return;const html=`<div class="td-today-kicker">Подтверждённая цена корзины сегодня</div><div class="td-today-total">${money(today.total)}</div><span class="td-today-trend ${t.kind}">${esc(t.text)}</span><div class="td-today-meta">${today.items} товаров · ${esc(store?store.short:today.storeId)}${t.prev?` · было ${money(t.prev.total)}`:""}</div>`;let card=existing;if(!card){card=document.createElement("section");card.className="td-today-card";wrap.prepend(card);}if(card.innerHTML!==html)card.innerHTML=html;
  }
  function openProfile(){
    ensureCss();closeProfile({restore:false});profileOpener=document.activeElement;const today=snapshot();const p=profile(),st=stats(),h=history().slice(-10).reverse();const sheet=document.createElement("section");sheet.className="td-profile-sheet";sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");sheet.setAttribute("aria-labelledby","td-profile-title");sheet.tabIndex=-1;sheet.innerHTML=`<div class="td-profile-head"><button class="td-profile-back" type="button" aria-label="Закрыть профиль">←</button><div><b id="td-profile-title">Профиль</b><div class="sub">Твоя экономия и привычная корзина</div></div></div><div class="td-profile-body">${storageFault&&!today?'<div class="td-profile-storage" role="alert">Локальное хранилище сейчас недоступно. Изменения профиля и новая история не будут считаться сохранёнными.</div>':""}<div class="td-profile-hero"><div class="td-profile-avatar">${esc(initials(p.name))}</div><div class="td-profile-name">${esc(p.name)}</div><div class="td-profile-edit"><input maxlength="40" value="${esc(p.name)}" aria-label="Имя"><button type="button">Сохранить</button></div><div class="td-profile-storage" data-profile-status role="status" aria-live="polite" hidden></div></div><div class="td-profile-grid"><div class="td-profile-stat"><b>${st.days}</b><span>дней с историей</span></div><div class="td-profile-stat"><b>${st.best==null?"—":money(st.best)}</b><span>лучшая цена корзины</span></div></div><div class="td-profile-block"><h3>Последние цены корзины</h3>${h.length?h.map(x=>`<div class="td-history-row"><span>${esc(x.date)} · ${x.items} шт.</span><b>${money(x.total)}</b></div>`).join(""):'<p class="td-profile-note">История появится после первого сохранённого дня.</p>'}</div><div class="td-profile-block"><h3>Как это работает</h3><p class="td-profile-note">История учитывает только полностью подтверждённые корзины. Профиль и корзину можно сохранить в облако из раздела «Аккаунт».</p></div></div>`;document.body.appendChild(sheet);activeProfile=sheet;previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const back=sheet.querySelector(".td-profile-back"),input=sheet.querySelector(".td-profile-edit input"),save=sheet.querySelector(".td-profile-edit button"),status=sheet.querySelector("[data-profile-status]");
    back.addEventListener("click",()=>closeProfile());sheet.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();closeProfile();return;}trapTab(event,sheet);});
    save.addEventListener("click",()=>{const saved=saveProfile({name:input.value});if(!saved){status.hidden=false;status.setAttribute("role","alert");status.textContent="Не удалось сохранить профиль на этом устройстве. Проверь доступ к хранилищу и попробуй ещё раз.";safeFocus(status);return;}closeProfile();injectProfileButton();openProfile();});
    safeFocus(back||sheet);
  }
  let queued=false;function refresh(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureCss();snapshot();injectProfileButton();injectToday();});}
  const obs=new MutationObserver(refresh);function start(){ensureCss();obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});refresh();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("td:substitution-applied",refresh);window.addEventListener("td:retailer-prices-applied",refresh);window.addEventListener("pagehide",()=>closeProfile({restore:false}));
  window.TDProfileBasket={profile,saveProfile,snapshot,history,stats,trend,dayKey,currentTotal,openProfile,closeProfile,get storageFault(){return storageFault;}};
})();
