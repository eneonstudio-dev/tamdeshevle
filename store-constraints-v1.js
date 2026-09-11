(function(root,factory){
  "use strict";
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.window===root)root.TDStoreConstraints=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const STORE_WORDS={"пятероч":"pyat","пятёроч":"pyat","магнит":"magnit","перекр":"perek","лент":"lenta","дикси":"dixy","лавк":"lavka","впрок":"vprok"};
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const numberWord=v=>({один:1,одного:1,одну:1,два:2,две:2,двух:2,три:3,трех:3,четыре:4,четырех:4,пять:5}[low(v)]||Number(v)||null);
  function storesIn(text){const t=low(text),out=[];for(const [stem,id] of Object.entries(STORE_WORDS))if(t.includes(low(stem)))out.push(id);return uniq(out)}
  function parse(text){
    const t=low(text),shops=storesIn(t);let m;
    if(/сними|убери|сбрось/.test(t)&&/(огранич|фильтр).{0,18}магаз|магаз.{0,18}(огранич|фильтр)/.test(t))return{kind:"reset"};
    m=t.match(/(?:максимум|не больше|до)\s+(\d+|[а-я]+)\s+магаз/);if(m){const n=numberWord(m[1]);if(n&&n>0)return{kind:"max",maxStores:Math.min(5,Math.max(1,n))}}
    if(shops.length&&/(не используй|не бери|исключи|без\s+(?:пят|магнит|перекр|лент|дикси|лавк|впрок))/.test(t))return{kind:"exclude",stores:shops};
    if(shops.length&&/(снова можно|можно использовать|верни\s+(?:пят|магнит|перекр|лент|дикси|лавк|впрок))/.test(t))return{kind:"include",stores:shops};
    if(shops.length&&/(предпоч|лучше\s+(?:в|из)|любим)/.test(t))return{kind:"prefer",stores:shops};
    if(shops.length&&/только/.test(t)&&/(магаз|пят|магнит|перекр|лент|дикси|лавк|впрок)/.test(t))return{kind:"allowed",stores:shops};
    return null;
  }
  function derive(notes){
    const c={excluded:[],preferred:[],allowed:null,maxStores:null};
    for(const raw of Array.isArray(notes)?notes:[]){const n=String(raw||"");
      if(n==="__store_constraints_reset"){c.excluded=[];c.preferred=[];c.allowed=null;c.maxStores=null;continue}
      if(n.startsWith("__exclude_store:"))c.excluded=uniq([...c.excluded,n.split(":")[1]]);
      else if(n.startsWith("__include_store:")){const id=n.split(":")[1];c.excluded=c.excluded.filter(x=>x!==id)}
      else if(n.startsWith("__prefer_store:"))c.preferred=uniq([...c.preferred,n.split(":")[1]]);
      else if(n.startsWith("__allowed_stores:"))c.allowed=uniq(n.slice(17).split(","));
      else if(n.startsWith("__max_stores:")){const v=Number(n.split(":")[1]);c.maxStores=v>0?v:null}
    }
    return c;
  }
  function notesFor(parsed){if(!parsed)return[];if(parsed.kind==="reset")return["__store_constraints_reset"];if(parsed.kind==="max")return[`__max_stores:${parsed.maxStores}`];if(parsed.kind==="allowed")return[`__allowed_stores:${parsed.stores.join(",")}`];if(parsed.kind==="exclude")return parsed.stores.map(id=>`__exclude_store:${id}`);if(parsed.kind==="include")return parsed.stores.map(id=>`__include_store:${id}`);if(parsed.kind==="prefer")return parsed.stores.map(id=>`__prefer_store:${id}`);return[]}
  function combinations(items,max){const out=[];function walk(start,buf){if(buf.length){out.push(buf.slice());if(buf.length>=max)return}for(let i=start;i<items.length;i++){buf.push(items[i]);walk(i+1,buf);buf.pop()}}walk(0,[]);return out}
  function installOptimizer(){
    const O=root?.TDShoppingOptimizer;if(!O||O.__storeConstraintsV1)return false;const planOne=O.planOne.bind(O),planMulti=O.planMulti.bind(O);
    O.optimize=function(s){
      const c=derive(s?.userNotes),all=typeof STORES!=="undefined"?STORES:[],city=root.state?.city||"msk";
      let allowed=all.filter(x=>x.kind!=="delivery"&&(!x.city||x.city.includes(city))).map(x=>x.id);
      if(c.allowed?.length)allowed=allowed.filter(id=>c.allowed.includes(id));allowed=allowed.filter(id=>!c.excluded.includes(id));if(!allowed.length)return[];
      const prefScore=plan=>(Number(plan?.total)||Infinity)-(plan?.stores||[]).filter(id=>c.preferred.includes(id)).length*35;
      const onePlans=allowed.map(id=>planOne(s,id)).filter(x=>x?.products?.length);onePlans.sort((a,b)=>prefScore(a)-prefScore(b));const bestOne=onePlans[0]||null;
      if(s.mode==="one")return bestOne?[bestOne]:[];
      const original=all.slice(),limit=Math.max(1,Math.min(Number(c.maxStores)||allowed.length,allowed.length));let bestMulti=null;
      const groups=limit<allowed.length?combinations(allowed,limit):[allowed];
      try{for(const group of groups){all.splice(0,all.length,...original.filter(x=>group.includes(x.id)||x.kind==="delivery"));const p=planMulti(s);if(!p?.products?.length)continue;if((p.stores||[]).length>limit)continue;if(!bestMulti||prefScore(p)<prefScore(bestMulti))bestMulti=p}}finally{all.splice(0,all.length,...original)}
      const result=[bestOne,bestMulti].filter(Boolean);return result.sort((a,b)=>Number(a.total)-Number(b.total));
    };
    O.__storeConstraintsV1=true;return true;
  }
  function installBrain(){
    const B=root?.TDBaiBrain;if(!B||B.__storeConstraintsV1)return false;const original=B.route.bind(B);B.route=async function(raw,history){const parsed=parse(raw);if(!parsed)return original(raw,history);const notes=notesFor(parsed),ops=notes.map(value=>({type:"NOTE",value}));if(parsed.kind==="max"||parsed.kind==="allowed")ops.push({type:"SET_MODE",value:parsed.kind==="allowed"&&parsed.stores.length===1?"one":"multi"});const replies={reset:"Снял ограничения по магазинам.",max:`Ок, максимум ${parsed.maxStores} магазина.`,exclude:"Ок, эти магазины не использую.",include:"Ок, снова можно использовать.",prefer:"Ок, буду предпочитать их, если цена рядом.",allowed:"Ок, ищу только в этих магазинах."};return{ok:true,provider:"store-constraints-v1",operations:ops,reply:replies[parsed.kind]||"Готово.",suggestions:[],expectsAnswer:false}};B.__storeConstraintsV1=true;return true;
  }
  function install(){if(!root||root.window!==root)return;let tries=0;const timer=setInterval(()=>{const a=installOptimizer(),b=installBrain();if(((a||root.TDShoppingOptimizer?.__storeConstraintsV1)&&(b||root.TDBaiBrain?.__storeConstraintsV1))||tries++>80)clearInterval(timer)},100)}
  install();
  return{parse,derive,notesFor,combinations};
});