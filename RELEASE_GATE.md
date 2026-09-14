# Votonobay — Release Gate

Use this as a fail-closed checklist for closed beta and public release. A checked box requires evidence (test, PR, run, or manual verification), not confidence.

The current checked A–F decision applies only to the grocery/FMCG **closed-beta local-only** scope documented in `CLOSED_BETA_RELEASE_EVIDENCE.md` and `SECURITY_GATE_F.md`. Gate G remains separate and open.

## Gate A — Core shopping loop
- [x] Natural grocery request becomes correct ShoppingIntent. Evidence: `MVP_ACCEPTANCE_MATRIX.md` MVP-001/004/011/012/019/020 + golden shopping core.
- [x] Follow-ups change only the named dimension unless the user explicitly rebuilds. Evidence: MVP-002/003/015/021/022/023/024 regressions.
- [x] UniversalBasket persists correctly across retailer comparisons. Evidence: MVP-015 / `REG-030`.
- [x] Add/remove/replace/rebuild operations pass deterministic validation. Evidence: golden shopping core and shopping-state consistency tests.
- [x] Bay cannot execute out-of-scope/general-assistant actions. Evidence: `scripts/test-bai-domain-gate-boundary.mjs` / PR #411.

## Gate B — Product/data truth
- [x] Candidate products have acceptable identity/matching evidence. Evidence: matcher/identity contracts and MVP-010.
- [x] Rankable prices have source, scope/store/channel where required, timestamp and confidence/proof. Evidence: `SOURCE_PROVIDER_REGISTRY.md`, truth/data-quality regressions.
- [x] Missing/ambiguous data is never treated as zero or verified. Evidence: MVP-009 / `REG-001`.
- [x] Stock claims are separated from price/product identity claims. Evidence: `REG-015`, `REG-034` and receipt/overlay tests.
- [x] Non-equivalent substitutions cannot win only on price. Evidence: MVP-010 / `scripts/test-sku-matcher.mjs`.

## Gate C — Purchase strategy
- [x] Best feasible single-store baseline is correct. Evidence: MVP-005 / `scripts/test-one-store-choice.mjs`.
- [x] PurchasePlan accounts for verified delivery/service costs and minimum-order feasibility where known. Evidence: MVP-006/007/008/026 and comparison/split tests.
- [x] Default multi-store plan uses at most 2 stores. Evidence: MVP-006 and `REG-004`/`REG-011`.
- [x] Net savings are measured against the same basket/constraints. Evidence: MVP-006/007/008 and `REG-030`.
- [x] Hard constraints dominate soft preferences. Evidence: MVP-004/011/012/023/024 and guarded optimizer/state contracts.
- [x] Bay explains trade-offs and uncertainty. Evidence: MVP-030 / `REG-018` and uncertainty truth guards.

## Gate D — Handoff
- [x] Every enabled retailer has a declared capability in `RETAILER_CAPABILITIES.md`. Evidence: capability matrix + Sara 2 release acceptance.
- [x] UI never promises API_CART/API_ORDER/deep cart transfer when only redirect/compare exists. Evidence: `REDIRECT`/`COMPARE_ONLY` matrix and handoff regression coverage.
- [x] Handoff target is usable and retailer identity is clear. Evidence: `scripts/test-retailer-handoff-gate.py` and real-browser handoff QA.

## Gate E — Reliability / UX
- [x] Primary loop passes on mobile viewport. Evidence: real-browser UX + mobile composer/long-name/cold-start guards.
- [x] Loading, empty, offline and error states recover safely. Evidence: runtime resilience and network recovery tests.
- [x] Refresh/back/return does not silently corrupt basket state. Evidence: `scripts/test-roxy-return-continuity.py` / PR #375.
- [x] No P0/P1 known regression remains open for the release path. Evidence: `REGRESSION_BANK.md` — current P0/P1 entries are `GUARDED`.
- [x] Relevant regression bank cases pass. Evidence: normal repository CI and final release replay contract.

## Gate F — Security / legal / cost
- [x] Security review has no unresolved P0 release blocker for the tested closed-beta scope. Evidence: `SECURITY_GATE_F.md` scoped PASS; PR #454 merged-state security/browser checks.
- [x] No secrets/private credentials are exposed client-side or committed. Evidence: security hardening monitor; provider/model credentials remain server-side.
- [x] Provider/source use matches `SOURCE_PROVIDER_REGISTRY.md`. Evidence: registry contracts and Gate F provider review.
- [x] No protection/auth/anti-bot/ban bypass is required for the release path. Evidence: Gate F source/provider review and public bounded collector policy.
- [x] Zero-budget mode cannot silently create paid provider usage. Evidence: PR #426 `BAI_LLM_PAID_ENABLED=true` kill switch + security regression.
- [x] User-data flows used by release have explicit lawful participation/consent where required. Evidence: closed beta removes personal account/cloud/receipt-photo processing from release scope; analytics remains explicit opt-in. Re-enable/public path requires separate privacy/legal review.

## Gate G — Brand / launch hygiene
- [ ] Final Votonobay/VOTONOBAI spelling approved.
- [ ] Trademark/existing-brand/domain/social checks completed before public brand lock.
- [ ] Legacy `tamdeshevle` public URL replaced or intentionally accepted for closed testing only.
- [ ] Public copy does not imply official retailer partnership without one.

## Decision

**Closed beta:** Gates A–F are evidenced for the tested local-only grocery/FMCG path, subject to the final release-replay PR and post-merge head verification recorded in `CLOSED_BETA_RELEASE_EVIDENCE.md`.

**Public launch:** NOT approved. Gate G remains open, and personal account/cloud/receipt-photo processing cannot be re-enabled without separate privacy/legal review.

Release owner records evidence and date here or in `PROJECT_STATUS.md`. No agent may mark release-ready by intuition alone.