# Votonobay — Release Gate

Use this as a fail-closed checklist for closed beta and public release. A checked box requires evidence (test, PR, run, or manual verification), not confidence.

## Gate A — Core shopping loop
- [x] Natural grocery request becomes correct ShoppingIntent.
- [x] Follow-ups change only the named dimension unless the user explicitly rebuilds.
- [x] UniversalBasket persists correctly across retailer comparisons.
- [x] Add/remove/replace/rebuild operations pass deterministic validation.
- [x] Bay cannot execute out-of-scope/general-assistant actions.

## Gate B — Product/data truth
- [x] Candidate products have acceptable identity/matching evidence.
- [x] Rankable prices have source, scope/store/channel where required, timestamp and confidence/proof.
- [x] Missing/ambiguous data is never treated as zero or verified.
- [x] Stock claims are separated from price/product identity claims.
- [x] Non-equivalent substitutions cannot win only on price.

## Gate C — Purchase strategy
- [x] Best feasible single-store baseline is correct.
- [x] PurchasePlan accounts for verified delivery/service costs and minimum-order feasibility where known.
- [x] Default multi-store plan uses at most 2 stores.
- [x] Net savings are measured against the same basket/constraints.
- [x] Hard constraints dominate soft preferences.
- [x] Bay explains trade-offs and uncertainty.

## Gate D — Handoff
- [x] Every enabled retailer has a declared capability in `RETAILER_CAPABILITIES.md`.
- [x] UI never promises API_CART/API_ORDER/deep cart transfer when only redirect/compare exists.
- [x] Handoff target is usable and retailer identity is clear.

## Gate E — Reliability / UX
- [x] Primary loop passes on mobile viewport.
- [x] Loading, empty, offline and error states recover safely.
- [x] Refresh/back/return does not silently corrupt basket state.
- [x] No P0/P1 known regression remains open for the release path.
- [x] Relevant regression bank cases pass.

## Gate F — Security / legal / cost
- [x] Reinhard security review has no unresolved P0 release blocker.
- [x] No secrets/private credentials are exposed client-side or committed.
- [x] Provider/source use matches `SOURCE_PROVIDER_REGISTRY.md`.
- [x] No protection/auth/anti-bot/ban bypass is required for the release path.
- [x] Zero-budget mode cannot silently create paid provider usage.
- [x] User-data flows used by release have explicit lawful participation/consent where required.

## Gate G — Brand / launch hygiene
- [ ] Final Votonobay/VOTONOBAI spelling approved.
- [ ] Trademark/existing-brand/domain/social checks completed before public brand lock.
- [ ] Legacy `tamdeshevle` public URL replaced or intentionally accepted for closed testing only.
- [ ] Public copy does not imply official retailer partnership without one.

## Decision

**Closed beta:** PASS for the tested **local-only** scope on 2026-09-16. Gates A–F are supported by the merged canonical 001–030 acceptance matrix, Gate F local-only controls, merged owner-loop regression #486, merged exact-store Magnit scope fix #491, and the fresh-main evidence-only replay #493.

Fresh-main replay base: `efd5363c7e9f8f3fc97607fd5fda5dbdb456b196`.

Replay #493 head `d9510939c2d23ef2050fa37dd22c0a414dd68afd` completed GREEN:
- Validate golden shopping core — run `35037223292`;
- Continuous security monitoring — run `35037223363`;
- Validate app runtime resilience — run `35037223396`;
- Validate data and scripts — run `35037223419`;
- Master governance gate — run `35037223293`;
- Validate UX in real browser — run `35037223310`.

Owner shopping loop evidence: PR #486 merged at `de51240cf1ba96d2e98d2c400b33593e93b2bedd`, guarding the physical mobile sequence `собери мне еду на ужин на 100 рублей → привет → собери мне корзину на 7000 рублей → Магнитом → да`. Acceptance is state/action based: basket persistence, real StoreBasket/PurchasePlan retailer reprojection, budget discipline, and fail-closed final confirmation with no fabricated order/API capability.

Scope limits remain binding: this is not public-launch approval. Personal account/cloud/receipt-photo processing remains disabled for closed beta unless separately reviewed; Gate G is still open; retailer capabilities remain limited by `RETAILER_CAPABILITIES.md`; no automatic order/cart capability may be implied where only redirect/compare exists.

**Public launch:** NOT YET APPROVED. Gates A–G must pass.

Release owner records evidence and date here or in `PROJECT_STATUS.md`. No agent may mark release-ready by intuition alone.
