(function(){
  "use strict";
  const KEY="td:savings-ledger",MAX=200;
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch{return[];}};
  const write=x=>localStorage.setItem(KEY,JSON.stringify(x.slice(-MAX)));
  function record(input){const saving=Math.round(Number(input?.saving)||0),total=Math.round(Number(input?.total)||0);if(!input?.verified||saving<=0||total<=0)return null;const cart=input.cart||{};const signature=[new Date().toISOString().slice(0,10),input.storeId,input.channel,Object.entries(cart).sort().map(x=>x.join(":"))].join("|");const rows=read();if(rows.some(x=>x.signature===signature))return rows.find(x=>x.signature===signature);const row={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),signature,at:new Date().toISOString(),storeId:input.storeId,storeName:input.storeName||input.storeId,channel:input.channel,total,saving,verified:true,cart};rows.push(row);write(rows);window.dispatchEvent(new CustomEvent("td:savings-recorded",{detail:row}));return row;}
  function entries(){return read().filter(x=>x&&x.verified===true&&Number(x.saving)>0).sort((a,b)=>String(b.at).localeCompare(String(a.at)));}
  function stats(){const rows=entries();return{confirmed:rows.reduce((s,x)=>s+Number(x.saving),0),purchases:rows.length,latest:rows[0]||null};}
  window.TDSavingsLedger={record,entries,stats};
})();
