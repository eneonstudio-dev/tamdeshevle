(function(){
  "use strict";
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  let client=null, session=null, ready=false;
  const config=()=>window.TD_SUPABASE||null;
  const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v}catch{return f}};

  function configured(){const c=config();return !!(c&&/^https:\/\/.+\.supabase\.co$/.test(String(c.url||""))&&String(c.anonKey||"").length>20&&!String(c.url).includes("YOUR_PROJECT"));}
  function loadSdk(){return new Promise((resolve,reject)=>{if(window.supabase&&window.supabase.createClient)return resolve();const s=document.createElement("script");s.src=CDN;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error("Supabase SDK failed to load"));document.head.appendChild(s);});}
  async function init(){
    if(ready)return client;
    ready=true;
    if(!configured()){emit("td:auth-state",{configured:false,session:null});return null;}
    await loadSdk();const c=config();client=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await client.auth.getSession();session=data.session||null;
    client.auth.onAuthStateChange(async(_event,next)=>{session=next||null;emit("td:auth-state",{configured:true,session});if(session)await syncLocalToCloud();});
    emit("td:auth-state",{configured:true,session});if(session)await syncLocalToCloud();return client;
  }
  function user(){return session&&session.user?session.user:null;}
  async function signInWithEmail(email){const c=await init();if(!c)throw new Error("SUPABASE_NOT_CONFIGURED");const redirectTo=location.origin+location.pathname;const {error}=await c.auth.signInWithOtp({email:String(email||"").trim(),options:{emailRedirectTo:redirectTo}});if(error)throw error;return true;}
  async function signOut(){const c=await init();if(!c)return;const {error}=await c.auth.signOut();if(error)throw error;session=null;emit("td:auth-state",{configured:true,session:null});}
  async function upsert(table,row,onConflict){const {error}=await client.from(table).upsert(row,onConflict?{onConflict}:undefined);if(error)throw error;}
  async function syncLocalToCloud(){
    if(!client||!user())return false;const uid=user().id;
    const p=read("td:profile",{}), td=read("td",{}), hist=read("td:basket-history",[]);
    await upsert("profiles",{user_id:uid,display_name:String(p.name||user().user_metadata?.display_name||"Покупатель").slice(0,40),updated_at:new Date().toISOString()},"user_id");
    if(td.cart&&Object.keys(td.cart).length){await upsert("baskets",{user_id:uid,name:"Моя корзина",city:td.city||"msk",store_id:td.storeId||null,items:td.cart,is_default:true,updated_at:new Date().toISOString()});}
    if(td.address){const {data:existing}=await client.from("addresses").select("id").eq("user_id",uid).eq("is_default",true).limit(1);const row={user_id:uid,label:"Основной",address:String(td.address).slice(0,240),city:td.city||"msk",is_default:true,updated_at:new Date().toISOString()};if(existing&&existing[0])row.id=existing[0].id;await upsert("addresses",row);}
    for(const h of hist.slice(-90)){if(!h||!h.date)continue;await upsert("basket_history",{user_id:uid,day:h.date,city:h.city||"msk",store_id:h.storeId||null,total:Math.max(0,Math.round(Number(h.total)||0)),item_count:Math.max(0,Math.round(Number(h.items)||0)),items:h.cart||{},recorded_at:h.at||new Date().toISOString()},"user_id,day,city");}
    emit("td:cloud-synced",{userId:uid});return true;
  }
  async function cloudSummary(){if(!client||!user())return null;const uid=user().id;const [{data:profile},{data:baskets},{data:addresses},{data:history}]=await Promise.all([client.from("profiles").select("*").eq("user_id",uid).maybeSingle(),client.from("baskets").select("*").eq("user_id",uid).order("updated_at",{ascending:false}),client.from("addresses").select("*").eq("user_id",uid).order("is_default",{ascending:false}),client.from("basket_history").select("*").eq("user_id",uid).order("day",{ascending:false}).limit(90)]);return{profile,baskets:baskets||[],addresses:addresses||[],history:history||[]};}
  function modal(){
    document.querySelector(".td-auth-modal")?.remove();const root=document.createElement("div");root.className="td-auth-modal";root.innerHTML=`<div class="td-auth-card"><button class="td-auth-x" aria-label="Закрыть">×</button><div class="td-auth-logo">ТД</div><h2>Твой аккаунт</h2><p>Войди по email. Пришлём безопасную ссылку — пароль не нужен.</p>${configured()?`<form><input type="email" required autocomplete="email" placeholder="you@example.com"><button type="submit">Получить ссылку</button></form><div class="td-auth-msg"></div>`:`<div class="td-auth-warning">Backend подготовлен, но Supabase-проект ещё не подключён. Нужны Project URL и anon key.</div>`}</div>`;document.body.appendChild(root);root.querySelector(".td-auth-x").onclick=()=>root.remove();root.onclick=e=>{if(e.target===root)root.remove();};const form=root.querySelector("form");if(form)form.onsubmit=async e=>{e.preventDefault();const msg=root.querySelector(".td-auth-msg"),btn=form.querySelector("button"),email=form.querySelector("input").value;btn.disabled=true;msg.textContent="Отправляем…";try{await signInWithEmail(email);msg.textContent="Ссылка отправлена. Открой почту и вернись сюда.";}catch(err){msg.textContent="Не получилось: "+(err.message||err);}finally{btn.disabled=false;}};
  }
  function css(){if(document.getElementById("td-auth-style"))return;const s=document.createElement("style");s.id="td-auth-style";s.textContent=`.td-auth-modal{position:fixed;inset:0;z-index:500;background:rgba(22,20,16,.55);display:grid;place-items:end center;padding:16px}.td-auth-card{width:min(398px,100%);background:#f4f1ea;border-radius:26px;padding:20px;position:relative}.td-auth-card h2{font-size:26px;letter-spacing:-.04em;margin:10px 0 6px}.td-auth-card p{font-size:12px;color:#6b6458;font-weight:700;line-height:1.5}.td-auth-logo{width:48px;height:48px;border-radius:15px;background:#0f7b4a;color:white;display:grid;place-items:center;font-weight:900}.td-auth-x{position:absolute;right:14px;top:14px;width:36px;height:36px;border:0;border-radius:50%;background:white;font-size:20px}.td-auth-card form{display:grid;gap:9px;margin-top:16px}.td-auth-card input{border:0;border-radius:14px;padding:13px 14px;font:700 14px Manrope,sans-serif}.td-auth-card form button{border:0;border-radius:14px;padding:13px;background:#161410;color:#fff;font:900 13px Manrope,sans-serif}.td-auth-msg,.td-auth-warning{margin-top:12px;font-size:11px;font-weight:700;line-height:1.45}.td-auth-warning{background:#fff3cd;padding:11px;border-radius:12px}`;document.head.appendChild(s);}
  window.addEventListener("td:auth-requested",()=>{css();modal();});
  window.TDAuth={init,configured,user,signInWithEmail,signOut,syncLocalToCloud,cloudSummary,open:modal};
  css();init().catch(err=>{console.warn("Auth init failed",err);emit("td:auth-state",{configured:configured(),session:null,error:String(err.message||err)});});
})();
