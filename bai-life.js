(() => {
  "use strict";
  const bai=document.getElementById("bai-assistant");
  if(!bai||bai.querySelector(".bai-life"))return;
  const character=bai.querySelector(".bai-character");
  const image=bai.querySelector(".bai-image");
  if(!character||!image)return;
  const life=document.createElement("span");life.className="bai-life";life.setAttribute("aria-hidden","true");life.innerHTML="<i></i><i></i>";
  const wake=document.createElement("span");wake.className="bai-wake";wake.textContent="Нажми, чтобы разбудить";
  character.insertBefore(life,image);character.appendChild(wake);
  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let timer=0,lastMicro="";
  function schedule(){clearTimeout(timer);if(document.hidden||motionQuery?.matches)return;timer=setTimeout(ambient,7000+Math.random()*6500)}
  function ambient(){
    clearTimeout(timer);
    bai.classList.remove("micro-ear","micro-blink","micro-tail");
    if(document.hidden||motionQuery?.matches)return;
    if(["idle","peek"].includes(bai.dataset.state)&&!bai.classList.contains("panel-open")){
      const variants=["micro-ear","micro-blink","micro-tail"].filter(x=>x!==lastMicro);
      const micro=variants[Math.floor(Math.random()*variants.length)]||"micro-blink";
      lastMicro=micro;
      requestAnimationFrame(()=>{if(!document.hidden&&!motionQuery?.matches)bai.classList.add(micro);});
    }
    schedule();
  }
  function settleResult(){if(window.state?.screen!=="compare")return;const verified=document.querySelector(".v2-verdict:not(.v2-verdict-wait)");window.TDBai?.setState(verified?"big-saving":"suspicious",verified?"Вот это уже настоящая экономия":"Не буду выдумывать победителя",3000);}
  function visibilityChanged(){if(document.hidden){clearTimeout(timer);bai.classList.remove("micro-ear","micro-blink","micro-tail");return}ambient()}
  window.addEventListener("td:bai-state",event=>character.setAttribute("aria-label",event.detail?.state==="hidden"?"Разбудить Бая":"Открыть Бая"));
  window.addEventListener("td:v2-rendered",()=>setTimeout(settleResult,180));
  document.addEventListener("click",event=>{if(event.target.closest(".v2-compare,.btn.dark"))setTimeout(settleResult,520);});
  document.addEventListener("visibilitychange",visibilityChanged);
  window.addEventListener("pagehide",()=>clearTimeout(timer),{once:true});
  motionQuery?.addEventListener?.("change",ambient);
  ambient();setTimeout(settleResult,900);
})();
