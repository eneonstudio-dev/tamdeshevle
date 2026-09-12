(()=>{
  "use strict";
  if(window.TDBaiExecutionContract)return;
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const clone=v=>JSON.parse(JSON.stringify(v));
  const PRODUCT_OPS=new Set(["ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_QUANTITY","SET_ONLY_PRODUCTS","REQUIRE"]);
  const COMMAND=/(?:^|[^а-я])(?:добав[а-я]*|докин[а-я]*|положи|убери|удали|исключи|выкинь|замени|поменяй|вместо)(?=$|[^а-я])/i;
  const REMOVE=/(?:^|[^а-я])(?:убери|удали|исключи|выкинь)(?=$|[^а-я])/i;
  const ADD=/(?:^|[^а-я])(?:добав[а-я]*|докин[а-я]*|положи)(?=$|[^а-я])/i;
  const REPLACE=/(?:^|[^а-я])(?:замени|поменяй)(?=$|[^а-я])|вместо/i;
  const NUMBER={один:1,одну:1,одна:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6};
  let wrapped=false,lastProduct=null,pendingReplacement=null;

  function parsedItems(raw){
    try{return (window.TDBaiLiteralBasket?.parse?.(raw)?.items||[]).map(x=>String(x.id)).filter(Boolean)}catch{return[]}
  }
  function productName(id){return window.TDStoreAdapters?.catalog?.().find?.(x=>String(x.id)===String(id))?.name||String(id)}
  function operationResult(base,operations,reply){
    return{...(base||{}),ok:true,provider:"bai-execution-contract",operations,reply,suggestions:[],expectsAnswer:false,executionContract:{resolved:true}};
  }
  function currentQuantity(id){
    const line=window.TDShoppingState?.get?.()?.products?.find?.(x=>String(x?.id)===String(id));
    return Math.max(0,Number(line?.quantity)||0);
  }
  function explicitCount(raw){
    const t=low(raw),m=t.match(/(?:убери|удали|добав[а-я]*|докин[а-я]*|положи)\s+(?:еще\s+)?(\d+|один|одну|одна|одно|два|две|три|четыре|пять|шесть)(?=\s)/);
    if(!m||/(?:кг|килограмм|грамм|гр\b|литр|\bл\b|мл)\b/.test(t))return null;
    return /^\d+$/.test(m[1])?Number(m[1]):NUMBER[m[1]]||null;
  }
  function priceFor(id){
    const state=window.TDShoppingState?.get?.()||{},stores=(state.stores||[]).length?state.stores:(typeof STORES!=="undefined"?STORES.map(x=>x.id):[]);
    let best=Infinity;
    for(const storeId of stores){try{const value=Number(window.TDStoreAdapters?.adapter?.(storeId)?.getPrice?.(id,"shelf")?.value);if(Number.isFinite(value))best=Math.min(best,value)}catch{}}
    return best;
  }
  function cheapest(ids){return [...ids].sort((a,b)=>priceFor(a)-priceFor(b))[0]||null}
  function meaningful(ops){return (ops||[]).some(op=>PRODUCT_OPS.has(op?.type))}
  function normalizeQuantity(raw,result,items){
    const count=explicitCount(raw);if(!count||items.length!==1)return result;
    const id=items[0],ops=Array.isArray(result?.operations)?result.operations:[];
    if(REMOVE.test(raw)&&currentQuantity(id)>0){
      const next=ops.filter(op=>!(op?.type==="REMOVE_PRODUCT"&&String(op.value)===id));
      next.push({type:"CHANGE_QUANTITY",value:{id,delta:-count}});
      return operationResult(result,next,`Убираю ${count} уп. ${productName(id)}.`);
    }
    if(ADD.test(raw)&&/(?:^|[^а-я])(?:еще|ещё)(?=$|[^а-я])/i.test(raw)){
      const next=ops.filter(op=>!((op?.type==="ADD_PRODUCT"||op?.type==="REQUIRE")&&String(op.value)===id));
      next.push({type:"CHANGE_QUANTITY",value:{id,delta:count}});
      return operationResult(result,next,`Добавляю ещё ${count} уп. ${productName(id)}.`);
    }
    return result;
  }
  function rescue(raw,result){
    const t=low(raw),items=[...new Set(parsedItems(raw))];
    if(pendingReplacement&&!COMMAND.test(t)&&items.length===1){
      const from=pendingReplacement,to=items[0];pendingReplacement=null;
      return operationResult(result,[{type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from,to}},{type:"REOPTIMIZE"}],`Заменяю ${productName(from)} на ${productName(to)}.`);
    }
    const hasReplacement=(result?.operations||[]).some(op=>op?.type==="REPLACE_PRODUCT");
    if(REPLACE.test(t)&&items.length>=2&&!hasReplacement){
      const instead=t.includes("вместо")&&!/(?:замени|поменяй)/.test(t),from=instead?items[1]:items[0],targets=instead?[items[0]]:items.slice(1),to=cheapest(targets);pendingReplacement=null;
      return operationResult(result,[{type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from,to}},{type:"REOPTIMIZE"}],`Заменяю ${productName(from)} на ${productName(to)} — из названных вариантов он дешевле.`);
    }
    if(REPLACE.test(t)&&items.length===1&&!meaningful(result?.operations)){
      const pronoun=/(?:это|его|ее|её|эту|этого)/.test(t),source=pronoun?lastProduct:items[0];
      if(pronoun&&source&&source!==items[0])return operationResult(result,[{type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from:source,to:items[0]}},{type:"REOPTIMIZE"}],`Заменяю ${productName(source)} на ${productName(items[0])}.`);
      pendingReplacement=source;
      return{...(result||{}),operations:[],reply:`На что заменить ${productName(source)}?`,suggestions:[],expectsAnswer:true,provider:"bai-execution-contract"};
    }
    if(!meaningful(result?.operations)&&REMOVE.test(t)&&items.length)return operationResult(result,[{type:"SET_INTENT",value:"remove"},...items.map(value=>({type:"REMOVE_PRODUCT",value})),{type:"REOPTIMIZE"}],`Убираю: ${items.map(productName).join(", ")}.`);
    if(!meaningful(result?.operations)&&ADD.test(t)&&items.length)return operationResult(result,[{type:"SET_INTENT",value:"add"},...items.map(value=>({type:"ADD_PRODUCT",value})),{type:"REOPTIMIZE"}],`Добавляю: ${items.map(productName).join(", ")}.`);
    if(REPLACE.test(t)&&result?.expectsAnswer){
      pendingReplacement=items[0]||lastProduct;
    }
    return normalizeQuantity(raw,result,items);
  }
  function remember(result){
    for(const op of result?.operations||[]){
      if(["ADD_PRODUCT","REMOVE_PRODUCT","REQUIRE"].includes(op?.type))lastProduct=String(op.value||"")||lastProduct;
      if(op?.type==="REPLACE_PRODUCT"&&op.value?.to)lastProduct=String(op.value.to);
      if(op?.type==="SET_ONLY_PRODUCTS"&&Array.isArray(op.value)&&op.value.length)lastProduct=String(op.value.at(-1));
      if(op?.type==="RESET_BASKET"){lastProduct=null;pendingReplacement=null}
    }
    return result;
  }
  function wrap(brain){
    if(!brain?.route||brain.__baiExecutionContractWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiExecutionContractWrapped",{value:true,configurable:true});
    brain.route=async function(raw,...rest){const result=await original(raw,...rest);return remember(rescue(String(raw||""),result))};
    const reset=brain.reset?.bind(brain);if(reset)brain.reset=(...args)=>{lastProduct=null;pendingReplacement=null;return reset(...args)};
    wrapped=true;return brain;
  }
  function install(){
    const current=window.TDBaiBrain;if(current){wrap(current);return true}
    const desc=Object.getOwnPropertyDescriptor(window,"TDBaiBrain");
    if(desc?.get&&desc?.set&&desc.configurable){Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:desc.enumerable,get:desc.get,set(next){desc.set.call(window,next);const ready=desc.get.call(window);if(ready)wrap(ready)}});return true}
    let value;try{Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:true,get(){return value},set(next){value=wrap(next)}});return true}catch{return false}
  }
  window.TDBaiExecutionContract={install,rescue,status:()=>({wrapped,lastProduct,pendingReplacement})};
  install();
})();
