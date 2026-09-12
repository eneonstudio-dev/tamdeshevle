(()=>{
  "use strict";
  const brain=window.TDBaiBrain;
  if(!brain?.route||window.TDBaiReasoningGuard)return;

  const PRODUCT={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","яиц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const LABEL={milk:"молоко",bread:"хлеб",chicken:"курица",banana:"банан",oil:"масло",eggs:"яйца",buck:"гречка",sour:"сметана",sugar:"сахар",pasta:"макароны",water:"вода",apple:"яблоки",ham:"ветчина",dumplings:"пельмени",noodles:"лапша",waffles:"вафли",cottage:"творог"};
  const NUM={"один":1,"одного":1,"одна":1,"одну":1,"два":2,"две":2,"двое":2,"двоих":2,"три":3,"трое":3,"троих":3,"четыре":4,"четверо":4,"четверых":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10};
  const ORDINAL=[
    {index:0,re:/(^|[^а-я])(первый|первая|первую|первое|первого|первой)(?=$|[^а-я])/},
    {index:1,re:/(^|[^а-я])(второй|вторая|вторую|второе|второго)(?=$|[^а-я])/},
    {index:2,re:/(^|[^а-я])(третий|третья|третью|третье|третьего|третьей)(?=$|[^а-я])/},
    {index:3,re:/(^|[^а-я])(четвертый|четвертая|четвертую|четвертое|четвертого|четвертой)(?=$|[^а-я])/},
    {index:4,re:/(^|[^а-я])(пятый|пятая|пятую|пятое|пятого|пятой)(?=$|[^а-я])/},
    {last:true,re:/(^|[^а-я])(последний|последняя|последнюю|последнее|последнего|последней)(?=$|[^а-я])/}
  ];
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

  function normalizeScopedWithoutAdd(raw){
    const source=String(raw||""),t=low(source),items=mentions(source);
    if(items.length!==2||!/(^|[^а-я])без(?=$|[^а-я])/.test(t)||!/(^|[^а-я])(?:добав[а-я]*|докин[а-я]*|положи)(?=$|[^а-я])/.test(t))return source;
    const withoutMatch=/(^|[^а-я])без(?=$|[^а-я])/.exec(t),addMatch=/(^|[^а-я])(?:добав[а-я]*|докин[а-я]*|положи)(?=$|[^а-я])/.exec(t);
    if(!withoutMatch||!addMatch)return source;
    const withoutPos=withoutMatch.index+withoutMatch[1].length,addPos=addMatch.index+addMatch[1].length;
    const excluded=items.find(item=>item.pos>withoutPos&&(withoutPos<addPos?item.pos<addPos:true));
    const added=items.find(item=>item.pos>addPos&&(addPos<withoutPos?item.pos<withoutPos:true));
    if(!excluded||!added||excluded.id===added.id)return source;
    return `убери ${excluded.stem}, добавь ${added.stem}`;
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

  function basketOrder(){
    const live=window.TDShoppingState?.get?.()?.products;
    const liveIds=uniq((Array.isArray(live)?live:[]).map(item=>typeof item==="string"?item:item?.id).filter(id=>LABEL[id]));
    if(liveIds.length)return liveIds;
    const only=uniq(productGoalShadow.onlyProducts);
    return only.length?only:uniq(productGoalShadow.requiredProducts);
  }

  function ordinalCommand(raw){
    const t=low(raw),ordinal=ORDINAL.find(x=>x.re.test(t));
    if(!ordinal)return null;
    const wantsRemove=/(^|[^а-я])(убери|удали|исключи|выкинь)(?=$|[^а-я])/.test(t);
    const wantsReplace=/(^|[^а-я])(замени|поменяй)(?=$|[^а-я])/.test(t);
    if(!wantsRemove&&!wantsReplace)return null;
    const order=basketOrder(),index=ordinal.last?order.length-1:ordinal.index;
    if(index<0||index>=order.length)return{kind:"clarify",reply:`В корзине нет ${ordinal.last?"последней":"такой"} позиции. Что именно изменить?`,suggestions:[]};
    const source=order[index],items=mentions(raw);
    if(wantsRemove){
      if(items.length)return null;
      return{kind:"remove",source,index,rewrite:`убери ${LABEL[source]||source}`};
    }
    const orPos=t.indexOf("или");
    if(orPos>=0&&items.length>=2){
      const left=items.filter(x=>x.pos<orPos).at(-1),right=items.find(x=>x.pos>orPos);
      if(left&&right&&left.id!==right.id){
        const leftLabel=LABEL[left.id]||left.stem,rightLabel=LABEL[right.id]||right.stem;
        return{kind:"clarify",reply:`На что заменить эту позицию: ${leftLabel} или ${rightLabel}?`,suggestions:[leftLabel,rightLabel]};
      }
    }
    if(!items.length)return{kind:"clarify",reply:`На что заменить ${index+1}-ю позицию? Назови товар.`,suggestions:[]};
    const target=items.at(-1).id;
    if(target===source)return{kind:"clarify",reply:`Эта позиция уже ${LABEL[source]||source}. Назови другой товар.`,suggestions:[]};
    return{kind:"replace",source,target,index,rewrite:`замени ${LABEL[source]||source} на ${LABEL[target]||target}`};
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
    const trailingNormalized=normalizeTrailingExclusions(raw);
    const normalized=normalizeScopedWithoutAdd(trailingNormalized);
    const ordinal=ordinalCommand(normalized);
    if(ordinal?.kind==="clarify"){
      return{ok:true,provider:"bai-reasoning-guard+ordinal-clarification",operations:[],reply:ordinal.reply,suggestions:(ordinal.suggestions||[]).slice(0,3),expectsAnswer:true,goal:{...(originalStatus?.()?.goal||{}),people:peopleShadow,...clone(productGoalShadow)}};
    }
    const ambiguous=ambiguousReplacementChoice(normalized);
    if(ambiguous){
      const left=LABEL[ambiguous.left.id]||ambiguous.left.stem,right=LABEL[ambiguous.right.id]||ambiguous.right.stem;
      return{ok:true,provider:"bai-reasoning-guard+clarification",operations:[],reply:`Вижу два варианта через «или». Уточни один товар для замены: ${left} или ${right}.`,suggestions:[left,right],expectsAnswer:true,goal:{...(originalStatus?.()?.goal||{}),people:peopleShadow,...clone(productGoalShadow)}};
    }
    const replacement=ordinal?null:directionalReplacement(normalized);
    let result;
    if(ordinal?.rewrite){
      result=await original(ordinal.rewrite,...rest);
      result={...result,provider:`${result?.provider||"bai-brain"}+ordinal-guard`,interpretedAs:{type:ordinal.kind,position:ordinal.index+1,from:ordinal.source,to:ordinal.target||null}};
    }else if(!replacement){
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

  window.TDBaiReasoningGuard={directionalReplacement,normalizeTrailingExclusions,normalizeScopedWithoutAdd,ambiguousReplacementChoice,ordinalCommand,explicitPeople,guardPeople,guardGoalConsistency};
})();
