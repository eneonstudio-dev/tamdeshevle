# Votonobay — Security Gate F Evidence

**State:** IN PROGRESS  
**Date:** 2026-09-14  
**Release scope:** closed-beta grocery/FMCG path

This file records evidence for `RELEASE_GATE.md` Gate F. It is fail-closed: Gate F remains open until repository checks, live production probes and deployed Edge Function parity are all verified on the release candidate.

## Findings and remediations

### Third-party analytics / user-data flow

Finding: the previous `yandex-metrika.js` loaded Yandex Metrika immediately and enabled Webvisor without an explicit Votonobay consent gate.

Remediation in PR #426:
- analytics is disabled by default;
- third-party analytics script is not loaded unless `td:analytics-consent` is explicitly `granted`;
- an explicit browser API exists for grant/revoke;
- closed beta can operate with analytics completely off.

Evidence: `scripts/test-security-hardening.mjs` requires the consent guard to execute before third-party script creation.

### Zero-budget paid inference

Finding: `backend/bai-agent-core.ts` would call the configured external LLM whenever provider URL/key/model existed. There was no independent release kill switch protecting zero-budget mode.

Remediation in PR #426:
- external LLM inference is fail-closed unless server environment explicitly sets `BAI_LLM_PAID_ENABLED=true`;
- otherwise Agent Core returns `model_disabled_zero_budget` and falls back to deterministic rules;
- configured credentials alone are no longer enough to create provider usage.

Evidence: `scripts/test-security-hardening.mjs` requires the paid-provider flag before the provider fetch and requires the explicit disabled error path.

### Trained inference

`bai-trained-inference` remains fail-closed: it requires a promoted/bound release before resolving a private backend, checks exact release pinning, authenticates users, applies rate limits, requires HTTPS/token configuration and validates the backend response envelope.

## Existing repository security evidence

- CSP blocks object content and base-tag injection.
- External browser libraries are version-pinned and protected with SRI where applicable.
- User-controlled DOM values are escaped and retailer URLs use safe-scheme filtering with `noopener noreferrer`.
- Agent Core request reservation uses an atomic database rate limiter.
- Secret-like private credential patterns are scanned across tracked source/config files.
- GitHub Actions dependencies are pinned to commit SHAs.
- Production security probes require unauthenticated protected Edge Function requests to fail with small non-leaky 401/403 responses.

## Remaining before PASS

- [ ] PR #426 security monitor is green after both remediations.
- [ ] Normal golden/runtime/data/governance/browser suites remain green.
- [ ] Merge #426 to `main` and verify the post-merge security run.
- [ ] Verify the deployed `bai-agent-core` matches the zero-budget fail-closed source, not only the repository copy.
- [ ] Verify active release-path provider/source usage remains inside `SOURCE_PROVIDER_REGISTRY.md` and requires no protection/ban bypass.
- [ ] Confirm the closed-beta user-data path is explicit and appropriate for participation; analytics remains off unless explicitly opted in.

Gate F may be marked PASS only after these items have evidence. This file does not itself approve release.
