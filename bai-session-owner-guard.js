(()=>{
  "use strict";
  import("./bai-trace-context.js?v=20260913-trace-v1").catch(error=>console.warn("[Bai Trace] load failed",error));
  import("./bai-request-trace.js?v=20260913-server-trace-v1").catch(error=>console.warn("[Bai Request Trace] load failed",error));
  if(window.TDBaiSessionOwnerGuard)return;

  const SESSION_KEY="td:bai-shopping-session:v2";
  const OWNER_KEY="td:bai-shopping-session-owner:v1";
  const ownerOf=detail=>String(detail?.session?.user?.id||"guest");
  const readOwner=()=>{try{return String(localStorage.getItem(OWNER_KEY)||"")}catch{return""}};
  const writeOwner=owner=>{try{localStorage.setItem(OWNER_KEY,owner);return true}catch{return false}};
  const clearPersisted=()=>{try{localStorage.removeItem(SESSION_KEY)}catch{}};

  function resetKernel(){
    try{window.TDBaiShoppingAgentKernel?.state?.reset?.()}catch{}
  }

  function syncOwner(owner){
    const next=String(owner||"guest"),previous=readOwner();
    if(previous===next)return{changed:false,owner:next,previous};
    clearPersisted();
    resetKernel();
    writeOwner(next);
    return{changed:true,owner:next,previous};
  }

  function onAuthState(event){return syncOwner(ownerOf(event?.detail))}
  window.addEventListener?.("td:auth-state",onAuthState);
  window.TDBaiSessionOwnerGuard={syncOwner,status:()=>({owner:readOwner()||"unknown"}),_test:{ownerOf}};
})();
