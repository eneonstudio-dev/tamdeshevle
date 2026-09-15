(()=>{
  "use strict";
  if(window.__TDRoxyUxWaveV1)return;
  window.__TDRoxyUxWaveV1=true;

  let raf=0;

  function ensureCss(){
    if(document.querySelector('link[data-roxy-ux-wave]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-ux-wave-v1.css?v=20260915-v1";
    link.dataset.roxyUxWave="1";
    document.head.appendChild(link);
  }

  function currentScreen(){
    return document.getElementById("app")?.dataset?.screen||window.state?.screen||"";
  }

  function openBai(){
    window.TDBai?.openPanel?.();
    requestAnimationFrame(()=>document.getElementById("aiq")?.focus?.({preventScroll:false}));
  }

  function decorateList(){
    if(currentScreen()!=="cart")return false;
    const app=document.getElementById("app");
    const host=app?.querySelector(".wrap");
    if(!app||!host)return false;
    if(app.querySelector(".v2-list-bay"))return true;

    const card=document.createElement("aside");
    card.className="v2-list-bay";
    card.setAttribute("aria-label","Бай в списке покупок");
    card.innerHTML=`
      <div class="v2-list-bay-copy">
        <div class="v2-list-bay-kicker">Бай рядом</div>
        <strong>Хочешь поменять список словами?</strong>
        <p>Например: «убери молочку» или «всё из одного магазина».</p>
      </div>
      <button class="v2-list-bay-open" type="button">Спросить Бая</button>`;
    card.querySelector(".v2-list-bay-open")?.addEventListener("click",openBai);
    host.insertBefore(card,host.firstChild);
    return true;
  }

  function decorateAccount(root=document.querySelector(".td-account")){
    if(!root)return false;
    root.classList.add("td-account-polished");
    const localOnly=window.TD_RELEASE_SCOPE?.personalDataMode==="local-only"||window.TD_SUPABASE===null;
    if(localOnly&&!root.querySelector(".td-account-local-badge")){
      const label=document.createElement("span");
      label.className="td-account-local-badge";
      label.textContent="Локальный режим";
      const copy=root.querySelector(".td-account-head > div");
      copy?.appendChild(label);
    }
    return true;
  }

  function decorate(){
    ensureCss();
    decorateList();
    decorateAccount();
  }

  function queue(){
    if(typeof cancelAnimationFrame==="function")cancelAnimationFrame(raf);
    raf=requestAnimationFrame(decorate);
  }

  function boot(){
    ensureCss();
    decorate();
  }

  window.addEventListener?.("td:v2-rendered",queue);
  window.addEventListener?.("td:account-opened",()=>decorateAccount());
  window.addEventListener?.("pageshow",queue);
  window.TDRoxyUxWave={decorate,decorateList,decorateAccount,openBai};

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
