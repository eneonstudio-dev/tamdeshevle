(()=>{
  "use strict";
  const BRAND="Проще";
  const TAGLINE="Собери корзину — дальше проще";
  const replacements=[
    ["Собери корзину — скажем, где дешевле",TAGLINE],
    ["Там Дешевле продаётся","Проще продаётся"],
    ["Тамдешевле",BRAND],
    ["Там Дешевле",BRAND],
    ["Там дешевле",BRAND]
  ];
  const mark=`<svg class="logo td-prosche-logo" width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#102018"/><path d="M19 45V19h26v26M19 19h26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M43 19h7" stroke="#35D981" stroke-width="6" stroke-linecap="round"/></svg>`;
  function rewriteText(value){let out=String(value||"");for(const [from,to] of replacements)out=out.split(from).join(to);return out}
  function decorate(root=document){
    document.title="Проще — корзина без лишней суеты";
    try{localStorage.setItem("td:brand","prosche")}catch{}
    const scope=root?.nodeType===1?root:document.body;
    if(scope){
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/i.test(p.tagName))return NodeFilter.FILTER_REJECT;return /Тамдешевле|Там Дешевле|Там дешевле|Собери корзину — скажем, где дешевле/.test(node.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes)node.nodeValue=rewriteText(node.nodeValue);
    }
    document.querySelectorAll(".brand-home").forEach(btn=>{if(btn.dataset.proscheBrand)return;const svg=btn.querySelector("svg.logo");if(svg){svg.outerHTML=mark;btn.dataset.proscheBrand="1";btn.setAttribute("aria-label","На главную — Проще")}});
    document.querySelectorAll("header.app h1").forEach(h=>{if(h.textContent.trim()===BRAND){const sub=h.parentElement?.querySelector(".sub");if(sub&&/дешевле/.test(sub.textContent))sub.textContent=TAGLINE}});
  }
  let raf=0;const queue=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>decorate(document.body))};
  function boot(){decorate(document.body);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.TDBrand={name:BRAND,tagline:TAGLINE,decorate,rewriteText};
})();