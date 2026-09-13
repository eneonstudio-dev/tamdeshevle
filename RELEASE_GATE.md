# Votonobay — Release Gate

Use this as a fail-closed checklist for closed beta and public release. A checked box requires evidence (test, PR, run, or manual verification), not confidence.

## Gate A — Core shopping loop
- [ ] Natural grocery request becomes correct ShoppingIntent.
- [ ] Follow-ups change only the named dimension unless the user explicitly rebuilds.
- [ ] UniversalBasket persists correctly across retailer comparisons.
- [ ] Add/remove/replace/rebuild operations pass deterministic validation.
- [ ] Bay cannot execute out-of-scope/general-assistant actions.

## Gate B — Product/data truth
- [ ] Candidate products have acceptable identity/matching evidence.
- [ ] Rankable prices have source, scope/store/channel where required, timestamp and confidence/proof.
- [ ] Missing/ambiguous data is never treated as zero or verified.
- [ ] Stock claims are separated from price/product identity claims.
- [ ] Non-equivalent substitutions cannot win only on price.

## Gate C — Purchase strategy
- [ ] Best feasible single-store baseline is correct.
- [ ] PurchasePlan accounts for verified delivery/service costs and minimum-order feasibility where known.
- [ ] Default multi-store plan uses at most 2 stores.
- [ ] Net savings are measured against the same basket/constraints.
- [ ] Hard constraints dominate soft preferences.
- [ ] Bay explains trade-offs and uncertainty.

## Gate D — Handoff
- [ ] Every enabled retailer has a declared capability in `RETAILER_CAPABILITIES.md`.
- [ ] UI never promises API_CART/API_ORDER/deep cart transfer when only redirect/compare exists.
- [ ] Handoff target is usable and retailer identity is clear.

## Gate E — Reliability / UX
- [ ] Primary loop passes on mobile viewport.
- [ ] Loading, empty, offline and error states recover safely.
- [ ] Refresh/back/return does not silently corrupt basket state.
- [ ] No P0/P1 known regression remains open for the release path.
- [ ] Relevant regression bank cases pass.

## Gate F — Security / legal / cost
- [ ] Reinhard security review has no unresolved P0 release blocker.
- [ ] No secrets/private credentials are exposed client-side or committed.
- [ ] Provider/source use matches `SOURCE_PROVIDER_REGISTRY.md`.
- [ ] No protection/auth/anti-bot/ban bypass is required for the release path.
- [ ] Zero-budget mode cannot silently create paid provider usage.
- [ ] User-data flows used by release have explicit lawful participation/consent where required.

## Gate G — Brand / launch hygiene
- [ ] Final Votonobay/VOTONOBAI spelling approved.
- [ ] Trademark/existing-brand/domain/social checks completed before public brand lock.
- [ ] Legacy `tamdeshevle` public URL replaced or intentionally accepted for closed testing only.
- [ ] Public copy does not imply official retailer partnership without one.

## Decision

**Closed beta:** Gates A–F must pass for the tested path; Gate G may retain the legacy technical URL if clearly treated as closed testing.

**Public launch:** Gates A–G must pass.

Release owner records evidence and date here or in `PROJECT_STATUS.md`. No agent may mark release-ready by intuition alone.
