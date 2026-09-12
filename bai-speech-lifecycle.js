(()=>{
  "use strict";
  if(window.TDBaiSpeechLifecycle)return;
  const synth=window.speechSynthesis;
  if(!synth||typeof synth.speak!=="function"){
    window.TDBaiSpeechLifecycle={installed:false,reason:"speech_synthesis_unavailable"};
    return;
  }
  if(synth.__tdBaiNonBlockingSpeak){window.TDBaiSpeechLifecycle={installed:true,reason:"already_installed"};return}
  const nativeSpeak=synth.speak.bind(synth);
  function baiRoot(){return document.querySelector?.(".td-ai[data-bai-busy]")||null}
  function talkMode(root){return root?.querySelector?.("[data-ai-talkmode]")?.getAttribute?.("aria-pressed")==="true"}
  synth.speak=function(utterance){
    const root=baiRoot(),finish=utterance?.onend,nonBlocking=Boolean(root&&!talkMode(root)&&typeof finish==="function"&&/^ru(?:-|$)/i.test(String(utterance?.lang||"ru")));
    const result=nativeSpeak(utterance);
    if(nonBlocking)queueMicrotask(()=>{if(root?.isConnected&&root.hasAttribute("data-bai-busy"))finish.call(utterance,{type:"end",synthetic:true})});
    return result;
  };
  Object.defineProperty(synth,"__tdBaiNonBlockingSpeak",{value:true,configurable:true});
  window.TDBaiSpeechLifecycle={installed:true,reason:"non_blocking_text_mode"};
})();
