(()=>{
  "use strict";
  const brain=window.TDBaiBrain;
  if(!brain?.route||window.TDBaiReasoningGuard)return;

  const PRODUCT={"молок":"milk","хлеб":"bread","куриц":"chicken","банан":"banana","масл":"oil","яйц":"eggs","яиц":"eggs","греч":"buck","сметан":"sour","сахар":"sugar","макарон":"pasta","вод":"water","яблок":"apple","ветчин":"ham","пельмен":"dumplings","лапш":"noodles","вафл":"waffles","творог":"cottage"};
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const original=brain.route.bind(brain);
  const trailingExclusion=/(?:не\s+надо(?:\s+(?:добавлять|класть|брать))?|не\s+нуж(?:но|ен|на|ны)|не\s+(?:клади|добавляй))(?:\s*[.!?])?$/;

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
    const normalized=normalizeTrailingExclusions(raw);
    const replacement=directionalReplacement(normalized);
    if(!replacement){
      const result=await original(normalized,...rest);
      if(normalized===String(raw||""))return result;
      return{...result,provider:`${result?.provider||"bai-brain"}+negation-guard`};
    }
    const result=await original(replacement.rewrite,...rest);
    return{...result,provider:`${result?.provider||"bai-brain"}+direction-guard`,interpretedAs:{type:"replace",from:replacement.from.id,to:replacement.to.id}};
  };

  window.TDBaiReasoningGuard={directionalReplacement,normalizeTrailingExclusions};
})();
