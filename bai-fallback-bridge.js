(()=>{
  "use strict";
  const current=window.TDShoppingConversation;
  if(!current?.apply||window.TDBaiFallbackBridge)return;

  const PRODUCT={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","яиц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const NUM={"один":1,"одна":1,"одну":1,"два":2,"две":2,"три":3,"четыре":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10,"полтора":1.5,"полторы":1.5};
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const products=t=>Object.entries(PRODUCT).map(([stem,id])=>({stem,id,pos:t.indexOf(stem)})).filter(x=>x.pos>=0).sort((a,b)=>a.pos-b.pos);
  const num=v=>/^\d+(?:[.,]\d+)?$/.test(String(v||""))?Number(String(v).replace(",",".")):NUM[low(v)]||null;
  const unit=v=>{v=low(v);if(/^кг|килограмм/.test(v))return"kg";if(/^г$|^гр|^грамм/.test(v))return"g";if(/^мл|миллилитр/.test(v))return"ml";if(/^л$|^литр/.test(v))return"l";if(/пач|упаков/.test(v))return"pack";if(/^шт|штук/.test(v))return"pcs";return null};
  const result=(message,needsClarification=false)=>({ok:!needsClarification,state:window.TDShoppingState?.get?.()||{},plans:window.TDShoppingState?.get?.().lastPlans||[],message,operations:[],needsClarification});

  function amountOps(t,ordered){
    const out=[],n="(\\d+(?:[.,]\\d+)?|один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|полтора|полторы)",u="(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|миллилитр(?:а|ов)?|пачк(?:а|и|ек)?|упаковк(?:а|и|ок)?|шт|штук(?:а|и)?)";
    for(const p of ordered){
      const stem=p.stem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      let m=t.match(new RegExp(n+"\\s*"+u+"\\s+[^,.!?]{0,18}"+stem))||t.match(new RegExp(stem+"[^,.!?]{0,18}?"+n+"\\s*"+u));
      if(m){const amount=num(m[1]),u0=unit(m[2]);if(amount>0&&u0)out.push({type:"REQUIRE",value:p.id},{type:"SET_PRODUCT_AMOUNT",value:{id:p.id,amount,unit:u0}});continue}
      if(["eggs","banana","apple"].includes(p.id)){m=t.match(new RegExp(n+"\\s+(?:шт\\.?\\s+)?[^,.!?]{0,10}"+stem));const amount=m?num(m[1]):null;if(amount>0)out.push({type:"REQUIRE",value:p.id},{type:"SET_PRODUCT_AMOUNT",value:{id:p.id,amount,unit:"pcs"}})}
    }
    return out;
  }

  function special(raw){
    const t=low(raw),s=window.TDShoppingState?.get?.()||{},ordered=products(t),ids=uniq(ordered.map(x=>x.id));
    if(/оставь как есть|ничего не меняй|не меняй ничего|пусть так и будет|все нормально как есть/.test(t))return{direct:result("Оставил как есть.")};
    if(/(?:возьми|поставь|добавь)?\s*что-нибудь\s+вместо\s+(?:этого|него|нее)|замени\s+(?:это|его|ее)\s+на\s+что-нибудь/.test(t))return{direct:result("На что заменить? Назови товар.",true)};
    if(/не надо столько|слишком много/.test(t)&&!ids.length)return{direct:result("Сколько оставить?",true)};
    if(ids.length&&/(побольше|поменьше|больше|меньше)/.test(t)&&!amountOps(t,ordered).length)return{direct:result(`Сколько ${ids[0]==="milk"?"молока":ids[0]==="water"?"воды":"нужно"}?`,true)};

    const budget=Number(s.budget)||0;
    if(budget){
      let m=t.match(/(?:дешевле|меньше|снизь|уменьши)\s+на\s+(\d+)\s*(?:р|руб|₽)?/)||t.match(/(?:на\s+)?(\d+)\s*(?:р|руб|₽)?\s*(?:дешевле|меньше)/);
      if(m)return{ops:[{type:"CHANGE_BUDGET",value:Math.max(1,budget-Number(m[1]))},{type:"REOPTIMIZE"}]};
      if(/(?:дешевле|меньше|снизь|уменьши)\s+на\s+(?:косарь|тысячу|тыщу)|(?:косарь|тысячу|тыщу)\s*(?:дешевле|меньше)/.test(t))return{ops:[{type:"CHANGE_BUDGET",value:Math.max(1,budget-1000)},{type:"REOPTIMIZE"}]};
    }

    if(/убери|удали|исключи|выкинь/.test(t)&&/добав|докин|плюс|положи/.test(t)){
      const ops=[];
      for(const part of t.split(/\s+и\s+|,/)){const ps=uniq(products(part).map(x=>x.id));if(/убери|удали|исключи|выкинь/.test(part))ps.forEach(id=>ops.push({type:"REMOVE_PRODUCT",value:id}));else if(/добав|докин|плюс|положи/.test(part))ps.forEach(id=>ops.push({type:"ADD_PRODUCT",value:id}))}
      if(ops.length)return{ops:[...ops,{type:"REOPTIMIZE"}]};
    }

    const amounts=amountOps(t,ordered);
    if(amounts.length)return{ops:[...amounts,{type:"REOPTIMIZE"}]};
    return null;
  }

  function clearOldOnly(ops){
    if(!ops.some(o=>o.type==="CLEAR_ONLY"))return;
    const s=window.TDShoppingState?.get?.();
    if(!s||s.selectionMode!=="only"||!(s.onlyProducts||[]).length)return;
    const old=new Set(s.onlyProducts||[]),keep=new Set(ops.filter(o=>o.type==="REQUIRE"||o.type==="ADD_PRODUCT").map(o=>String(o.value)));
    window.TDShoppingState.commit("CLEAR_ONLY_SCOPE",x=>{
      x.requiredProducts=(x.requiredProducts||[]).filter(id=>!old.has(id)||keep.has(id));
      x.onlyProducts=[];x.selectionMode="auto";
      x.quantityTargets=x.quantityTargets||{};
      Object.keys(x.quantityTargets).forEach(id=>{if(old.has(id)&&!keep.has(id))delete x.quantityTargets[id]});
    },"Сброс старого режима «только»");
  }

  function apply(raw,providedOps){
    let ops=Array.isArray(providedOps)&&providedOps.length?providedOps:null;
    if(!ops){const fix=special(raw);if(fix?.direct)return fix.direct;if(fix?.ops)ops=fix.ops}
    if(ops)clearOldOnly(ops);
    return current.apply(raw,ops||undefined);
  }

  window.TDShoppingConversation={...current,apply};
  window.TDBaiFallbackBridge={special,clearOldOnly};
  import("./bai-brain.js?v=20260911-reliability-v1").catch(e=>console.warn("[Bai Brain preload] load failed",e));
})();