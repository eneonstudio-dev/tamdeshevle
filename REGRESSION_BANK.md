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
| `REG-001` | P0 | Exact price/store evidence is absent or ambiguous | Result stays unverified/non-rankable; missing value never becomes `0` | truth | GUARDED | `scripts/test-data-layer-truth.mjs` + comparison truth tests | PR #372 |
| `REG-002` | P1 | User changes one named basket constraint | Preserve unrelated ShoppingIntent/UniversalBasket dimensions | state/action | GUARDED | shopping-agent regression suite | existing main contracts |
| `REG-003` | P1 | External/trained brain fails, times out, or produces unsafe action | Reject/repair and fall back to safe bounded runtime | runtime/action | GUARDED | Bai runtime bridge tests | existing main contracts |
| `REG-004` | P1 | Multi-store item prices look cheaper before fees | Compare feasible charged totals and constraints; do not recommend fake savings | optimizer | GUARDED | `scripts/test-basket-split.mjs` | PR #370 |
| `REG-005` | P1 | Retailer supports redirect only | Explain handoff honestly; never claim automatic cart transfer | handoff | GUARDED | current V2 handoff contract | existing main contracts |
| `REG-006` | P1 | Kaggle exposes T4 x2 while single-process Trainer loads 4-bit QLoRA | Isolate train/eval model subprocesses to one T4; never DataParallel-replicate bitsandbytes modules | runtime/training | GUARDED | `teacher-lab/training/kaggle_first_run_smoke.py` | PR #353 |
| `REG-007` | P1 | A model prediction contains non-array `actions` or `retained_constraints` | Score the response as failed/missing; benchmark and promotion gate must not crash or skip the candidate | runtime/eval | GUARDED | `teacher-lab/training/deterministic-seed-smoke.mjs` | PR #354 |
| `REG-008` | P1 | Teacher-loop output uses `confidence.price/availability/quality = "unknown"` to declare missing dynamic evidence | Treat the explicit confidence sentinel as unknown evidence, not as a fabricated price/stock/quality fact; continue rejecting actual forbidden dynamic claims | truth/eval | GUARDED | `teacher-lab/student-teacher-loop-smoke.mjs` | `fix/bai-unknown-truth-sentinel` |
| `REG-009` | P1 | Receipt evidence carries an `observed_at` materially in the future | Reject the observation before history/ranking promotion; permit only bounded clock skew | truth | GUARDED | `scripts/test-receipt-verification.mjs` | PR #372 |
| `REG-010` | P1 | Regional catalog snapshot is older than TTL or its declared promo period has ended | Suppress the indicative price entirely; never carry an expired estimate forward as current evidence | truth | GUARDED | `scripts/test-data-quality.mjs` + `scripts/test-retailer-estimate-freshness.mjs` + `scripts/test-proshoper-collector.mjs` | PR #372 |
| `REG-011` | P1 | Bay receives multiple explicit retailer choices in one shopping request | Preserve one canonical `store_ids` allow-list through mapping, execution, verification and optimization; never roll a valid multi-store request back as `EFFECT_NOT_VERIFIED` | state/action | GUARDED | `scripts/test-bai-multistore-scope.mjs` | PR #370 |
| `REG-012` | P1 | User says `Не Магнит` | Exclude Magnit while preserving basket intent; retailer exclusion must not become retailer selection or `EXCLUDE_BRAND` | intent/state | GUARDED | `scripts/test-bai-multistore-scope.mjs` | PR #370 |
| `REG-013` | P1 | User requests one retailer / `Только Магнит`, or asks for `Всё из одного магазина` | Force one-store mode and compare eligible single-store projections of the same basket; never pin the first/current retailer accidentally | intent/optimizer | GUARDED | `scripts/test-bai-multistore-scope.mjs` + `scripts/test-one-store-choice.mjs` | PR #370 |
| `REG-014` | P1 | Post-purchase proof opens with Bay's planned total and user confirms without entering what was actually charged | Keep planned amount approximate/separate; require a positive explicit actual total before saving self-reported purchase evidence; receipt evidence remains pending until separately verified | truth/UX | GUARDED | `scripts/test-roxy-purchase-proof.py` | PR #378 |
| `REG-015` | P1 | A scope-verified exact-store retailer observation says the canonical item is out of stock while an older static/educational price exists for that retailer | Preserve the explicit unavailable evidence, suppress the stale baseline price for that exact store/channel, and keep the basket incomplete/non-rankable until a valid substitute or in-stock equivalent exists | truth/runtime | GUARDED | `scripts/test-retailer-overlay.mjs` | PR #384 |
| `REG-016` | P1 | A promo/loyalty price is cheaper, but user/plan eligibility or promo terms are unknown | Keep the conditional promo non-rankable; use a guaranteed regular price when available, and only rank promo pricing after both eligibility and terms are explicitly verified | truth | GUARDED | `scripts/test-promo-eligibility.mjs` + `scripts/test-lenta-adapter.mjs` | PR #386 |
| `REG-017` | P1 | Two PurchasePlans have the same charged total but differ in basket coverage, evidence quality or fulfillment friction | Rank deterministically by charged total, then coverage, evidence quality, convenience cost/fewer stores, and finally stable plan id; never inherit incidental array order | optimizer | GUARDED | `scripts/test-plan-tie-break.mjs` | PR #388 |
| `REG-018` | P1 | MVP-030: two plans have the same charged total, but Bay explains the chosen multi-store plan as if a price difference justified it or cites generic “current priorities/convenience” not present in the evidence | Explain the decision from actual plan facts only: charged total, item subtotal, known split friction/store count and evidence quality; never invent a causal reason | truth/UX | GUARDED | `scripts/test-mvp030-decision-explanation.py` | PR #390 |
| `REG-019` | P1 | MVP-021: user says `Добавь две пачки макарон`, but the deterministic parser recognizes only digit quantities and silently loses the word-form amount | Parse supported Russian cardinal word quantities into explicit `SET_PRODUCT_AMOUNT`; preserve quantity 2 through ShoppingState and PurchasePlan totals instead of falling back to one pack | intent/state/optimizer | GUARDED | `scripts/test-mvp021-word-quantity.mjs` | PR #393 |
| `REG-020` | P1 | A provider blocked/disabled by `SOURCE_PROVIDER_REGISTRY.md` is supplied as a prebuilt identity index or forced runtime priority | Ignore the source at runtime as well as import time; blocked/unregistered evidence cannot enrich identity or gain price/store/rankability authority | truth/runtime | GUARDED | `scripts/test-product-identity.mjs` + `scripts/test-product-identity-importer.mjs` | PR #392 + PR #394 |
| `REG-021` | P1 | Magnit exposes a count-based sale pack in the title (`10шт`, `100пак`) plus a physical package weight in characteristics | Preserve explicit count as the purchasable pack; physical weight must not turn eggs/tea into gram-based non-equivalents, while characteristic weight remains valid fallback for produce with no title pack | truth/matcher | GUARDED | `scripts/test-magnit-adapter.mjs` | PR #398 |
| `REG-022` | P1 | A long grocery/product title contains an uninterrupted retailer/brand-like token on a narrow mobile purchase surface | Keep the complete product identity readable without ellipsis, horizontal overflow or collision with price/action controls across Bay summary, comparison and retailer handoff | UX | GUARDED | `scripts/test-roxy-long-product-names.py` | PR #400 |
| `REG-023` | P1 | MVP-022: after pasta quantity is 2, user says `Удали одну пачку макарон` | Decrement pasta by exactly one pack, keep the SKU at quantity 1, preserve unrelated basket lines and synchronize PurchasePlan totals; quantity-less remove still deletes the SKU | intent/state/optimizer | OPEN | `scripts/test-mvp022-decrement-pack.mjs` | PR #397 |
| `REG-024` | P1 | Magnit renders a loyalty-gated price (`Цена по карте` / explicit Premium price), or separately advertises an extra Premium benefit near a normal current price | Only explicit card/Premium-gated prices become conditional and non-rankable until eligibility + terms are verified; a normal displayed base price must not be suppressed merely because `+N% с Премиум` is advertised separately | truth | OPEN | `scripts/test-magnit-collector.mjs` + `scripts/test-magnit-adapter.mjs` | `tali/magnit-promo-truth` |

## Lifecycle

1. Reproduce the failure with the smallest realistic scenario.
2. Add the case here or in the executable bank before/with the fix when practical.
3. Fix root cause, not only wording.
4. Add/extend automated coverage.
5. Verify adjacent cases.
6. Mark `FIXED`/`GUARDED` only when the relevant test passes in the merged state.

A regression case should be deleted only if the product capability itself is intentionally removed or an ADR explicitly supersedes the behavior.
