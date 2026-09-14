(()=>{
  "use strict";
  if(window.TDBaiBrandRelaxBridge)return;

  const BRAND_RELAX=/(?:бренд(?:ы)?\s+не\s+важн|бренд\s+не\s+важен|любой\s+бренд)/i;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const low=value=>String(value||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
  const isBrandRelaxOperations=operations=>{
    const list=Array.isArray(operations)?operations:[];
    return list.filter(op=>op?.type==="CLEAR_BRAND_PREFERENCES").length===1
      && list.every(op=>["CLEAR_BRAND_PREFERENCES","REOPTIMIZE"].includes(op?.type));
  };
  const hasShoppingContext=kernel=>{
    const legacy=window.TDShoppingState?.get?.()||{};
    const agent=kernel?.state?.get?.()||{};
    return Boolean((legacy.products||[]).length||(legacy.excludedBrands||[]).length||(agent.basket?.items||[]).length);
  };

  function install(kernel){
    if(!kernel||kernel.__brandRelaxBridgeInstalled)return kernel;
    const originalGate=typeof kernel.domainGate==="function"?kernel.domainGate.bind(kernel):null;
    const originalRun=typeof kernel.run==="function"?kernel.run.bind(kernel):null;
    if(!originalRun)return kernel;

    kernel.domainGate=function(text){
      if(BRAND_RELAX.test(low(text))&&hasShoppingContext(kernel))return{allowed:true,code:"ALLOWED",reason:"brand_constraint"};
      return originalGate?originalGate(text):{allowed:false,code:"OUT_OF_SCOPE",reason:"no_shopping_intent"};
    };

    kernel.run=async function(input={}){
      const text=String(input?.text||"");
      const operations=Array.isArray(input?.operations)?input.operations:[];
      if(!BRAND_RELAX.test(low(text))||!isBrandRelaxOperations(operations))return originalRun(input);
      const gate=kernel.domainGate(text);
      if(!gate?.allowed)return originalRun(input);

      const beforeAgent=kernel.state?.get?.()||{};
      let applied=null;
      try{applied=window.TDShoppingConversation?.apply?.(text,operations)}catch(error){
        return{ok:false,status:"ERROR",gate,error:{code:"EXECUTION_FAILED",message:"Не удалось применить изменение брендов.",recoverable:true,details:{cause:String(error?.message||error)}},actions:[],provider_actions_executed:false,state:clone(beforeAgent)};
      }
      if(!applied?.ok)return{ok:false,status:"ERROR",gate,error:{code:"EXECUTION_FAILED",message:"Не удалось применить изменение брендов.",recoverable:true},actions:[],provider_actions_executed:false,state:clone(beforeAgent)};

      const afterLegacy=window.TDShoppingState?.get?.()||applied.state||{};
      const preserve=clone(beforeAgent);
      preserve.constraints={...(preserve.constraints||{}),excluded_brands:[]};
      const state=kernel.state?.syncFromLegacy?.(afterLegacy,preserve)||kernel.state?.save?.(preserve)||preserve;
      const action={type:"set_constraint",payload:{key:"excluded_brands",value:[]},meta:{source:"parser",confidence:1}};
      const total=Number(afterLegacy.currentTotal)||0;
      return{
        ok:true,status:"VERIFIED",gate,actions:[action],state,
        verification:{ok:true,effects:{ok:true,brand_constraints_cleared:true},constraints:{ok:true}},
        message:`Брендовые ограничения снял.${(afterLegacy.products||[]).length?` Корзина пересчитана, итог ≈ ${Math.round(total)} ₽.`:""}`,
        provider_actions_executed:true,legacy_result:applied
      };
    };

    try{Object.defineProperty(kernel,"__brandRelaxBridgeInstalled",{value:true,configurable:true})}catch{kernel.__brandRelaxBridgeInstalled=true}
    return kernel;
  }

  const current=window.TDBaiShoppingAgentKernel;
  if(current)install(current);
  else{
    let value;
    try{Object.defineProperty(window,"TDBaiShoppingAgentKernel",{configurable:true,enumerable:true,get(){return value},set(next){value=install(next)}})}catch{}
  }
  window.TDBaiBrandRelaxBridge={install};
})();
