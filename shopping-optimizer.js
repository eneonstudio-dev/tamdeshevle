(function(){
  "use strict";
  const quick=["dumplings","eggs","bread","milk","water","banana","apple","noodles","waffles"];
  const normal=["chicken","eggs","bread","milk","water","banana","apple","buck","pasta"];
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const norm=v=>String(v||"").toLowerCase().trim().replace(/,/g,".");
  function excludedBrand(s,p){const brand=norm(p?.brand);return brand&&s.excludedBrands.some(x=>brand.includes(norm(x))||norm(x).includes(brand));}
  function desired(s){
    const all=TDStoreAdapters.catalog();
    if(s.selectionMode==="only"&&s.onlyProducts?.length)return uniq(s.onlyProducts).filter(id=>{const p=all.find(x=>x.id===id);return p&&!s.excludedProducts.includes(id)&&!excludedBrand(s,p)});
    let ids=s.cookingPreference==="minimal"?[...quick]:[...normal];
    const words=[...s.requiredProducts,...s.preferredProducts].join(" ").toLowerCase();
    all.forEach(p=>{if((p.tags||[]).some(t=>words.includes(t))||words.includes(p.name.toLowerCase()))ids.push(p.id)});
    const existing=s.existingProducts.join(" ").toLowerCase();
    return uniq(ids).filter(id=>{const p=all.find(x=>x.id===id);return p&&!s.excludedProducts.includes(id)&&!excludedBrand(s,p)&&!existing.includes(p.name.toLowerCase().split(" ")[0])});
  }
  function quote(ids,storeId,s){const adapter=TDStoreAdapters.adapter(storeId);const lines=ids.map(id=>{const p=adapter.getProduct(id),q=adapter.getPrice(id,"shelf");return p&&!excludedBrand(s,p)&&{id,name:p.name,pack:p.pack,emoji:p.emoji||"•",brand:p.brand||"Без привязки к бренду",quantity:1,storeId,unitPrice:q.value,price:q.value,quality:q.quality,sourceId:(typeof PRODUCTS!=="undefined"&&PRODUCTS.some(x=>x.id===id))?id:null}}).filter(x=>x&&Number.isFinite(x.price));return{lines,total:lines.reduce((n,x)=>n+x.price,0)};}
  function packMeasure(pack){const t=norm(pack);let m=t.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|g)\b/);if(m){let v=Number(m[1]);if(/кг|kg/.test(m[2]))v*=1000;return{kind:"mass",base:v}}m=t.match(/(\d+(?:\.\d+)?)\s*(мл|ml|л|l)\b/);if(m){let v=Number(m[1]);if(/^(л|l)$/.test(m[2]))v*=1000;return{kind:"volume",base:v}}m=t.match(/(\d+)\s*(?:шт|pcs|pieces|яиц|яйц)/);if(m)return{kind:"pcs",base:Number(m[1])};return null}
  function targetBase(target){const a=Number(target?.amount)||0,u=target?.unit;if(!a)return null;if(u==="kg")return{kind:"mass",unit:u,amount:a,base:a*1000,label:`${a} кг`};if(u==="g")return{kind:"mass",unit:u,amount:a,base:a,label:`${a} г`};if(u==="l")return{kind:"volume",unit:u,amount:a,base:a*1000,label:`${a} л`};if(u==="ml")return{kind:"volume",unit:u,amount:a,base:a,label:`${a} мл`};if(u==="pcs")return{kind:"pcs",unit:u,amount:a,base:a,label:`${a} шт.`};if(u==="pack")return{kind:"pack",unit:u,amount:a,base:a,label:`${a} уп.`};return null}
  function fallbackQuantity(t,line){if(t.kind==="mass")return Math.max(1,Math.ceil(t.unit==="kg"?t.amount:t.amount/1000));if(t.kind==="volume")return Math.max(1,Math.ceil(t.unit==="l"?t.amount:t.amount/1000));if(t.kind==="pcs"&&line.id==="eggs")return Math.max(1,Math.ceil(t.amount/10));if(t.kind==="pcs"&&["banana","apple"].includes(line.id))return Math.max(1,Math.ceil(t.amount/5));return Math.max(1,Math.ceil(t.amount))}
  function applyTargets(lines,s){const targets=s.quantityTargets||{};for(const line of lines){const t=targetBase(targets[line.id]);if(!t)continue;let q=1,approx=false;if(t.kind==="pack")q=Math.ceil(t.base);else{const p=packMeasure(line.pack);if(p&&p.kind===t.kind&&p.base>0)q=Math.ceil(t.base/p.base);else{q=fallbackQuantity(t,line);approx=true}}line.quantity=Math.max(line.quantity||1,q);line.requestedMinQuantity=line.quantity;line.requestedApproximate=approx;line.requestedAmountLabel=(approx?"≈ ":"")+t.label;if(q>1)line.requestedAmountLabel+=` → ${q} уп.`}return lines}
  function fit(lines,budget,required){if(!budget)return lines;const req=new Set(required||[]);const scored=lines.map((x,i)=>({...x,_i:i,_must:req.has(x.id)||Boolean(x.requestedMinQuantity)}));while(scored.reduce((n,x)=>n+x.price*x.quantity,0)>budget){const removable=scored.filter(x=>!x._must).sort((a,b)=>b.price-a.price)[0];if(!removable)break;scored.splice(scored.indexOf(removable),1)}return scored.map(({_i,_must,...x})=>x);}
  function targetBudget(s,overhead=0){if(!s.budget)return Infinity;return Math.max(0,Math.floor(s.budget*.9)-overhead);}
  function scaleOnly(lines,s,overhead=0){
    if(!lines.length)return lines;
    const budget=Number(s.budget)||0,available=Math.max(0,budget-overhead);
    if(budget>0){
      let total=lines.reduce((n,x)=>n+x.price*x.quantity,0),guard=0;
      const ordered=[...lines].sort((a,b)=>a.price-b.price);
      while(guard++<500){let added=false;for(const line of ordered){if(total+line.price>available)continue;line.quantity++;total+=line.price;added=true;}if(!added)break;}
      return lines;
    }
    const demand=Math.max(1,(Number(s.peopleCount)||1)*(Number(s.duration)||1));
    lines.forEach(line=>line.quantity=Math.max(line.requestedMinQuantity||1,Math.ceil(demand/Math.max(1,lines.length))));
    return lines;
  }
  function scaleQuantities(lines,s,overhead=0){
    if(s.selectionMode==="only")return scaleOnly(lines,s,overhead);
    if(!lines.length)return lines;const people=Math.max(1,Number(s.peopleCount)||1),days=Math.max(1,Number(s.duration)||1);const demand=Math.max(1,people*days);const target=targetBudget(s,overhead);let total=lines.reduce((n,x)=>n+x.price*x.quantity,0);const priority=["water","bread","eggs","milk","chicken","dumplings","pasta","buck","banana","apple","noodles"];
    const byId=new Map(lines.map(x=>[x.id,x]));const softCaps={water:Math.ceil(demand/2),bread:Math.ceil(demand/4),eggs:Math.ceil(demand/3),milk:Math.ceil(demand/4),chicken:Math.ceil(demand/3),dumplings:Math.ceil(demand/3),pasta:Math.ceil(demand/4),buck:Math.ceil(demand/4),banana:Math.ceil(demand/3),apple:Math.ceil(demand/3),noodles:Math.ceil(demand/3)};
    let changed=true,rounds=0;while(changed&&rounds<80){changed=false;rounds++;for(const id of priority){const line=byId.get(id);if(!line)continue;const cap=Math.max(line.requestedMinQuantity||1,softCaps[id]||Math.ceil(demand/4));if(line.quantity>=cap)continue;if(total+line.price>target)continue;line.quantity++;total+=line.price;changed=true;}if(total>=target)break;}
    if(s.budget&&total<target*.72){const cheapest=[...lines].sort((a,b)=>a.price-b.price);let guard=0;while(total<target*.86&&guard++<80){let added=false;for(const line of cheapest){const absoluteCap=Math.max(line.requestedMinQuantity||1,2,Math.ceil(demand/2));if(line.quantity>=absoluteCap||total+line.price>target)continue;line.quantity++;total+=line.price;added=true;if(total>=target*.86)break;}if(!added)break;}}
    return lines;
  }
  function topUp(lines,s,build,overhead=0){
    if(s.selectionMode==="only")return scaleOnly(lines,s,overhead);
    if(!s.budget)return scaleQuantities(lines,s,overhead);
    const target=targetBudget(s,overhead),used=new Set(lines.map(x=>x.id)),existing=s.existingProducts.join(" ").toLowerCase();const candidates=TDStoreAdapters.catalog().filter(p=>!used.has(p.id)&&!s.excludedProducts.includes(p.id)&&!excludedBrand(s,p)&&!existing.includes(p.name.toLowerCase().split(" ")[0])).map(build).filter(Boolean).sort((a,b)=>a.price-b.price);let total=lines.reduce((n,x)=>n+x.price*x.quantity,0);for(const line of candidates){if(lines.length>=14||total>=target)break;if(total+line.price<=target){lines.push(line);total+=line.price}}return scaleQuantities(lines,s,overhead);
  }
  function planOne(s,storeId){let q=quote(desired(s),storeId,s);q.lines=applyTargets(q.lines,s);q.lines=fit(q.lines,s.budget,s.requiredProducts);const adapter=TDStoreAdapters.adapter(storeId);q.lines=topUp(q.lines,s,p=>{if(excludedBrand(s,p))return null;const price=adapter.getPrice(p.id,"shelf");return Number.isFinite(price.value)?{id:p.id,name:p.name,pack:p.pack,emoji:p.emoji||"•",brand:p.brand||"Без привязки к бренду",quantity:1,storeId,unitPrice:price.value,price:price.value,quality:price.quality,sourceId:(typeof PRODUCTS!=="undefined"&&PRODUCTS.some(x=>x.id===p.id))?p.id:null}:null});q.total=q.lines.reduce((n,x)=>n+x.price*x.quantity,0);const qualities=q.lines.map(x=>x.quality);return{id:"one_"+storeId,type:"one",stores:[storeId],products:q.lines,goods:q.total,convenienceCost:0,total:q.total,quality:qualities.includes("UNKNOWN")?"UNKNOWN":qualities.length&&qualities.every(x=>x==="LIVE")?"LIVE":"ESTIMATED"};}
  function planMulti(s){const ids=desired(s),storeIds=(typeof STORES!=="undefined"?STORES:[]).filter(x=>x.city.includes(window.state?.city||"msk")&&x.kind!=="delivery").map(x=>x.id),bestLine=id=>{let best=null;storeIds.forEach(storeId=>{const a=TDStoreAdapters.adapter(storeId),p=a.getProduct(id),q=a.getPrice(id,"shelf");if(p&&!excludedBrand(s,p)&&Number.isFinite(q.value)&&(!best||q.value<best.price))best={id,name:p.name,pack:p.pack,emoji:p.emoji||"•",brand:p.brand||"Без привязки к бренду",quantity:1,storeId,unitPrice:q.value,price:q.value,quality:q.quality,sourceId:(typeof PRODUCTS!=="undefined"&&PRODUCTS.some(x=>x.id===id))?id:null}});return best};let lines=ids.map(bestLine).filter(Boolean);lines=applyTargets(lines,s);lines=fit(lines,s.budget,s.requiredProducts);let used=uniq(lines.map(x=>x.storeId)),cost=Math.max(0,used.length-1)*120;lines=topUp(lines,s,p=>bestLine(p.id),cost);used=uniq(lines.map(x=>x.storeId));cost=Math.max(0,used.length-1)*120;while(s.budget&&lines.reduce((n,x)=>n+x.price*x.quantity,0)+cost>s.budget&&lines.length>1){const removable=[...lines].reverse().find(x=>!x.requestedMinQuantity&&!s.requiredProducts.includes(x.id));if(!removable)break;lines.splice(lines.indexOf(removable),1)}used=uniq(lines.map(x=>x.storeId));const goods=lines.reduce((n,x)=>n+x.price*x.quantity,0);cost=Math.max(0,used.length-1)*120;return{id:"multi",type:"multi",stores:used,products:lines,goods,convenienceCost:cost,total:goods+cost,quality:lines.length&&lines.every(x=>x.quality==="LIVE")?"LIVE":"ESTIMATED"};}
  function optimize(s){s.quantityTargets=s.quantityTargets||{};const allowed=s.stores.length?s.stores:[window.state?.storeId||"pyat"];const one=planOne(s,allowed[0]);if(s.selectionMode==="only"&&s.mode!=="multi")return[one];const multi=planMulti(s);return s.mode==="one"?[one]:[one,multi].sort((a,b)=>a.total-b.total);}
  window.TDShoppingOptimizer={optimize,planOne,planMulti,conveniencePerExtraStore:120};
})();
