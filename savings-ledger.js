(function(){
  "use strict";
  const KEY="td:savings-ledger",MAX=200,DAY=24*60*60*1000;
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch{return[];}};
  const write=x=>localStorage.setItem(KEY,JSON.stringify(x.slice(-MAX)));
  function record(input){
    const saving=Math.round(Number(input?.saving)||0),total=Math.round(Number(input?.total)||0);
    if(!input?.verified||saving<=0||total<=0)return null;
    const cart=input.cart||{};
    const signature=[new Date().toISOString().slice(0,10),input.storeId,input.channel,Object.entries(cart).sort().map(x=>x.join(":"))].join("|");
    const rows=read();
    if(rows.some(x=>x.signature===signature))return rows.find(x=>x.signature===signature);
    const row={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),signature,at:new Date().toISOString(),storeId:input.storeId,storeName:input.storeName||input.storeId,channel:input.channel,total,saving,baselineTotal:Math.round(Number(input.baselineTotal)||0),planType:input.planType||"",verified:true,cart};
    rows.push(row);write(rows);window.dispatchEvent(new CustomEvent("td:savings-recorded",{detail:row}));return row;
  }
  function entries(){return read().filter(x=>x&&x.verified===true&&Number(x.saving)>0).sort((a,b)=>String(b.at).localeCompare(String(a.at)));}
  function sumSince(rows,days){const after=Date.now()-days*DAY;return rows.filter(x=>new Date(x.at).getTime()>=after).reduce((s,x)=>s+Number(x.saving||0),0);}
  function stats(){
    const rows=entries(),confirmed=rows.reduce((s,x)=>s+Number(x.saving||0),0),best=rows.reduce((a,x)=>!a||Number(x.saving)>Number(a.saving)?x:a,null);
    return{confirmed,week:sumSince(rows,7),month:sumSince(rows,30),purchases:rows.length,latest:rows[0]||null,best,bestSaving:best?Number(best.saving)||0:0};
  }
  window.TDSavingsLedger={record,entries,stats};
})();
