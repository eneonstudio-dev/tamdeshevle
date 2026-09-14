# Votonobay — PROJECT STATUS

**Updated:** 2026-09-15  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — final closed-beta release replay/decision

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
| P0 | Security release gate (Gate F) | Reinhard | **PASS FOR CLOSED-BETA LOCAL-ONLY SCOPE** | PR #454 merged at `5893599c2a6c35a87552d0d2fc6d4da66a06cff5`; merged-head security `34900001701`, browser `34900001694`, runtime `34900001755`, data `34900001805`, governance `34900001822` and golden `34900001886` are green. Personal account/cloud/receipt-photo processing is disabled for closed beta; public/re-enable path still requires privacy/legal review. |
| P0/P1 | Corrected re-evaluation of first trained Bay candidate | Умняша Бая | IN PROGRESS / EXTERNAL GPU DEPENDENCY | PRs #359/#365/#366 provide the corrected SFT/eval comparison path; returned artifacts are now portable/hash-validated. Re-evaluate the existing adapter before any second training run. This remains parallel to deterministic MVP release safety; no trained release is active. |
| P1 | Data Factory v2 teacher pilot | Умняша Бая | READY FOR EXTERNAL KAGGLE GPU / REVIEW-ONLY | PRs #410/#412/#413 build a 400-case unique balanced pilot, pinned Qwen3-8B + DeepSeek T4x2 generation, calibration gate and triage. PR #432 adds a portable hash/inventory-guarded Kaggle handoff. No teacher output auto-enters Gold. |
| P1 | Second Bay training iteration | Умняша Бая | STAGED / BLOCKED UNTIL CORRECTED REEVAL REJECTS + REVIEWED GOLD | PR #433 blocks train/eval semantic leakage even under different IDs. PR #434 keeps the historical frozen eval unchanged, sanitizes future train Gold against it, requires current training-allowed provenance and >=500 clean examples, and only emits `READY_FOR_ITERATION_2` after a validated `REEVAL_REJECTED`. |
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
- `REG-033` — future training cannot overlap the frozen holdout by normalized request/context even under different IDs; iteration-2 Gold is sanitized and must be replenished with reviewed non-heldout data before training, PRs #433/#434.
- `REG-026` / MVP-024 brand relaxation is GUARDED by merged PR #406 and repeated golden-core passes.
- MVP-001 did not require a behavioral fix: PR #424 added direct real-brain/real-optimizer acceptance for `Собери продукты на неделю до 5000 ₽` and merged green.

No current matrix gap justifies an architecture rewrite. A future beta failure still follows reproduce → regression → root-cause fix → CI → merged-state guard.

## Swarm coordination now

- **Роук/Fixer:** run the final closed-beta A–F release replay/decision against fresh `main`; do not manufacture more parser fixes without a reproduced P0/P1.
- **Vi:** may resume architecture ownership when available, but no current deterministic acceptance blocker should wait for Vi.
- **Тали:** continue useful rankable source/truth coverage and exact-store evidence quality; do not inflate retailer count with non-rankable discovery sources.
- **Сара 2:** critical mobile/handoff UX is guarded; no redesign unless beta/release evidence finds a blocker.
- **Рейнхард:** Gate F is PASS for the closed-beta local-only scope; keep security monitoring active and do not re-enable account/cloud/receipt-photo personal-data processing without separate privacy/legal review.
- **Умняша Бая:** run the corrected existing-candidate external-GPU re-evaluation and the review-only Data Factory teacher pilot when Kaggle GPU is available. Do not run iteration 2 before a validated `REEVAL_REJECTED`; if rejected, use only sanitized >=500 approved Gold with zero frozen-holdout ID/fingerprint overlap.
- **Карина/Ghost:** prepare beta/outreach around capabilities that actually exist; do not imply retailer partnerships or cart APIs that are not present.

## Current known repo snapshot

