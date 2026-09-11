(()=>{
  "use strict";
  const brain=window.TDBaiBrain;
  if(!brain?.route||window.TDBaiReasoningGuard)return;

  const PRODUCT={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","яиц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const original=brain.route.bind(brain);

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

  brain.route=async function(raw,...rest){
    const replacement=directionalReplacement(raw);
    if(!replacement)return original(raw,...rest);
    const result=await original(replacement.rewrite,...rest);
    return{...result,provider:`${result?.provider||"bai-brain"}+direction-guard`,interpretedAs:{type:"replace",from:replacement.from.id,to:replacement.to.id}};
  };

  window.TDBaiReasoningGuard={directionalReplacement};
})();
