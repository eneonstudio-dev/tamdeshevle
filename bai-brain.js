(() => {
  "use strict";

  const PRODUCTS={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const STORES={"пятероч":"pyat","пятёроч":"pyat","магнит":"magnit","перекр":"perek","лент":"lenta","дикси":"dixy","лавк":"lavka","впрок":"vprok"};
  const NUM={"один":1,"одного":1,"одну":1,"два":2,"двое":2,"двоих":2,"двух":2,"три":3,"трое":3,"троих":3,"трех":3,"четыре":4,"четверо":4,"четверых":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10};
  const uniq=a=>[...new Set((a||[]).filter(Boolean))],low=s=>String(s||"").toLowerCase().replace(/ё/g,"е"),state=()=>window.TDShoppingState?.get?.()||{};
  const emptyGoal=()=>({task:"basket",occasion:null,people:null,days:null,budget:null,cooking:null,preferences:[],requiredProducts:[],excludedProducts:[],onlyProducts:[],quantityTargets:{},stores:[],mode:null});
  let memory={pending:null,lastIntent:"build",turns:0,lastSuggestions:[],goal:emptyGoal()};

  function products(text){const t=low(text),out=[];for(const [stem,id] of Object.entries(PRODUCTS)){const p=t.indexOf(stem);if(p>=0)out.push({id,pos:p,stem})}return out.sort((a,b)=>a.pos-b.pos)}
  function stores(text){const t=low(text),out=[];for(const [stem,id] of Object.entries(STORES))if(t.includes(stem))out.push(id);return uniq(out)}
  function number(v){if(!v)return null;if(/^\d+$/.test(v))return Number(v);return NUM[low(v)]||null}
  function people(text){const m=low(text).match(/(?:нас|на|для|будет)\s+(\d+|[а-я]+)\s*(?:человек|чел|персон|едок|нас)?/);return m?number(m[1]):null}
  function days(text){const m=low(text).match(/(?:на|примерно на)\s+(\d+|[а-я]+)\s*(?:день|дня|дней|суток)/);return m?number(m[1]):null}
  function budget(text){const t=low(text);let m=t.match(/(?:до|бюджет(?:ом)?|улож(?:ись|иться) в|не больше|примерно|около)\s*([\d\s.,]+)\s*(?:р|руб|₽)/);if(m)return Number(m[1].replace(/\D/g,""));m=t.match(/(?:на)\s*([\d\s.,]+)\s*(?:р|руб|₽)/);return m?Number(m[1].replace(/\D/g,"")):null}
  function relativeBudget(text,current){const t=low(text);let m=t.match(/(?:дешевле|снизь|уменьши)\s*(?:на)?\s*(\d+)\s*%/);if(m&&current)return Math.max(1,Math.round(current*(1-Number(m[1])/100)));if(/подешевле|дешевле|сэконом/.test(t)&&current)return Math.max(1,Math.round(current*.85));return null}
  const yes=t=>/^(да|ага|угу|давай|ок|окей|верно|поехали)\b/.test(low(t).trim()),no=t=>/^(нет|неа|не надо|отмена)\b/.test(low(t).trim());
  const fresh=t=>/с нуля|заново|новую корзин|начн[её]м заново/.test(t),only=t=>/\b(только|исключительно|лишь|одни|одних)\b/.test(t)||/корзин\w*\s+из\s+/.test(t),add=t=>/\b(добав|докин|еще|плюс|положи)\w*/.test(t),remove=t=>/\b(убери|удали|исключи|выкинь|без)\b/.test(t),replace=t=>/\b(замени|поменяй|вместо)\b/.test(t);
  const normalizeUnit=u=>{u=low(u);if(/^кг|килограмм/.test(u))return"kg";if(/^г$|^гр|^грамм/.test(u))return"g";if(/^мл|миллилитр/.test(u))return"ml";if(/^л$|^литр/.test(u))return"l";if(/пач|упаков/.test(u))return"pack";if(/^шт|штук/.test(u))return"pcs";return null};
  function amounts(text,ordered){const t=low(text),out=[];const n="(\\d+(?:[.,]\\d+)?)",u="(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|миллилитр(?:а|ов)?|пачк(?:а|и|ек)?|упаковк(?:а|и|ок)?|шт|штук(?:а|и)?)";for(const p of ordered){const stem=p.stem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");let m=t.match(new RegExp(n+"\\s*"+u+"\\s+[^,.!?]{0,18}"+stem))||t.match(new RegExp(stem+"[^,.!?]{0,18}?"+n+"\\s*"+u));if(m){const amount=Number(String(m[1]).replace(",",".")),unit=normalizeUnit(m[2]);if(amount>0&&unit)out.push({id:p.id,amount,unit});continue}if(["eggs","banana","apple"].includes(p.id)){m=t.match(new RegExp("(\\d+)\\s+(?:шт\\.?\\s+)?[^,.!?]{0,10}"+stem));if(m&&Number(m[1])>0)out.push({id:p.id,amount:Number(m[1]),unit:"pcs"})}}return out}
  const amountLabel=x=>x.unit==="kg"?`${x.amount} кг`:x.unit==="g"?`${x.amount} г`:x.unit==="l"?`${x.amount} л`:x.unit==="ml"?`${x.amount} мл`:x.unit==="pack"?`${x.amount} уп.`:`${x.amount} шт.`;

  function prefs(t){const ops=[];if(/готовить\s*(не хочу|лень|не буду)|без готовки|минимум готовки|быстро и просто/.test(t))ops.push({type:"SET_COOKING",value:"minimal"});if(/сытн|плотн|наесться|пожирнее/.test(t))ops.push({type:"ADD_PREFERENCE",value:"hearty"});if(/перекус|пожевать|к сериалу|к фильму/.test(t))ops.push({type:"ADD_PREFERENCE",value:"snacks"});if(/полезн|здоров|пп\b/.test(t))ops.push({type:"ADD_PREFERENCE",value:"healthy"});if(/бюджетн|эконом/.test(t))ops.push({type:"ADD_PREFERENCE",value:"budget"});if(/фрукт/.test(t))ops.push({type:"PREFER",value:"фрукты"});if(/сладк|к чаю/.test(t))ops.push({type:"PREFER",value:"сладкое"});if(/завтрак/.test(t))ops.push({type:"ADD_PREFERENCE",value:"breakfast"});if(/ужин|на вечер/.test(t))ops.push({type:"ADD_PREFERENCE",value:"dinner"});return ops}

  function mergeGoal(ops,text=""){
    const g=memory.goal,t=low(text);
    if(/ужин|на вечер/.test(t))g.occasion="dinner";else if(/завтрак/.test(t))g.occasion="breakfast";else if(/перекус|к сериалу|к фильму/.test(t))g.occasion="snacks";
    for(const o of ops||[]){
      if(o.type==="RESET_BASKET")memory.goal=emptyGoal();
      else if(o.type==="CHANGE_BUDGET")memory.goal.budget=Number(o.value)||null;
      else if(o.type==="SET_PEOPLE")memory.goal.people=Number(o.value)||null;
      else if(o.type==="SET_DURATION")memory.goal.days=Number(o.value)||null;
      else if(o.type==="SET_COOKING")memory.goal.cooking=o.value;
      else if(o.type==="ADD_PREFERENCE"||o.type==="PREFER")memory.goal.preferences=uniq([...(memory.goal.preferences||[]),String(o.value)]);
      else if(o.type==="REQUIRE"||o.type==="ADD_PRODUCT")memory.goal.requiredProducts=uniq([...(memory.goal.requiredProducts||[]),String(o.value)]);
      else if(o.type==="REMOVE_PRODUCT"){memory.goal.excludedProducts=uniq([...(memory.goal.excludedProducts||[]),String(o.value)]);delete memory.goal.quantityTargets[o.value]}
      else if(o.type==="SET_ONLY_PRODUCTS")memory.goal.onlyProducts=uniq(o.value||[]);
      else if(o.type==="SET_PRODUCT_AMOUNT"&&o.value?.id)memory.goal.quantityTargets[o.value.id]={amount:Number(o.value.amount),unit:o.value.unit};
      else if(o.type==="CHANGE_STORE")memory.goal.stores=uniq([...(memory.goal.stores||[]),String(o.value)]);
      else if(o.type==="SET_MODE")memory.goal.mode=o.value;
      else if(o.type==="REPLACE_PRODUCT"&&o.value){memory.goal.excludedProducts=uniq([...(memory.goal.excludedProducts||[]),String(o.value.from)]);memory.goal.requiredProducts=uniq([...(memory.goal.requiredProducts||[]),String(o.value.to)]);if(memory.goal.quantityTargets[o.value.from]&&!memory.goal.quantityTargets[o.value.to])memory.goal.quantityTargets[o.value.to]=memory.goal.quantityTargets[o.value.from];delete memory.goal.quantityTargets[o.value.from]}
    }
    return memory.goal;
  }
  function dedupeOps(ops){const seen=new Set();return (ops||[]).filter(o=>{const k=o.type+":"+JSON.stringify(o.value??null);if(seen.has(k))return false;seen.add(k);return true})}
  function question(text,options,kind,deferred=[]){mergeGoal(deferred);memory.pending={kind,deferred:dedupeOps(deferred)};memory.lastSuggestions=options||[];return{ok:true,provider:"bai-brain-v4",operations:[{type:"ASK_CLARIFICATION",value:text}],reply:text,suggestions:options||[],expectsAnswer:true,goal:JSON.parse(JSON.stringify(memory.goal))}}
  function proposal(text,options){memory.lastSuggestions=options||[];return{ok:true,provider:"bai-brain-v4",operations:[],reply:text,suggestions:options||[],expectsAnswer:true,goal:JSON.parse(JSON.stringify(memory.goal))}}
  function resolved(p,extra,reply){const operations=dedupeOps([...(p.deferred||[]),...extra,{type:"REOPTIMIZE"}]);mergeGoal(operations);return{operations,reply,suggestions:[],confirmedContext:true,goal:JSON.parse(JSON.stringify(memory.goal))}}
  function resolvePending(raw){const p=memory.pending;if(!p)return null;const t=low(raw);memory.pending=null;
    if(p.kind==="budget"){const b=budget(raw)||number(t.trim());if(b)return resolved(p,[{type:"CHANGE_BUDGET",value:b}],`Принял ${b} ₽. И предыдущую цель не потерял.`);if(/без бюджета|неважно|любой/.test(t))return resolved(p,[],"Окей, жёсткий потолок не ставлю. Остальные условия сохранил.")}
    if(p.kind==="people"){const n=people(raw)||number(t.trim());if(n)return resolved(p,[{type:"SET_PEOPLE",value:n}],`Понял, на ${n}. Предыдущие условия тоже держу в голове.`)}
    if(p.kind==="style"){if(/сыт/.test(t))return resolved(p,[{type:"ADD_PREFERENCE",value:"hearty"}],"Делаю упор на сытность.");if(/перекус|снэк|снек/.test(t))return resolved(p,[{type:"ADD_PREFERENCE",value:"snacks"}],"Окей, больше удобных перекусов.");if(/полез/.test(t))return resolved(p,[{type:"ADD_PREFERENCE",value:"healthy"}],"Понял, смещаю выбор в более полезную сторону.");if(/дешев|эконом/.test(t))return resolved(p,[{type:"ADD_PREFERENCE",value:"budget"}],"Тогда приоритет — цена.")}
    if(p.kind==="cooking"){if(/не хочу|лень|без готовки/.test(t)||yes(raw))return resolved(p,[{type:"SET_COOKING",value:"minimal"}],"Окей, почти без готовки.");if(no(raw)||/готовить могу|нормально готовить/.test(t))return resolved(p,[{type:"SET_COOKING",value:"normal"}],"Понял, готовку не ограничиваю.")}
    if(no(raw))return{operations:[],reply:"Хорошо, это уточнение отменил. Уже понятые условия сохранил.",suggestions:[],confirmedContext:true,goal:JSON.parse(JSON.stringify(memory.goal))};
    memory.pending=p;return null
  }

  function advisor(raw,s){const t=low(raw),best=s.lastPlans?.[0];if(/хватит ли|нормально ли|как корзина|что скажешь|оцени/.test(t)&&best){const b=s.budget||0,total=best.total||0;if(b&&total>b)return proposal(`Сейчас корзина выше бюджета примерно на ${Math.round(total-b)} ₽. Я бы сначала ужал лишнее, а обязательное оставил.`,["Ужми до бюджета","Покажи что убрать","Оставь как есть"]);if(b&&total<b*.72)return proposal(`Запас бюджета ещё около ${Math.round(b-total)} ₽. Можно либо оставить экономный вариант, либо усилить корзину.`,["Добавь сытности","Добавь фруктов","Оставь экономно"]);return proposal("По текущим условиям корзина выглядит нормально. Могу сделать её сытнее, дешевле или удобнее по готовке.",["Сытнее","Дешевле","Меньше готовки"])}if(/что лучше|что бы ты выбрал|посоветуй вариант/.test(t))return proposal("Я бы выбрал направление по твоей главной цели. Что сейчас важнее?",["Сытность","Экономия","Без готовки"]);return null}

  async function route(raw,history=[]){
    raw=String(raw||"").trim();if(!raw)return{ok:true,provider:"bai-brain-v4",operations:[],reply:"",goal:JSON.parse(JSON.stringify(memory.goal))};
    memory.turns++;
    const pr=resolvePending(raw);if(pr)return{ok:true,provider:"bai-brain-v4",...pr};
    const t=low(raw),s=state(),ordered=products(raw),ids=uniq(ordered.map(x=>x.id)),amountList=amounts(raw,ordered),shops=stores(raw),ops=[],advice=advisor(raw,s);if(advice)return advice;
    const b=budget(raw)||relativeBudget(raw,s.budget||memory.goal.budget),p=people(raw),d=days(raw);
    if(/верни как было|отмени последнее|назад/.test(t))return{ok:true,provider:"bai-brain-v4",operations:[{type:"UNDO"}],reply:"Откатываю последнее изменение.",suggestions:[],goal:JSON.parse(JSON.stringify(memory.goal))};
    if(fresh(t)){ops.push({type:"RESET_BASKET"});memory.goal=emptyGoal()}
    if(b)ops.push({type:"CHANGE_BUDGET",value:b});if(p)ops.push({type:"SET_PEOPLE",value:p});if(d)ops.push({type:"SET_DURATION",value:d});
    for(const st of shops)ops.push({type:"CHANGE_STORE",value:st});
    if((shops.length===1&&/только|в одном магазине/.test(t))||/собери\s+в\s+одном\s+магазине|одним магазином/.test(t))ops.push({type:"SET_MODE",value:"one"});
    if(/нескольк.*магаз|по разным магазин|где дешевле/.test(t))ops.push({type:"SET_MODE",value:"multi"});
    if(/ужми до бюджета|уложи(?:сь)? в бюджет|не вылезай за бюджет/.test(t))ops.push({type:"ADD_PREFERENCE",value:"budget"});
    ops.push(...prefs(t));
    if(only(t)&&ids.length){ops.push({type:"SET_INTENT",value:"only"},{type:"SET_ONLY_PRODUCTS",value:ids});memory.lastIntent="only"}
    else if(replace(t)&&ordered.length>=2){ops.push({type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from:ordered[0].id,to:ordered[ordered.length-1].id}});memory.lastIntent="replace"}
    else if(remove(t)&&ids.length){ops.push({type:"SET_INTENT",value:"remove"});ids.forEach(id=>ops.push({type:"REMOVE_PRODUCT",value:id}));memory.lastIntent="remove"}
    else if(add(t)&&ids.length){ops.push({type:"SET_INTENT",value:"add"});ids.forEach(id=>ops.push({type:"ADD_PRODUCT",value:id}));memory.lastIntent="add"}
    else if(ids.length){const cont=/^(а|и|еще|тогда|нет|ладно|ок)\b/.test(t)||Boolean(s.products?.length);if(!cont||fresh(t))ops.push({type:"CLEAR_ONLY"},{type:"SET_INTENT",value:"build"});ids.forEach(id=>ops.push({type:"REQUIRE",value:id}));memory.lastIntent=cont?"refine":"build"}
    if(!remove(t))amountList.forEach(x=>{if(!ops.some(o=>(o.type==="REQUIRE"||o.type==="ADD_PRODUCT")&&o.value===x.id))ops.push({type:"REQUIRE",value:x.id});ops.push({type:"SET_PRODUCT_AMOUNT",value:x})});

    mergeGoal(ops,t);
    const broad=/собери|подбери|корзин|что купить|чего взять|хочу еды|нужна еда|на вечер|на ужин/.test(t);
    if(broad&&!s.budget&&!memory.goal.budget&&!b&&!/без бюджета|цена неважна/.test(t))return question("Какой бюджет держим? Можно примерно.",["До 1500 ₽","До 2500 ₽","Без жёсткого бюджета"],"budget",ops);
    if(broad&&(!s.peopleCount||s.peopleCount===1)&&!memory.goal.people&&!p&&!/на одного|для себя|мне одному/.test(t)&&memory.turns<4)return question("На сколько человек собираем?",["На одного","На двоих","На троих"],"people",ops);
    const hasStyle=/сыт|перекус|полез|эконом|бюджет|завтрак|ужин|готовить|быстро/.test(t)||Boolean((s.preferences||[]).length)||Boolean(memory.goal.preferences.length)||Boolean(s.cookingPreference)||Boolean(memory.goal.cooking);
    if(broad&&!hasStyle&&ids.length===0)return question("Какой вариант тебе ближе? Я от этого сильно по-разному соберу корзину.",["Сытно","Побольше перекусов","Полезнее","Максимально бюджетно"],"style",ops);
    if(/не знаю что хочу|сам реши|на твой вкус|предложи сам|удиви/.test(t))return proposal("Могу пойти тремя путями. Выбирай настроение — дальше сам дособеру.",["Сытно и просто","Перекусы на вечер","Полезно и без возни"]);
    if(/готовить/.test(t)&&!/не хочу|лень|не буду|могу|люблю|нормально/.test(t))return question("Готовить готов или лучше почти без готовки?",["Почти без готовки","Готовить нормально"],"cooking",ops);

    if(ops.length){if(!ops.some(o=>o.type==="REOPTIMIZE"))ops.push({type:"REOPTIMIZE"});mergeGoal(ops,t);let reply="Понял, обновляю корзину и сохраняю предыдущие условия.";if(amountList.length)reply=`Понял количество: ${amountList.map(amountLabel).join(", ")}. Подберу нужное число упаковок.`;if(ops.some(o=>o.type==="REMOVE_PRODUCT"))reply="Убрал. Остальные условия не трогаю.";else if(ops.some(o=>o.type==="ADD_PRODUCT")&&!amountList.length)reply="Добавил. Остальную корзину сохраняю.";else if(ops.some(o=>o.type==="REPLACE_PRODUCT"))reply="Понял, именно замена. Остальное оставляю как было.";else if(ops.some(o=>o.type==="SET_ONLY_PRODUCTS")&&!amountList.length)reply="Принял: только эти продукты, без лишнего.";else if(/только бюджет|только цену/.test(t)&&b)reply="Меняю только бюджет. Остальную цель не трогаю.";else if(ops.some(o=>o.type==="SET_MODE"&&o.value==="one"))reply="Понял: собираю в одном магазине, остальные условия сохраняю.";else if((b||p||d)&&!amountList.length)reply="Принял новые условия. Пересчитываю текущий вариант.";const next=[];if(!s.budget&&!memory.goal.budget)next.push("Задать бюджет");if(!(s.preferences||[]).length&&!memory.goal.preferences.length&&!hasStyle)next.push("Сделать сытнее");if(!s.cookingPreference&&!memory.goal.cooking)next.push("Минимум готовки");return{ok:true,provider:"bai-brain-v4",operations:dedupeOps(ops),reply,suggestions:next.slice(0,3),expectsAnswer:false,goal:JSON.parse(JSON.stringify(memory.goal))}}
    return proposal("Я понял не всё и не хочу гадать. Скажи, что сейчас важнее: что добавить, что убрать или какой результат ты хочешь получить?",["Добавить продукты","Убрать лишнее","Собрать заново"])
  }
  function reset(){memory={pending:null,lastIntent:"build",turns:0,lastSuggestions:[],goal:emptyGoal()}}
  window.TDBaiBrain={route,reset,status:()=>JSON.parse(JSON.stringify(memory))};
})();
