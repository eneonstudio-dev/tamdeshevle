(function(){
  "use strict";
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  let client=null, session=null, initPromise=null, syncTimer=null;
  const config=()=>window.TD_SUPABASE||null;
  const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};

  function configured(){const c=config();return !!(c&&/^https:\/\/.+\.supabase\.co$/.test(String(c.url||""))&&String(c.anonKey||"").length>20&&!String(c.url).includes("YOUR_PROJECT"));}
  function loadSdk(){return new Promise((resolve,reject)=>{if(window.supabase&&window.supabase.createClient)return resolve();const s=document.createElement("script");s.src=CDN;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error("Supabase SDK failed to load"));document.head.appendChild(s);});}
  function scheduleSync(){
    clearTimeout(syncTimer);
    // Auth callbacks run under the SDK lock. Start network work in a new task.
    syncTimer=setTimeout(async()=>{
      if(!session)return;
      try{await hydrateLocalFromCloud();await syncLocalToCloud();}
      catch(err){console.warn("Cloud sync failed",err);emit("td:cloud-sync-error",{message:String(err.message||err)});}
    },0);
  }
  function init(){
    if(!initPromise)initPromise=initialize().catch(err=>{initPromise=null;throw err;});
    return initPromise;
  }
  async function initialize(){
    if(!configured()){emit("td:auth-state",{configured:false,session:null});return null;}
    await loadSdk();const c=config();client=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session||null;
    client.auth.onAuthStateChange((_event,next)=>{session=next||null;emit("td:auth-state",{configured:true,session});scheduleSync();});
    emit("td:auth-state",{configured:true,session});
    if(session)scheduleSync();
    return client;
  }
  function user(){return session&&session.user?session.user:null;}
  async function signInWithEmail(email){const c=await init();if(!c)throw new Error("SUPABASE_NOT_CONFIGURED");const value=String(email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(value))throw new Error("EMAIL_INVALID");const redirectTo=location.origin+location.pathname;const {error}=await c.auth.signInWithOtp({email:value,options:{emailRedirectTo:redirectTo}});if(error)throw error;return true;}
  async function signOut(){const c=await init();if(!c)return;const {error}=await c.auth.signOut();if(error)throw error;session=null;emit("td:auth-state",{configured:true,session:null});}
  async function upsert(table,row,onConflict){const {data,error}=await client.from(table).upsert(row,onConflict?{onConflict}:undefined).select();if(error)throw error;return data;}
  function stableUuid(uid,suffix){const hex=String(uid||"").replace(/-/g,"").padEnd(32,"0").slice(0,31)+suffix;return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;}
  async function syncLocalToCloud(){
    if(!client||!user())return false;const uid=user().id;
    const p=read("td:profile",{}), td=read("td",{}), hist=read("td:basket-history",[]);
    await upsert("profiles",{user_id:uid,display_name:String(p.name||user().user_metadata?.display_name||"Покупатель").slice(0,40),updated_at:new Date().toISOString()},"user_id");
    if(td.cart&&Object.keys(td.cart).length){await upsert("baskets",{id:stableUuid(uid,"a"),user_id:uid,name:"Моя корзина",city:td.city||"msk",store_id:td.storeId||null,items:td.cart,is_default:true,updated_at:new Date().toISOString()},"id");}
    if(td.address){await upsert("addresses",{id:stableUuid(uid,"b"),user_id:uid,label:"Основной",address:String(td.address).slice(0,240),city:td.city||"msk",is_default:true,updated_at:new Date().toISOString()},"id");}
    for(const h of hist.slice(-90)){if(!h||!h.date)continue;await upsert("basket_history",{user_id:uid,day:h.date,city:h.city||"msk",store_id:h.storeId||null,total:Math.max(0,Math.round(Number(h.total)||0)),item_count:Math.max(0,Math.round(Number(h.items)||0)),items:h.cart||{},recorded_at:h.at||new Date().toISOString()},"user_id,day,city");}
    emit("td:cloud-synced",{userId:uid});return true;
  }
  async function cloudSummary(){
    if(!client||!user())return null;const uid=user().id;
    const queries=await Promise.all([
      client.from("profiles").select("*").eq("user_id",uid).maybeSingle(),
      client.from("baskets").select("*").eq("user_id",uid).order("updated_at",{ascending:false}),
      client.from("addresses").select("*").eq("user_id",uid).order("is_default",{ascending:false}),
      client.from("basket_history").select("*").eq("user_id",uid).order("day",{ascending:false}).limit(90)
    ]);
    for(const q of queries)if(q.error)throw q.error;
    return{profile:queries[0].data,baskets:queries[1].data||[],addresses:queries[2].data||[],history:queries[3].data||[]};
  }
  async function hydrateLocalFromCloud(){
    const cloud=await cloudSummary();if(!cloud)return false;
    const td=read("td",{}), localProfile=read("td:profile",{}), localHist=read("td:basket-history",[]);
    let changed=false;
    if(cloud.profile&&cloud.profile.display_name&&!localProfile.name){write("td:profile",{...localProfile,name:cloud.profile.display_name});changed=true;}
    const basket=cloud.baskets.find(x=>x.is_default)||cloud.baskets[0];
    if(basket&&(!td.cart||!Object.keys(td.cart).length)){td.cart=basket.items||{};td.city=basket.city||td.city||"msk";td.storeId=basket.store_id||td.storeId||null;changed=true;}
    const address=cloud.addresses.find(x=>x.is_default)||cloud.addresses[0];
    if(address&&!td.address){td.address=address.address;changed=true;}
    if(changed)write("td",td);
    if(!localHist.length&&cloud.history.length){write("td:basket-history",cloud.history.slice().reverse().map(h=>({date:h.day,city:h.city,storeId:h.store_id,total:h.total,items:h.item_count,cart:h.items||{},at:h.recorded_at})));changed=true;}
    if(changed)emit("td:cloud-hydrated",{userId:user().id});
    return changed;
  }
  function modal(){
    document.querySelector(".td-auth-modal")?.remove();const root=document.createElement("div");root.className="td-auth-modal";root.innerHTML=`<div class="td-auth-card"><button class="td-auth-x" aria-label="Закрыть">×</button><div class="td-auth-logo">ТД</div><h2>Твой аккаунт</h2><p>Войди по любой почте — Яндекс, Mail.ru, корпоративной или другой. Пришлём безопасную ссылку, пароль не нужен.</p>${configured()?`<form><input type="email" required autocomplete="email" inputmode="email" placeholder="name@yandex.ru" aria-label="Электронная почта"><button type="submit">Получить ссылку</button></form><div class="td-auth-hint">Подойдут, например: @yandex.ru, @mail.ru, @bk.ru, @inbox.ru и другие.</div><div class="td-auth-msg" aria-live="polite"></div>`:`<div class="td-auth-warning">Backend ещё не подключён. Нужны Project URL и publishable key.</div>`}</div>`;document.body.appendChild(root);root.querySelector(".td-auth-x").onclick=()=>root.remove();root.onclick=e=>{if(e.target===root)root.remove();};const form=root.querySelector("form");if(form)form.onsubmit=async e=>{e.preventDefault();const msg=root.querySelector(".td-auth-msg"),btn=form.querySelector("button"),email=form.querySelector("input").value;btn.disabled=true;msg.textContent="Отправляем письмо…";try{await signInWithEmail(email);msg.textContent="Ссылка отправлена. Проверь входящие и папку «Спам», затем открой ссылку из письма.";}catch(err){msg.textContent=err.message==="EMAIL_INVALID"?"Проверь адрес почты.":"Не получилось: "+(err.message||err);}finally{btn.disabled=false;}};
  }
  function css(){if(document.getElementById("td-auth-style"))return;const s=document.createElement("style");s.id="td-auth-style";s.textContent=`.td-auth-modal{position:fixed;inset:0;z-index:500;background:rgba(22,20,16,.55);display:grid;place-items:end center;padding:16px}.td-auth-card{width:min(398px,100%);background:#f4f1ea;border-radius:26px;padding:20px;position:relative}.td-auth-card h2{font-size:26px;letter-spacing:-.04em;margin:10px 0 6px}.td-auth-card p{font-size:12px;color:#6b6458;font-weight:700;line-height:1.5}.td-auth-logo{width:48px;height:48px;border-radius:15px;background:#0f7b4a;color:white;display:grid;place-items:center;font-weight:900}.td-auth-x{position:absolute;right:14px;top:14px;width:36px;height:36px;border:0;border-radius:50%;background:white;font-size:20px}.td-auth-card form{display:grid;gap:9px;margin-top:16px}.td-auth-card input{border:0;border-radius:14px;padding:13px 14px;font:700 14px Manrope,sans-serif}.td-auth-card form button{border:0;border-radius:14px;padding:13px;background:#161410;color:#fff;font:900 13px Manrope,sans-serif}.td-auth-hint{margin-top:9px;color:#80786b;font-size:10px;font-weight:700;line-height:1.45}.td-auth-msg,.td-auth-warning{margin-top:12px;font-size:11px;font-weight:700;line-height:1.45}.td-auth-warning{background:#fff3cd;padding:11px;border-radius:12px}`;document.head.appendChild(s);}
  window.addEventListener("td:auth-requested",()=>{css();modal();});
  window.TDAuth={init,configured,user,signInWithEmail,signOut,syncLocalToCloud,hydrateLocalFromCloud,cloudSummary,open:modal};
  css();init().catch(err=>{console.warn("Auth init failed",err);emit("td:auth-state",{configured:configured(),session:null,error:String(err.message||err)});});
})();
