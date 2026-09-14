# Votonobay — PROJECT STATUS

**Updated:** 2026-09-14  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — final acceptance and release-gate proof

Fresh-read `main` before trusting commit/PR status because the repository moves quickly.

## Mission now

Prove repeatedly:

`natural shopping request → correct intent/constraints → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest purchase handoff`

## Current critical work

| Priority | Work | Owner role | State | Evidence / blocker |
|---|---|---|---|---|
| P1 | Canonical ShoppingIntent / basket action correctness | Роук + Fixer | DONE / GUARDED FOR DISCOVERED P1s | The acceptance push now guards retailer scope/one-store/multi-store (#370), MVP-002 (#417), MVP-003 (#409), MVP-004 (#423), MVP-011 (#421), MVP-012 (#416), MVP-015 (#419), MVP-021 (#393), MVP-022 (#397), MVP-023 (#399), MVP-024 (#406), MVP-029 (#388) and MVP-030 (#390). New failures are recorded in `REGRESSION_BANK.md`; do not reopen these paths without a reproduction. |
| P1 | UniversalBasket → StoreBasket → PurchasePlan acceptance proof | Роук/Fixer temporarily; Vi when available | FINAL MATRIX / REPLAY | MVP-015 now proves same-basket retailer reprojection including exact quantity preservation. One/two-store economics and retailer scope are guarded. Remaining task is evidence mapping/replay across all 30 canonical scenarios, not architecture rewrite. |
| P1 | Multi-Store PurchasePlan economics | Fixer / QA | GUARDED | `REG-004`, `REG-011`, `REG-013`, tie-break `REG-017` and decision explanation `REG-018` are guarded. Default remains max 2 stores. |
| P1 | Product/data truth for tested path | Tali / data-truth | GUARDED CORE / SOURCE COVERAGE IN PROGRESS | Missing/stale/future evidence fails closed (#372); promo eligibility (#386), exact-store out-of-stock (#384), Magnit loyalty/base-price (#404) and pack identity (#398) are guarded. Magnit remains conditional exact-store evidence; Perekrestok/Proshoper regional catalogs remain non-rankable estimates. |
| P1 | Honest retailer handoff | Роук / Sara 2 / Tali | VERIFIED FOR TESTED PATH | `RETAILER_CAPABILITIES.md` remains authoritative; repeated real-browser runs including #419/#423 passed `Validate retailer handoff Gate D`. REDIRECT retailers are not represented as API_CART/API_ORDER. |
| P1 | Reliability / mobile / return / post-purchase proof | Fixer / Sara 2 / Tali | GUARDED FOR TESTED PATH | Network recovery #374, return continuity #375, post-purchase truth #378/#380, mobile composer #371 and long product names #400 pass repeated real-browser validation. |
| P0 | Security release gate (Gate F) | Reinhard | REQUIRED BEFORE CLOSED BETA | `RELEASE_GATE.md` Gate F remains the main closed-beta blocker after acceptance convergence. No release-ready claim until security review has no unresolved P0 blocker and provider/legal/cost checks pass. |
| P0/P1 | Corrected re-evaluation of first trained Bay candidate | Умняша Бая | IN PROGRESS / EXTERNAL GPU DEPENDENCY | PRs #359/#365/#366 provide the corrected SFT/eval comparison path. Re-evaluate the existing adapter before any second training run. This is parallel to deterministic MVP acceptance; no trained release is active. |
| P1 | Post-PASS trained checkpoint serving path | Умняша Бая | DONE / DISABLED BY DEFAULT | PR #362 + ADR-007 provide staged fail-closed serving. No checkpoint is promoted/bound until corrected promotion proof passes. |

## Acceptance campaign status

The recent campaign has moved the project from broad implementation into evidence-driven release hardening. Every material failure found was reproduced first, then fixed with executable coverage. Newly guarded canonical regressions include:

- `REG-027` — MVP-003 chicken → turkey replacement, PR #409.
- `REG-028` — MVP-002 dairy category removal, PR #417.
- `REG-029` — MVP-012 convenience-over-minor-savings intent, PR #416.
- `REG-030` — MVP-015 same UniversalBasket retailer reprojection with exact quantities, PR #419.
- `REG-031` — MVP-011 PP + no-sugar dietary intent, PR #421.
- `REG-032` — MVP-004 qualitative savings stays soft; meat quality remains a competing preference; explicit relative savings remain relative, PR #423.
- `REG-026` / MVP-024 brand relaxation is now GUARDED by merged PR #406 and repeated golden-core passes.

The next acceptance action is a scenario-to-test matrix for MVP-001…030 and one final replay. A scenario without executable proof should be reproduced before any fix; a scenario already guarded should not be rewritten for style.

## Swarm coordination now

- **Роук/Fixer:** finish the 001–030 evidence matrix and final replay; only reproduced P0/P1 gaps become code work.
- **Vi:** may resume architecture ownership when available, but no current acceptance blocker should wait for Vi.
- **Тали:** continue useful rankable source/truth coverage and exact-store evidence quality; do not inflate retailer count with non-rankable discovery sources.
- **Сара 2:** critical mobile/handoff UX is already guarded; no redesign unless acceptance finds a blocker.
- **Рейнхард:** Gate F is now the key closed-beta release review once A–E evidence is consolidated.
- **Умняша Бая:** corrected external-GPU re-evaluation only; no second training run before that verdict.
- **Карина/Ghost:** prepare beta/outreach around capabilities that actually exist; do not imply retailer partnerships or cart APIs that are not present.

## Current known repo snapshot

Fresh `main` at this status sync: `90df2e86181fed5ced7f5da2b36007c44581d70f` (merged PR #423).

Important current facts:
- PR #423 is merged after green golden shopping core, Bai assistant, runtime, data/scripts, governance and real-browser validation.
- PR #419 same-basket reprojection and PR #421 PP/no-sugar are merged and guarded.
- Real-browser release path repeatedly passes purchase handoff, explicit Gate D, mobile, reconnect, return continuity, purchase-proof truth and catalog-hint checks.
- `REG-001`…`REG-032` contain no known OPEN P0/P1 entry after this sync; this does **not** replace the final 001–030 evidence replay or Gate F.
- The delivery bottleneck is now: canonical acceptance evidence matrix/final replay → Gate F security/legal/cost → closed-beta decision.
- Corrected trained-Bay re-evaluation remains a separate external-GPU dependency; the deterministic runtime remains the release-safe fallback.

## Bay training evidence

- First real Kaggle T4 run completed on 2026-09-13 from repository commit `865def7a98aa6b645b1950cfcd4ec9ffc37320ca`, pinned Qwen3 revision `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`, deterministic bootstrap 500 train / 60 disjoint holdout, seed 42, thinking disabled.
- Training completed 3 epochs / 48 steps in 747.6 seconds; final reported train loss was `0.2296814`. The experiment ZIP and promotion artifacts are saved in Kaggle notebook `eneonstii/notebook07f42bd563`, Version 1.
- Historical promotion gate verdict: **REJECTED**. Candidate metrics were intent `0.4833`, constraints `0.5`, actions `0.1`, context retention `0.28`; only 36/60 candidate responses parsed.
- PR #356 later identified a material evaluation defect: SFT and evaluation used different system/input prompt contracts. Therefore the historical rejection is evidence for the old harness, but not sufficient justification to retrain before corrected re-evaluation of the same adapter.
- PR #359 added corrected-contract re-evaluation and failure clustering. PR #360 added leak-safe failure learning. PR #365 added fail-closed frozen-holdout comparisons. PR #366 wired comparison into the corrected Kaggle re-evaluation path.
- PR #362 / ADR-007 added the post-PASS serving path. Supabase `bai-trained-inference` infrastructure is deployed but intentionally fail-closed; there is no promoted release pin or bound private GPU backend.
- If corrected re-evaluation still fails, cluster failures, review train-side remediation siblings, and only approved Gold may feed iteration 2.

## Rules for agents

- Read `VOTONOBAI_MASTER_ROADMAP.md` and fresh `main` before work.
- Never work blind from chat memory.
- Do not silently change strategy/scope.
- P0/P1 bugs in the active path are reproduced, fixed and tested, not merely reported.
- Mark DONE only under the MASTER Definition of Done.
- Update this status only when a material blocker/state changes.

## Immediate definition of success

The MVP is ready for closed-beta consideration when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions, the canonical acceptance replay is green, and Gates A–F have evidence with no unresolved P0/P1 release blocker.
