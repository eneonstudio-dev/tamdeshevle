# Votonobay — PROJECT STATUS

**Updated:** 2026-09-14  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — prove real end-to-end shopping loop

This file is intentionally short. Fresh-read `main` before trusting commit/PR status because the repository moves quickly.

## Mission now

Prove:

`natural shopping request → correct intent/constraints → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest purchase handoff`

## Current critical work

| Priority | Work | Owner role | State | Evidence / blocker |
|---|---|---|---|---|
| P1 | Golden shopping core: retailer scope + one/two-store decision correctness | Fixer / QA | DONE / GUARDED | PR #370 is merged. Latest PR-head runs passed `Validate golden shopping core`, Bai assistant, app runtime resilience, data/scripts, governance and real-browser UX. `REG-004`, `REG-011`, `REG-012` and `REG-013` are GUARDED. |
| P0/P1 | First real trained Bay checkpoint + held-out eval + promotion proof | Умняша/AI training | DONE: candidate trained; historical gate verdict REJECTED | First real Kaggle run completed; historical evaluator contract was later found mismatched to SFT. |
| P0/P1 | Re-evaluate first candidate under corrected SFT/eval prompt contract | Умняша/AI training | IN PROGRESS | PRs #359, #365 and #366 provide the corrected re-eval/comparison path. External GPU re-evaluation of the existing adapter is still required before another training run. |
| P0/P1 | Second Bay training iteration from real failure clusters + reviewed Gold | Умняша/AI training | NEXT | Start only if corrected re-evaluation still rejects the existing candidate. |
| P1 | Post-PASS trained checkpoint serving path | Умняша/AI training | DONE | PR #362 + ADR-007: staged serving infrastructure + fail-closed proxy; no trained release activated. |
| P1 | UniversalBasket → StoreBasket → PurchasePlan contract verification | Роук/Fixer temporarily; Vi when available | VERIFY NOW | PR #370 proves the critical retailer-scope and one/two-store behaviors, but release proof still needs an explicit canonical-scenario pass over the first-class basket/projection/purchase-plan contract. Do not reopen already-guarded optimizer bugs unless a scenario reproduces one. |
| P1 | Multi-Store PurchasePlan economics and retailer scope | Fixer / QA | GUARDED, RELEASE VERIFY PENDING | `REG-004` plus one-store/multi-store scope regressions are GUARDED by PR #370. Remaining work is acceptance-level proof across canonical scenarios, not another parallel optimizer rewrite. |
| P1 | Small set of trustworthy real grocery sources | Tali / data-truth | IN PROGRESS | Magnit has conditional exact-store catalog evidence. Perekrestok and Proshoper regional catalogs remain non-rankable estimates. PR #384 now preserves scope-verified exact-store `out_of_stock` evidence fail-closed instead of leaving an older baseline price visible. Terms/commercial review remains pending where the registry says `conditional`. |
| P1 | Real end-to-end shopping regression scenarios | Shared, coordinated by Роук/Fixer | IN PROGRESS | `MVP_SCENARIOS.md` is the active acceptance campaign. MVP-028 exact-store unavailability is now guarded by PR #384 / `REG-015`; continue replaying remaining scenarios from fresh green `main`, promoting every reproduced failure into the regression bank. |
| P1 | Honest retailer handoff capability matrix | Product/Роук/Tali | PARTIALLY ESTABLISHED / VERIFY | `RETAILER_CAPABILITIES.md` declares safe capabilities and recent UX work keeps redirect handoff honest. Release evidence across the tested path still needs explicit Gate D verification. |
| P1 | Post-purchase proof truth boundary | Sara 2 / Tali / QA | DONE / GUARDED | PR #378 is merged and `REG-014` is GUARDED via PR #380: planned totals stay separate from explicit actual-paid evidence; receipt proof remains pending until separately verified. |
| P0 | Security release gate | Reinhard | BEFORE CLOSED BETA/PUBLIC RELEASE | `RELEASE_GATE.md` Gate F remains unchecked; no release-ready claim until Reinhard has no unresolved P0 blocker. |

## Swarm coordination now

- **Fixer** finished the #370 P1 blocker and the MVP-028 truth failure is now guarded in #384. Continue acceptance-level replay of the canonical MVP scenarios from fresh green `main`, not another rewrite of already-guarded optimizer/truth paths.
- **Vi** is temporarily unavailable. Роук/Fixer hold the contract-verification path so delivery does not wait; Vi can resume architecture ownership later without blocking current acceptance work.
- **Умняша Бая** owns the corrected external GPU re-evaluation of the first trained candidate. Do not spend another training run before that verdict.
- **Tali** owns source coverage/truth quality. Priority is useful rankable grocery evidence, not retailer-count expansion; regional estimates remain discovery/indicative only.
- **Сара 2 / Roxy** has merged the non-blocking rejected-split explanation in PR #381; it reads existing optimizer output only and must not become a new arithmetic/truth implementation path.
- **Reinhard** owns the security/release review once the acceptance path is stable enough to audit; provider/legal truth questions may still block specific sources earlier.

