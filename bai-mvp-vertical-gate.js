(()=>{
  "use strict";
  if(window.TDBaiMvpVerticalGate)return;

  const UNSUPPORTED_PRODUCT=/(?:ноутбук|телефон|смартфон|наушник|телевизор|одежд|обув|косметик|мебел|инструмент|лекарств)/i;
  const PRODUCT_ADVICE=/(?:како(?:й|е|ую|ие).{0,48}лучше|что\s+лучше|посовет|выбер|подбер|сравн|куп)/i;
  const REPLY="Сейчас я работаю с продуктами и продуктовой корзиной. Ноутбуки и другие непродуктовые категории пока не поддерживаю — не буду делать вид, что могу их нормально сравнить.";
  const low=value=>String(value||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();

  function check(text){
    const value=low(text),matched=UNSUPPORTED_PRODUCT.test(value)&&PRODUCT_ADVICE.test(value);
    return matched
      ? {supported:false,code:"UNSUPPORTED_MVP_CATEGORY",reason:"grocery_mvp_only",vertical:"grocery_fmcg"}
      : {supported:true,code:"SUPPORTED",reason:"grocery_mvp",vertical:"grocery_fmcg"};
  }

  const kernel=window.TDBaiShoppingAgentKernel;
  if(kernel&&typeof kernel.domainGate==="function"){
    const originalDomain=kernel.domainGate.bind(kernel);
    kernel.mvpVerticalGate=check;
    kernel.domainGate=text=>{
      const vertical=check(text);
      if(vertical.supported===false)return{allowed:true,code:"ALLOWED",reason:"product_advice"};
      return originalDomain(text);
    };
  }

  function wrap(brain){
    if(!brain?.route||brain.__baiMvpVerticalGateWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiMvpVerticalGateWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){
      const gate=check(raw);
      if(gate.supported===false)return{ok:false,status:"UNSUPPORTED_CATEGORY",provider:"mvp-vertical-gate",operations:[],reply:REPLY,suggestions:[],expectsAnswer:false,verticalGate:gate};
      return original(raw,history,...rest);
    };
    return brain;
  }

  wrap(window.TDBaiBrain);
  window.TDBaiMvpVerticalGate={check,wrap,reply:REPLY};
})();
