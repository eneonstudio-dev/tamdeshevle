(()=>{
  "use strict";
  if(window.TDBaiPantry)return;
  const KEY="td_bai_pantry_v1";
  const DAY=86400000;
  const META={
    milk:{label:"молоко",ttl:5*DAY},bread:{label:"хлеб",ttl:5*DAY},chicken:{label:"курица",ttl:4*DAY},banana:{label:"бананы",ttl:5*DAY},oil:{label:"масло",ttl:35*DAY},eggs:{label:"яйца",ttl:18*DAY},buck:{label:"гречка",ttl:45*DAY},sour:{label:"сметана",ttl:7*DAY},sugar:{label:"сахар",ttl:60*DAY},pasta:{label:"макароны",ttl:60*DAY},water:{label:"вода",ttl:30*DAY},apple:{label:"яблоки",ttl:10*DAY},ham:{label:"ветчина",ttl:5*DAY},dumplings:{label:"пельмени",ttl:45*DAY},noodles:{label:"лапша",ttl:90*DAY},waffles:{label:"вафли",ttl:30*DAY},cottage:{label:"творог",ttl:5*DAY}
  };
  const STEMS={молок:"milk",хлеб:"bread",куриц:"chicken",банан:"banana",масл:"oil",яйц:"eggs",греч:"buck",сметан:"sour",сахар:"sugar",макарон:"pasta",вод:"water",яблок:"apple",ветчин:"ham",пельмен:"dumplings",лапш:"noodles",вафл:"waffles",творог:"cottage"};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const now=()=>Date.now();
  const blank=()=>({version:1,items:{}});
  let state;try{state={...blank(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{state=blank()}
  state.items=state.items||{};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}return state}
  function idFrom(value){const v=String(value||"").toLowerCase().replace(/ё/g,"е");if(META[v])return v;for(const [stem,id] of Object.entries(STEMS))if(v.includes(stem))return id;return null}
  function prune(){let changed=false;for(const [id,item] of Object.entries(state.items)){const ttl=META[id]?.ttl||14*DAY;if(!item?.seenAt||now()-Number(item.seenAt)>ttl){delete state.items[id];changed=true}}if(changed)save();return changed}
  function add(value,source="explicit"){const id=idFrom(value);if(!id)return null;state.items[id]={id,label:META[id]?.label||String(value),seenAt:now(),source};save();return clone(state.items[id])}
  function remove(value){const id=idFrom(value);if(!id||!state.items[id])return false;delete state.items[id];save();return true}
  function observe(raw,operations=[]){const text=String(raw||"").toLowerCase().replace(/ё/g,"е");prune();if(/(?:дома|у меня)\s+(?:нет|не осталось)|закончил(?:ось|ись)|кончил(?:ось|ись)/.test(text)){for(const id of Object.keys(META))if(text.includes(META[id].label.split(" ")[0])||Object.entries(STEMS).some(([stem,x])=>x===id&&text.includes(stem)))remove(id)}
    if(!/(?:дома|у меня)\s+(?:уже\s+)?есть/.test(text))return list();
    for(const op of operations||[])if(op?.type==="HAS_AT_HOME")add(op.value,"explicit");
    for(const [stem,id] of Object.entries(STEMS))if(text.includes(stem))add(id,"explicit");
    return list();
  }
  function list(){prune();return Object.values(state.items).map(clone)}
  function has(value){prune();const id=idFrom(value);return Boolean(id&&state.items[id])}
  function operations(){return list().map(item=>({type:"HAS_AT_HOME",value:item.label}))}
  function applyToState(input={}){const s=clone(input),labels=list().map(x=>x.label);s.existingProducts=[...new Set([...(s.existingProducts||[]),...labels])];return s}
  function count(){return list().length}
  function clear(){state=blank();try{localStorage.removeItem(KEY)}catch{}return state}
  window.TDBaiPantry={observe,add,remove,list,has,count,operations,applyToState,clear,idFrom};
})();
