(()=>{
  "use strict";
  const brain=window.TDBaiBrain;
  if(!brain?.route||window.TDBaiReasoningGuard)return;

  const PRODUCT={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","яиц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const LABEL={milk:"молоко",bread:"хлеб",chicken:"курица",banana:"банан",oil:"масло",eggs:"яйца",buck:"гречка",sour:"сметана",sugar:"сахар",pasta:"макароны",water:"вода",apple:"яблоки",ham:"ветчина",dumplings:"пельмени",noodles:"лапша",waffles:"вафли",cottage:"творог"};
  const NUM={"один":1,"одного":1,"одна":1,"одну":1,"два":2,"две":2,"двое":2,"двоих":2,"три":3,"трое":3,"троих":3,"четыре":4,"четверо":4,"четверых":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10};
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const original=brain.route.bind(brain);
  const originalReset=brain.reset?.bind(brain);
  const originalStatus=brain.status?.bind(brain);
  const trailingExclusion=/(?:не\s+надо(?:\s+(?:добавлять|класть|брать))?|не\s+нуж(?:но|ен|на|ны)|не\s+(?:клади|добавляй))(?:\s*[.!?])?$/;
  const initialGoal=clone(originalStatus?.()?.goal||{});
  let peopleShadow=Number(initialGoal.people)||null;
  let productGoalShadow={
    requiredProducts:uniq(initialGoal.requiredProducts),
    excludedProducts:uniq(initialGoal.excludedProducts),
    onlyProducts:uniq(initialGoal.onlyProducts),
    quantityTargets:{...(initialGoal.quantityTargets||{})}
  };

  function mentions(raw){
    const t=low(raw),out=[];
    for(const [stem,id] of Object.entries(PRODUCT)){
      let from=0;
      while(from<t.length){
        const pos=t.indexOf(stem,from);
        if(pos<0)break;
        out.push({stem,id,pos});
        from=pos+stem.length;
      }
    }
    return out.sort((a,b)=>a.pos-b.pos);
  }

  function parseNumber(value){
    if(!value)return null;
    const v=low(value);
    if(/^\d+$/.test(v))return Number(v);
    return NUM[v]||null;
  }

  function explicitPeople(raw){
    const t=low(raw);
    let m=t.match(/(?:^|[^а-я])нас\s+(\d+|[а-я]+)(?=\s|$|[,.!?])/);
    if(m){const n=parseNumber(m[1]);if(n)return n}
    m=t.match(/(?:^|[^а-я])(?:на|для|будет)\s+(\d+|[а-я]+)\s*(?:человек(?:а|у|ом)?|чел(?:\.|а)?|персон(?:ы|у)?|едок(?:а|ов)?)(?=\s|$|[,.!?])/);
    if(m){const n=parseNumber(m[1]);if(n)return n}
    m=t.match(/(?:^|[^а-я])(?:на|для)\s+(одного|двоих|троих|четверых)(?=\s|$|[,.!?])/);
    return m?parseNumber(m[1]):null;
  }

  function normalizeTrailingExclusions(raw){
    const source=String(raw||"");
    return source.split(/(\s*(?:,|;|\s+и\s+)\s*)/i).map(part=>{
      const t=low(part),neg=t.match(trailingExclusion),items=mentions(part);
      if(!neg||!items.length)return part;
      const item=items.at(-1),negPos=t.lastIndexOf(neg[0]);
      if(negPos<=item.pos)return part;
      return `не добавляй ${item.stem}`;
    }).join("");
  }

  function ambiguousReplacementChoice(raw){
    const t=low(raw);
    if(!/(замени|поменяй|вместо)/.test(t)||!/(^|[^а-яa-z0-9_])или(?=$|[^а-яa-z0-9_])/.test(t))return null;
    const items=mentions(t);
    if(items.length<3)return null;
    const orPos=t.indexOf("или");
    const left=items.filter(x=>x.pos<orPos).at(-1),right=items.find(x=>x.pos>orPos);
    if(!left||!right||left.id===right.id)return null;
    return{left,right};
  }

  function directionalReplacement(raw){
    const t=low(raw),pivot=t.indexOf("вместо");
    if(pivot<0)return null;
    const items=mentions(t);
    if(items.length<2)return null;
    const before=items.filter(x=>x.pos<pivot);
    const after=items.filter(x=>x.pos>pivot);
    let from=null,to=null;
    if(before.length&&after.length){
      to=before.at(-1);
      from=after[0];
    }else if(!before.length&&after.length>=2){
      from=after[0];
      to=after.at(-1);
    }
    if(!from||!to||from.id===to.id)return null;
    return{from,to,rewrite:`замени ${from.stem} на ${to.stem}`};
  }

  function applyProductGoalOps(operations){
    for(const op of operations||[]){
      const value=op?.value;
      if(op?.type==="RESET_BASKET"){
        productGoalShadow={requiredProducts:[],excludedProducts:[],onlyProducts:[],quantityTargets:{}};
      }else if(op?.type==="CLEAR_ONLY"){
        productGoalShadow.onlyProducts=[];
      }else if(op?.type==="SET_ONLY_PRODUCTS"){
        const ids=uniq(value||[]);
        productGoalShadow.onlyProducts=ids;
        productGoalShadow.requiredProducts=ids;
        productGoalShadow.excludedProducts=productGoalShadow.excludedProducts.filter(id=>!ids.includes(id));
      }else if(op?.type==="ADD_PRODUCT"||op?.type==="REQUIRE"){
        const id=String(value||"");
        if(!id)continue;
        productGoalShadow.requiredProducts=uniq([...productGoalShadow.requiredProducts,id]);
        productGoalShadow.excludedProducts=productGoalShadow.excludedProducts.filter(x=>x!==id);
      }else if(op?.type==="REMOVE_PRODUCT"){
        const id=String(value||"");
        if(!id)continue;
        productGoalShadow.excludedProducts=uniq([...productGoalShadow.excludedProducts,id]);
        productGoalShadow.requiredProducts=productGoalShadow.requiredProducts.filter(x=>x!==id);
        productGoalShadow.onlyProducts=productGoalShadow.onlyProducts.filter(x=>x!==id);
        delete productGoalShadow.quantityTargets[id];
      }else if(op?.type==="REPLACE_PRODUCT"&&value?.from&&value?.to){
        const from=String(value.from),to=String(value.to);
        productGoalShadow.excludedProducts=uniq([...productGoalShadow.excludedProducts.filter(x=>x!==to),from]);
        productGoalShadow.requiredProducts=uniq([...productGoalShadow.requiredProducts.filter(x=>x!==from),to]);
        if(productGoalShadow.onlyProducts.includes(from))productGoalShadow.onlyProducts=uniq(productGoalShadow.onlyProducts.map(x=>x===from?to:x));
        if(productGoalShadow.quantityTargets[from]&&!productGoalShadow.quantityTargets[to])productGoalShadow.quantityTargets[to]=productGoalShadow.quantityTargets[from];
        delete productGoalShadow.quantityTargets[from];
      }else if(op?.type==="SET_PRODUCT_AMOUNT"&&value?.id){
        productGoalShadow.quantityTargets[String(value.id)]={amount:Number(value.amount),unit:value.unit};
      }
    }
  }

  function guardGoalConsistency(result){
    if(!result||typeof result!=="object")return result;
    const operations=Array.isArray(result.operations)?result.operations:[];
    applyProductGoalOps(operations);
    if(!result.goal||typeof result.goal!=="object")return result;
    const goal={...result.goal,...clone(productGoalShadow)};
    const changed=JSON.stringify(result.goal.requiredProducts||[])!==JSON.stringify(goal.requiredProducts)||
      JSON.stringify(result.goal.excludedProducts||[])!==JSON.stringify(goal.excludedProducts)||
      JSON.stringify(result.goal.onlyProducts||[])!==JSON.stringify(goal.onlyProducts)||
      JSON.stringify(result.goal.quantityTargets||{})!==JSON.stringify(goal.quantityTargets||{});
    return changed?{...result,goal,provider:`${result.provider||"bai-brain"}+goal-guard`}:{...result,goal};
  }

  function guardPeople(raw,result){
    if(!result||typeof result!=="object")return result;
    const parsed=explicitPeople(raw);
    const operations=Array.isArray(result.operations)?result.operations:[];
    const hadPeople=operations.some(op=>op?.type==="SET_PEOPLE");
    let changed=false,nextOps=operations;
    if(parsed){
      peopleShadow=parsed;
      if(hadPeople){
        changed=operations.some(op=>op?.type==="SET_PEOPLE"&&Number(op.value)!==parsed);
        nextOps=operations.map(op=>op?.type==="SET_PEOPLE"?{...op,value:parsed}:op);
      }
    }else if(hadPeople){
      nextOps=operations.filter(op=>op?.type!=="SET_PEOPLE");
      changed=true;
    }
    let goal=result.goal;
    if(goal&&typeof goal==="object"&&goal.people!==peopleShadow){
      goal={...goal,people:peopleShadow};
      changed=true;
    }
    if(!changed)return result;
    return{...result,operations:nextOps,goal,provider:`${result.provider||"bai-brain"}+people-guard`};
  }

  brain.route=async function(raw,...rest){
    const normalized=normalizeTrailingExclusions(raw);
    const ambiguous=ambiguousReplacementChoice(normalized);
    if(ambiguous){
      const left=LABEL[ambiguous.left.id]||ambiguous.left.stem,right=LABEL[ambiguous.right.id]||ambiguous.right.stem;
      return{ok:true,provider:"bai-reasoning-guard+clarification",operations:[],reply:`Вижу два варианта через «или». Уточни один товар для замены: ${left} или ${right}.`,suggestions:[left,right],expectsAnswer:true,goal:{...(originalStatus?.()?.goal||{}),people:peopleShadow,...clone(productGoalShadow)}};
    }
    const replacement=directionalReplacement(normalized);
    let result;
    if(!replacement){
      result=await original(normalized,...rest);
      if(normalized!==String(raw||""))result={...result,provider:`${result?.provider||"bai-brain"}+negation-guard`};
    }else{
      result=await original(replacement.rewrite,...rest);
      result={...result,provider:`${result?.provider||"bai-brain"}+direction-guard`,interpretedAs:{type:"replace",from:replacement.from.id,to:replacement.to.id}};
    }
    return guardGoalConsistency(guardPeople(raw,result));
  };

  if(originalReset)brain.reset=function(...args){
    const result=originalReset(...args);
    peopleShadow=null;
    productGoalShadow={requiredProducts:[],excludedProducts:[],onlyProducts:[],quantityTargets:{}};
    return result;
  };

  if(originalStatus)brain.status=function(){
    const status=originalStatus();
    if(!status?.goal)return status;
    return{...status,goal:{...status.goal,people:peopleShadow,...clone(productGoalShadow)}};
  };

  window.TDBaiReasoningGuard={directionalReplacement,normalizeTrailingExclusions,ambiguousReplacementChoice,explicitPeople,guardPeople,guardGoalConsistency};
})();
