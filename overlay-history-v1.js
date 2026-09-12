(()=>{
  "use strict";
  const layers=[
    {key:"bai",selector:".td-ai",close:node=>node.querySelector("[data-ai-close]")?.click()},
    {key:"pickup",selector:".td-pickup-backdrop",close:()=>window.TDPickupFlowV1?.close?.()},
    {key:"courier",selector:".td-courier-backdrop",close:()=>window.TDCourierHandoffV1?.close?.()},
    {key:"continue-stores",selector:".td-continue-stores",close:()=>window.TDContinueInStoresV1?.close?.()},
    {key:"retailer",selector:".td-retailer-handoff",close:()=>window.TDRealStoreIntegrationV1?.close?.()}
  ];
  let active=null,closingFromPop=false,manualBackPending=false;
  const findLayer=node=>layers.find(x=>node?.matches?.(x.selector));
  function push(layer,node){
    if(!layer||!node||active?.node===node)return;
    active={...layer,node};
    if(history.state?.tdOverlay===layer.key)return;
    try{history.pushState({...history.state,tdOverlay:layer.key},"")}catch{}
  }
  function handleAdded(node){
    if(!(node instanceof Element))return;
    const own=findLayer(node);if(own){push(own,node);return}
    for(const layer of layers){const found=node.querySelector?.(layer.selector);if(found){push(layer,found);return}}
  }
  function handleRemoved(node){
    if(!active||!(node instanceof Element))return;
    const removed=node===active.node||node.contains?.(active.node);if(!removed)return;
    const old=active;active=null;
    if(closingFromPop){closingFromPop=false;return}
    if(history.state?.tdOverlay===old.key){manualBackPending=true;try{history.back()}catch{manualBackPending=false}}
  }
  const observer=new MutationObserver(records=>{for(const record of records){record.addedNodes.forEach(handleAdded);record.removedNodes.forEach(handleRemoved)}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("popstate",event=>{
    if(manualBackPending){manualBackPending=false;return}
    if(!active)return;
    if(event.state?.tdOverlay===active.key)return;
    const current=active;closingFromPop=true;
    try{current.close(current.node)}catch(e){console.warn("[OverlayHistory] close failed",e);closingFromPop=false}
    queueMicrotask(()=>{if(active?.node===current.node&&document.contains(current.node))closingFromPop=false});
  });
  for(const layer of layers){const node=document.querySelector(layer.selector);if(node){push(layer,node);break}}
  window.TDOverlayHistoryV1={active:()=>active?.key||null,layers:layers.map(x=>x.key)};
})();