# Votonobay — PROJECT STATUS

**Updated:** 2026-09-13  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — prove real end-to-end shopping loop

This file is intentionally short. Fresh-read `main` before trusting commit/PR status because the repository moves quickly.

## Mission now

Prove:

`natural shopping request → correct intent/constraints → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest purchase handoff`

## Current critical work

| Priority | Work | Owner role | State |
|---|---|---|---|
| P0/P1 | First real trained Bay checkpoint + held-out eval + promotion proof | Умняша/AI training | DONE: candidate trained; gate REJECTED it |
| P0/P1 | Second Bay training iteration from failure clusters + reviewed Gold | Умняша/AI training | NEXT |
| P1 | UniversalBasket → StoreBasket contract/mapping | Vi | NEXT / VERIFY CURRENT MAIN FIRST |
| P1 | Multi-Store PurchasePlan optimizer | Vi | NEXT AFTER/ALONGSIDE BASKET CONTRACT |
| P1 | Small set of trustworthy real grocery sources | Price 2 | IN PROGRESS / VERIFY CURRENT MAIN FIRST |
| P1 | Real end-to-end shopping regression scenarios | Shared | NEXT |
| P1 | Honest retailer handoff capability matrix | Product/Vi/Price | NEXT |
| P0 | Security release gate | Reinhard | BEFORE PUBLIC RELEASE |

## Current known repo snapshot

At the time the MASTER system was introduced, fresh `main` was at commit `a2d85a57c1a01306f2e5973ac77d547cd313e01a` (merged PR #350, final Roxy motion polish). This SHA is a historical snapshot only; agents must fetch fresh `main` before work.

## Bay training evidence

- First real Kaggle T4 run completed on 2026-09-13 from repository commit `865def7a98aa6b645b1950cfcd4ec9ffc37320ca`, pinned Qwen3 revision `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`, deterministic bootstrap 500 train / 60 disjoint holdout, seed 42, thinking disabled.
- Training completed 3 epochs / 48 steps in 747.6 seconds; final reported train loss was `0.2296814`. The candidate experiment ZIP and pipeline/metric/promotion JSON artifacts are saved in Kaggle notebook `eneonstii/notebook07f42bd563`, Version 1 (`First real GPU run - promotion rejected`).
- Promotion gate verdict: **REJECTED**. Candidate metrics: intent `0.4833`, constraints `0.5`, actions `0.1`, context retention `0.28`; only 36/60 candidate responses parsed. Reasons: `context_retention_rate_regressed`, `constraint_floor_not_met`, `intent_floor_not_met`.
- No promotable checkpoint, brain release bundle, registry update or production deployment was created. This is intentional fail-closed behavior.
- Runtime fixes discovered by this run are merged in PR #353 (single-T4 model subprocesses) and PR #354 (malformed output is scored as failure instead of crashing benchmark), both with green CI.
- NEXT: cluster the 24 candidate JSON parse failures and semantic misses, replace/augment deterministic bootstrap with reviewed Gold emphasizing JSON validity, retained constraints and exact action payloads, then run a new candidate through the unchanged gate.

## Rules for agents

- Read `VOTONOBAI_MASTER_ROADMAP.md` first.
- Never work blind from chat memory.
- Do not silently change strategy/scope.
- P0/P1 bugs discovered in the active workstream should be reproduced, fixed and tested, not only reported.
- Mark something DONE only under the MASTER Definition of Done.
- Update this status when a material blocker/state changes.

## Immediate definition of success

The MVP is not proven by UI polish or number of providers. It is proven when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions.
