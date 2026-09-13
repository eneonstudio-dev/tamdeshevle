(()=>{
  "use strict";
  if(window.TDBaiTrainedBridge)return;
  let wrapped=false,lastProvider=null;

  function wrap(brain){
    if(!brain?.route||brain.__baiTrainedBridgeFinal===brain.route)return brain;
    const original=brain.route.bind(brain);
    const routed=async function(raw,history=[],...rest){
      const baseline=await original(raw,history,...rest);
      const runtime=window.TDBaiBrainRuntime;
      if(!runtime?.route)return baseline;
      const trained=await runtime.route(String(raw||""),history,baseline);
      if(trained){lastProvider=trained.provider||"bai-trained-runtime";return trained}
      lastProvider=baseline?.provider||"rules";return baseline;
    };
    brain.route=routed;
    try{Object.defineProperty(brain,"__baiTrainedBridgeFinal",{value:routed,writable:true,configurable:true})}catch{brain.__baiTrainedBridgeFinal=routed}
    wrapped=true;return brain;
  }
  function install(){const brain=window.TDBaiBrain;if(!brain)return false;wrap(brain);return true}
  function observeAgentClient(){
    if(window.TDBaiAgentClient){queueMicrotask(install);return}
    const desc=Object.getOwnPropertyDescriptor(window,"TDBaiAgentClient");if(desc&&!desc.configurable)return;
    let value;
    try{Object.defineProperty(window,"TDBaiAgentClient",{configurable:true,enumerable:true,get(){return value},set(next){value=next;queueMicrotask(install)}})}catch{}
  }
  observeAgentClient();
  setTimeout(()=>{if(!window.TDBaiAgentClient)install()},1000);
  window.addEventListener?.("td:runtime-ready",()=>queueMicrotask(install));
  window.TDBaiTrainedBridge={install,status:()=>({wrapped,lastProvider,runtime:window.TDBaiBrainRuntime?.status?.()||null,registry:window.TDBaiBrainRegistry?.status?.()||null})};
})();
