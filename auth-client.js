(function(){
  "use strict";
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  let client=null, session=null, initPromise=null, busy=false, cloudState={status:"idle",message:"Облачная копия ещё не проверена"};
  const config=()=>window.TD_SUPABASE||null;
  const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};

  function configured(){const c=config();return !!(c&&/^https:\/\/.+\.supabase\.co$/.test(String(c.url||""))&&String(c.anonKey||"").length>20&&!String(c.url).includes("YOUR_PROJECT"));}
  function loadSdk(){return new Promise((resolve,reject)=>{if(window.supabase&&window.supabase.createClient)return resolve();const s=document.createElement("script");s.src=CDN;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error("Supabase SDK failed to load"));document.head.appendChild(s);});}
  function setCloudState(status,message){cloudState={status,message};emit("td:cloud-state",cloudState);}
  function assertUser(uid){if(user()?.id!==uid)throw new Error("ACCOUNT_CHANGED");}
  async function cloudOperation(action){
    await init();if(!user())throw new Error("SIGN_IN_REQUIRED");
    if(busy)throw new Error("SYNC_BUSY");
    const uid=user().id;busy=true;setCloudState("busy","Работаем с облачной копией…");
    try{return await action(uid);}
    catch(err){setCloudState("error","Не удалось завершить операцию. Попробуй ещё раз.");throw err;}
    finally{busy=false;}
  }
  function init(){
    if(!initPromise)initPromise=initialize().catch(err=>{initPromise=null;throw err;});
    return initPromise;
  }
  async function initialize(){
    if(!configured()){emit("td:auth-state",{configured:false,session:null});return null;}
    await loadSdk();const c=config();client=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session||null;
    if(session&&typeof client.auth.getUser==="function"){const verified=await client.auth.getUser();if(verified.error){session=null;}else if(verified.data&&verified.data.user){session={...session,user:verified.data.user};}}
    client.auth.onAuthStateChange((_event,next)=>{const changed=session?.user?.id!==next?.user?.id;session=next||null;if(changed)setCloudState("idle","Облачная копия ещё не проверена");emit("td:auth-state",{configured:true,session});});
    if(session&&/[#?](access_token|refresh_token|token_hash|code|error)/.test(String(location.href||""))&&window.history?.replaceState){window.history.replaceState(null,"",location.origin+location.pathname);}
    emit("td:auth-state",{configured:true,session,verified:Boolean(session)});
    return client;
  }
  function user(){return session&&session.user?session.user:null;}
  async function signInWithEmail(email){const c=await init();if(!c)throw new Error("SUPABASE_NOT_CONFIGURED");const value=String(email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(value))throw new Error("EMAIL_INVALID");const redirectTo=location.origin+location.pathname;const {error}=await c.auth.signInWithOtp({email:value,options:{emailRedirectTo:redirectTo}});if(error)throw error;return true;}
  async function signOut(){if(busy)throw new Error("SYNC_BUSY");const c=await init();if(!c)return;const {error}=await c.auth.signOut();if(error)throw error;session=null;emit("td:auth-state",{configured:true,session:null});}
  async function upsert(table,row,onConflict){const {data,error}=await client.from(table).upsert(row,onConflict?{onConflict}:undefined).select();if(error)throw error;return data;}
  function stableUuid(uid,suffix){const hex=String(uid||"").replace(/-/g,"").padEnd(32,"0").slice(0,31)+suffix;return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;}
  async function syncLocalToCloud(){return cloudOperation(async uid=>{
    const p=read("td:profile",{}), td=JSON.parse(JSON.stringify(window.state||read("td",{}))), hist=read("td:basket-history",[]), ledger=read("td:savings-ledger",[]);
    const name=String(p.name||user().user_metadata?.display_name||"Покупатель").slice(0,40);
    await upsert("profiles",{user_id:uid,display_name:name,updated_at:new Date().toISOString()},"user_id");assertUser(uid);
    const basketId=stableUuid(uid,"a"),cart=td.cart||{};
    await upsert("baskets",{id:basketId,user_id:uid,name:"Моя корзина",city:td.city||"msk",store_id:td.storeId||null,items:cart,is_default:true,updated_at:new Date().toISOString()},"id");assertUser(uid);
    if(td.address){await upsert("addresses",{id:stableUuid(uid,"b"),user_id:uid,label:"Основной",address:String(td.address).slice(0,240),city:td.city||"msk",is_default:true,updated_at:new Date().toISOString()},"id");assertUser(uid);}
    for(const h of hist.filter(x=>x&&x.verified===true).slice(-90)){if(!h.date)continue;assertUser(uid);await upsert("basket_history",{user_id:uid,day:h.date,city:h.city||"msk",store_id:h.storeId||null,total:Math.max(0,Math.round(Number(h.total)||0)),item_count:Math.max(0,Math.round(Number(h.items)||0)),items:h.cart||{},recorded_at:h.at||new Date().toISOString()},"user_id,day,city");}
    for(const x of ledger.filter(x=>x&&x.verified===true&&Number(x.saving)>0).slice(-200)){assertUser(uid);await upsert("savings_ledger",{id:x.id,user_id:uid,signature:x.signature,occurred_at:x.at,store_id:x.storeId,store_name:x.storeName,channel:x.channel,basket_total:Math.round(Number(x.total)),saving:Math.round(Number(x.saving)),cart:x.cart||{},verified:true},"user_id,signature");}
    const cloud=await cloudSummary();assertUser(uid);
    const saved=cloud?.baskets.find(b=>b.id===basketId);
    const sameCart=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>a[k]===b[k]);
    if(!saved||!sameCart(saved.items||{},cart)||saved.city!==(td.city||"msk")||saved.store_id!==(td.storeId||null)||cloud.profile?.display_name!==name)throw new Error("CLOUD_VERIFY_FAILED");
    const localSavings=ledger.filter(x=>x&&x.verified===true&&Number(x.saving)>0).slice(-200);if(localSavings.some(x=>!cloud.savings.some(saved=>saved.signature===x.signature)))throw new Error("CLOUD_VERIFY_FAILED");
    setCloudState("saved","Корзина сохранена в облаке · "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}));
    emit("td:cloud-synced",{userId:uid});return true;
  });}
  async function cloudSummary(){
    if(!client||!user())return null;const uid=user().id;
    const queries=await Promise.all([
      client.from("profiles").select("*").eq("user_id",uid).maybeSingle(),
      client.from("baskets").select("*").eq("user_id",uid).order("updated_at",{ascending:false}),
      client.from("addresses").select("*").eq("user_id",uid).order("is_default",{ascending:false}),
      client.from("basket_history").select("*").eq("user_id",uid).order("day",{ascending:false}).limit(90),
      client.from("savings_ledger").select("*").eq("user_id",uid).order("occurred_at",{ascending:false}).limit(200)
    ]);
    for(const q of queries)if(q.error)throw q.error;
    return{profile:queries[0].data,baskets:queries[1].data||[],addresses:queries[2].data||[],history:queries[3].data||[],savings:queries[4].data||[]};
  }
  async function hydrateLocalFromCloud(){return cloudOperation(async uid=>{
    const cloud=await cloudSummary();assertUser(uid);
    const basket=cloud?.baskets.find(x=>x.is_default)||cloud?.baskets[0];
    if(!basket){setCloudState("empty","В облаке пока нет корзины. Сначала сохрани её на этом устройстве.");return false;}
    const td=read("td",{}),localProfile=read("td:profile",{});
    const address=cloud.addresses.find(x=>x.is_default)||cloud.addresses[0];
    const restored={...td,cart:basket.items||{},city:basket.city||"msk",storeId:basket.store_id||null,address:address?.address||""};
    // Keep an undo copy before replacing device data.
    if(!write("td:before-cloud-restore",{td:window.state||td,profile:localProfile,history:read("td:basket-history",[])}))throw new Error("LOCAL_STORAGE_FAILED");
    if(!write("td",restored))throw new Error("LOCAL_STORAGE_FAILED");
    if(cloud.profile&&!write("td:profile",{...localProfile,name:cloud.profile.display_name}))throw new Error("LOCAL_STORAGE_FAILED");
    if(!write("td:basket-history",cloud.history.slice().reverse().map(h=>({date:h.day,city:h.city,storeId:h.store_id,total:h.total,items:h.item_count,cart:h.items||{},at:h.recorded_at,verified:true}))))throw new Error("LOCAL_STORAGE_FAILED");
    if(!write("td:savings-ledger",cloud.savings.slice().reverse().map(x=>({id:x.id,signature:x.signature,at:x.occurred_at,storeId:x.store_id,storeName:x.store_name,channel:x.channel,total:x.basket_total,saving:x.saving,cart:x.cart||{},verified:true}))))throw new Error("LOCAL_STORAGE_FAILED");
    if(window.state)Object.assign(window.state,{cart:restored.cart,city:restored.city,storeId:restored.storeId,address:restored.address});
    if(typeof window.render==="function")window.render();
    setCloudState("loaded","Корзина восстановлена из облака");emit("td:cloud-hydrated",{userId:uid});return true;
  });}
  const RECEIPT_BUCKET="receipt-proofs", RECEIPT_TYPES=new Set(["image/jpeg","image/png","image/webp","image/heic"]), RECEIPT_MAX_BYTES=10*1024*1024;
  function receiptFileName(file){const type=String(file&&file.type||"").toLowerCase();const ext=type==="image/png"?"png":type==="image/webp"?"webp":type==="image/heic"?"heic":"jpg";const id=window.crypto&&typeof window.crypto.randomUUID==="function"?window.crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;return `${id}.${ext}`;}
  async function submitReceiptEvidence(input){return cloudOperation(async uid=>{
    const file=input&&input.file, observation=input&&input.observation;
    if(!file||!RECEIPT_TYPES.has(String(file.type||"").toLowerCase())||file.size<1||file.size>RECEIPT_MAX_BYTES)throw new Error("RECEIPT_FILE_INVALID");
    const check=window.TDReceiptObservations&&window.TDReceiptObservations.validate(observation);
    if(!check||!check.ok)throw new Error("RECEIPT_INVALID");
    const store=observation.store||{};
    if(!store.store_id||!store.chain_id||!store.address||!observation.receipt_id)throw new Error("RECEIPT_SCOPE_INVALID");
    const path=`${uid}/${receiptFileName(file)}`;
    const {error:uploadError}=await client.storage.from(RECEIPT_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError)throw uploadError;
    assertUser(uid);
    const row={user_id:uid,receipt_id:observation.receipt_id,chain_id:store.chain_id,store_id:store.store_id,store_address:store.address,observed_at:observation.observed_at,payload:observation,proof_path:path,status:"pending"};
    const {data,error}=await client.from("receipt_submissions").insert(row).select("id,status,submitted_at").single();
    if(error){await client.storage.from(RECEIPT_BUCKET).remove([path]);throw error;}
    assertUser(uid);emit("td:receipt-submitted",{id:data.id,status:data.status});return data;
  });}
  async function receiptQueue(){await init();if(!user())throw new Error("SIGN_IN_REQUIRED");const uid=user().id;const {data,error}=await client.from("receipt_submissions").select("id,receipt_id,store_id,store_address,observed_at,status,submitted_at,reviewed_at,review_note,payload").eq("user_id",uid).order("submitted_at",{ascending:false}).limit(30);if(error)throw error;assertUser(uid);return data||[];}
  async function receiptPriceHistory(){await init();if(!user())throw new Error("SIGN_IN_REQUIRED");const uid=user().id;const {data,error}=await client.from("receipt_price_history").select("id,submission_id,line_index,chain_id,store_id,external_store_id,store_address,product_id,unit_price,observed_at,recorded_at,expires_at").order("observed_at",{ascending:false}).limit(100);if(error)throw error;assertUser(uid);return data||[];}
  async function isReceiptReviewer(){await init();if(!user())return false;const uid=user().id;const {data,error}=await client.from("receipt_reviewers").select("user_id").eq("user_id",uid).maybeSingle();if(error)throw error;assertUser(uid);return Boolean(data);}
  async function receiptReviewQueue(){await init();if(!user())throw new Error("SIGN_IN_REQUIRED");const uid=user().id;if(!await isReceiptReviewer())throw new Error("REVIEWER_REQUIRED");const {data,error}=await client.from("receipt_submissions").select("id,receipt_id,user_id,chain_id,store_id,store_address,observed_at,status,submitted_at,reviewed_at,review_note,payload,proof_path").order("submitted_at",{ascending:false}).limit(50);if(error)throw error;assertUser(uid);return data||[];}
  async function receiptProofUrl(path){await init();if(!user()||!await isReceiptReviewer())throw new Error("REVIEWER_REQUIRED");const {data,error}=await client.storage.from(RECEIPT_BUCKET).createSignedUrl(String(path||""),300);if(error)throw error;return data&&data.signedUrl||null;}
  async function reviewReceipt(input){await init();if(!user())throw new Error("SIGN_IN_REQUIRED");const uid=user().id;if(!await isReceiptReviewer())throw new Error("REVIEWER_REQUIRED");const submissionId=String(input&&input.submissionId||"");const decisions=Array.isArray(input&&input.decisions)?input.decisions:[];if(!submissionId||!decisions.length)throw new Error("REVIEW_INCOMPLETE");for(const raw of decisions){const lineIndex=Number(raw.lineIndex),decision=raw.decision,productId=String(raw.productId||"").trim()||null,unitPrice=Number(raw.unitPrice),note=String(raw.note||"").slice(0,300)||null;if(!Number.isInteger(lineIndex)||lineIndex<0||!["accepted","rejected"].includes(decision)||decision==="accepted"&&(!productId||!Number.isFinite(unitPrice)||unitPrice<=0))throw new Error("REVIEW_INCOMPLETE");const row={submission_id:submissionId,line_index:lineIndex,reviewer_id:uid,decision,product_id:productId,unit_price:Number.isFinite(unitPrice)&&unitPrice>0?unitPrice:null,note,reviewed_at:new Date().toISOString()};const existing=await client.from("receipt_review_lines").select("submission_id").eq("submission_id",submissionId).eq("line_index",lineIndex).maybeSingle();if(existing.error)throw existing.error;if(existing.data){const {error}=await client.from("receipt_review_lines").update({decision:row.decision,product_id:row.product_id,unit_price:row.unit_price,note:row.note,reviewed_at:row.reviewed_at}).eq("submission_id",submissionId).eq("line_index",lineIndex);if(error)throw error;}else{const {error}=await client.from("receipt_review_lines").insert(row);if(error)throw error;}}
    const accepted=decisions.filter(x=>x.decision==="accepted").length,status=accepted?"accepted":"rejected",reviewNote=accepted?`Подтверждено строк: ${accepted} из ${decisions.length}`:"Все строки отклонены";const {error}=await client.from("receipt_submissions").update({status,reviewed_at:new Date().toISOString(),review_note:reviewNote}).eq("id",submissionId);if(error)throw error;assertUser(uid);emit("td:receipt-reviewed",{id:submissionId,status});return{status,accepted,total:decisions.length};}
  function modal(){
    document.querySelector(".td-auth-modal")?.remove();const root=document.createElement("div");root.className="td-auth-modal";root.innerHTML=`<div class="td-auth-card"><button class="td-auth-x" aria-label="Закрыть">×</button><div class="td-auth-logo">ТД</div><h2>Твой аккаунт</h2><p>Войди по любой почте — Яндекс, Mail.ru, корпоративной или другой. Пришлём безопасную ссылку, пароль не нужен.</p>${configured()?`<form><input type="email" required autocomplete="email" inputmode="email" placeholder="name@yandex.ru" aria-label="Электронная почта"><button type="submit">Получить ссылку</button></form><div class="td-auth-hint">Подойдут, например: @yandex.ru, @mail.ru, @bk.ru, @inbox.ru и другие.</div><div class="td-auth-msg" aria-live="polite"></div>`:`<div class="td-auth-warning">Вход временно недоступен. Попробуй позже.</div>`}</div>`;document.body.appendChild(root);root.querySelector(".td-auth-x").onclick=()=>root.remove();root.onclick=e=>{if(e.target===root)root.remove();};const form=root.querySelector("form");if(form)form.onsubmit=async e=>{e.preventDefault();const msg=root.querySelector(".td-auth-msg"),btn=form.querySelector("button"),email=form.querySelector("input").value;btn.disabled=true;msg.textContent="Отправляем письмо…";try{await signInWithEmail(email);msg.textContent="Ссылка отправлена. Проверь входящие и папку «Спам», затем открой ссылку из письма.";}catch(err){msg.textContent=err.message==="EMAIL_INVALID"?"Проверь адрес почты.":"Не получилось: "+(err.message||err);}finally{btn.disabled=false;}};
  }
  function css(){if(document.getElementById("td-auth-style"))return;const s=document.createElement("style");s.id="td-auth-style";s.textContent=`.td-auth-modal{position:fixed;inset:0;z-index:500;background:rgba(22,20,16,.55);display:grid;place-items:end center;padding:16px}.td-auth-card{width:min(398px,100%);background:#f4f1ea;border-radius:26px;padding:20px;position:relative}.td-auth-card h2{font-size:26px;letter-spacing:-.04em;margin:10px 0 6px}.td-auth-card p{font-size:12px;color:#6b6458;font-weight:700;line-height:1.5}.td-auth-logo{width:48px;height:48px;border-radius:15px;background:#0f7b4a;color:white;display:grid;place-items:center;font-weight:900}.td-auth-x{position:absolute;right:14px;top:14px;width:36px;height:36px;border:0;border-radius:50%;background:white;font-size:20px}.td-auth-card form{display:grid;gap:9px;margin-top:16px}.td-auth-card input{border:0;border-radius:14px;padding:13px 14px;font:700 14px Manrope,sans-serif}.td-auth-card form button{border:0;border-radius:14px;padding:13px;background:#161410;color:#fff;font:900 13px Manrope,sans-serif}.td-auth-hint{margin-top:9px;color:#80786b;font-size:10px;font-weight:700;line-height:1.45}.td-auth-msg,.td-auth-warning{margin-top:12px;font-size:11px;font-weight:700;line-height:1.45}.td-auth-warning{background:#fff3cd;padding:11px;border-radius:12px}`;document.head.appendChild(s);}
  window.addEventListener("td:auth-requested",()=>{css();modal();});
  window.TDAuth={init,configured,user,signInWithEmail,signOut,syncLocalToCloud,hydrateLocalFromCloud,cloudSummary,submitReceiptEvidence,receiptQueue,receiptPriceHistory,isReceiptReviewer,receiptReviewQueue,receiptProofUrl,reviewReceipt,cloudStatus:()=>({...cloudState}),open:modal};
  css();init().catch(err=>{console.warn("Auth init failed",err);emit("td:auth-state",{configured:configured(),session:null,error:String(err.message||err)});});
})();
