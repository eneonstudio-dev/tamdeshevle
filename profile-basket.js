(function(){
  "use strict";

  const PROFILE_KEY="td:profile";
  const HISTORY_KEY="td:basket-history";
  const MAX_HISTORY=90;

  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||"null");return v==null?fallback:v;}catch{return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  function profile(){const p=readJson(PROFILE_KEY,{});return{name:String(p.name||"Покупатель").slice(0,40),createdAt:p.createdAt||new Date().toISOString()};}
  function saveProfile(next){const current=profile();const p={...current,...next};if(!p.createdAt)p.createdAt=new Date().toISOString();writeJson(PROFILE_KEY,p);return p;}
  function dayKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`;}
  function currentTotal(){
    if(!window.state||typeof window.sumIn!=="function")return null;
    const id=state.storeId;let total=Number(window.sumIn(id));
    const s=typeof window.storeBy==="function"?window.storeBy(id):null;
    if(s&&s.kind==="delivery")total+=Number(s.delivery||0);
    return Number.isFinite(total)?Math.round(total):null;
  }
  function cartCount(){if(!window.state)return 0;return Object.values(state.cart||{}).reduce((a,v)=>a+(Number(v)||0),0);}
  function snapshot(){
    if(!window.state||!cartCount())return null;
    const total=currentTotal();if(!Number.isFinite(total))return null;
    const record={date:dayKey(),at:new Date().toISOString(),city:state.city,storeId:state.storeId,total,items:cartCount(),cart:{...(state.cart||{})}};
    const history=readJson(HISTORY_KEY,[]).filter(x=>x&&x.date!==record.date);
    history.push(record);history.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    writeJson(HISTORY_KEY,history.slice(-MAX_HISTORY));return record;
  }
  function history(){return readJson(HISTORY_KEY,[]).filter(x=>x&&Number.isFinite(Number(x.total))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function previousComparable(today){const h=history().filter(x=>x.date<today.date&&x.city===today.city);return h.length?h[h.length-1]:null;}
  function stats(){
    const h=history();if(!h.length)return{days:0,best:null,latest:null,change:null,savedVsPrevious:0};
    const latest=h[h.length-1],prev=h.length>1?h[h.length-2]:null;const change=prev?latest.total-prev.total:null;
    return{days:h.length,best:Math.min(...h.map(x=>Number(x.total))),latest,change,savedVsPrevious:change<0?Math.abs(change):0};
  }
  function money(v){return Math.round(Number(v)||0).toLocaleString("ru-RU")+" ₽";}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function trend(today){const prev=previousComparable(today);if(!prev)return{prev:null,text:"Сохраним сегодняшнюю цену и сравним при следующем визите.",kind:"neutral"};const d=today.total-prev.total;if(d<0)return{prev,text:`Сегодня дешевле на ${money(Math.abs(d))}`,kind:"good"};if(d>0)return{prev,text:`Сегодня дороже на ${money(d)}`,kind:"bad"};return{prev,text:"Цена корзины не изменилась",kind:"neutral"};}
  function ensureCss(){if(document.getElementById("td-profile-style"))return;const s=document.createElement("style");s.id="td-profile-style";s.textContent=`
    .td-profile-btn{border:0;background:#fff;width:38px;height:38px;border-radius:50%;font:900 13px Manrope,sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 12px rgba(22,20,16,.06)}
    .td-today-card{background:#fff;border-radius:20px;padding:15px;margin:0 0 12px;box-shadow:0 10px 26px rgba(22,20,16,.06)}.td-today-kicker{font-size:10px;font-weight:900;color:#6b6458;text-transform:uppercase;letter-spacing:.08em}.td-today-total{font-size:30px;font-weight:900;letter-spacing:-.05em;margin:5px 0}.td-today-trend{display:inline-block;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;background:#f1ede6}.td-today-trend.good{background:#e7f6ec;color:#0f7b4a}.td-today-trend.bad{background:#fff0ed;color:#a23525}.td-today-meta{font-size:11px;color:#6b6458;margin-top:7px;font-weight:650}
    .td-profile-sheet{position:fixed;inset:0;z-index:120;background:#f4f1ea;overflow:auto}.td-profile-head{position:sticky;top:0;background:rgba(244,241,234,.96);backdrop-filter:blur(14px);display:flex;align-items:center;gap:10px;padding:14px 16px}.td-profile-back{border:0;background:#fff;width:38px;height:38px;border-radius:12px;font-size:18px;cursor:pointer}.td-profile-body{padding:6px 16px 40px}.td-profile-hero{background:#161410;color:#fff;border-radius:24px;padding:18px;margin-bottom:12px}.td-profile-avatar{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#ffe14a;color:#161410;font-size:20px;font-weight:900;margin-bottom:12px}.td-profile-name{font-size:24px;font-weight:900;letter-spacing:-.04em}.td-profile-edit{margin-top:10px;display:flex;gap:8px}.td-profile-edit input{flex:1;border:0;border-radius:12px;padding:11px;font:700 13px Manrope,sans-serif}.td-profile-edit button{border:0;border-radius:12px;padding:0 13px;background:#ffe14a;font:900 12px Manrope,sans-serif}.td-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}.td-profile-stat{background:#fff;border-radius:16px;padding:12px}.td-profile-stat b{display:block;font-size:20px}.td-profile-stat span{font-size:10px;color:#6b6458;font-weight:700}.td-profile-block{background:#fff;border-radius:18px;padding:14px;margin-bottom:10px}.td-profile-block h3{font-size:13px;margin-bottom:9px}.td-history-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eee8de;font-size:11px}.td-history-row:first-of-type{border-top:0}.td-history-row span{color:#6b6458}.td-history-row b{font-size:12px}.td-profile-note{font-size:10px;line-height:1.5;color:#6b6458}
  `;document.head.appendChild(s);}
  function initials(name){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"ТД";}
  function injectProfileButton(){
    document.querySelectorAll("header.app .row").forEach(row=>{if(row.querySelector(".td-profile-btn"))return;const city=row.querySelector(".city");if(!city)return;const p=profile();const b=document.createElement("button");b.className="td-profile-btn";b.type="button";b.title="Профиль";b.setAttribute("aria-label","Открыть профиль");b.textContent=initials(p.name);b.addEventListener("click",openProfile);city.insertAdjacentElement("beforebegin",b);});
  }
  function todayRecord(){return snapshot()||history().find(x=>x.date===dayKey())||null;}
  function injectToday(){
    document.querySelector(".td-today-card")?.remove();if(!window.state||state.screen!=="home")return;const today=todayRecord();if(!today)return;const t=trend(today);const wrap=document.querySelector("#app .wrap");if(!wrap)return;const card=document.createElement("section");card.className="td-today-card";card.innerHTML=`<div class="td-today-kicker">Цена моей корзины сегодня</div><div class="td-today-total">${money(today.total)}</div><span class="td-today-trend ${t.kind}">${esc(t.text)}</span><div class="td-today-meta">${today.items} товаров · ${esc(today.storeId)}${t.prev?` · было ${money(t.prev.total)}`:""}</div>`;wrap.prepend(card);
  }
  function openProfile(){
    ensureCss();snapshot();document.querySelector(".td-profile-sheet")?.remove();const p=profile(),st=stats(),h=history().slice(-10).reverse();const sheet=document.createElement("section");sheet.className="td-profile-sheet";sheet.innerHTML=`<div class="td-profile-head"><button class="td-profile-back" type="button">←</button><div><b>Профиль</b><div class="sub">Твоя экономия и привычная корзина</div></div></div><div class="td-profile-body"><div class="td-profile-hero"><div class="td-profile-avatar">${esc(initials(p.name))}</div><div class="td-profile-name">${esc(p.name)}</div><div class="td-profile-edit"><input maxlength="40" value="${esc(p.name)}" aria-label="Имя"><button type="button">Сохранить</button></div></div><div class="td-profile-grid"><div class="td-profile-stat"><b>${st.days}</b><span>дней с историей</span></div><div class="td-profile-stat"><b>${st.best==null?"—":money(st.best)}</b><span>лучшая цена корзины</span></div></div><div class="td-profile-block"><h3>Последние цены корзины</h3>${h.length?h.map(x=>`<div class="td-history-row"><span>${esc(x.date)} · ${x.items} шт.</span><b>${money(x.total)}</b></div>`).join(""):'<p class="td-profile-note">История появится после первого сохранённого дня.</p>'}</div><div class="td-profile-block"><h3>Как это работает</h3><p class="td-profile-note">Пока профиль хранится только на этом устройстве. Мы сохраняем один снимок корзины за день и сравниваем его с предыдущими. Это не аккаунт и не облачная синхронизация — их добавим отдельно, когда появится backend авторизации.</p></div></div>`;document.body.appendChild(sheet);sheet.querySelector(".td-profile-back").addEventListener("click",()=>sheet.remove());const input=sheet.querySelector(".td-profile-edit input"),save=sheet.querySelector(".td-profile-edit button");save.addEventListener("click",()=>{saveProfile({name:input.value.trim()||"Покупатель"});sheet.remove();injectProfileButton();openProfile();});
  }
  function refresh(){ensureCss();snapshot();injectProfileButton();injectToday();}
  const obs=new MutationObserver(()=>requestAnimationFrame(refresh));function start(){ensureCss();obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});refresh();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("td:substitution-applied",refresh);window.addEventListener("td:retailer-prices-applied",refresh);
  window.TDProfileBasket={profile,saveProfile,snapshot,history,stats,trend,dayKey,openProfile};
})();
