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
| P0/P1 | First successful trained Bay checkpoint + held-out eval + promotion proof | Умняша/AI training | IN PROGRESS |
| P1 | UniversalBasket → StoreBasket contract/mapping | Vi | NEXT / VERIFY CURRENT MAIN FIRST |
| P1 | Multi-Store PurchasePlan optimizer | Vi | NEXT AFTER/ALONGSIDE BASKET CONTRACT |
| P1 | Small set of trustworthy real grocery sources | Price 2 | IN PROGRESS / VERIFY CURRENT MAIN FIRST |
| P1 | Real end-to-end shopping regression scenarios | Shared | NEXT |
| P1 | Honest retailer handoff capability matrix | Product/Vi/Price | NEXT |
| P0 | Security release gate | Reinhard | BEFORE PUBLIC RELEASE |

## Current known repo snapshot

At the time the MASTER system was introduced, fresh `main` was at commit `a2d85a57c1a01306f2e5973ac77d547cd313e01a` (merged PR #350, final Roxy motion polish). This SHA is a historical snapshot only; agents must fetch fresh `main` before work.

## Rules for agents

- Read `VOTONOBAI_MASTER_ROADMAP.md` first.
- Never work blind from chat memory.
- Do not silently change strategy/scope.
- P0/P1 bugs discovered in the active workstream should be reproduced, fixed and tested, not only reported.
- Mark something DONE only under the MASTER Definition of Done.
- Update this status when a material blocker/state changes.

## Immediate definition of success

The MVP is not proven by UI polish or number of providers. It is proven when ordinary users can repeatedly complete the golden shopping loop with honest data and correct basket decisions.
