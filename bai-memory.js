(() => {
  "use strict";
  const KEY="td_bai_memory_v1", low=v=>String(v||"").toLowerCase().replace(/ё/g,"е"), uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const empty=()=>({version:1,updatedAt:0,turns:0,preferences:[],dislikes:[],productsLiked:[],productsAvoided:[],cooking:null,usualBudget:null,usualPeople:null,storeMode:null,corrections:0});
  function load(){try{return {...empty(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return empty()}}
  let profile=load();
  function save(){profile.updatedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(profile))}catch{}return profile}
  function learn(raw,routed,state={}){const t=low(raw),ops=routed?.operations||[];profile.turns++;
    for(const o of ops){if(o.type==="ADD_PREFERENCE"||o.type==="PREFER")profile.preferences=uniq([...profile.preferences,String(o.value)]);if(o.type==="SET_COOKING")profile.cooking=o.value;if(o.type==="SET_PEOPLE")profile.usualPeople=Number(o.value)||profile.usualPeople;if(o.type==="CHANGE_BUDGET"&&Number(o.value)>0)profile.usualBudget=Number(o.value);if(o.type==="SET_MODE")profile.storeMode=o.value;if(o.type==="ADD_PRODUCT"||o.type==="REQUIRE")profile.productsLiked=uniq([...profile.productsLiked,String(o.value)]);if(o.type==="REMOVE_PRODUCT")profile.productsAvoided=uniq([...profile.productsAvoided,String(o.value)]);if(o.type==="REPLACE_PRODUCT"&&o.value){profile.productsAvoided=uniq([...profile.productsAvoided,String(o.value.from)]);profile.productsLiked=uniq([...profile.productsLiked,String(o.value.to)])}}
    if(/не люблю|не нравится|не предлагай|не бери|больше не/.test(t))profile.corrections++;
    return save()}
  function defaults(state={}){const ops=[];if(!state.cookingPreference&&profile.cooking)ops.push({type:"SET_COOKING",value:profile.cooking});if((!state.peopleCount||state.peopleCount===1)&&profile.usualPeople>1)ops.push({type:"SET_PEOPLE",value:profile.usualPeople});if(!state.mode&&profile.storeMode)ops.push({type:"SET_MODE",value:profile.storeMode});return ops}
  function hint(){const bits=[];if(profile.cooking==="minimal")bits.push("обычно без лишней готовки");if(profile.usualPeople>1)bits.push(`обычно на ${profile.usualPeople}`);if(profile.preferences.includes("budget"))bits.push("цена важна");if(profile.preferences.includes("hearty"))bits.push("любишь сытнее");return bits.slice(0,3).join(", ")}
  function clear(){profile=empty();try{localStorage.removeItem(KEY)}catch{}return profile}
  window.TDBaiMemory={get:()=>({...profile}),learn,defaults,hint,clear};
})();
