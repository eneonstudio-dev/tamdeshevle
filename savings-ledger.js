(function(){
  "use strict";
  const KEY="td:savings-ledger",MAX=200,DAY=24*60*60*1000;
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch{return[];}};
  const write=rows=>{try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)));return true;}catch(error){console.warn("Savings ledger storage unavailable",error);return false;}};
  const event=(name,detail)=>{try{if(typeof window?.dispatchEvent==="function"&&typeof CustomEvent==="function")window.dispatchEvent(new CustomEvent(name,{detail}));}catch{}};
  const makeId=()=>{try{if(typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function")return crypto.randomUUID();}catch{}return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;};
  function normalizedCart(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return{};
    const cart={};
    Object.entries(value).sort(([a],[b])=>String(a).localeCompare(String(b))).forEach(([id,raw])=>{const qty=Number(raw);if(id&&Number.isFinite(qty)&&qty>0)cart[id]=Math.min(99,Math.max(1,Math.floor(qty)));});
    return cart;
  }
  function record(input){
    const saving=Math.round(Number(input?.saving)||0),total=Math.round(Number(input?.total)||0);
    if(!input?.verified||saving<=0||total<=0)return null;
    const cart=normalizedCart(input.cart);
    const signature=[new Date().toISOString().slice(0,10),String(input.storeId||""),String(input.channel||""),Object.entries(cart).map(x=>x.join(":")).join(",")].join("|");
    const rows=read(),existing=rows.find(x=>x&&x.signature===signature);
    if(existing)return existing;
    const row={id:makeId(),signature,at:new Date().toISOString(),storeId:String(input.storeId||""),storeName:String(input.storeName||input.storeId||""),channel:String(input.channel||""),total,saving,baselineTotal:Math.round(Number(input.baselineTotal)||0),planType:String(input.planType||""),verified:true,cart};
    rows.push(row);
    if(!write(rows))return null;
    event("td:savings-recorded",row);
    return row;
  }
  function entries(){return read().filter(x=>x&&x.verified===true&&Number(x.saving)>0&&Number(x.total)>0).sort((a,b)=>String(b.at).localeCompare(String(a.at)));}
  function sumSince(rows,days){const after=Date.now()-days*DAY;return rows.filter(x=>{const at=new Date(x.at).getTime();return Number.isFinite(at)&&at>=after;}).reduce((s,x)=>s+Number(x.saving||0),0);}
  function stats(){
    const rows=entries(),confirmed=rows.reduce((s,x)=>s+Number(x.saving||0),0),best=rows.reduce((a,x)=>!a||Number(x.saving)>Number(a.saving)?x:a,null);
    return{confirmed,week:sumSince(rows,7),month:sumSince(rows,30),purchases:rows.length,latest:rows[0]||null,best,bestSaving:best?Number(best.saving)||0:0};
  }
  window.TDSavingsLedger={record,entries,stats};
})();
