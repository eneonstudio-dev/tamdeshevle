(()=>{
  "use strict";
  if(window.__TDRoxySplitDecisionV1)return;
  window.__TDRoxySplitDecisionV1=true;
  const STYLE="votonobay-roxy-split-decision-v1.css?v=20260914-v1";
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  function ensureStyle(){if(document.querySelector('link[data-roxy-split-decision]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href=STYLE;link.dataset.roxySplitDecision="1";document.head.appendChild(link)}
  function decision(result){
    const one=result?.bestOne,two=result?.bestTwo;
    if(!one||!two||result.worthSplitting||!(result.extraSaving>0))return null;
    if(result.travelKnown===false||result.operationalCost==null)return{kind:"unknown",title:"Пока не делю корзину",text:`По товарам два магазина выглядят дешевле на ${money(result.extraSaving)}, но дорога и время ещё не учтены.`};
    const net=Number(one.total)-Number(two.total)-Number(result.operationalCost);
    if(!Number.isFinite(net)||net>0)return null;
    return{kind:"single",title:"Один магазин выгоднее по итогу",text:`На товарах разница ${money(result.extraSaving)}, а второй заход стоит ${money(result.operationalCost)}. Чистой выгоды от разделения нет.`};
  }
  function decorate(){
    if(!window.TDBasketSplit||!window.state||state.screen!=="compare")return false;
    const wrap=document.querySelector("#app .wrap"),toggle=wrap?.querySelector(".toggle");
    if(!wrap||!toggle||wrap.querySelector("[data-split-basket],.roxy-split-decision"))return false;
    const result=window.TDBasketSplit.fromWindow?.(),copy=decision(result);if(!copy)return false;
    ensureStyle();
    const card=document.createElement("section");card.className="roxy-split-decision";card.dataset.splitDecision=copy.kind;
    const small=document.createElement("small");small.textContent="РЕШЕНИЕ БАЯ · ОДИН ИЛИ ДВА МАГАЗИНА";
    const title=document.createElement("h3");title.textContent=copy.title;
    const text=document.createElement("p");text.textContent=copy.text;
    const note=document.createElement("p");note.className="roxy-split-decision__note";note.textContent="В рекомендации остаётся один магазин. Номинальную разницу цен не выдаём за чистую экономию.";
    card.append(small,title,text,note);toggle.insertAdjacentElement("afterend",card);return true;
  }
  function schedule(){requestAnimationFrame(decorate)}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("td:runtime-ready",schedule);window.addEventListener("td:assembly-settings",()=>{document.querySelector(".roxy-split-decision")?.remove();schedule()});schedule();
  window.TDRoxySplitDecisionV1={decision,decorate,schedule};
})();
