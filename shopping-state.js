(function(){
  "use strict";
  const KEY="td:shopping-session:v1";
  const blank=()=>({
    id:"shop_"+Date.now(),budget:null,currentTotal:0,location:"",stores:[],products:[],lastPlans:[],
    existingProducts:[],requiredProducts:[],preferredProducts:[],excludedProducts:[],excludedBrands:[],
    onlyProducts:[],quantityTargets:{},selectionMode:"auto",intent:"build",preferences:[],cookingPreference:"normal",
    deliveryPreference:"any",peopleCount:1,duration:1,userNotes:[],mode:"multi",shoppingIntelligence:null,history:[],updatedAt:new Date().toISOString()
  });
  const ARRAY_FIELDS=["stores","products","lastPlans","existingProducts","requiredProducts","preferredProducts","excludedProducts","excludedBrands","onlyProducts","preferences","userNotes","history"];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function normalize(raw){
    const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
    const next={...blank(),...source};
    ARRAY_FIELDS.forEach(key=>{if(!Array.isArray(next[key]))next[key]=[]});
    if(!next.quantityTargets||typeof next.quantityTargets!=="object"||Array.isArray(next.quantityTargets))next.quantityTargets={};
    if(next.shoppingIntelligence!=null&&(typeof next.shoppingIntelligence!=="object"||Array.isArray(next.shoppingIntelligence)))next.shoppingIntelligence=null;
    next.peopleCount=Math.max(1,Number(next.peopleCount)||1);
    next.duration=Math.max(1,Number(next.duration)||1);
    next.currentTotal=Math.max(0,Number(next.currentTotal)||0);
    next.budget=next.budget==null?null:Math.max(0,Number(next.budget)||0);
    if(!["auto","only"].includes(next.selectionMode))next.selectionMode="auto";
    if(!["one","multi"].includes(next.mode))next.mode="multi";
    if(typeof next.intent!=="string"||!next.intent)next.intent="build";
    return next;
  }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return normalize(null)}}
  let state=load();
  const snapshot=()=>{pruneStalePlans(state);return clone({...state,history:[]})};
  function save(){
    state=normalize(state);
    pruneStalePlans(state);
    state.updatedAt=new Date().toISOString();
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
    try{window.dispatchEvent(new CustomEvent("td:shopping-state",{detail:snapshot()}))}catch{}
    return state;
  }
  function commit(type,mutate,description){state.history.push({type,before:snapshot(),description,at:new Date().toISOString()});if(state.history.length>30)state.history.shift();mutate(state);return save();}
  function undo(){const event=state.history.pop();if(!event)return{ok:false,state,message:"Отменять пока нечего"};const rest=state.history;state=normalize({...event.before,history:rest});save();return{ok:true,state,message:`Вернул как было: ${event.description||event.type}`};}
  function reset(){state=normalize(null);return save();}

  function normalizedCart(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return{};
    const out={};
    for(const [id,raw] of Object.entries(value)){
      const qty=Math.min(99,Math.max(0,Math.floor(Number(raw)||0)));
      if(!qty)continue;
      const known=state.products.some(line=>line&&(line.sourceId===id||line.id===id))
        ||(typeof PRODUCTS!=="undefined"&&Array.isArray(PRODUCTS)&&PRODUCTS.some(product=>product?.id===id))
        ||Boolean(window.TDStoreAdapters?.catalog?.().some?.(product=>product?.id===id));
      if(known)out[id]=qty;
    }
    return out;
  }
  function cartSignature(cart){return Object.entries(normalizedCart(cart)).sort(([a],[b])=>a.localeCompare(b)).map(([id,qty])=>`${id}:${qty}`).join("|")}
  function productSignature(products){
    const map={};
    for(const line of Array.isArray(products)?products:[]){const id=line?.sourceId||line?.id,qty=Math.min(99,Math.max(0,Math.floor(Number(line?.quantity)||0)));if(id&&qty)map[id]=(map[id]||0)+qty;}
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([id,qty])=>`${id}:${qty}`).join("|");
  }
  function planMatchesProducts(plan,products=state.products){
    if(!plan||!Array.isArray(plan.products)||!plan.products.length||!Array.isArray(products)||!products.length)return false;
    const expected=productSignature(products),actual=productSignature(plan.products);
    return Boolean(expected&&actual&&expected===actual);
  }
  function pruneStalePlans(target=state){
    if(!target||typeof target!=="object")return false;
    const raw=Array.isArray(target.lastPlans)?target.lastPlans:[];
    if(!raw.length){if(!Array.isArray(target.lastPlans))target.lastPlans=[];return false}
    const fresh=raw.filter(plan=>planMatchesProducts(plan,target.products));
    if(fresh.length===raw.length)return false;
    target.lastPlans=fresh;
    return true;
  }
  function currentPlans(){pruneStalePlans(state);return state.lastPlans}
  function appProduct(id){
    const app=typeof PRODUCTS!=="undefined"&&Array.isArray(PRODUCTS)?PRODUCTS.find(product=>product?.id===id):null;
    if(app)return app;
    try{return window.TDStoreAdapters?.catalog?.().find?.(product=>product?.id===id)||null}catch{return null}
  }
  function lineForCart(id,quantity){
    const previous=state.products.find(line=>line&&(line.sourceId===id||line.id===id))||null;
    const product=appProduct(id)||previous;
    if(!product)return null;
    const storeId=previous?.storeId||window.state?.storeId||state.stores?.[0]||"";
    let quote=null;
    try{quote=storeId?window.TDStoreAdapters?.adapter?.(storeId)?.getPrice?.(id,"shelf"):null}catch{}
    const quoted=Number(quote?.value),previousUnit=Number(previous?.unitPrice??previous?.price);
    const unitPrice=Number.isFinite(quoted)?quoted:Number.isFinite(previousUnit)?previousUnit:null;
    const quality=quote?.quality||previous?.quality||"UNKNOWN";
    return{
      ...(previous?clone(previous):{}),id:product.id||id,sourceId:id,name:product.name||previous?.name||id,
      pack:product.pack||previous?.pack||"",emoji:product.emoji||previous?.emoji||"•",brand:product.brand||previous?.brand||"",
      quantity,storeId,unitPrice,price:unitPrice,quality
    };
  }
  function applyCartToState(target,cart){
    const normalized=normalizedCart(cart),ids=Object.keys(normalized),lines=ids.map(id=>lineForCart(id,normalized[id])).filter(Boolean);
    target.products=lines;
    target.requiredProducts=[...ids];
    target.onlyProducts=[...ids];
    target.selectionMode="only";
    target.intent="manual";
    target.quantityTargets=Object.fromEntries(ids.map(id=>[id,{amount:normalized[id],unit:"pack"}]));
    target.excludedProducts=(target.excludedProducts||[]).filter(id=>!ids.includes(id));
    target.lastPlans=[];
    target.currentTotal=lines.length&&lines.every(line=>Number.isFinite(Number(line.price)))?lines.reduce((sum,line)=>sum+Number(line.price)*line.quantity,0):0;
    return normalized;
  }
  function syncFromCart(cart,options={}){
    const normalized=normalizedCart(cart);
    if(cartSignature(normalized)===productSignature(state.products))return{changed:false,cart:normalized,state};
    const mutate=target=>applyCartToState(target,normalized);
    if(options.record===false){mutate(state);save();}
    else commit("SYNC_MANUAL_CART",mutate,options.description||"Ручное изменение корзины");
    try{window.dispatchEvent(new CustomEvent("td:unified-cart",{detail:{source:"manual",cart:{...normalized}}}))}catch{}
    window.TDShoppingAssistant?.refresh?.();
    return{changed:true,cart:normalized,state};
  }
  function syncCart(){
    if(!window.state)return false;
    const cart=Object.fromEntries(state.products.filter(x=>x&&x.sourceId).map(x=>[x.sourceId,Math.min(99,Math.max(1,Number(x.quantity)||1))]));
    state.cart={...cart};
    window.state.cart={...cart};
    window.state.cartTouched=true;
    try{const saved=JSON.parse(localStorage.getItem("td")||"{}");localStorage.setItem("td",JSON.stringify({...saved,cart:window.state.cart,cartTouched:true}))}catch{}
    try{window.dispatchEvent(new CustomEvent("td:unified-cart",{detail:{source:"bai",cart:{...cart}}}))}catch{}
    window.render?.();
    return true;
  }
  window.TDShoppingState={get:()=>{pruneStalePlans(state);return state},commit,undo,reset,save,snapshot,syncCart,syncFromCart,normalizedCart,cartSignature,productSignature,planMatchesProducts,currentPlans,pruneStalePlans,normalize,operations:["RESET_BASKET","REBUILD_PRODUCTS","SET_SHOPPING_INTENT","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_QUANTITY","CHANGE_STORE","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","SET_MODE","CLEAR_ONLY","SET_ONLY_PRODUCTS","SET_PRODUCT_AMOUNT","SET_INTENT","ADD_PREFERENCE","REQUIRE","PREFER","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","NOTE","REOPTIMIZE"]};
})();
