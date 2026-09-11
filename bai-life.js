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
  let timer=0;
  function ambient(){clearTimeout(timer);if(["idle","peek"].includes(bai.dataset.state)&&!bai.classList.contains("panel-open")){bai.classList.remove("micro-ear","micro-blink","micro-tail");const micro=["micro-ear","micro-blink","micro-tail"][Math.floor(Math.random()*3)];requestAnimationFrame(()=>bai.classList.add(micro));}timer=setTimeout(ambient,7000+Math.random()*6500);}
  function settleResult(){if(window.state?.screen!=="compare")return;const verified=document.querySelector(".v2-verdict:not(.v2-verdict-wait)");window.TDBai?.setState(verified?"big-saving":"suspicious",verified?"Вот это уже настоящая экономия":"Не буду выдумывать победителя",3000);}
  window.addEventListener("td:bai-state",event=>character.setAttribute("aria-label",event.detail?.state==="hidden"?"Разбудить Бая":"Открыть Бая"));
  window.addEventListener("td:v2-rendered",()=>setTimeout(settleResult,180));
  document.addEventListener("click",event=>{if(event.target.closest(".v2-compare,.btn.dark"))setTimeout(settleResult,520);});
  ambient();setTimeout(settleResult,900);
})();
