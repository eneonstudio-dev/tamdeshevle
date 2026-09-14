// Closed-beta release scope: keep personal/account data on-device until privacy/legal review is complete.
// This is intentionally fail-closed. The Supabase auth/cloud/receipt backend remains in the repository,
// but the browser release does not initialize it and cannot upload account/cloud/receipt personal data.
window.TD_RELEASE_SCOPE = Object.freeze({
  channel: "closed-beta",
  personalDataMode: "local-only",
  accountCloudEnabled: false,
  receiptProofUploadEnabled: false,
  reason: "privacy-legal-review-pending"
});

// No active personal-data Supabase configuration is exposed to the closed-beta browser runtime.
window.TD_SUPABASE = null;

(function enforceClosedBetaLocalOnly(scope) {
  "use strict";
  if (!scope || scope.personalDataMode !== "local-only") return;

  const disabledError = () => new Error("CLOSED_BETA_LOCAL_ONLY");
  const disabledAsync = async () => { throw disabledError(); };
  let authValue = window.TDAuth || null;

  function lockAuth(value) {
    if (!value || typeof value !== "object") return value;
    value.configured = () => false;
    value.user = () => null;
    value.signInWithEmail = disabledAsync;
    value.signOut = async () => {};
    value.syncLocalToCloud = disabledAsync;
    value.hydrateLocalFromCloud = disabledAsync;
    value.cloudSummary = async () => null;
    value.submitReceiptEvidence = null;
    value.receiptQueue = null;
    value.receiptPriceHistory = null;
    value.isReceiptReviewer = null;
    value.receiptReviewQueue = null;
    value.receiptProofUrl = null;
    value.reviewReceipt = null;
    value.cloudStatus = () => ({
      status: "local-only",
      message: "Закрытая бета: данные остаются только на этом устройстве."
    });
    return value;
  }

  try {
    Object.defineProperty(window, "TDAuth", {
      configurable: true,
      enumerable: true,
      get() { return authValue; },
      set(value) { authValue = lockAuth(value); }
    });
    if (authValue) authValue = lockAuth(authValue);
  } catch (error) {
    console.warn("[Closed Beta Data Policy] auth lock failed closed", error);
    window.TD_SUPABASE = null;
  }

  const ACCOUNT_STATUS = "Закрытая бета · данные хранятся только на этом устройстве";
  const CLOUD_STATUS = "Облачная синхронизация отключена в закрытой бете до завершения privacy/legal review.";
  const RECEIPT_STATUS = "Черновик сохранён на устройстве. Отправка фото чека в облако отключена в закрытой бете.";

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function disable(button, label) {
    if (!button) return;
    if (!button.disabled) button.disabled = true;
    if (button.getAttribute && button.getAttribute("aria-disabled") !== "true") button.setAttribute("aria-disabled", "true");
    if (label) setText(button, label);
  }

  function applyLocalOnlyUi() {
    if (typeof document === "undefined") return;
    for (const root of document.querySelectorAll?.(".td-account") || []) {
      setText(root.querySelector?.(".td-account-status"), ACCOUNT_STATUS);
      setText(root.querySelector?.(".td-cloud-status"), CLOUD_STATUS);
      disable(root.querySelector?.("[data-auth]"), "Локальный режим");
      disable(root.querySelector?.("[data-cloud-save]"));
      disable(root.querySelector?.("[data-cloud-restore]"));
    }
    for (const button of document.querySelectorAll?.(".receipt-upload") || []) {
      disable(button, "Отправка фото отключена в закрытой бете");
    }
  }

  window.addEventListener?.("td:auth-requested", event => {
    event.stopImmediatePropagation?.();
    applyLocalOnlyUi();
  });
  window.addEventListener?.("td:account-opened", () => Promise.resolve().then(applyLocalOnlyUi));
  window.addEventListener?.("td:receipt-draft-saved", () => Promise.resolve().then(() => {
    applyLocalOnlyUi();
    const status = document.querySelector?.(".receipt-entry-status");
    if (status) {
      status.hidden = false;
      status.className = "receipt-entry-status ok";
      setText(status, RECEIPT_STATUS);
    }
  }));

  function startUiLock() {
    applyLocalOnlyUi();
    if (typeof MutationObserver !== "function" || !document?.documentElement) return;
    const observer = new MutationObserver(() => applyLocalOnlyUi());
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startUiLock, { once: true });
    else startUiLock();
  }
})(window.TD_RELEASE_SCOPE);

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
