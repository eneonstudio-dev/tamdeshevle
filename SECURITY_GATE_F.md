# Votonobay — Security Gate F Evidence

**State:** TECHNICAL EVIDENCE READY / LEGAL SIGNOFF PENDING  
**Date:** 2026-09-14  
**Release scope:** closed-beta grocery/FMCG path

This file records evidence for `RELEASE_GATE.md` Gate F. It is fail-closed: Gate F is **not PASS** until the release-head checks are green and the remaining user-data/legal participation item is explicitly resolved for the closed-beta scope.

## Findings and remediations

### Third-party analytics / user-data flow

Finding: the previous `yandex-metrika.js` loaded Yandex Metrika immediately and enabled Webvisor without an explicit Votonobay consent gate.

Remediation in merged PR #426:
- analytics is disabled by default;
- third-party analytics script is not loaded unless `td:analytics-consent` is explicitly `granted`;
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

Current closed-beta account/cloud behavior is user initiated and authenticated:
- cloud operations fail closed with `SIGN_IN_REQUIRED` when no authenticated user exists;
- save/restore are explicit account UI actions;
- cloud restore asks for confirmation before replacing local basket/profile/address/history data;
- an undo copy is written before local replacement;
- account tables use own-row RLS policies bound to `auth.uid()`.

Evidence: `auth-client.js`, `account-auth-ui.js`, `supabase/migrations/20260910_optimize_auth_rls_policies.sql`, guarded by `scripts/test-gate-f-user-data.mjs`.

### Receipt evidence participation and privacy

Receipt evidence is not silently uploaded:
- receipt entry first saves a local draft;
- photo submission is a separate explicit `Отправить фото на проверку` action;
- submission is routed through authenticated `cloudOperation` and the proof path is scoped under the authenticated user id;
- the `receipt-proofs` bucket is private with MIME/size limits;
- receipt submissions have RLS and own-user insert/read/delete policies;
- pending receipt evidence does not become rankable price truth before review.

Evidence: `receipt-entry-ui.js`, `auth-client.js`, `supabase/migrations/20260910_receipt_submissions.sql`, guarded by `scripts/test-gate-f-user-data.mjs`.

## Repository / deployment evidence

- PR #426 is merged at `2e68e958fd1b82a3ec69460b1c00ce966256bbc6`.
- Post-merge GitHub Actions security monitor run `34879270356` completed successfully; runtime, data/scripts, governance and browser checks on the same merge commit also completed successfully.
- Deployed Supabase `bai-agent-core` was manually inspected on 2026-09-14 and contains the same zero-budget fail-closed paid-provider decision as the merged source.
- Active tested-path provider review found no required auth/CAPTCHA/anti-bot/ban bypass. Magnit collection uses public retailer pages and remains bounded by `SOURCE_PROVIDER_REGISTRY.md`; generic AI/search scouts stay discovery-only and cannot become price/store truth.
- Repository security checks cover CSP/SRI, DOM escaping, safe retailer URLs, atomic server-side rate limiting, secret-like value scanning and pinned GitHub Actions.

## Security-monitor coverage hardening

The security monitor previously ran on schedule and when its own test/workflow files changed, but security-sensitive product files could change without triggering the workflow immediately.

This evidence change closes that CI gap:
- the monitor now triggers on auth, analytics, receipt, Agent Core, trained inference, relevant migrations/provider registry and the source files already read by the hardening test;
- it runs `scripts/test-gate-f-user-data.mjs` in addition to the existing hardening and production probes.

## Remaining before PASS

- [ ] The Gate-F evidence PR containing `test-gate-f-user-data.mjs` and expanded security-monitor paths is green and merged; verify the post-merge release-head security run.
- [ ] Resolve the legal participation/privacy-notice question for enabled closed-beta user-data flows. Repository audit found technical opt-in/user-initiation and access controls, but did not find a user-facing privacy notice covering account/cloud/receipt processing. Either provide an appropriate reviewed notice/legal basis for the enabled scope or explicitly disable those optional user-data flows from closed beta until that review is complete.
- [ ] Final release owner records the Gate F decision against the actual closed-beta release head with no unresolved P0 security blocker.

Until those items are resolved, Gate F remains **OPEN**. Technical controls are evidenced; this file does not provide legal advice or approve release by itself.
