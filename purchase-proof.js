(()=>{
  "use strict";
  const KEY="td:purchase-proof-v1",MAX=100;
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}};
  const write=x=>localStorage.setItem(KEY,JSON.stringify(x.slice(-MAX)));
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  const state=()=>window.TDShoppingState?.get?.()||{};
  const plan=()=>state().lastPlans?.[0]||null;
  const receiptModule=()=>window.TDReceiptProofV2?Promise.resolve(window.TDReceiptProofV2):import("./receipt-proof-v2.js?v=20260911-receipt-proof-v2").then(()=>window.TDReceiptProofV2);
  let opener=null,keyHandler=null,previousOverflow="";
  function entries(){return read().sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
  function stats(){const rows=entries(),verified=rows.filter(x=>x.proof==="receipt_verified"),pending=rows.filter(x=>x.proof==="receipt_pending"),self=rows.filter(x=>x.proof==="self");return{purchases:rows.length,selfPurchases:self.length,receiptPurchases:verified.length,receiptPending:pending.length,actualTotal:verified.reduce((s,x)=>s+Number(x.actualSaving||0),0),reportedTotal:rows.reduce((s,x)=>s+Number(x.actualSaving||0),0),latest:rows[0]||null}}
  function snapshot(){const p=plan();if(!p?.products?.length)return null;const baseline=(state().lastPlans||[]).find(x=>x.type==="one")||null;return{planId:p.id||"",planType:p.type||"",plannedTotal:Math.round(Number(p.total)||0),baselineTotal:Math.round(Number(baseline?.total)||0),cart:Object.fromEntries((p.products||[]).map(x=>[x.id,x.quantity||1]))}}
  function parseMoney(value){
    const raw=String(value??"").trim();
    if(!raw)return null;
    const normalized=raw.replace(/\s/g,"").replace(",",".").replace(/[^0-9.]/g,"");
    const parsed=Number(normalized);
    return Number.isFinite(parsed)&&parsed>0?Math.round(parsed):null;
  }
  function save(input={}){
    const snap=snapshot();if(!snap)return null;
    const actualTotal=parseMoney(input.actualTotal);if(actualTotal==null)return null;
    const proof=["self","receipt_pending","receipt_verified"].includes(input.proof)?input.proof:"self";
    const actualSaving=snap.baselineTotal>0?Math.max(0,snap.baselineTotal-actualTotal):0;
    const row={id:crypto.randomUUID?.()||String(Date.now()),at:new Date().toISOString(),proof,receiptRef:input.receiptRef||null,actualTotal,actualSaving,note:String(input.note||"").slice(0,160),...snap};
    const rows=read();rows.push(row);write(rows);window.dispatchEvent(new CustomEvent("td:purchase-confirmed",{detail:row}));return row;
  }
  function focusables(root){return[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&el.getClientRects().length)}
  function unlock(){
    if(keyHandler){document.removeEventListener("keydown",keyHandler);keyHandler=null}
    document.documentElement.style.overflow=previousOverflow;
    const target=opener;opener=null;
    if(target?.isConnected)requestAnimationFrame(()=>{try{target.focus({preventScroll:true})}catch{target.focus?.()}});
  }
  function close(){const root=document.querySelector(".td-purchase-proof");if(!root)return;root.remove();unlock()}
  function bindDialog(root,card){
    opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    previousOverflow=document.documentElement.style.overflow;
    document.documentElement.style.overflow="hidden";
    keyHandler=event=>{
      if(event.key==="Escape"){event.preventDefault();close();return}
      if(event.key!=="Tab")return;
      const items=focusables(card);if(!items.length){event.preventDefault();card.focus();return}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",keyHandler);
    root.onclick=event=>{if(event.target===root)close()};
  }
  async function openReceipt(snap,status){
    try{
      const mod=await receiptModule();if(!mod?.open)throw new Error("receipt module unavailable");
      close();
      mod.open({plannedTotal:snap.plannedTotal,onSaved:receipt=>{
        const row=save({actualTotal:receipt.total,proof:"receipt_pending",receiptRef:receipt.id});
        if(row)window.dispatchEvent(new CustomEvent("td:purchase-receipt-linked",{detail:{purchase:row,receipt}}));
      }});
    }catch(e){console.warn("[Purchase Proof] receipt open failed",e);if(status)status.textContent="Чек не открылся. Попробуй ещё раз."}
  }
  function open(){
    const snap=snapshot();if(!snap)return false;
    close();
    const root=document.createElement("section");root.className="td-purchase-proof";
    root.innerHTML=`<div class="td-purchase-proof-card" role="dialog" aria-modal="true" aria-labelledby="td-purchase-proof-title" tabindex="-1"><button type="button" data-proof-close aria-label="Закрыть">×</button><small>ПОСЛЕ МАГАЗИНА</small><h3 id="td-purchase-proof-title">Сколько получилось по факту?</h3><p class="td-proof-plan">План Бая: <b>≈ ${money(snap.plannedTotal)}</b></p><label for="td-proof-total">Фактически заплатил<input id="td-proof-total" data-proof-total inputmode="decimal" autocomplete="off" placeholder="Например, ${snap.plannedTotal}" aria-describedby="td-proof-note"></label><div class="td-proof-actions"><button type="button" data-proof-self>Сохранить мою сумму</button><button type="button" data-proof-receipt>Добавить чек</button></div><p class="td-proof-note" id="td-proof-note">Плановую сумму не подставляю как факт. Без чека сохраню только ту сумму, которую ты сам введёшь. Чек сначала остаётся черновиком и не становится «проверенным» автоматически.</p><div data-proof-status role="status" aria-live="polite"></div></div>`;
    document.body.appendChild(root);
    const card=root.querySelector(".td-purchase-proof-card"),status=root.querySelector("[data-proof-status]"),input=root.querySelector("[data-proof-total]");
    root.querySelector("[data-proof-close]").onclick=close;
    root.querySelector("[data-proof-self]").onclick=()=>{
      const total=parseMoney(input.value);
      if(total==null){status.textContent="Введи сумму, которую реально заплатил. План Бая не считаю фактом.";input.focus();return}
      const row=save({actualTotal:total,proof:"self"});
      if(!row){status.textContent="Не получилось сохранить сумму. Проверь значение и попробуй ещё раз.";return}
      status.textContent=`Сохранил твою сумму${row.actualSaving>0?` · разница с базовым планом ${money(row.actualSaving)}`:""}. Без чека это остаётся пользовательским подтверждением.`;
      setTimeout(close,1100);
    };
    root.querySelector("[data-proof-receipt]").onclick=()=>openReceipt(snap,status);
    input.addEventListener("input",()=>{if(status.textContent)status.textContent=""});
    bindDialog(root,card);
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
    return true;
  }
  function css(){if(document.querySelector("style[data-purchase-proof-css]"))return;const s=document.createElement("style");s.dataset.purchaseProofCss="1";s.textContent=`.td-purchase-proof{position:fixed;inset:0;z-index:420;background:rgba(20,18,14,.58);display:grid;align-items:end;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.td-purchase-proof-card{position:relative;background:#fff;border-radius:24px;padding:20px;max-width:430px;max-height:min(88vh,88dvh);overflow:auto;overscroll-behavior:contain;width:100%;margin:0 auto;font-family:Manrope,sans-serif}.td-purchase-proof-card:focus{outline:none}.td-purchase-proof-card>[data-proof-close]{position:absolute;right:12px;top:10px;border:0;background:#f2efe9;border-radius:50%;width:44px;height:44px;font-size:22px;cursor:pointer}.td-purchase-proof-card>small{display:block;font-size:10px;letter-spacing:.08em;font-weight:900;color:#0f7b4a}.td-purchase-proof-card h3{font-size:23px;line-height:1.12;margin:5px 48px 8px 0}.td-purchase-proof-card p{font-size:12px}.td-proof-plan{color:#6b6458}.td-purchase-proof-card label{display:block;font-size:11px;font-weight:900;margin-top:14px}.td-purchase-proof-card input{box-sizing:border-box;width:100%;min-height:48px;margin-top:6px;border:1px solid #ddd5c9;border-radius:13px;padding:12px;background:#faf8f4;font:800 15px Manrope,sans-serif}.td-purchase-proof-card input:focus{outline:2px solid rgba(15,123,74,.22);border-color:#0f7b4a}.td-proof-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.td-proof-actions button{min-height:46px;border:0;border-radius:14px;padding:11px 12px;font:900 12px Manrope,sans-serif;cursor:pointer}.td-proof-actions [data-proof-self]{background:#161410;color:#fff}.td-proof-actions [data-proof-receipt]{background:#e8f3ea;color:#0f7b4a}.td-proof-note{color:#6b6458;line-height:1.5;margin-top:10px}[data-proof-status]{min-height:16px;font-size:11px;line-height:1.4;font-weight:800;margin-top:9px;color:#0f7b4a}@media(max-width:520px){.td-purchase-proof{padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}.td-purchase-proof-card{max-width:none;border-radius:24px 24px 0 0;padding:20px 16px max(20px,env(safe-area-inset-bottom));max-height:min(94vh,94dvh)}.td-proof-actions{grid-template-columns:1fr}.td-proof-actions button{min-height:48px}}`;
    document.head.appendChild(s)}
  css();window.TDPurchaseProof={open,close,save,entries,stats,parseMoney};
})();
