(function(){
  "use strict";
  const storeWords={"пятёроч":"pyat","пятероч":"pyat","магнит":"magnit","перекр":"perek","лент":"lenta","дикси":"dixy","лавк":"lavka","впрок":"vprok"};
  const productWords={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const numberWords={"одного":1,"один":1,"одну":1,"одна":1,"двоих":2,"двух":2,"два":2,"две":2,"двое":2,"троих":3,"трех":3,"трёх":3,"три":3,"трое":3,"четверых":4,"четырех":4,"четырёх":4,"четыре":4,"четверо":4,"пятерых":5,"пяти":5,"пять":5,"шестерых":6,"шести":6,"шесть":6,"семерых":7,"семи":7,"семь":7,"восьмерых":8,"восьми":8,"восемь":8,"девятерых":9,"девяти":9,"девять":9,"десятерых":10,"десяти":10,"десять":10};
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const productName=id=>TDStoreAdapters.catalog().find(p=>p.id===id)?.name||String(id||"товар");
  const productAt=text=>Object.entries(productWords).map(([word,id])=>({word,id,pos:text.indexOf(word)})).filter(x=>x.pos>=0).sort((a,b)=>a.pos-b.pos);
  const escapeRx=value=>String(value||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  function storeScope(low){
    const positive=[],excluded=[];
    for(const [word,id] of Object.entries(storeWords)){
      if(!low.includes(word))continue;
      const esc=escapeRx(word),negative=new RegExp(`(?:^|[\\s,;])(?:не(?:\\s+хочу)?|без)\\s+(?:(?:в|из)\\s+|магазин(?:е|а)?\\s+)?${esc}`).test(low);
      (negative?excluded:positive).push(id);
    }
    const denied=uniq(excluded);
    if(!denied.length)return{requested:uniq(positive),excluded:[]};
    const city=window.state?.city||"msk",known=typeof STORES!=="undefined"&&Array.isArray(STORES)?STORES:[];
    const physical=known.filter(store=>store&&store.kind!=="delivery"&&(!Array.isArray(store.city)||store.city.includes(city))).map(store=>String(store.id));
    const fallback=uniq(Object.values(storeWords).filter(id=>!["lavka","vprok"].includes(id)));
    const base=positive.length?uniq(positive):(physical.length?physical:fallback);
    return{requested:base.filter(id=>!denied.includes(id)),excluded:denied};
  }
  function installOneStoreComparison(){
    const optimizer=window.TDShoppingOptimizer;if(!optimizer||optimizer.__oneStoreComparisonV1)return;const original=optimizer.optimize.bind(optimizer);
    optimizer.optimize=s=>{
      if(!s||s.mode!=="one")return original(s);
      s.quantityTargets=s.quantityTargets||{};s.stores=Array.isArray(s.stores)?s.stores:[];
      const scoped=optimizer.eligibleStores(s),fallback=s.stores.length?uniq(s.stores):[window.state?.storeId||"pyat"],storeIds=scoped.length?scoped:fallback;
      const wanted=uniq([...(s.onlyProducts||[]),...(s.requiredProducts||[]),...(s.products||[]).map(line=>line?.sourceId||line?.id)]);
      const plans=storeIds.map(id=>optimizer.planOne(s,id)),coverage=plan=>wanted.filter(id=>plan.products.some(line=>(line.sourceId||line.id)===id||line.id===id)).length;
      const complete=wanted.length?plans.filter(plan=>coverage(plan)===wanted.length):plans,pool=complete.length?complete:plans;
      pool.sort((a,b)=>coverage(b)-coverage(a)||a.total-b.total||String(a.stores[0]).localeCompare(String(b.stores[0])));
      return[pool[0]||original(s)[0]];
    };
    optimizer.__oneStoreComparisonV1=true;
  }
  installOneStoreComparison();
  function parsePeople(low){
    let m=low.match(/(?:^|[^а-яё])нас\s+(\d+|[а-яё]+)(?=\s|$|[,.!?])/);
    if(m)return /^\d+$/.test(m[1])?Number(m[1]):numberWords[m[1]]||null;
    m=low.match(/(?:^|[^а-яё])(?:на|для)\s+(\d+|[а-яё]+)\s*(?:человек(?:а|у|ом)?|чел\.?|персон(?:ы|у)?|едок(?:а|ов)?)(?=\s|$|[,.!?])/);
    if(!m)return null;
    return /^\d+$/.test(m[1])?Number(m[1]):numberWords[m[1]]||null;
  }
  function isOnlyRequest(low,mentioned){if(!mentioned.length)return false;return /(?:только|лишь|исключительно)\b/.test(low)||/\bодн(?:и|их|ого|ой)\b/.test(low)||/(?:пусть|чтобы)[^.!?]{0,35}\bпросто\b/.test(low)||/\bпросто\s+(?:банан|яблок|молок|хлеб|вод|яйц|макарон|греч|куриц)/.test(low)||/корзин[^.!?]{0,60}\bиз\s+(?:банан|яблок|молок|хлеб|вод|яйц|макарон|греч|куриц)/.test(low);}
  const unit=u=>{u=String(u||"").toLowerCase();if(/^кг/.test(u))return"kg";if(/^(г|гр)/.test(u))return"g";if(/^(л|лит)/.test(u))return"l";if(/^мл/.test(u))return"ml";if(/пач|упак/.test(u))return"pack";if(/шт|штук/.test(u))return"pcs";return null};
  function parseAmounts(low){const out=[];for(const [stem,id] of Object.entries(productWords)){if(!low.includes(stem))continue;const esc=stem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),num="(\\d+(?:[.,]\\d+)?)",wordNum="(одна|один|одну|две|два|три|четыре|пять|шесть|семь|восемь|девять|десять)",u="(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|миллилитр(?:а|ов)?|пачк(?:а|и|у|ек)?|упаковк(?:а|и|у|ок)?|шт|штук(?:а|и)?)";let m=low.match(new RegExp(num+"\\s*"+u+"\\s+[^,.!?]{0,18}"+esc))||low.match(new RegExp(esc+"[^,.!?]{0,18}?"+num+"\\s*"+u));if(m){const value=Number(String(m[1]).replace(",",".")),normalized=unit(m[2]);if(value>0&&normalized)out.push({id,amount:value,unit:normalized});continue}m=low.match(new RegExp(wordNum+"\\s*"+u+"\\s+[^,.!?]{0,18}"+esc))||low.match(new RegExp(esc+"[^,.!?]{0,18}?"+wordNum+"\\s*"+u));if(m){const value=numberWords[m[1]]||0,normalized=unit(m[2]);if(value>0&&normalized)out.push({id,amount:value,unit:normalized});continue}if(["eggs","banana","apple"].includes(id)){m=low.match(new RegExp("(\\d+)\\s+(?:шт\\.?\\s+)?[^,.!?]{0,10}"+esc))||low.match(new RegExp(wordNum+"\\s+(?:шт\\.?\\s+)?[^,.!?]{0,10}"+esc));if(m){const value=/^\d+$/.test(m[1])?Number(m[1]):numberWords[m[1]]||0;if(value>0)out.push({id,amount:value,unit:"pcs"})}}}return out}
  function parse(raw){
    const text=String(raw||"").trim(),low=text.toLowerCase(),ops=[];if(!text)return ops;if(/верни как было|отмени|назад/.test(low))return[{type:"UNDO"}];
    const budget=low.match(/(?:до|максимум|на)\s*(\d(?:[\d\s.,]*\d)?)\s*(?:р|₽|руб)/)||low.match(/(?:^|[^а-яё])бюджет(?:\s+теперь)?\s*(?:до\s*)?(\d(?:[\d\s.,]*\d)?)\s*(?:р|₽|руб)?(?=\s|$|[,.!?])/);if(budget)ops.push({type:"CHANGE_BUDGET",value:Number(budget[1].replace(/[^\d]/g,""))});
    const people=parsePeople(low);if(people)ops.push({type:"SET_PEOPLE",value:people});const days=low.match(/на\s+(\d+)\s*(?:дн|дня|дней)/);if(days)ops.push({type:"SET_DURATION",value:Number(days[1])});
    if(/готовить\s+(?:не хочу|лень)|минимум готовки|готовить особо не люблю/.test(low))ops.push({type:"SET_COOKING",value:"minimal"});if(/максимум еды|побольше еды/.test(low))ops.push({type:"ADD_PREFERENCE",value:"maximum_food"});if(/без молоч|молочку не/.test(low))ops.push({type:"EXCLUDE_TAG",value:"молочка"});
    const retailer=storeScope(low);retailer.requested.forEach(id=>ops.push({type:"CHANGE_STORE",value:id}));if(retailer.excluded.length||retailer.requested.length>1)ops.push({type:"SET_MODE",value:"multi"});else if(retailer.requested.length===1&&/(?:^|[^а-яёa-z0-9])только(?:$|[^а-яёa-z0-9])/.test(low))ops.push({type:"SET_MODE",value:"one"});if(/(?:^|[^а-яёa-z0-9])один\s+магазин(?:$|[^а-яёa-z0-9])|в одном магазине|одним магазином|из\s+одного\s+магазина/.test(low))ops.push({type:"SET_MODE",value:"one"});if(/из двух|нескольк.*магаз|там дешевле|по разным магазин|где дешевле/.test(low))ops.push({type:"SET_MODE",value:"multi"});
    const ordered=productAt(low),mentioned=uniq(ordered.map(x=>x.id)),only=isOnlyRequest(low,mentioned),replace=/замени|поменяй|вместо/.test(low)&&ordered.length>=2,remove=/убери|удали|исключи|без\s+(?:банан|яблок|молок|хлеб|вод|яйц|макарон|греч|куриц)/.test(low),add=/добав|докин|положи ещё|плюс/.test(low),fresh=/с нуля|заново|новую корзин/.test(low);
    const parsedAmounts=parseAmounts(low),partialPackRemovals=new Map((remove?parsedAmounts:[]).filter(x=>mentioned.includes(x.id)&&x.unit==="pack"&&Number.isInteger(Number(x.amount))&&Number(x.amount)>0).map(x=>[x.id,x]));
    if(fresh)ops.push({type:"RESET_BASKET"});
    if(only)ops.push({type:"SET_INTENT",value:"only"},{type:"SET_ONLY_PRODUCTS",value:mentioned});
    else if(replace)ops.push({type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from:ordered[0].id,to:ordered[ordered.length-1].id}});
    else if(remove){ops.push({type:"SET_INTENT",value:"remove"});mentioned.forEach(id=>{const partial=partialPackRemovals.get(id);if(partial)ops.push({type:"CHANGE_QUANTITY",value:{id,delta:-Number(partial.amount)}});else ops.push({type:"REMOVE_PRODUCT",value:id})});}
    else if(add){ops.push({type:"SET_INTENT",value:"add"});mentioned.forEach(id=>ops.push({type:"ADD_PRODUCT",value:id}));}
    else if(mentioned.length&&/собери|нужн|хочу|пожевать|перекус/.test(low)){ops.push({type:"CLEAR_ONLY"},{type:"SET_INTENT",value:"build"});if(/фрукт/.test(low))ops.push({type:"PREFER",value:"фрукты"});mentioned.forEach(id=>ops.push({type:"REQUIRE",value:id}));if(/пожевать|перекус/.test(low))ops.push({type:"PREFER",value:"перекус"});}
    else if(/собери|подбери|корзин/.test(low))ops.push({type:"CLEAR_ONLY"},{type:"SET_INTENT",value:"build"});
    parsedAmounts.forEach(x=>{if(remove)return;if(!mentioned.includes(x.id))return;if(!ops.some(o=>(o.type==="REQUIRE"||o.type==="ADD_PRODUCT")&&o.value===x.id))ops.push({type:"REQUIRE",value:x.id});ops.push({type:"SET_PRODUCT_AMOUNT",value:x})});
    if(/подешевле|дешевле|пересобери|пересчитай|побольше|поменьше/.test(low)&&ops.length)ops.push({type:"REOPTIMIZE"});
    const brand=low.match(/(?:бренд\s+)?([а-яёa-z0-9-]+)\s+(?:не хочу|не добавляй)/i),withoutBrand=low.match(/(?:^|[\s,;])без\s+([а-яёa-z0-9-]+)/i),brandValue=brand?.[1]||withoutBrand?.[1],storeLike=brandValue&&Object.keys(storeWords).some(word=>brandValue.includes(word)||word.includes(brandValue));if(brandValue&&!storeLike&&!productAt(brandValue).length&&!/^(?:молоч|глютен|лактоз|сахар|мяс|рыб|орех)/.test(brandValue))ops.push({type:"EXCLUDE_BRAND",value:brandValue});const existing=low.match(/дома (?:есть|уже есть)\s+(.+?)(?:\.|,?\s+(?:нужн|хочу|и хотелось)|$)/);if(existing)existing[1].split(/,| и /).map(x=>x.trim()).filter(Boolean).forEach(x=>ops.push({type:"HAS_AT_HOME",value:x}));if(!ops.length)ops.push({type:"NOTE",value:text});return ops;
  }
  function resetBasketState(s){s.products=[];s.requiredProducts=[];s.preferredProducts=[];s.excludedProducts=[];s.excludedBrands=[];s.onlyProducts=[];s.quantityTargets={};s.selectionMode="auto";s.preferences=[];s.userNotes=[];}
  function apply(raw,providedOps){
    const ops=Array.isArray(providedOps)&&providedOps.length?providedOps:parse(raw);
    if(ops[0]?.type==="UNDO")return TDShoppingState.undo();
    const clarification=ops.find(op=>op.type==="ASK_CLARIFICATION");
    if(clarification){const message=String(clarification.value||"Уточни, пожалуйста, что именно ты хочешь изменить в корзине.");return{ok:false,state:TDShoppingState.get(),plans:TDShoppingState.get().lastPlans||[],message,operations:ops,needsClarification:true};}
    const requestedStores=uniq(ops.filter(op=>op.type==="CHANGE_STORE").map(op=>String(op.value||"")).filter(Boolean));
    const descriptions=[];let plans=[];
    TDShoppingState.commit(ops[0]?.type||"UPDATE",s=>{
      s.quantityTargets=s.quantityTargets||{};
      if(requestedStores.length)s.stores=[...requestedStores];
      for(const op of ops){
        if(op.type==="RESET_BASKET")resetBasketState(s);
        if(op.type==="CHANGE_BUDGET")s.budget=Math.max(0,Number(op.value)||0);
        if(op.type==="SET_PEOPLE")s.peopleCount=Math.max(1,Number(op.value)||1);
        if(op.type==="SET_DURATION")s.duration=Math.max(1,Number(op.value)||1);
        if(op.type==="SET_COOKING")s.cookingPreference=op.value;
        if(op.type==="SET_INTENT")s.intent=String(op.value||"build");
        if(op.type==="ADD_PREFERENCE"&&!s.preferences.includes(op.value))s.preferences.push(op.value);
        if(op.type==="SET_MODE")s.mode=op.value;
        if(op.type==="CLEAR_ONLY"){s.selectionMode="auto";s.onlyProducts=[];}
        if(op.type==="SET_ONLY_PRODUCTS"){const ids=uniq(Array.isArray(op.value)?op.value:[op.value]);s.selectionMode="only";s.onlyProducts=ids;s.requiredProducts=[...ids];s.preferredProducts=[];s.excludedProducts=s.excludedProducts.filter(id=>!ids.includes(id));s.products=[];Object.keys(s.quantityTargets).forEach(id=>{if(!ids.includes(id))delete s.quantityTargets[id]});}
        if(op.type==="SET_PRODUCT_AMOUNT"&&op.value?.id){const amount=Number(op.value.amount),unit=String(op.value.unit||"");if(amount>0&&unit)s.quantityTargets[op.value.id]={amount,unit};}
        if(op.type==="ADD_PRODUCT"){const id=op.value;if(id&&!s.requiredProducts.includes(id))s.requiredProducts.push(id);if(s.selectionMode==="only"&&id&&!s.onlyProducts.includes(id))s.onlyProducts.push(id);s.excludedProducts=s.excludedProducts.filter(x=>x!==id);}
        if(op.type==="REMOVE_PRODUCT"){const id=op.value;if(id&&!s.excludedProducts.includes(id))s.excludedProducts.push(id);s.products=s.products.filter(x=>x.id!==id);s.requiredProducts=s.requiredProducts.filter(x=>x!==id);s.onlyProducts=s.onlyProducts.filter(x=>x!==id);delete s.quantityTargets[id];}
        if(op.type==="CHANGE_QUANTITY"&&op.value?.id){
          const id=String(op.value.id),line=s.products.find(x=>x.id===id),current=Math.max(0,Number(line?.quantity)||0);
          const absolute=Number(op.value.quantity),delta=Number(op.value.delta),next=Math.max(0,Math.min(99,Number.isFinite(absolute)?absolute:current+(Number.isFinite(delta)?delta:0)));
          if(next<=0){if(!s.excludedProducts.includes(id))s.excludedProducts.push(id);s.products=s.products.filter(x=>x.id!==id);s.requiredProducts=s.requiredProducts.filter(x=>x!==id);s.onlyProducts=s.onlyProducts.filter(x=>x!==id);delete s.quantityTargets[id];}
          else{s.quantityTargets[id]={amount:next,unit:"pack"};if(!s.requiredProducts.includes(id))s.requiredProducts.push(id);if(s.selectionMode==="only"&&!s.onlyProducts.includes(id))s.onlyProducts.push(id);s.excludedProducts=s.excludedProducts.filter(x=>x!==id);}
        }
        if(op.type==="REPLACE_PRODUCT"&&op.value){const from=op.value.from,to=op.value.to,target=s.quantityTargets[from];if(from&&!s.excludedProducts.includes(from))s.excludedProducts.push(from);s.requiredProducts=s.requiredProducts.filter(x=>x!==from);s.onlyProducts=s.onlyProducts.filter(x=>x!==from);delete s.quantityTargets[from];if(to&&!s.requiredProducts.includes(to))s.requiredProducts.push(to);if(s.selectionMode==="only"&&to&&!s.onlyProducts.includes(to))s.onlyProducts.push(to);s.excludedProducts=s.excludedProducts.filter(x=>x!==to);if(target&&!s.quantityTargets[to])s.quantityTargets[to]=target;}
        if(op.type==="REQUIRE"&&!s.requiredProducts.includes(op.value)){s.requiredProducts.push(op.value);s.excludedProducts=s.excludedProducts.filter(x=>x!==op.value);}
        if(op.type==="PREFER"&&!s.preferredProducts.includes(op.value))s.preferredProducts.push(op.value);
        if(op.type==="EXCLUDE_BRAND"&&!s.excludedBrands.includes(op.value))s.excludedBrands.push(op.value);
        if(op.type==="HAS_AT_HOME"&&!s.existingProducts.includes(op.value))s.existingProducts.push(op.value);
        if(op.type==="EXCLUDE_TAG")s.excludedProducts=uniq([...s.excludedProducts,...TDStoreAdapters.catalog().filter(p=>(p.tags||[]).includes(op.value)).map(p=>p.id)]);
        if(op.type==="NOTE")s.userNotes.push(op.value);
        descriptions.push(op.type);
      }
      plans=TDShoppingOptimizer.optimize(s);const best=plans[0];s.products=best?.products||[];s.currentTotal=Number(best?.total)||0;s.lastPlans=plans;
    },descriptions.join(", "));
    const s=TDShoppingState.get(),best=plans[0]||{products:[],total:0,quality:"UNKNOWN"};TDShoppingState.syncCart();const uncertain=best.quality!=="LIVE",budget=s.budget,rest=budget?budget-best.total:null,totalUnits=best.products.reduce((n,x)=>n+(x.quantity||1),0),amounts=best.products.filter(x=>x.requestedAmountLabel).map(x=>`${x.name} — ${x.requestedAmountLabel}`).slice(0,3);
    const removed=uniq(ops.filter(x=>x.type==="REMOVE_PRODUCT").map(x=>x.value)),added=uniq(ops.filter(x=>x.type==="ADD_PRODUCT").map(x=>x.value)),replaced=ops.filter(x=>x.type==="REPLACE_PRODUCT"&&x.value),changed=ops.filter(x=>x.type==="CHANGE_QUANTITY"&&x.value?.id);
    let lead="";if(replaced.length)lead=replaced.map(x=>`Заменил ${productName(x.value.from)} на ${productName(x.value.to)}.`).join(" ");else if(removed.length)lead=`Убрал: ${removed.map(productName).join(", ")}.`;else if(added.length)lead=`Добавил: ${added.map(productName).join(", ")}.`;else if(changed.length)lead=changed.map(x=>`${Number(x.value.delta)<0?"Уменьшил":"Изменил количество"}: ${productName(x.value.id)}.`).join(" ");
    let message=(lead?lead+" ":"")+(s.selectionMode==="only"?`В корзине только ${best.products.map(x=>x.name).join(", ")||"выбранные товары"}. ${totalUnits} уп. — ${best.total}${budget?` из ${budget}`:""} ₽.`:`Теперь ${best.products.length} видов товаров, ${totalUnits} упаковок${s.peopleCount>1?` на ${s.peopleCount} человек`:""}${s.duration>1?` на ${s.duration} дн.`:""}${budget?` — ${best.total} из ${budget} ₽`:` — ориентир ${best.total} ₽`}.`);
    if(amounts.length)message+=` По количеству: ${amounts.join("; ")}.`;
    if(uncertain)message+=` Часть цен оценочная: итог проверю перед покупкой.`;if(rest!=null&&rest>Math.max(250,budget*.2)&&s.selectionMode!=="only")message+=` Запас бюджета около ${rest} ₽ — могу усилить корзину ещё.`;if(rest!=null&&rest<0)message+=` Бюджет превышен на ${Math.abs(rest)} ₽ — явные количества не режу, лучше предложу что убрать из остального.`;
    return{ok:true,state:TDShoppingState.get(),plans,message,operations:ops};
  }
  window.TDShoppingConversation={parse,apply};
})();