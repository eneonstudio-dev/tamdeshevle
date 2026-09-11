(() => {
  "use strict";

  const PRODUCT_STEMS = {
    "молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"
  };
  const STORE_STEMS = {"пятёроч":"pyat","пятероч":"pyat","магнит":"magnit","перекр":"perek","лент":"lenta","дикси":"dixy","лавк":"lavka","впрок":"vprok"};
  const NUMBER_WORDS = {"один":1,"одного":1,"одну":1,"два":2,"двое":2,"двоих":2,"двух":2,"три":3,"трое":3,"троих":3,"трех":3,"трёх":3,"четыре":4,"четверо":4,"четверых":4,"пять":5,"пятеро":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10};

  let pending = null;
  let lastIntent = "build";
  let lastUserText = "";

  const uniq = a => [...new Set((a || []).filter(Boolean))];
  const low = s => String(s || "").toLowerCase().replace(/ё/g,"е");
  const state = () => window.TDShoppingState?.get?.() || {};

  function findProducts(text){
    const t=low(text), out=[];
    for(const [stem,id] of Object.entries(PRODUCT_STEMS)){
      let i=t.indexOf(stem); if(i>=0) out.push({id,pos:i,stem});
    }
    return out.sort((a,b)=>a.pos-b.pos);
  }
  function findStores(text){
    const t=low(text), out=[];
    for(const [stem,id] of Object.entries(STORE_STEMS)) if(t.includes(stem)) out.push(id);
    return uniq(out);
  }
  function parseNumberToken(tok){
    if(!tok) return null;
    if(/^\d+$/.test(tok)) return Number(tok);
    return NUMBER_WORDS[low(tok)] || null;
  }
  function people(text){
    const t=low(text);
    const m=t.match(/(?:нас|на|для|будет)\s+(\d+|[а-я]+)\s*(?:человек|чел|персон|едок|нас)?/);
    if(m) return parseNumberToken(m[1]);
    const short=t.match(/(?:на|для)\s+(двоих|троих|четверых|пятерых|шестерых|семерых|восьмерых|девятерых)/);
    return short?parseNumberToken(short[1]):null;
  }
  function days(text){
    const t=low(text);
    const m=t.match(/(?:на|примерно на)\s+(\d+|[а-я]+)\s*(?:день|дня|дней|суток)/);
    return m?parseNumberToken(m[1]):null;
  }
  function budget(text){
    const t=low(text);
    const m=t.match(/(?:до|бюджет(?:ом)?|на|улож(?:ись|иться) в|не больше)\s*([\d\s.,]+)\s*(?:р|руб|₽)/);
    return m?Number(m[1].replace(/\D/g,"")):null;
  }
  function relativeBudget(text,current){
    const t=low(text);
    let m=t.match(/(?:дешевле|снизь|уменьши)\s*(?:на)?\s*(\d+)\s*%/);
    if(m&&current) return Math.max(1,Math.round(current*(1-Number(m[1])/100)));
    m=t.match(/(?:дороже|увеличь|подними)\s*(?:на)?\s*(\d+)\s*%/);
    if(m&&current) return Math.max(1,Math.round(current*(1+Number(m[1])/100)));
    if(/подешевле|дешевле|сэконом/.test(t)&&current) return Math.max(1,Math.round(current*0.85));
    return null;
  }
  function isQuestion(text){return /\?|что лучше|что взять|посовет|как думаешь|нормально ли|хватит ли/.test(low(text));}
  function yes(text){return /^(да|ага|угу|точно|верно|давай|ок|окей|поехали)\b/.test(low(text).trim());}
  function no(text){return /^(нет|неа|не|не надо|отмена)\b/.test(low(text).trim());}
  function onlyIntent(t){return /\b(только|исключительно|лишь|одни|одних)\b/.test(t)||/корзин\w*\s+из\s+/.test(t);}
  function addIntent(t){return /\b(добав|докин|еще|ещё|плюс|положи)\w*/.test(t);}
  function removeIntent(t){return /\b(убери|удали|исключи|выкинь|без)\b/.test(t);}
  function replaceIntent(t){return /\b(замени|поменяй|вместо)\b/.test(t);}
  function freshIntent(t){return /с нуля|заново|новую корзин|начнем заново|начнём заново/.test(t);}

  function scenarioPrefs(t){
    const ops=[];
    if(/готовить\s*(?:не хочу|лень|не буду)|без готовки|минимум готовки|быстр(?:о|енько)/.test(t)) ops.push({type:"SET_COOKING",value:"minimal"});
    if(/сытн|плотн|наесться|пожирнее/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"hearty"});
    if(/перекус|пожевать|к сериалу|к фильму/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"snacks"});
    if(/полезн|пп\b|здоров/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"healthy"});
    if(/дешев|эконом|бюджетн/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"budget"});
    if(/фрукт/.test(t)) ops.push({type:"PREFER",value:"фрукты"});
    if(/сладк|к чаю/.test(t)) ops.push({type:"PREFER",value:"сладкое"});
    if(/завтрак/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"breakfast"});
    if(/ужин|на вечер/.test(t)) ops.push({type:"ADD_PREFERENCE",value:"dinner"});
    return ops;
  }

  function buildReply(ops,text){
    const t=low(text), s=state();
    const b=ops.find(o=>o.type==="CHANGE_BUDGET")?.value;
    const p=ops.find(o=>o.type==="SET_PEOPLE")?.value;
    const d=ops.find(o=>o.type==="SET_DURATION")?.value;
    if(ops.some(o=>o.type==="RESET_BASKET")) return "Начинаю заново. Старые ограничения корзины убрал.";
    if(ops.some(o=>o.type==="REPLACE_PRODUCT")) return "Понял, это замена, а не новая корзина. Пересобираю с учётом остального контекста.";
    if(ops.some(o=>o.type==="REMOVE_PRODUCT")) return "Убрал. Остальные условия корзины сохраняю.";
    if(ops.some(o=>o.type==="ADD_PRODUCT")) return "Добавил. Остальную корзину не трогаю.";
    if(ops.some(o=>o.type==="SET_ONLY_PRODUCTS")) return "Понял: только эти продукты, без самодеятельности с моей стороны.";
    if(b||p||d){const bits=[];if(b)bits.push(`до ${b} ₽`);if(p)bits.push(`на ${p} чел.`);if(d)bits.push(`на ${d} дн.`);return `Принял изменение: ${bits.join(", ")}. Пересчитываю текущую корзину, остальное сохраняю.`;}
    if(/подешевле|дешевле|сэконом/.test(t)) return "Окей, ужимаю стоимость, но не сбрасываю остальные пожелания.";
    if(/побольше|сытн|перекус|полезн|завтрак|ужин/.test(t)) return "Понял, это уточнение к текущей корзине. Пересобираю, не начиная всё с нуля.";
    if(s.products?.length) return "Понял. Это изменение текущей корзины, а не новая задача.";
    return "Понял задачу. Собираю корзину по этим условиям.";
  }

  function clarify(question,kind,options={}){
    pending={kind,options};
    return {ok:true,provider:"native-brain",operations:[{type:"ASK_CLARIFICATION",value:question}],reply:question};
  }

  function resolvePending(text){
    if(!pending) return null;
    const p=pending; pending=null;
    if(p.kind==="budget"){
      const b=budget(text); if(b) return {operations:[{type:"CHANGE_BUDGET",value:b},{type:"REOPTIMIZE"}],reply:`Принял бюджет ${b} ₽. Теперь пересобираю.`};
      if(yes(text)&&p.options.default) return {operations:[{type:"CHANGE_BUDGET",value:p.options.default},{type:"REOPTIMIZE"}],reply:`Окей, беру ${p.options.default} ₽ за ориентир.`};
    }
    if(p.kind==="people"){
      const n=people(text)||parseNumberToken(low(text).trim()); if(n) return {operations:[{type:"SET_PEOPLE",value:n},{type:"REOPTIMIZE"}],reply:`Понял, вас ${n}. Пересчитываю.`};
    }
    if(p.kind==="cooking"){
      const t=low(text); if(/не хочу|лень|минимум|без готовки/.test(t)||yes(text)) return {operations:[{type:"SET_COOKING",value:"minimal"},{type:"REOPTIMIZE"}],reply:"Понял, делаю с минимумом готовки."};
      if(no(text)||/могу готовить|готовить ок/.test(t)) return {operations:[{type:"SET_COOKING",value:"normal"},{type:"REOPTIMIZE"}],reply:"Окей, тогда готовку не ограничиваю."};
    }
    if(no(text)) return {operations:[],reply:"Окей, это уточнение отменил. Скажи, что меняем дальше."};
    return null;
  }

  async function route(text,history=[]){
    const raw=String(text||"").trim(); if(!raw) return {ok:true,provider:"native-brain",operations:null,reply:""};
    const pendingResult=resolvePending(raw); if(pendingResult) return {ok:true,provider:"native-brain",...pendingResult};

    const t=low(raw), s=state(), ordered=findProducts(raw), productIds=uniq(ordered.map(x=>x.id)), stores=findStores(raw), ops=[];
    const b=budget(raw) || relativeBudget(raw,s.budget);
    const p=people(raw), d=days(raw);

    if(/верни как было|отмени последнее|назад/.test(t)) return {ok:true,provider:"native-brain",operations:[{type:"UNDO"}],reply:"Откатываю последнее изменение."};
    if(freshIntent(t)) ops.push({type:"RESET_BASKET"});
    if(b) ops.push({type:"CHANGE_BUDGET",value:b});
    if(p) ops.push({type:"SET_PEOPLE",value:p});
    if(d) ops.push({type:"SET_DURATION",value:d});
    for(const st of stores) ops.push({type:"CHANGE_STORE",value:st});
    if(stores.length===1&&/только|в одном магазине/.test(t)) ops.push({type:"SET_MODE",value:"one"});
    if(/нескольк.*магаз|по разным магазин|где дешевле/.test(t)) ops.push({type:"SET_MODE",value:"multi"});
    ops.push(...scenarioPrefs(t));

    if(onlyIntent(t)&&productIds.length){
      ops.push({type:"SET_INTENT",value:"only"},{type:"SET_ONLY_PRODUCTS",value:productIds}); lastIntent="only";
    }else if(replaceIntent(t)&&ordered.length>=2){
      ops.push({type:"SET_INTENT",value:"replace"},{type:"REPLACE_PRODUCT",value:{from:ordered[0].id,to:ordered[ordered.length-1].id}}); lastIntent="replace";
    }else if(removeIntent(t)&&productIds.length){
      ops.push({type:"SET_INTENT",value:"remove"}); productIds.forEach(id=>ops.push({type:"REMOVE_PRODUCT",value:id})); lastIntent="remove";
    }else if(addIntent(t)&&productIds.length){
      ops.push({type:"SET_INTENT",value:"add"}); productIds.forEach(id=>ops.push({type:"ADD_PRODUCT",value:id})); lastIntent="add";
    }else if(productIds.length){
      const continuation=/^(а|и|еще|ещё|тогда|нет|ладно|ок|окей)\b/.test(t)||Boolean(s.products?.length);
      if(!continuation||freshIntent(t)) ops.push({type:"CLEAR_ONLY"},{type:"SET_INTENT",value:"build"});
      productIds.forEach(id=>ops.push({type:"REQUIRE",value:id}));
      lastIntent=continuation?"refine":"build";
    }else if(/собери|подбери|корзин|что купить|чего взять|хочу еды|нужна еда/.test(t)){
      if(!s.budget && !b && !/без бюджета|неважно сколько/.test(t)) return clarify("Какой бюджет держать в голове? Можно примерно.","budget",{default:2000});
      if(!s.peopleCount && !p) return clarify("На сколько человек собираем?","people");
      ops.push({type:"CLEAR_ONLY"},{type:"SET_INTENT",value:"build"}); lastIntent="build";
    }

    if(/не знаю что хочу|сам реши|на твой вкус|предложи сам/.test(t)){
      if(!s.budget&&!b) return clarify("Тогда хотя бы ориентир по бюджету скажи — сколько максимум?","budget",{default:2000});
      if(!s.cookingPreference && !/готов/.test(t)) return clarify("Готовить будем или лучше почти без готовки?","cooking");
      ops.push({type:"ADD_PREFERENCE",value:"balanced"},{type:"REOPTIMIZE"});
    }

    if(/хватит ли|нормально ли|как тебе корзина|оцени корзину/.test(t)){
      const total=s.currentTotal||0, bud=s.budget||0;
      let reply="Корзина выглядит нормально по текущим условиям.";
      if(bud&&total>bud) reply=`Сейчас корзина выше бюджета примерно на ${Math.round(total-bud)} ₽. Могу ужать.`;
      else if(bud&&total<bud*.7) reply=`До бюджета ещё остаётся примерно ${Math.round(bud-total)} ₽. Можно усилить корзину.`;
      return {ok:true,provider:"native-brain",operations:[],reply};
    }

    if(!ops.length){
      if(isQuestion(raw)) return clarify("Я понял, что ты спрашиваешь про покупки, но не понял, что именно менять: бюджет, состав или магазин?","generic");
      return {ok:true,provider:"native-brain",operations:[{type:"NOTE",value:raw}],reply:"Запомнил это как пожелание. Если хочешь, сразу скажи, что именно поменять в корзине."};
    }

    if((p||d||b||ops.some(o=>["SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE"].includes(o.type))) && s.products?.length && !ops.some(o=>["RESET_BASKET","SET_ONLY_PRODUCTS","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT"].includes(o.type))) ops.push({type:"REOPTIMIZE"});

    lastUserText=raw;
    return {ok:true,provider:"native-brain",operations:ops,reply:buildReply(ops,raw),meta:{intent:lastIntent,previous:lastUserText,historyCount:history.length}};
  }

  function reset(){pending=null;lastIntent="build";lastUserText="";}
  window.TDBaiBrain={route,reset,status:()=>({provider:"native-brain",pending:pending?.kind||null,lastIntent})};
})();
