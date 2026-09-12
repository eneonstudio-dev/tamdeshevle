(()=>{
  "use strict";

  function rowsFor(city){
    if(!window.TDCompare?.fromWindow||!window.state)return[];
    try{return TDCompare.fromWindow({city:city||state.city,mode:"any",originStoreId:state.storeId})||[]}catch{return[]}
  }

  function preferredFallback(rows){
    return rows.find(row=>row.kind!=="delivery")||rows[0]||null;
  }

  function persistStore(id){
    try{
      const parsed=JSON.parse(localStorage.getItem("td")||"{}");
      const next=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};
      next.storeId=id;
      localStorage.setItem("td",JSON.stringify(next));
    }catch{}
  }

  function ensureStore(city){
    if(!window.state)return null;
    const rows=rowsFor(city);
    if(!rows.length)return null;
    const current=rows.find(row=>row.id===state.storeId);
    if(current)return current;
    const fallback=preferredFallback(rows);
    if(!fallback)return null;
    state.storeId=fallback.id;
    persistStore(fallback.id);
    window.dispatchEvent?.(new CustomEvent("td:store-repaired",{detail:{storeId:fallback.id,city:city||state.city,reason:"invalid_runtime_store"}}));
    return fallback;
  }

  function wrap(name,before){
    const original=window[name];
    if(typeof original!=="function"||original.__tdStoreGuard)return;
    const guarded=function(...args){
      const allowed=before?before(...args):ensureStore();
      if(allowed===false)return false;
      return original.apply(this,args);
    };
    guarded.__tdStoreGuard=true;
    guarded.__original=original;
    window[name]=guarded;
  }

  function install(){
    if(!window.state||!window.TDCompare)return false;
    ensureStore();
    wrap("render",()=>Boolean(ensureStore()));
    wrap("go",()=>Boolean(ensureStore()));
    wrap("setQty",()=>Boolean(ensureStore()));
    wrap("choosePlan",storeId=>{
      ensureStore();
      const plan=TDCompare.fromWindow?.().find(row=>row.id===storeId&&row.rankable);
      if(plan)return true;
      window.dispatchEvent?.(new CustomEvent("td:purchase-blocked",{detail:{reason:"unrankable_store",storeId}}));
      return false;
    });
    const toggle=window.toggleCity;
    if(typeof toggle==="function"&&!toggle.__tdStoreGuard){
      const guardedToggle=function(...args){
        const next=state.city==="msk"?"spb":"msk";
        ensureStore(next);
        return toggle.apply(this,args);
      };
      guardedToggle.__tdStoreGuard=true;
      guardedToggle.__original=toggle;
      window.toggleCity=guardedToggle;
    }
    return true;
  }

  if(!install())window.addEventListener?.("td:runtime-ready",install,{once:true});
  window.addEventListener?.("pageshow",()=>{ensureStore();});
  window.addEventListener?.("storage",event=>{if(!event||event.key==="td")ensureStore();});

  window.TDAppStoreGuard={ensureStore,rowsFor,install};
})();
