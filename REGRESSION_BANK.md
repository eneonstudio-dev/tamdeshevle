# Votonobay — Regression Bank

**Rule:** every important Bay failure that can recur should become a permanent regression case.

This document defines the contract. Executable tests may live elsewhere; this file is the human-readable index and triage layer.

## What belongs here

Add a case when Bay or the shopping system:
- misunderstands intent or a follow-up constraint;
- changes an unrelated basket dimension;
- adds/removes/replaces the wrong item;
- violates a hard budget/brand/health/fulfillment constraint;
- treats an unverified price/store/stock claim as verified;
- picks a non-equivalent substitution merely because it is cheaper;
- computes a wrong total/savings/fee;
- recommends a worse multi-store split after delivery/service/minimum-order effects;
- claims cart/order handoff that did not actually occur;
- fails recovery after provider/network/runtime error;
- accepts out-of-scope general-assistant work;
- regresses mobile/critical UX behavior that blocks the golden loop.

## Severity

- `P0` — truth/security/site-breaker / user cannot complete core flow.
- `P1` — materially wrong shopping decision or basket behavior.
- `P2` — degraded UX/explanation but core decision still safe.
- `P3` — cosmetic/non-critical.

## Required case fields

| Field | Meaning |
|---|---|
| `id` | Stable ID, e.g. `REG-001` |
| `date_found` | YYYY-MM-DD |
| `severity` | P0–P3 |
| `scenario` | User input and minimal relevant state |
| `expected` | Required behavior |
| `actual_failure` | What went wrong |
| `layer` | intent / state / action / matcher / truth / optimizer / handoff / runtime / UX |
| `root_cause` | Once known |
| `test_path` | Executable regression test or contract |
| `fix_ref` | PR/commit |
| `status` | OPEN / FIXED / GUARDED / WONTFIX |

## Bank

| id | severity | scenario | expected | layer | status | test_path | fix_ref |
|---|---|---|---|---|---|---|---|
| `REG-001` | P0 | Exact price/store evidence is absent or ambiguous | Result stays unverified/non-rankable; missing value never becomes `0` | truth | GUARDED | existing truth/runtime tests | existing main contracts |
| `REG-002` | P1 | User changes one named basket constraint | Preserve unrelated ShoppingIntent/UniversalBasket dimensions | state/action | GUARDED | shopping-agent regression suite | existing main contracts |
| `REG-003` | P1 | External/trained brain fails, times out, or produces unsafe action | Reject/repair and fall back to safe bounded runtime | runtime/action | GUARDED | Bai runtime bridge tests | existing main contracts |
| `REG-004` | P1 | Multi-store item prices look cheaper before fees | Compare feasible charged totals and constraints; do not recommend fake savings | optimizer | OPEN | to add with PurchasePlan optimizer | pending |
| `REG-005` | P1 | Retailer supports redirect only | Explain handoff honestly; never claim automatic cart transfer | handoff | GUARDED | current V2 handoff contract | existing main contracts |

## Lifecycle

1. Reproduce the failure with the smallest realistic scenario.
2. Add the case here or in the executable bank before/with the fix when practical.
3. Fix root cause, not only wording.
4. Add/extend automated coverage.
5. Verify adjacent cases.
6. Mark `FIXED`/`GUARDED` only when the relevant test passes in the merged state.

A regression case should be deleted only if the product capability itself is intentionally removed or an ADR explicitly supersedes the behavior.
