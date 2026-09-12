(()=>{
  "use strict";
  if(window.__TDUnifiedCartStateV1)return;
  window.__TDUnifiedCartStateV1=true;

  let syncing=false;
  const sync=(options={})=>{
    if(syncing||!window.TDShoppingState?.syncFromCart||!window.state)return false;
    syncing=true;
    try{return window.TDShoppingState.syncFromCart(window.state.cart||{},options)}
    finally{syncing=false}
  };

  const originalSetQty=window.setQty;
  if(typeof originalSetQty==="function"&&!originalSetQty.__tdUnifiedCartWrapped){
    const wrapped=function(...args){
      const result=originalSetQty.apply(this,args);
      if(result!==false)sync({record:true,description:"Изменил количество вручную"});
      return result;
    };
    wrapped.__tdUnifiedCartWrapped=true;
    wrapped.__tdUnifiedCartOriginal=originalSetQty;
    window.setQty=wrapped;
  }

  function restore(){
    if(window.state?.cartTouched===true)sync({record:false,description:"Восстановил ручную корзину"});
  }

  window.addEventListener("pageshow",restore);
  window.addEventListener("td:v2-rendered",()=>sync({record:false,description:"Сверил корзину интерфейса"}));
  restore();

  window.TDUnifiedCartStateV1={sync,restore,isSyncing:()=>syncing};
})();
