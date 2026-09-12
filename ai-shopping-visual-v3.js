(function(){
  "use strict";
  const PHOTOS={
    "молоко":"https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=320&q=78",
    "яйца":"https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=320&q=78",
    "курица":"https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=320&q=78",
    "хлеб":"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=320&q=78",
    "бананы":"https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=320&q=78",
    "яблоки":"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=320&q=78",
    "макароны":"https://images.unsplash.com/photo-1551462147-ff29893d2640?auto=format&fit=crop&w=320&q=78",
    "вода":"https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=320&q=78"
  };
  const prompts=["Еда на три дня до 2000 ₽","Ужин без готовки до 1000 ₽","Корзина на двоих до 3000 ₽"];
  let queued=false;
  function photoFor(text){const low=String(text||"").toLowerCase();return Object.entries(PHOTOS).find(([word])=>low.includes(word))?.[1]||""}
  function productGlyph(text){const match=String(text||"").match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u);return match?.[0]||"✦"}
  function enhanceHero(root){const hero=root.querySelector(".td-ai-bai");if(!hero)return;hero.dataset.visualV3="1";const title=hero.querySelector("h2");if(title&&title.textContent!=="Что сегодня собираем?")title.textContent="Что сегодня собираем?";const p=hero.querySelector("p"),copy="Расскажи задачу как человеку. Бай поймёт бюджет, учтёт продукты дома и соберёт корзину.";if(p&&p.textContent!==copy)p.textContent=copy;if(!hero.querySelector(".td-ai-v3-eyebrow")){const eyebrow=document.createElement("small");eyebrow.className="td-ai-v3-eyebrow";eyebrow.textContent="AI-АССИСТЕНТ ПОКУПОК";hero.insertBefore(eyebrow,title)}if(!hero.querySelector(".td-ai-v3-prompts")){const wrap=document.createElement("div");wrap.className="td-ai-v3-prompts";prompts.forEach(text=>{const b=document.createElement("button");b.type="button";b.textContent=text;b.onclick=()=>window.TDShoppingAssistant?.submit?.(text);wrap.appendChild(b)});hero.appendChild(wrap)}}
  function enhanceLines(root){root.querySelectorAll(".td-ai-summary .td-ai-line").forEach((line,index)=>{const signature=line.textContent.trim();if(line.dataset.visualSignature===signature)return;line.dataset.visualSignature=signature;line.classList.add("td-ai-v3-product");line.style.setProperty("--card-order",String(Math.min(index,6)));line.querySelector(".td-ai-v3-photo")?.remove();const photo=photoFor(signature),glyph=productGlyph(signature);const media=document.createElement("span");media.className="td-ai-v3-photo";media.setAttribute("aria-hidden","true");const showFallback=()=>{media.textContent=glyph;media.classList.add("fallback")};if(photo){const img=document.createElement("img");img.src=photo;img.alt="";img.loading="lazy";img.decoding="async";img.onerror=()=>{img.remove();showFallback()};media.appendChild(img)}else showFallback();line.prepend(media)})}
  function labelResult(root){const summary=root.querySelector(".td-ai-summary");if(!summary)return;summary.dataset.resultLabel="СНАЧАЛА РЕЗУЛЬТАТ";const messages=root.querySelector(".td-ai-messages");if(messages)messages.classList.add("td-ai-v3-has-result")}
  function enhance(){const root=document.querySelector(".td-ai");if(!root)return;root.dataset.visualV3="1";enhanceHero(root);enhanceLines(root);labelResult(root)}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("click",event=>{if(event.target.closest(".td-ai-entry,[data-action='basket']"))setTimeout(schedule,0)});
  schedule();
})();
