(function(){
  "use strict";
  const KEY="td:shopping-session:v1";
  const blank=()=>({
    id:"shop_"+Date.now(),budget:null,currentTotal:0,location:"",stores:[],products:[],
    existingProducts:[],requiredProducts:[],preferredProducts:[],excludedProducts:[],excludedBrands:[],
    onlyProducts:[],quantityTargets:{},selectionMode:"auto",intent:"build",preferences:[],cookingPreference:"normal",
    deliveryPreference:"any",peopleCount:1,duration:1,userNotes:[],mode:"multi",history:[],updatedAt:new Date().toISOString()
  });
  const ARRAY_FIELDS=["stores","products","existingProducts","requiredProducts","preferredProducts","excludedProducts","excludedBrands","onlyProducts","preferences","userNotes","history"];
  function normalize(raw){
    const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
    const next={...blank(),...source};
    ARRAY_FIELDS.forEach(key=>{if(!Array.isArray(next[key]))next[key]=[]});
    if(!next.quantityTargets||typeof next.quantityTargets!=="object"||Array.isArray(next.quantityTargets))next.quantityTargets={};
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
  const snapshot=()=>JSON.parse(JSON.stringify({...state,history:[]}));
  function save(){
    state=normalize(state);
    state.updatedAt=new Date().toISOString();
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
    try{window.dispatchEvent(new CustomEvent("td:shopping-state",{detail:snapshot()}))}catch{}
    return state;
  }
  function commit(type,mutate,description){state.history.push({type,before:snapshot(),description,at:new Date().toISOString()});if(state.history.length>30)state.history.shift();mutate(state);return save();}
  function undo(){const event=state.history.pop();if(!event)return{ok:false,state,message:"Отменять пока нечего"};const rest=state.history;state=normalize({...event.before,history:rest});save();return{ok:true,state,message:`Вернул как было: ${event.description||event.type}`};}
  function reset(){state=normalize(null);return save();}
  function syncCart(){if(!window.state)return;state.cart=Object.fromEntries(state.products.filter(x=>x&&x.sourceId).map(x=>[x.sourceId,Math.max(1,Number(x.quantity)||1)]));window.state.cart={...state.cart};window.state.cartTouched=true;try{const saved=JSON.parse(localStorage.getItem("td")||"{}");localStorage.setItem("td",JSON.stringify({...saved,cart:window.state.cart,cartTouched:true}))}catch{}window.render?.();}
  window.TDShoppingState={get:()=>state,commit,undo,reset,save,snapshot,syncCart,normalize,operations:["RESET_BASKET","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_QUANTITY","CHANGE_STORE","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","SET_MODE","CLEAR_ONLY","SET_ONLY_PRODUCTS","SET_PRODUCT_AMOUNT","SET_INTENT","ADD_PREFERENCE","REQUIRE","PREFER","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","NOTE","REOPTIMIZE"]};
})();
