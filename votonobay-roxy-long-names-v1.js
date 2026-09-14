(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyLongNamesV1)return;
  window.__TDVotonobayRoxyLongNamesV1=true;

  const STYLE_HREF="votonobay-roxy-long-names-v1.css?v=20260914-v1";
  function ensureStyle(){
    if(document.querySelector('link[data-roxy-long-names="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE_HREF;
    link.dataset.roxyLongNames="1";
    document.head.appendChild(link);
  }

  ensureStyle();
  window.TDRoxyLongNamesV1={ensureStyle};
})();
