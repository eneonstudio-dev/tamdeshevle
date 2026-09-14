# Votonobay — Security Gate F Evidence

**State:** CLOSED-BETA LOCAL-ONLY REMEDIATION IN REVIEW  
**Date:** 2026-09-15  
**Release scope:** closed-beta grocery/FMCG path

This file records evidence for `RELEASE_GATE.md` Gate F. It is fail-closed: Gate F is **not PASS** until the local-only release-scope change is merged and the actual release-head checks are green.

## Closed-beta privacy/legal scope decision

For closed beta, Votonobay chooses the conservative release-safe path from issue #448: **personal account/cloud/receipt-photo flows are out of release scope until a reviewed privacy/legal basis and user-facing notice exist**.

The browser release is therefore fail-closed to local-only personal data:
- `TD_RELEASE_SCOPE.personalDataMode` is `local-only`;
- `TD_SUPABASE` is `null`, so the personal-data Supabase auth/cloud client cannot initialize in the closed-beta browser runtime;
- exported auth/cloud methods are locked after `TDAuth` is created;
- account login, cloud save/restore and receipt-photo upload controls are disabled and explain that closed beta keeps data on the device;
- local basket/profile/history and local receipt drafts remain available;
- this does **not** claim that a consent checkbox alone would satisfy legal requirements. Re-enabling personal-data cloud flows requires a separate privacy/legal review and release decision.

Executable evidence: `scripts/test-closed-beta-local-only.mjs`, run by `.github/workflows/security-monitor.yml`.

## Findings and remediations

### Third-party analytics / user-data flow

Finding: the previous `yandex-metrika.js` loaded Yandex Metrika immediately and enabled Webvisor without an explicit Votonobay consent gate.

Remediation in merged PR #426:
- analytics is disabled by default;
- third-party analytics script is not loaded unless the persisted Votonobay analytics consent is explicitly granted;
- an explicit browser API exists for grant/revoke;
- closed beta can operate with analytics completely off.

Evidence:
- `scripts/test-security-hardening.mjs` guards the persisted consent gate and requires it to execute before third-party script creation;
- `scripts/test-gate-f-user-data.mjs` additionally guards explicit grant/revoke semantics.

### Zero-budget paid inference

Finding: `backend/bai-agent-core.ts` would call the configured external LLM whenever provider URL/key/model existed. There was no independent release kill switch protecting zero-budget mode.

Remediation in merged PR #426:
- external LLM inference is fail-closed unless server environment explicitly sets `BAI_LLM_PAID_ENABLED=true`;
- otherwise Agent Core returns `model_disabled_zero_budget` and falls back to deterministic rules;
- configured credentials alone are no longer enough to create provider usage.

Evidence: `scripts/test-security-hardening.mjs` requires the paid-provider flag before the provider fetch and requires the explicit disabled error path.

### Trained inference

`bai-trained-inference` remains fail-closed: it requires a promoted/bound release before resolving a private backend, checks exact release pinning, authenticates users, applies rate limits, requires HTTPS/token configuration and validates the backend response envelope.

### Account/cloud data participation

The backend wiring remains covered by regression tests for future use, but account/cloud participation is **disabled in the closed-beta browser release**. The release does not initialize the personal-data Supabase client and does not expose an enabled login/save/restore path.

When this optional capability is revisited, the existing backend guards still require authentication, own-row RLS, explicit save/restore actions, destructive-restore confirmation and an undo copy. Those controls do not replace the future privacy/legal review.

### Receipt evidence participation and privacy

Local receipt drafts remain enabled because they stay on the device and do not become rankable price truth merely by being drafted.

Receipt-photo cloud submission is **disabled for closed beta**. The private bucket, authenticated submission path, RLS and review pipeline remain implemented and regression-tested for future re-enablement, but they are not part of the closed-beta release scope until the privacy/legal review is complete.

## Repository / deployment evidence

- PR #426 is merged at `2e68e958fd1b82a3ec69460b1c00ce966256bbc6` and established the zero-budget/analytics fail-closed controls.
- PR #447 is merged at `42596d028cd10600f47e17b703cbbe155cedd0c0` and added executable Gate F user-data evidence plus expanded security-monitor coverage.
- Post-#447 security/runtime/data/governance/golden checks passed on the merged head.
- Deployed Supabase `bai-agent-core` was manually inspected on 2026-09-14 and contains the same zero-budget fail-closed paid-provider decision as the merged source.
- Active tested-path provider review found no required auth/CAPTCHA/anti-bot/ban bypass. Magnit collection uses public retailer pages and remains bounded by `SOURCE_PROVIDER_REGISTRY.md`; generic AI/search scouts stay discovery-only and cannot become price/store truth.
- Repository security checks cover CSP/SRI, DOM escaping, safe retailer URLs, atomic server-side rate limiting, secret-like value scanning and pinned GitHub Actions.

## Security-monitor coverage

The security monitor now runs on the security-sensitive account/auth/receipt/config/provider paths and executes:
- `scripts/test-security-hardening.mjs`;
- `scripts/test-gate-f-user-data.mjs`;
- `scripts/test-closed-beta-local-only.mjs`;
- `scripts/test-production-security.mjs`.

## Remaining before PASS

- [ ] Merge the closed-beta local-only personal-data policy after PR CI is green.
- [ ] Verify the post-merge security/runtime/data/governance/golden checks on the actual merged head.
- [ ] Record Gate F PASS for the closed-beta **local-only** scope and resolve issue #448 as completed by scope reduction, not by claiming a legal review occurred.

Public release or any re-enablement of account/cloud/receipt-photo processing remains separately blocked on privacy/legal review. This file is release evidence, not legal advice.
