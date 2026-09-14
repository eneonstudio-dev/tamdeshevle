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
| P1 | Golden shopping core: retailer scope + one/two-store decision correctness | Fixer / QA | IN PROGRESS | PR #370 is open. Its dedicated `Validate golden shopping core` workflow fails at `scripts/test-bai-multistore-scope.mjs`: a single-retailer request does not force one-store mode. Split optimizer, one-store choice, shopping-state consistency and unified-cart steps pass before that failure. Do not merge until the full gate is green. |
| P0/P1 | First real trained Bay checkpoint + held-out eval + promotion proof | Умняша/AI training | DONE: candidate trained; historical gate verdict REJECTED | First real Kaggle run completed; historical evaluator contract was later found mismatched to SFT. |
| P0/P1 | Re-evaluate first candidate under corrected SFT/eval prompt contract | Умняша/AI training | IN PROGRESS | PRs #359, #365 and #366 provide the corrected re-eval/comparison path. External GPU re-evaluation of the existing adapter is still required before another training run. |
| P0/P1 | Second Bay training iteration from real failure clusters + reviewed Gold | Умняша/AI training | NEXT | Start only if corrected re-evaluation still rejects the existing candidate. |
| P1 | Post-PASS trained checkpoint serving path | Умняша/AI training | DONE | PR #362 + ADR-007: staged serving infrastructure + fail-closed proxy; no trained release activated. |
| P1 | UniversalBasket → StoreBasket contract/mapping | Vi | VERIFY AFTER #370 | Existing legacy shopping-state/projection code covers parts of the behavior, and PR #370 adds end-to-end mapping/scope regressions, but the contract is not release-proven in `main` while #370 is failing/open. Vi owns formal verification after the Fixer path merges. |
| P1 | Multi-Store PurchasePlan optimizer | Vi + Fixer | IN PROGRESS / BLOCKED ON #370 | `REG-004` remains OPEN in `main`. PR #370 hardens fee/friction logic and one/two-store scope, but the golden core gate is not green yet. Avoid parallel rewrites of the same optimizer path. |
| P1 | Small set of trustworthy real grocery sources | Tali / data-truth | IN PROGRESS | Magnit has conditional exact-store catalog evidence. Perekrestok and Proshoper regional catalogs remain non-rankable estimates. Terms/commercial review remains pending where the registry says `conditional`. PRs #372/#373 hardened missing/future/stale evidence. |
| P1 | Real end-to-end shopping regression scenarios | Shared, coordinated by Rоук/Fixer | NEXT AFTER #370 | `MVP_SCENARIOS.md` is the acceptance set. PR #370 adds a golden shopping gate, but the campaign should start from the merged, green core rather than test a knowingly failing branch. |
| P1 | Honest retailer handoff capability matrix | Product/Vi/Tali | PARTIALLY ESTABLISHED / VERIFY | `RETAILER_CAPABILITIES.md` declares safe capabilities and recent UX work keeps redirect handoff honest. Release evidence across the tested path still needs explicit Gate D verification. |
| P0 | Security release gate | Reinhard | BEFORE CLOSED BETA/PUBLIC RELEASE | `RELEASE_GATE.md` Gate F remains unchecked; no release-ready claim until Reinhard has no unresolved P0 blocker. |

## Swarm coordination now

- **Fixer** owns PR #370 until the golden shopping core is fully green and merge-ready. Current concrete failure: single-retailer request must force one-store mode.
- **Vi** should not independently rewrite the same retailer-scope/optimizer code while #370 is active. Immediately after #370 merges, verify first-class UniversalBasket → StoreBasket → PurchasePlan behavior against the canonical MVP scenarios and close remaining contract gaps only then.
- **Умняша Бая** owns the corrected external GPU re-evaluation of the first trained candidate. Do not spend another training run before that verdict.
- **Tali** owns source coverage/truth quality. Priority is useful rankable grocery evidence, not retailer-count expansion; regional estimates remain discovery/indicative only.
- **Сара 2 / Roxy** has recently merged mobile/network/return continuity work (#371, #374, #375). Further cosmetic polish is below P0/P1 until the shopping core is green unless a UX defect blocks the golden loop.
- **Reinhard** owns the security/release review once the release path is stable enough to audit; provider/legal truth questions may still block specific sources earlier.

## Current known repo snapshot

Fresh `main` at this status sync: `8c4de55c5b1838aff6334a0c68ddfe4763a0139c` (merged PR #375, Bay return continuity).

Important current facts:
- PR #370 is the only current high-priority open product PR on the golden shopping path and is not DONE because its dedicated workflow fails.
- PRs #372/#373 are merged truth hardening / handoff evidence.
- PRs #374/#375 are merged reliability UX for reconnect and return continuity.
- `REG-004` remains OPEN in `main` until the PurchasePlan/multi-store fix is merged and guarded.

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
