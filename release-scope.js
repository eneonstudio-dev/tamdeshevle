(()=>{
  "use strict";

  // Closed beta is intentionally local-first until the user-data notice/legal basis
  // for optional remote account/cloud/receipt flows is reviewed. These flags are
  // release controls, not user preferences; client code must fail closed when false.
  const flags=Object.freeze({
    closedBeta:true,
    remoteAccount:false,
    cloudSync:false,
    receiptUpload:false
  });

  const enabled=name=>flags[name]===true;
  window.TDReleaseScope=Object.freeze({
    mode:"closed-beta-local-first",
    flags,
    enabled
  });
})();
