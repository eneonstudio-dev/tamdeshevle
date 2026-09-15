(()=>{
  "use strict";
  if(window.TDBayEngineBudget)return;

  const VERSION=1;
  const toMicros=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value)*1_000_000)):0;
  const fromMicros=value=>Math.round(Number(value||0))/1_000_000;
  const clean=(value,max=80)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const monthKey=ms=>{const d=new Date(ms);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`};

  function create(config={}){
    const source=config&&typeof config==="object"?config:{};
    const enabled=source.enabled===true;
    const ceilingMicros=toMicros(source.monthlyCeilingUsd);
    const worstCaseMicros=toMicros(source.worstCaseRequestUsd);
    const now=typeof source.now==="function"?source.now:()=>Date.now();
    const onEvent=typeof source.onEvent==="function"?source.onEvent:null;
    let period=monthKey(now()),committedMicros=0,actualMicros=0,authorizedRequests=0,breached=false;

    function syncPeriod(){
      const current=monthKey(now());
      if(current!==period){period=current;committedMicros=0;actualMicros=0;authorizedRequests=0;breached=false;}
    }
    function emit(type,detail={}){
      if(!onEvent)return;
      try{onEvent({type,period,provider:clean(detail.provider),reason:clean(detail.reason),reservedUsd:fromMicros(detail.reservedMicros),actualUsd:fromMicros(detail.actualMicros),committedUsd:fromMicros(committedMicros),remainingUsd:fromMicros(Math.max(0,ceilingMicros-committedMicros))});}catch{}
    }
    function check(provider){
      syncPeriod();
      if(!enabled)return{ok:false,reason:"paid_disabled"};
      if(breached)return{ok:false,reason:"budget_breached"};
      if(ceilingMicros<=0)return{ok:false,reason:"budget_ceiling_missing"};
      if(worstCaseMicros<=0)return{ok:false,reason:"worst_case_cost_missing"};
      if(worstCaseMicros>ceilingMicros)return{ok:false,reason:"worst_case_exceeds_ceiling"};
      if(committedMicros+worstCaseMicros>ceilingMicros)return{ok:false,reason:"budget_exhausted"};
      return{ok:true,provider:clean(provider)};
    }
    function authorize(context={}){
      const gate=check(context?.provider);
      if(!gate.ok){emit("budget_denied",{provider:context?.provider,reason:gate.reason});return false;}
      committedMicros+=worstCaseMicros;authorizedRequests++;
      emit("budget_reserved",{provider:context?.provider,reservedMicros:worstCaseMicros});
      return true;
    }
    function recordActual(context={}){
      syncPeriod();
      const costMicros=toMicros(context.actualCostUsd);
      actualMicros+=costMicros;
      if(actualMicros>committedMicros){breached=true;emit("budget_breach",{provider:context?.provider,actualMicros:costMicros,reason:"actual_exceeds_reserved_total"});return{ok:false,code:"ACTUAL_COST_EXCEEDS_RESERVED_TOTAL",snapshot:snapshot()};}
      emit("budget_actual",{provider:context?.provider,actualMicros:costMicros});
      return{ok:true,snapshot:snapshot()};
    }
    function snapshot(){
      syncPeriod();
      return{
        version:VERSION,
        period,
        enabled,
        breached,
        monthlyCeilingUsd:fromMicros(ceilingMicros),
        worstCaseRequestUsd:fromMicros(worstCaseMicros),
        committedUsd:fromMicros(committedMicros),
        actualUsd:fromMicros(actualMicros),
        remainingUsd:fromMicros(Math.max(0,ceilingMicros-committedMicros)),
        authorizedRequests
      };
    }
    function routerPolicy(){
      return{
        enabled,
        monthlyCeilingUsd:fromMicros(ceilingMicros),
        spentUsd:()=>snapshot().committedUsd,
        authorize
      };
    }

    return Object.freeze({version:VERSION,authorize,recordActual,snapshot,routerPolicy});
  }

  window.TDBayEngineBudget={version:VERSION,create};
})();
