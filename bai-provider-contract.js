(()=>{
  "use strict";
  if(window.TDBaiProviderContract)return;

  const ALLOWED=new Set(["UNDO","RESET_BASKET","SET_INTENT","SET_ONLY_PRODUCTS","CLEAR_ONLY","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_QUANTITY","SET_PRODUCT_AMOUNT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE","REQUIRE","PREFER","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","REOPTIMIZE","ASK_CLARIFICATION","NOTE"]);
  const PRODUCT_OPS=new Set(["ADD_PRODUCT","REMOVE_PRODUCT","REQUIRE","PREFER"]),TEXT_OPS=new Set(["SET_INTENT","SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","ASK_CLARIFICATION","NOTE"]);
  const clean=value=>String(value??"").replace(/[<>]/g," ").replace(/\s+/g," ").trim();
  const id=value=>{const out=String(value??"").trim();return/^[a-z0-9_-]{1,64}$/.test(out)?out:null};
  const fail=(code,details={})=>({ok:false,error:{code,recoverable:true,details},operations:[],reply:"",suggestions:[]});
  function operation(raw,known){
    if(!raw||typeof raw!=="object"||!ALLOWED.has(raw.type))return null;const type=raw.type,value=raw.value;
    if(PRODUCT_OPS.has(type)){const product=id(value);return product&&known.has(product)?{type,value:product}:null}
    if(type==="REPLACE_PRODUCT"){const from=id(value?.from),to=id(value?.to);return from&&to&&from!==to&&known.has(from)&&known.has(to)?{type,value:{from,to}}:null}
    if(type==="SET_ONLY_PRODUCTS"){if(!Array.isArray(value))return null;const products=[...new Set(value.map(id).filter(x=>x&&known.has(x)))].slice(0,24);return products.length?{type,value:products}:null}
    if(type==="CHANGE_QUANTITY"){const product=id(value?.id),quantity=Number(value?.quantity),delta=Number(value?.delta);if(!product||!known.has(product)||(!Number.isFinite(quantity)&&!Number.isFinite(delta)))return null;if(Number.isFinite(quantity)&&(quantity<0||quantity>99))return null;if(Number.isFinite(delta)&&(delta<-99||delta>99))return null;return{type,value:{id:product,...(Number.isFinite(quantity)?{quantity}:{delta})}}}
    if(type==="SET_PRODUCT_AMOUNT"){const product=id(value?.id),amount=Number(value?.amount),unit=clean(value?.unit).slice(0,16);return product&&known.has(product)&&Number.isFinite(amount)&&amount>0&&amount<=100000?{type,value:{id:product,amount,unit:unit||"pack"}}:null}
    if(type==="CHANGE_BUDGET"){const amount=Number(value);return Number.isFinite(amount)&&amount>=1&&amount<=10000000?{type,value:Math.round(amount)}:null}
    if(type==="SET_PEOPLE"||type==="SET_DURATION"){const amount=Number(value),limit=type==="SET_PEOPLE"?100:365;return Number.isInteger(amount)&&amount>=1&&amount<=limit?{type,value:amount}:null}
    if(TEXT_OPS.has(type)){const text=clean(value).slice(0,type==="ASK_CLARIFICATION"?180:100);return text?{type,value:text}:null}
    return value===undefined?{type}:null;
  }
  function normalize(raw,{catalog=[]}={}){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return fail("INVALID_PROVIDER_PAYLOAD");
    const known=new Set((Array.isArray(catalog)?catalog:[]).map(x=>id(x?.id)).filter(Boolean)),input=Array.isArray(raw.operations)?raw.operations:[];
    if(input.length>20)return fail("TOO_MANY_ACTIONS",{count:input.length});const operations=[];
    for(const candidate of input){const safe=operation(candidate,known);if(!safe)return fail("INVALID_PROVIDER_ACTION",{type:String(candidate?.type||"unknown")});operations.push(safe)}
    const clarification=operations.some(x=>x.type==="ASK_CLARIFICATION"),mutating=operations.some(x=>x.type!=="ASK_CLARIFICATION");if(clarification&&mutating)return fail("CLARIFICATION_MIXED_WITH_MUTATION");
    const reply=clean(raw.reply).slice(0,500),suggestions=(Array.isArray(raw.suggestions)?raw.suggestions:[]).map(clean).filter(Boolean).slice(0,3);
    if(!operations.length&&!reply)return fail("EMPTY_PROVIDER_RESULT");
    return{ok:true,operations,reply,suggestions,expectsAnswer:Boolean(raw.expectsAnswer||clarification),meta:{model:clean(raw.model).slice(0,80),version:clean(raw.version).slice(0,40),trace:(Array.isArray(raw.trace)?raw.trace:[]).map(clean).filter(Boolean).slice(0,8)}};
  }
  window.TDBaiProviderContract={version:1,allowed:[...ALLOWED],normalize};
})();
