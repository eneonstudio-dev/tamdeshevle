# Votonobay — PROJECT STATUS

**Updated:** 2026-09-14  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — release-gate proof after canonical acceptance convergence

Fresh-read `main` before trusting commit/PR status because the repository moves quickly.

## Mission now

Prove repeatedly:

`natural shopping request → correct intent/constraints → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest purchase handoff`

## Current critical work

| Priority | Work | Owner role | State | Evidence / blocker |
|---|---|---|---|---|
| P1 | Canonical ShoppingIntent / basket action correctness | Роук + Fixer | DONE / GUARDED FOR DISCOVERED P1s | The acceptance push guards retailer scope/one-store/multi-store (#370), MVP-002 (#417), MVP-003 (#409), MVP-004 (#423), MVP-011 (#421), MVP-012 (#416), MVP-015 (#419), MVP-021 (#393), MVP-022 (#397), MVP-023 (#399), MVP-024 (#406), MVP-029 (#388) and MVP-030 (#390). MVP-001 now has direct real-brain/optimizer acceptance in #424. New failures must be reproduced before new code work. |
| P1 | UniversalBasket → StoreBasket → PurchasePlan acceptance proof | Роук/Fixer temporarily; Vi when available | 30/30 MATRIX GUARDED / FINAL REPLAY EVIDENCE CONSOLIDATED | `MVP_ACCEPTANCE_MATRIX.md` maps every canonical scenario to executable evidence. MVP-015 proves same-basket retailer reprojection including exact quantity preservation. Fresh-main #424 push checks are green; the latest behavior-changing #423 also passed full real-browser validation. |
| P1 | Multi-Store PurchasePlan economics | Fixer / QA | GUARDED | `REG-004`, `REG-011`, `REG-013`, tie-break `REG-017` and decision explanation `REG-018` are guarded. Default remains max 2 stores. |
| P1 | Product/data truth for tested path | Tali / data-truth | GUARDED CORE / SOURCE COVERAGE IN PROGRESS | Missing/stale/future evidence fails closed (#372); promo eligibility (#386), exact-store out-of-stock (#384), Magnit loyalty/base-price (#404), pack identity (#398), regional estimate non-rankability and freshness contracts are executable. Magnit remains conditional exact-store evidence; Perekrestok/Proshoper regional catalogs remain non-rankable estimates. |
| P1 | Honest retailer handoff | Роук / Sara 2 / Tali | VERIFIED FOR TESTED PATH | `RETAILER_CAPABILITIES.md` remains authoritative; repeated real-browser runs including #419/#423 passed explicit Gate D. REDIRECT retailers are not represented as API_CART/API_ORDER. |
| P1 | Reliability / mobile / return / post-purchase proof | Fixer / Sara 2 / Tali | GUARDED FOR TESTED PATH | Network recovery #374, return continuity #375, post-purchase truth #378/#380, mobile composer #371 and long product names #400 pass repeated real-browser validation. |
| P0 | Security release gate (Gate F) | Reinhard | REQUIRED BEFORE CLOSED BETA | **Primary remaining closed-beta blocker.** `RELEASE_GATE.md` Gate F requires security P0 clear, dependency/secret/auth/runtime review, provider/source legal review and zero-budget cost verification. Existing security tests are evidence, not a substitute for the explicit Gate F decision. |
| P0/P1 | Corrected re-evaluation of first trained Bay candidate | Умняша Бая | IN PROGRESS / EXTERNAL GPU DEPENDENCY | PRs #359/#365/#366 provide the corrected SFT/eval comparison path. Re-evaluate the existing adapter before any second training run. This remains parallel to deterministic MVP release safety; no trained release is active. |
| P1 | Post-PASS trained checkpoint serving path | Умняша Бая | DONE / DISABLED BY DEFAULT | PR #362 + ADR-007 provide staged fail-closed serving. No checkpoint is promoted/bound until corrected promotion proof passes. |

## Acceptance campaign status

The canonical 001–030 campaign has converged to executable evidence. `MVP_ACCEPTANCE_MATRIX.md` is the release index; the matrix includes direct evidence for intent/state, truth/matching, optimizer economics, persistence/recovery, vertical/domain boundaries, retailer handoff and explanation.

Recently added guarded regressions:

- `REG-027` — MVP-003 chicken → turkey replacement, PR #409.
- `REG-028` — MVP-002 dairy category removal, PR #417.
- `REG-029` — MVP-012 convenience-over-minor-savings intent, PR #416.
- `REG-030` — MVP-015 same UniversalBasket retailer reprojection with exact quantities, PR #419.
- `REG-031` — MVP-011 PP + no-sugar dietary intent, PR #421.
- `REG-032` — MVP-004 qualitative savings stays soft; meat quality remains a competing preference; explicit relative savings remain relative, PR #423.
- `REG-026` / MVP-024 brand relaxation is GUARDED by merged PR #406 and repeated golden-core passes.
- MVP-001 did not require a behavioral fix: PR #424 added direct real-brain/real-optimizer acceptance for `Собери продукты на неделю до 5000 ₽` and merged green.

No current matrix gap justifies an architecture rewrite. A future beta failure still follows reproduce → regression → root-cause fix → CI → merged-state guard.

## Swarm coordination now

- **Роук/Fixer:** acceptance moves to maintenance/watch mode; do not manufacture more parser fixes without a reproduced P0/P1. Support Gate F and final closed-beta decision evidence.
- **Vi:** may resume architecture ownership when available, but no current acceptance blocker should wait for Vi.
- **Тали:** continue useful rankable source/truth coverage and exact-store evidence quality; do not inflate retailer count with non-rankable discovery sources.
- **Сара 2:** critical mobile/handoff UX is guarded; no redesign unless beta/release evidence finds a blocker.
- **Рейнхард:** Gate F is now the primary closed-beta critical path.
- **Умняша Бая:** corrected external-GPU re-evaluation only; no second training run before that verdict.
- **Карина/Ghost:** prepare beta/outreach around capabilities that actually exist; do not imply retailer partnerships or cart APIs that are not present.

## Current known repo snapshot

Fresh `main` at this status sync: `9465350ef3d546ffcd7fa934b964fc99f81b963c` (merged PR #424).

Important current facts:
- PR #424 adds direct MVP-001 acceptance and fresh-main golden/runtime/data/governance push checks are green.
- PR #423 is the latest behavior-changing canonical fix and passed golden shopping core, Bai assistant, runtime, data/scripts, governance and full real-browser validation before merge.
- PR #419 same-basket reprojection and PR #421 PP/no-sugar are merged and guarded.
- `REG-001`…`REG-032` contain no known OPEN P0/P1 entry at this sync.
- `MVP_ACCEPTANCE_MATRIX.md` maps all 30 canonical scenarios to executable merged evidence.
- The delivery bottleneck is now **Gate F security/legal/cost review → closed-beta decision**, not more canonical shopping implementation.
- Corrected trained-Bay re-evaluation remains a separate external-GPU dependency; deterministic runtime remains the release-safe fallback.

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

The MVP is ready for closed-beta consideration when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions, canonical acceptance evidence remains green, and Gates A–F have evidence with no unresolved P0/P1 release blocker. Canonical acceptance is now converged; Gate F is the primary remaining release decision.