Gate F behavior/evidence head verified on `main`: `5893599c2a6c35a87552d0d2fc6d4da66a06cff5` (merged PR #454).

Important current facts:
- PR #424 adds direct MVP-001 acceptance; canonical 001–030 acceptance remains converged.
- PR #432 adds a portable, hash/inventory-validated Data Factory teacher handoff; returned review artifacts remain review-only.
- PR #433 blocks train/eval semantic request/context overlap even when row IDs differ.
- PR #434 guards iteration-2 readiness: the frozen 60 remain unchanged for corrected same-adapter re-evaluation, colliding future-train rows are removed, and reviewed nonheldout Gold must replenish the clean dataset to the current minimum before retraining.
- PR #454 resolves the closed-beta Gate F personal-data blocker by **scope reduction**: personal account/cloud/receipt-photo processing fails closed to local-only behavior; this is not a claim that privacy/legal review occurred.
- `REG-001`…`REG-033` contain no known OPEN P0/P1 entry at this sync.
- `MVP_ACCEPTANCE_MATRIX.md` maps all 30 canonical scenarios to executable merged evidence.
- The delivery bottleneck is now **final A–F closed-beta release replay/decision**, not Gate F remediation or more canonical shopping implementation.
- Corrected trained-Bay re-evaluation and the Data Factory teacher pilot remain external-GPU dependencies; deterministic runtime remains the release-safe fallback.

## Bay training evidence

- First real Kaggle T4 run completed on 2026-09-13 from repository commit `865def7a98aa6b645b1950cfcd4ec9ffc37320ca`, pinned Qwen3 revision `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`, deterministic bootstrap 500 train / 60 ID-disjoint frozen holdout, seed 42, thinking disabled.
- Training completed 3 epochs / 48 steps in 747.6 seconds; final reported train loss was `0.2296814`. The experiment ZIP and promotion artifacts are saved in Kaggle notebook `eneonstii/notebook07f42bd563`, Version 1.
- Historical promotion gate verdict: **REJECTED**. Candidate metrics were intent `0.4833`, constraints `0.5`, actions `0.1`, context retention `0.28`; only 36/60 candidate responses parsed.
- PR #356 later identified a material evaluation defect: SFT and evaluation used different system/input prompt contracts. Therefore the historical rejection is evidence for the old harness, but not sufficient justification to retrain before corrected re-evaluation of the same adapter.
- PR #359 added corrected-contract re-evaluation and failure clustering. PR #360 added leak-safe failure learning. PR #365 added fail-closed frozen-holdout comparisons. PR #366 wired comparison into the corrected Kaggle re-evaluation path. The original frozen eval stays unchanged so the corrected same-adapter comparison remains historically comparable.
- A second evaluation-integrity defect was found while staging iteration 2: the old deterministic train/eval split is ID-disjoint but contains some identical normalized `user_request + session_context` fingerprints across the split. PR #433 makes all future training fail closed on that overlap; PR #434 sanitizes iteration-2 training rows against the unchanged frozen eval and requires enough reviewed nonheldout Gold to restore the >=500 minimum. This is guarded as `REG-033` and does not rewrite the first candidate's historical frozen holdout.
- PRs #410/#412/#413 provide Data Factory v2: 512 semantically unique generated scenarios, a balanced 400-case review-only pilot, pinned dual-teacher Kaggle path, 40-case calibration spend gate and automatic triage. PR #432 adds portable package/intake validation with tamper rejection.
- PR #362 / ADR-007 added the post-PASS serving path. Supabase `bai-trained-inference` infrastructure is deployed but intentionally fail-closed; there is no promoted release pin or bound private GPU backend.
- If corrected re-evaluation passes, route to staged release review and do not retrain merely because iteration-2 tooling exists. If it rejects, use failure clusters + human-reviewed nonheldout Gold, sanitize against the frozen eval, require `READY_FOR_ITERATION_2`, then train and compare on the exact frozen holdout under the unchanged promotion gate.

## Rules for agents

- Read `VOTONOBAI_MASTER_ROADMAP.md` and fresh `main` before work.
- Never work blind from chat memory.
- Do not silently change strategy/scope.
- P0/P1 bugs in the active path are reproduced, fixed and tested, not merely reported.
- Mark DONE only under the MASTER Definition of Done.
- Update this status only when a material blocker/state changes.

## Immediate definition of success

The MVP is ready for closed-beta consideration when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions, canonical acceptance evidence remains green, and Gates A–F have evidence with no unresolved P0/P1 release blocker. Gate F now passes for the closed-beta local-only scope; the immediate next step is the final A–F release replay/decision on fresh `main`.
