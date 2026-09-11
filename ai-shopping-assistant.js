(function(){
  "use strict";
  let root=null,messages=[],recognition=null,brainLoad=null,voiceActive=false,voiceFinal="",voiceInterim="";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>Math.round(Number(v)||0).toLocaleString("ru-RU")+" ₽";
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id;
  function bay(state="idle"){const img=root?.querySelector("[data-ai-bai]");const map={idle:"bai-idle.webp",listening:"bai-peek.webp",thinking:"bai-peek.webp",warning:"bai-grumpy.webp",success:"bai-idle.webp"};if(img)img.src="assets/bai/"+(map[state]||map.idle);root?.setAttribute("data-bai-state",state)}
  function summary(){const s=TDShoppingState.get(),best=s.lastPlans?.[0];if(!best)return"";return `<section class="td-ai-summary"><div class="td-ai-summary-head"><b>Корзина · ${best.products.length}</b></div>${best.products.map(p=>`<div class="td-ai-line"><span>${esc(p.emoji)} ${esc(p.name)}<small>${esc(p.pack)} · ${esc(storeName(p.storeId))}</small></span><b>${money(p.price*p.quantity)}</b></div>`).join("")}<div class="td-ai-total"><span>Итого</span><strong>≈ ${money(best.total)}</strong></div></section>`}
  function render(){if(!root)return;const s=root.querySelector(".td-ai-messages");s.innerHTML=messages.map(m=>`<div class="td-ai-msg ${m.role}">${esc(m.text)}</div>`).join("")+summary();s.lastElementChild?.scrollIntoView({block:"nearest"})}
  function speak(text){if(!("speechSynthesis"in window)||!text)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="ru-RU";u.rate=1.02;window.speechSynthesis.speak(u)}
  async function ensureBrain(){if(!window.TDBaiBrain){brainLoad=brainLoad||import("./bai-brain.js?v=20260911-native-v1").catch(e=>{console.warn("[Bai Brain] load failed",e);return null});await brainLoad}return window.TDBaiBrain||null}
  async function submit(text){
    if(voiceActive)stopVoice();
    const area=root?.querySelector("textarea"),value=String(text||area?.value||"").trim();if(!value)return;
    const history=messages.slice(-10);messages.push({role:"user",text:value});if(area)area.value="";bay("thinking");render();
    let routed={operations:null,reply:""};try{const brain=await ensureBrain();routed=await brain?.route?.(value,history)||routed}catch(e){console.warn("[Bai Brain]",e)}
    let result=null,reply="";
    if(Array.isArray(routed.operations)&&routed.operations.length){result=TDShoppingConversation.apply(value,routed.operations);reply=result.message||routed.reply;}
    else if(routed.reply){reply=routed.reply;}
    else{result=TDShoppingConversation.apply(value);reply=result.message;}
    if(routed.reply&&!result?.needsClarification)reply=routed.reply+(result?.message&&result.message!==routed.reply?` ${result.message}`:"");
    messages.push({role:"assistant",text:reply});bay(result?.needsClarification?"warning":"success");render();speak(reply);
  }
  function dedupe(t){let w=String(t||"").trim().split(/\s+/).filter(Boolean);let changed=true;while(changed){changed=false;for(let n=Math.min(14,Math.floor(w.length/2));n>0;n--){const a=w.slice(-n).join(" ").toLowerCase(),b=w.slice(-2*n,-n).join(" ").toLowerCase();if(a===b){w.splice(-n);changed=true;break}}}return w.filter((x,i)=>!i||x.toLowerCase()!==w[i-1].toLowerCase()).join(" ")}
  function updateVoice(){const a=root?.querySelector("textarea");if(a)a.value=dedupe([voiceFinal,voiceInterim].filter(Boolean).join(" "))}
  function makeRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;const r=new SR();r.lang="ru-RU";r.interimResults=true;r.continuous=true;r.maxAlternatives=1;r.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const p=e.results[i][0]?.transcript||"";if(e.results[i].isFinal)voiceFinal=dedupe(voiceFinal+" "+p);else interim+=" "+p}voiceInterim=dedupe(interim);updateVoice()};r.onend=()=>{recognition=null;if(voiceActive)setTimeout(()=>{recognition=makeRecognition();try{recognition?.start()}catch{}},180)};return r}
  function startVoice(){window.TDBaiVoice?.stop?.();voiceFinal="";voiceInterim="";voiceActive=true;recognition=makeRecognition();if(!recognition){messages.push({role:"assistant",text:"На этом устройстве голосовой ввод не поддерживается — напиши текстом."});render();return}recognition.start();root?.querySelector("[data-ai-mic]")?.classList.add("listening");bay("listening")}
  function stopVoice(){voiceActive=false;voiceInterim="";try{recognition?.stop()}catch{}recognition=null;root?.querySelector("[data-ai-mic]")?.classList.remove("listening");updateVoice();bay("idle")}
  function voice(){voiceActive?stopVoice():startVoice()}
  function newSession(){stopVoice();TDShoppingState.reset();window.TDBaiBrain?.reset?.();messages=[{role:"assistant",text:"Начали заново. Скажи обычными словами, что хочешь купить — я буду держать условия по ходу разговора."}];render()}
  function open(){if(root)return;root=document.createElement("section");root.className="td-ai";root.innerHTML=`<div class="td-ai-shell"><header class="td-ai-head"><button data-ai-close>←</button><div><b>Бай</b><small>помощник покупок</small></div><button data-ai-new>Новая</button></header><main class="td-ai-main"><div class="td-ai-bai"><img data-ai-bai src="assets/bai/bai-idle.webp" alt=""><h2>Что сегодня покупаем?</h2><p>Говори как обычно. Я помню условия разговора.</p></div><div class="td-ai-messages" aria-live="polite"></div></main><div class="td-ai-compose"><textarea placeholder="Например: хочу сытно на вечер, до 1500 ₽, готовить лень"></textarea><button data-ai-mic>●</button><button class="td-ai-send" data-ai-send>Отправить</button></div></div>`;document.body.appendChild(root);root.querySelector("[data-ai-close]").onclick=()=>{stopVoice();root.remove();root=null};root.querySelector("[data-ai-new]").onclick=newSession;root.querySelector("[data-ai-send]").onclick=()=>submit();root.querySelector("[data-ai-mic]").onclick=voice;root.querySelector("textarea").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit()}};messages.length||(messages=[{role:"assistant",text:"Расскажи, что хочешь. Можно как человеку: бюджет, сколько вас, что любишь, что не хочешь и хочется ли готовить."}]);render();ensureBrain();root.querySelector("textarea").focus()}
  function mutateProduct(type,id,fn){TDShoppingState.commit(type,s=>{const p=s.products.find(x=>x.id===id);if(p)fn(s,p)},type);TDShoppingState.syncCart();render()}
  function adjust(id,d){mutateProduct("CHANGE_QUANTITY",id,(s,p)=>{p.quantity=Math.max(0,p.quantity+d);if(!p.quantity)s.products=s.products.filter(x=>x.id!==id)})}
  function remove(id){mutateProduct("REMOVE_PRODUCT",id,s=>{s.products=s.products.filter(x=>x.id!==id);if(!s.excludedProducts.includes(id))s.excludedProducts.push(id)})}
  window.TDShoppingAssistant={open,voice,submit,adjust,remove,newSession};
})();