## Current known repo snapshot

Fresh `main` at this status sync: `54f75c594f9ab823a9eb239d52b636862e7924f5` (merged PR #384).

Important current facts:
- PR #370 is merged; its latest full shopping-core workflow passed.
- `REG-004`, `REG-011`, `REG-012` and `REG-013` are GUARDED by PR #370.
- PR #378 is merged and hardens post-purchase actual-paid truth; PR #380 records `REG-014` as GUARDED.
- PR #381 is merged and explains rejected two-store splits without changing optimizer arithmetic or truth semantics.
- PR #384 is merged with green data/scripts, runtime, shopping-core, governance and real-browser checks; scope-verified exact-store unavailability is now fail-closed and recorded as `REG-015`.
- PRs #372/#373 remain the merged truth hardening / handoff evidence base.
- PRs #374/#375 remain merged reliability UX for reconnect and return continuity.
- The main delivery bottleneck is now acceptance proof across the remaining canonical MVP scenarios plus handoff/security release gates, while trained-Bay corrected re-evaluation remains an external GPU dependency.

## Bay training evidence

- First real Kaggle T4 run completed on 2026-09-13 from repository commit `865def7a98aa6b645b1950cfcd4ec9ffc37320ca`, pinned Qwen3 revision `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`, deterministic bootstrap 500 train / 60 disjoint holdout, seed 42, thinking disabled.
- Training completed 3 epochs / 48 steps in 747.6 seconds; final reported train loss was `0.2296814`. The candidate experiment ZIP and pipeline/metric/promotion JSON artifacts are saved in Kaggle notebook `eneonstii/notebook07f42bd563`, Version 1 (`First real GPU run - promotion rejected`).
- Historical promotion gate verdict: **REJECTED**. Candidate metrics were intent `0.4833`, constraints `0.5`, actions `0.1`, context retention `0.28`; only 36/60 candidate responses parsed. Reasons: `context_retention_rate_regressed`, `constraint_floor_not_met`, `intent_floor_not_met`.
- No promotable checkpoint or active trained release exists. The historical rejection therefore remains non-production evidence only.
- Runtime fixes discovered by the run are merged in PR #353 (single-T4 model subprocesses) and PR #354 (malformed output is scored as failure instead of crashing benchmark), both with green CI.
- PR #356 later identified a material evaluation defect: SFT and evaluation used different system/input prompt contracts. Train/eval now share one versioned prompt contract. Therefore the historical rejection remains valid evidence for the old harness, but it is not sufficient justification to retrain before the same adapter is re-evaluated under the corrected contract.
- PR #359 added corrected-contract re-evaluation of the existing adapter plus failure clustering. Re-evaluation remains the current required external GPU step.
- PR #360 added leak-safe failure learning: held-out failures become evaluation regressions/focus signals, remediation uses train-side sibling examples, human review is mandatory, and held-out examples cannot leak into training Gold.
- PR #365 / commit `260b626202e512c65e988b6a75228a13416407e5` added fail-closed frozen-holdout candidate comparison reports for baseline and later checkpoints. Every compared run must cover the exact same eval IDs; reports expose parse coverage, benchmark deltas, failure labels and per-category pass rates without replacing the promotion gate.
- PR #366 / commit `88f20e472166c81963fdc0f3d2d4a16273925e4e` wired that comparison into the one-click Kaggle corrected re-evaluation notebook. The notebook automatically compares corrected baseline/candidate and also historical Version 1 runs when complete historical prediction/metric artifacts are present.
- PR #362 / commit `4a00f58dc147cc9c597a1c05248d36a34537cf6e` added the post-PASS serving path: pinned GPU adapter server, authenticated Supabase proxy, disabled-by-default release binder and runtime origin allowlist. All seven PR checks passed, including real-browser UX.
- Supabase Edge Function `bai-trained-inference` v1 is deployed and ACTIVE in the Bai Learning Backend project, but intentionally fail-closed: no promoted release pin or private GPU backend is bound, so this is serving infrastructure, not a deployed trained brain.
- Re-evaluation must remain fail-closed: unchanged benchmark and promotion gate, no automatic release. If the existing candidate still fails, cluster the corrected-run failures, review train-side remediation siblings, and only approved Gold may feed iteration 2.

## Rules for agents

- Read `VOTONOBAI_MASTER_ROADMAP.md` first.
- Never work blind from chat memory.
- Do not silently change strategy/scope.
- P0/P1 bugs discovered in the active workstream should be reproduced, fixed and tested, not only reported.
- Mark something DONE only under the MASTER Definition of Done.
- Update this status when a material blocker/state changes.

## Immediate definition of success

The MVP is not proven by UI polish or number of providers. It is proven when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions.
