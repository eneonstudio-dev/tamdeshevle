# Votonobay — Security Gate F Evidence

**State:** PASS — CLOSED-BETA LOCAL-ONLY SCOPE  
**Date:** 2026-09-15  
**Release scope:** closed-beta grocery/FMCG path with personal account/cloud/receipt-photo processing disabled

This file records evidence for `RELEASE_GATE.md` Gate F. The PASS applies only to the tested **closed-beta local-only** scope described below. It does not approve public release or re-enable account/cloud/receipt-photo processing.

## Closed-beta privacy/legal scope decision

For closed beta, Votonobay takes the conservative path from issue #448: **personal account/cloud/receipt-photo flows are out of release scope until a separate privacy/legal review approves them**.

Merged PR #454 (`5893599c2a6c35a87552d0d2fc6d4da66a06cff5`) enforces that boundary:
- `TD_RELEASE_SCOPE.personalDataMode` is `local-only`;
- `TD_SUPABASE` is `null`, so the personal-data Supabase auth/cloud client cannot initialize in the closed-beta browser runtime;
- exported auth/cloud/receipt functions are locked after `TDAuth` is created;
- account login, cloud save/restore and receipt-photo upload controls are disabled and visibly explain the local-only scope;
- local basket/profile/history and local receipt drafts remain available;
- the per-action disclosure UI remains in the repository as a future re-enable safety layer, but it is **not treated as a substitute for privacy/legal review**.

Executable evidence: `scripts/test-closed-beta-local-only.mjs` plus real-browser `scripts/test-gate-f-local-only.py`, including an Android-sized viewport.

## Gate F criteria and evidence

### Security P0 clear for the tested path

No unresolved P0/P1 security regression is known on the tested closed-beta path. Repository security checks cover CSP/SRI, DOM escaping, safe retailer URLs, atomic server-side rate limiting, secret-like value scanning and pinned GitHub Actions.

### Secrets / private credentials

Client-side release configuration does not expose private provider credentials. Model provider credentials remain server-side. Personal-data Supabase browser configuration is disabled entirely in the closed-beta local-only scope.

### Provider/source use

Active tested-path provider review found no required auth/CAPTCHA/anti-bot/ban bypass. Magnit collection uses public retailer pages and remains bounded by `SOURCE_PROVIDER_REGISTRY.md`; generic AI/search scouts stay discovery-only and cannot become price/store truth.

### Zero-budget cost control

Merged PR #426 established the explicit `BAI_LLM_PAID_ENABLED=true` server-side kill switch. Configured external LLM credentials alone cannot create paid usage; otherwise Agent Core returns `model_disabled_zero_budget` and falls back to deterministic rules.

### User-data participation

Third-party analytics is opt-in and disabled by default. For closed beta, higher-risk personal account/cloud/receipt-photo processing is removed from release scope altogether and fails closed to device-local behavior. Re-enabling those flows requires a separate privacy/legal review.

## Trained inference

`bai-trained-inference` remains fail-closed: it requires a promoted/bound release before resolving a private backend, checks exact release pinning, authenticates users, applies rate limits, requires HTTPS/token configuration and validates the backend response envelope. No trained checkpoint is promoted by this Gate F decision.

## Merged-head verification

PR #454 merged to `main` at `5893599c2a6c35a87552d0d2fc6d4da66a06cff5`. Release-relevant push checks on that exact merged head completed successfully:

- Continuous security monitoring — run `34900001701` — **success**.
- Validate UX in real browser — run `34900001694` — **success**; includes the closed-beta local-only desktop + Android-sized browser proof.
- Validate app runtime resilience — run `34900001755` — **success**.
- Validate data and scripts — run `34900001805` — **success**.
- Master governance gate — run `34900001822` — **success**.
- Validate golden shopping core — run `34900001886` — **success**.
- Validate Bai assistant — run `34900001696` — **success**.
- Validate Bai trained serving — run `34900001632` — **success**.

The local-only boundary therefore survived merged-state security, browser, runtime, data, governance and canonical shopping validation.

## Security-monitor coverage

The security monitor runs on security-sensitive account/auth/receipt/config/provider paths and executes:
- `scripts/test-security-hardening.mjs`;
- `scripts/test-gate-f-user-data.mjs`;
- `scripts/test-closed-beta-local-only.mjs`;
- `scripts/test-production-security.mjs`.

Real-browser UX additionally proves that local-only controls stay disabled and understandable on desktop and an Android-sized viewport while device-local receipt drafts still work.

## Decision

**Gate F: PASS for the closed-beta local-only scope.**

This PASS is achieved by a release-scope reduction, not by claiming a privacy/legal review occurred. Public release, or any re-enablement of account/cloud/receipt-photo processing, remains separately blocked on privacy/legal review. This file is release evidence, not legal advice.
