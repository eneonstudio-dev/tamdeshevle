(()=>{
  "use strict";
  if(window.TDBaiLiteralBasket)return;

  const NUMBER_WORDS={один:1,одна:1,одну:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,полтора:1.5,полторы:1.5};
  const STATIC_ALIASES=[
    {stem:"свекл",ids:["beet"]},{stem:"банан",ids:["banana"]},{stem:"яблок",ids:["apple"]},{stem:"молок",ids:["milk"]},
    {stem:"макарон",ids:["pasta"]},{stem:"сахар",ids:["sugar"]},{stem:"ветчин",ids:["ham"]},{stem:"пельмен",ids:["dumplings"]},
    {stem:"картоф",ids:["potato"]},{stem:"морков",ids:["carrot"]},{stem:"капуст",ids:["cabbage"]},{stem:"лук",ids:["onion"]},
    {stem:"огур",ids:["cucumber"]},{stem:"томат",ids:["tomato"]},{stem:"помидор",ids:["tomato"]},{stem:"апельсин",ids:["orange"]},
    {stem:"лимон",ids:["lemon"]},{stem:"груш",ids:["pear"]},{stem:"виноград",ids:["grapes"]},{stem:"рис",ids:["rice"]},
    {stem:"овсян",ids:["oatmeal"]},{stem:"творог",ids:["tvorog","cottage"]},{stem:"сметан",ids:["smetana","sour"]},
    {stem:"греч",ids:["buckwheat","buck"]},{stem:"яйц",ids:["eggs_c1","eggs"]},{stem:"яиц",ids:["eggs_c1","eggs"]},
    {stem:"куриц",ids:["chicken_fil","chicken"]},{stem:"хлеб",ids:["bread_dark","bread"]},{stem:"вод",ids:["water_still","water"]}
  ];
  const EDIT=/(?:^|[^а-я])(?:добав[а-я]*|докин[а-я]*|положи|убери|удали|исключи|выкинь|замени|поменяй|вместо|не\s+добав[а-я]*|без)(?=$|[^а-я])/i;
  const PLAN=/(?:собери|подбери|составь|рацион|меню|сам\s+реши|реши\s+сам|сравни|что\s+лучше|что\s+купить|подешевле|дешевле|бюджет|до\s*\d+\s*(?:р|руб|₽)|на\s+\d+\s*(?:дн|дня|дней|недел)|готовить|магазин)/i;
  const CONTINUE=/^\s*(?:а\s+|ещ[её]\s+|и\s+ещ[её]\s+|плюс\s+)/i;
  const EXACT=/(?:^|[^а-я])(?:только|и\s+вс[её]|вот\s+и\s+вс[её]|больше\s+ничего)(?=$|[^а-я])/i;
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const catalog=()=>Array.isArray(window.TDStoreAdapters?.catalog?.())?window.TDStoreAdapters.catalog():[];
  const normalizeUnit=u=>{u=low(u);if(/^кг|килограмм/.test(u))return"kg";if(/^г$|^гр|^грамм/.test(u))return"g";if(/^мл|миллилитр/.test(u))return"ml";if(/^л$|^литр/.test(u))return"l";if(/пач|упаков/.test(u))return"pack";if(/^шт|штук/.test(u))return"pcs";return null};
  const number=v=>/^\d+(?:[.,]\d+)?$/.test(String(v||""))?Number(String(v).replace(",",".")):(NUMBER_WORDS[low(v)]||null);

  function simpleStem(word){
    let w=low(word).replace(/[^а-яa-z0-9_-]/g,"");
    const suffixes=["иями","ями","ами","ого","ему","ыми","ими","ую","юю","ая","яя","ое","ее","ие","ые","ов","ев","ам","ям","ах","ях","ом","ем","ой","ей","а","я","у","ю","ы","и","е"];
    for(const s of suffixes)if(w.endsWith(s)&&w.length-s.length>=4)return w.slice(0,-s.length);
    return w;
  }
  function catalogMaps(){
    const list=catalog(),byId=new Map(list.map(p=>[String(p.id),p])),stemIds=new Map();
    for(const p of list){
      const words=low(p?.name).split(/[^а-яa-z0-9_-]+/).filter(Boolean);
      for(const word of words){const stem=simpleStem(word);if(stem.length<4)continue;const set=stemIds.get(stem)||new Set();set.add(String(p.id));stemIds.set(stem,set)}
    }
    return{list,byId,stemIds};
  }
  function resolvePreferred(ids,byId){for(const id of ids)if(byId.has(id))return id;return null}
  function findProducts(text,maps){
    const t=low(text),out=[],seen=new Set();
    for(const alias of STATIC_ALIASES){
      const re=new RegExp(`(^|[^а-яa-z0-9_])(${escRe(alias.stem)}[а-я]*)`,`i`),m=re.exec(t);if(!m)continue;
      const id=resolvePreferred(alias.ids,maps.byId);if(!id||seen.has(id))continue;seen.add(id);out.push({id,pos:m.index+m[1].length,raw:m[2]});
    }
    const tokens=[...t.matchAll(/[а-яa-z0-9_-]+/g)];
    for(const m of tokens){const stem=simpleStem(m[0]);const ids=maps.stemIds.get(stem);if(!ids||ids.size!==1)continue;const id=[...ids][0];if(seen.has(id))continue;seen.add(id);out.push({id,pos:m.index||0,raw:m[0]})}
    return out.sort((a,b)=>a.pos-b.pos);
  }
  function splitClauses(text){return String(text||"").split(/\s*(?:,|;|\s+и\s+|\s+а\s+)\s*/i).map(x=>x.trim()).filter(Boolean)}
  function measure(clause){
    const n="(\\d+(?:[.,]\\d+)?|один|одна|одну|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|полтора|полторы)",u="(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|л|литр(?:а|ов)?|мл|миллилитр(?:а|ов)?|пачк(?:а|и|ек|у)?|упаковк(?:а|и|ок|у)?|шт|штук(?:а|и)?)";
    let m=low(clause).match(new RegExp(`${n}\\s*${u}`));
    if(m){const amount=number(m[1]),unit=normalizeUnit(m[2]);return amount>0&&unit?{amount,unit,raw:m[0]}:null}
    m=low(clause).match(new RegExp(`(^|[^а-я])${u}(?=$|[^а-я])`));
    if(m){const unit=normalizeUnit(m[2]);return unit?{amount:1,unit,raw:m[2]}:null}
    return null;
  }
  function parse(text){
    const maps=catalogMaps(),clauses=splitClauses(text),items=[],unresolved=[];
    for(const clause of clauses){
      if(/^(?:вс[её]|вот\s+и\s+вс[её])$/i.test(clause))continue;
      const found=findProducts(clause,maps),m=measure(clause);
      if(m&&!found.length){unresolved.push(clause);continue}
      for(const p of found){let item=items.find(x=>x.id===p.id);if(!item){item={id:p.id,name:maps.byId.get(p.id)?.name||p.id,amount:null,unit:null};items.push(item)}if(m&&found.length===1){item.amount=m.amount;item.unit=m.unit}}
    }
    return{items,unresolved,maps};
  }
  function isLiteral(text,parsed){
    const t=low(text),count=parsed.items.length,hasAmount=parsed.items.some(x=>x.amount!=null),hasUnresolved=parsed.unresolved.length>0;
    if(!count&&!hasUnresolved)return false;if(EDIT.test(t)||PLAN.test(t))return false;if(CONTINUE.test(t)&&!EXACT.test(t))return false;
    return count>=2||hasAmount||hasUnresolved||EXACT.test(t);
  }
  function label(item){if(item.amount==null)return item.name;const unit={kg:"кг",g:"г",l:"л",ml:"мл",pack:"уп.",pcs:"шт."}[item.unit]||item.unit;return `${item.name} — ${item.amount} ${unit}`}
  function route(text){
    const parsed=parse(text);if(!isLiteral(text,parsed))return null;
    if(parsed.unresolved.length){return{ok:true,provider:"bai-literal-basket",operations:[{type:"ASK_CLARIFICATION",value:"Один товар с количеством не нашёл в каталоге. Уточни название."}],reply:"Один товар с количеством не нашёл в каталоге. На соседний товар количество не переношу. Уточни название.",suggestions:[],expectsAnswer:true,literal:{safe:false,unresolved:parsed.unresolved.slice(0,2)}}}
    const ids=uniq(parsed.items.map(x=>x.id)),ops=[{type:"SET_INTENT",value:"literal"},{type:"SET_ONLY_PRODUCTS",value:ids}];
    for(const item of parsed.items)if(item.amount!=null)ops.push({type:"SET_PRODUCT_AMOUNT",value:{id:item.id,amount:item.amount,unit:item.unit}});
    ops.push({type:"REOPTIMIZE"});
    return{ok:true,provider:"bai-literal-basket",operations:ops,reply:`${parsed.items.map(label).join(". ")}. Считаю.`,suggestions:[],expectsAnswer:false,literal:{safe:true,productIds:ids,quantityTargets:Object.fromEntries(parsed.items.filter(x=>x.amount!=null).map(x=>[x.id,{amount:x.amount,unit:x.unit}]))}};
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__baiLiteralBasketWrapped)return brain;const original=brain.route.bind(brain);Object.defineProperty(brain,"__baiLiteralBasketWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){const literal=route(raw);return literal||original(raw,history,...rest)};return brain;
  }
  function install(){
    const current=window.TDBaiBrain;if(current){wrapBrain(current);return true}
    const desc=Object.getOwnPropertyDescriptor(window,"TDBaiBrain");if(desc?.set&&desc?.get&&desc.configurable){Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:desc.enumerable,get:desc.get,set(next){desc.set.call(window,next);const ready=desc.get.call(window);if(ready)wrapBrain(ready)}});return true}
    let value;try{Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapBrain(next)}});return true}catch{return false}
  }
  window.TDBaiLiteralBasket={parse,isLiteral,route,install};install();
})();
