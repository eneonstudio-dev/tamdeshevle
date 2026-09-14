// Public Supabase browser configuration.
// Publishable browser keys are safe for client use; never expose service_role here.
window.TD_SUPABASE = window.TD_SUPABASE || {
  url: "https://pdsxeddldrmehdqaaksl.supabase.co",
  anonKey: "sb_publishable_PDQ3o1sAFvGFw2MelUNw0g_Vr2Vd7vw"
};

// Bai learning data is isolated in a separate Supabase project.
// These Edge Functions verify the existing TD auth session server-side; no learning-project key is exposed here.
window.TD_BAI_LEARNING = window.TD_BAI_LEARNING || {
  endpoint: "https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-learning-ingest",
  adminEndpoint: "https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-learning-admin"
};

// Brain 2.0 reasoning runs server-side. The browser only knows the public function URL;
// model provider credentials stay in Edge Function secrets/environment variables.
window.TD_BAI_AGENT = window.TD_BAI_AGENT || {
  endpoint: "https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-agent-core"
};

// Promoted self-hosted Bai checkpoints are reached only through this authenticated proxy.
// The runtime registry still requires a promoted, pinned and explicitly enabled release descriptor.
window.TD_BAI_TRAINED = window.TD_BAI_TRAINED || {
  endpoint: "https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-trained-inference"
};
try {
  const trainedOrigin = new URL(window.TD_BAI_TRAINED.endpoint).origin;
  const existing = Array.isArray(window.TD_BAI_BRAIN_ALLOWED_ORIGINS) ? window.TD_BAI_BRAIN_ALLOWED_ORIGINS : [];
  window.TD_BAI_BRAIN_ALLOWED_ORIGINS = [...new Set([...existing, trainedOrigin])];
} catch {}

// Gate F participation boundary. The capture guards are registered synchronously before
// auth/cloud handlers, while the small disclosure UI is loaded from same-origin code.
window.TDUserDataParticipationReady = window.TDUserDataParticipationReady || import("./votonobay-user-data-participation-v1.js?v=20260914-v1")
  .then(()=>window.TDUserDataParticipation||null)
  .catch(error=>{console.warn("[Gate F] participation UI failed to load",error);return null;});

(function installUserDataParticipationGuards(){
  const approvedKey="tdParticipationApproved";
  const pendingKey="tdParticipationPending";
  async function ask(kind,opener){
    const api=window.TDUserDataParticipation||await window.TDUserDataParticipationReady;
    if(!api||typeof api.confirm!=="function")return false;
    return api.confirm(kind,{opener});
  }
  document.addEventListener("submit",event=>{
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||!form.matches(".td-auth-modal form"))return;
    if(form.dataset[approvedKey]==="1"){
      delete form.dataset[approvedKey];
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if(form.dataset[pendingKey]==="1")return;
    form.dataset[pendingKey]="1";
    const submitter=event.submitter||form.querySelector('button[type="submit"]');
    void ask("account",submitter).then(ok=>{
      delete form.dataset[pendingKey];
      if(!ok)return;
      form.dataset[approvedKey]="1";
      if(typeof form.requestSubmit==="function")form.requestSubmit(submitter||undefined);
      else if(submitter&&typeof submitter.click==="function")submitter.click();
    });
  },true);
  document.addEventListener("click",event=>{
    const button=event.target&&event.target.closest?.("[data-cloud-save],[data-cloud-restore],.receipt-upload");
    if(!button)return;
    if(button.dataset[approvedKey]==="1"){
      delete button.dataset[approvedKey];
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if(button.disabled||button.dataset[pendingKey]==="1")return;
    button.dataset[pendingKey]="1";
    const kind=button.hasAttribute("data-cloud-save")?"cloud_save":button.hasAttribute("data-cloud-restore")?"cloud_restore":"receipt";
    void ask(kind,button).then(ok=>{
      delete button.dataset[pendingKey];
      if(!ok)return;
      button.dataset[approvedKey]="1";
      button.click();
    });
  },true);
  document.addEventListener("keydown",event=>{
    if(!document.querySelector(".td-user-data-participation"))return;
    const handled=window.TDUserDataParticipation?.handleKeydown?.(event);
    if(handled)event.stopImmediatePropagation();
  },true);
})();

import("./config/bai-brain-release-bound.js?v=20260914-serving-v1").catch(error=>console.warn("[Bai Brain Release] preload failed",error));
import("./bai-autopilot.js?v=20260912-autopilot-v2").catch(error=>console.warn("[Bai Autopilot] load failed",error));
import("./bai-session-owner-guard.js?v=20260913-owner-v1")
  .then(()=>import("./bai-shopping-agent-kernel.js?v=20260913-verification-trace-v1"))
  .then(()=>import("./bai-provider-contract.js?v=20260913-contract-v1"))
  .then(()=>import("./bai-agent-client.js?v=20260913-provider-origin-v1"))
  .then(()=>import("./bai-mvp-vertical-gate.js?v=20260914-mvp020-v1"))
  .then(()=>import("./bai-convenience-preference.js?v=20260914-mvp012-v1"))
  .then(()=>import("./bai-category-intents.js?v=20260914-mvp002-v1"))
  .then(()=>import("./bai-soft-tradeoff-intents.js?v=20260914-mvp004-v1"))
  .then(()=>import("./bai-same-basket-reprojection.js?v=20260914-mvp015-v1"))
  .then(()=>import("./bai-decision-quality.js?v=20260912-decision-v1"))
  .then(()=>import("./bai-shopping-journey.js?v=20260913-provider-origin-v1"))
  .then(()=>import("./bai-system-prompt-v1.js?v=20260912-system-v1"))
  .then(()=>import("./bai-literal-basket.js?v=20260912-literal-v1"))
  .then(()=>import("./bai-speech-lifecycle.js?v=20260912-speech-v1"))
  .then(()=>import("./bai-character.js?v=20260912-character-v2"))
  .then(()=>import("./bai-execution-contract.js?v=20260912-contract-v2"))
  .then(()=>import("./bai-observability.js?v=20260913-observability-v1"))
  .then(()=>import("./bai-idempotency-guard.js?v=20260913-operation-origin-v1"))
  .catch(error=>console.warn("[Bai Agent/Decision/Journey/SystemPrompt/Literal/Speech/Character/Observability/Idempotency] client load failed",error));