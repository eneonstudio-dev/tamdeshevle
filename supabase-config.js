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

import("./bai-autopilot.js?v=20260912-autopilot-v2").catch(error=>console.warn("[Bai Autopilot] load failed",error));
import("./bai-agent-client.js?v=20260912-agent-core-v1")
  .then(()=>import("./bai-shopping-journey.js?v=20260912-journey-v2"))
  .then(()=>import("./bai-character.js?v=20260912-character-v1"))
  .catch(error=>console.warn("[Bai Agent/Journey/Character] client load failed",error));
