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
| `REG-015` | P1 | A scope-verified exact-store retailer observation says the canonical item is out of stock while an older static/educational price exists for that retailer | Preserve explicit unavailable evidence, suppress stale baseline price for that exact store/channel, and keep basket incomplete/non-rankable until a valid substitute or in-stock equivalent exists | truth/runtime | GUARDED | `scripts/test-retailer-overlay.mjs` | PR #384 |
| `REG-016` | P1 | A promo/loyalty price is cheaper, but user/plan eligibility or promo terms are unknown | Keep the conditional promo non-rankable; use a guaranteed regular price when available, and only rank promo pricing after both eligibility and terms are explicitly verified | truth | GUARDED | `scripts/test-promo-eligibility.mjs` + `scripts/test-lenta-adapter.mjs` | PR #386 |
| `REG-017` | P1 | Two PurchasePlans have the same charged total but differ in basket coverage, evidence quality or fulfillment friction | Rank deterministically by charged total, then coverage, evidence quality, convenience cost/fewer stores, and finally stable plan id | optimizer | GUARDED | `scripts/test-plan-tie-break.mjs` | PR #388 |
| `REG-018` | P1 | MVP-030: Bay explains a selected plan with a reason not present in its evidence | Explain from actual charged total, goods, store count/friction and evidence quality only; never invent causal reasoning | truth/UX | GUARDED | `scripts/test-mvp030-decision-explanation.py` | PR #390 |
| `REG-019` | P1 | MVP-021: `Добавь две пачки макарон` silently loses the word-form quantity | Parse supported Russian cardinal words into explicit amount and preserve quantity through totals | intent/state/optimizer | GUARDED | `scripts/test-mvp021-word-quantity.mjs` | PR #393 |
| `REG-020` | P1 | A blocked/disabled provider is supplied as a prebuilt identity index or forced runtime priority | Ignore it at runtime and import; blocked/unregistered evidence cannot gain authority | truth/runtime | GUARDED | `scripts/test-product-identity.mjs` + `scripts/test-product-identity-importer.mjs` | PR #392 + PR #394 |
| `REG-021` | P1 | Magnit title has a count sale pack plus physical package weight | Preserve explicit count as purchasable pack; weight must not create false non-equivalence | truth/matcher | GUARDED | `scripts/test-magnit-adapter.mjs` | PR #398 |
| `REG-022` | P1 | Long product identity token on a narrow mobile purchase surface | Keep complete identity readable without overflow/collision | UX | GUARDED | `scripts/test-roxy-long-product-names.py` | PR #400 |
| `REG-023` | P1 | MVP-022: after pasta quantity 2, `Удали одну пачку макарон` | Decrement exactly one pack, keep unrelated basket and synchronize totals | intent/state/optimizer | GUARDED | `scripts/test-mvp022-decrement-pack.mjs` | PR #397 |
| `REG-024` | P1 | MVP-023: `Бюджет теперь 4000` after an existing constrained basket | Change only budget, preserve retailer/people/duration/products/quantities/brand constraints and re-evaluate plan | intent/state/optimizer | GUARDED | `scripts/test-mvp023-budget-only.mjs` | PR #399 |
| `REG-025` | P1 | Magnit exposes card/Premium gated price or advertises Premium benefit near normal price | Conditional loyalty price stays non-rankable until verified; normal base price is not suppressed by a separate benefit | truth | GUARDED | `scripts/test-magnit-collector.mjs` + `scripts/test-magnit-adapter.mjs` | PR #404 + live collector #13 |
| `REG-026` | P1 | MVP-024: `Бренды не важны` after excluded-brand constraints | Clear only brand constraints, preserve basket/budget/store/people/duration/quantities, re-evaluate PurchasePlan | intent/state/runtime | GUARDED | `scripts/test-mvp024-brand-relax.mjs` | PR #406 |
| `REG-027` | P1 | MVP-003: `Замени курицу на индейку` when turkey was absent from canonical product vocabulary/catalog | Replace only chicken with turkey, preserve quantity and unrelated basket state; new candidate remains estimated unless retailer truth exists | intent/state/catalog | GUARDED | `scripts/test-mvp003-replace-turkey.mjs` | PR #409 |
| `REG-028` | P1 | MVP-002: after an existing basket user says `Убери молочку` | Convert category removal into a deterministic dairy exclusion and preserve unrelated constraints/items | intent/state | GUARDED | `scripts/test-mvp002-remove-dairy.mjs` | PR #417 |
| `REG-029` | P1 | MVP-012: `Побыстрее, цена не главное` was not represented as a convenience-over-minor-savings preference | Normalize explicit speed-over-price intent to convenience and let deterministic trade-off prefer simpler fulfillment without weakening truth rules | intent/optimizer | GUARDED | `scripts/test-mvp012-convenience-priority.mjs` | PR #416 |
| `REG-030` | P1 | MVP-015: `Собери то же самое в Перекрёстке` rebuilt intent and later re-scaled exact quantities to the target-store budget | Re-project the same UniversalBasket: preserve SKU identity, exact quantities, selection mode and unrelated constraints; only retailer projection/plan changes | intent/state/optimizer | GUARDED | `scripts/test-mvp015-same-basket-reprojection.mjs` | PR #419 |
| `REG-031` | P1 | MVP-011: `Мне ПП и без сахара` lost PP and did not express no-sugar as an evidence-backed hard dietary constraint | Persist healthy preference; map no-sugar to tag exclusion; preserve unrelated basket state | intent/state/truth | GUARDED | `scripts/test-mvp011-healthy-no-sugar.mjs` | PR #421 |
| `REG-032` | P1 | MVP-004: `Сделай подешевле, но мясо оставь хорошее` silently turned qualitative savings into a 15% hard budget cut; explicit `дешевле на 1000 ₽` could also be misread as an absolute 1000 ₽ budget | Keep qualitative savings soft, preserve meat-quality priority, and interpret explicit relative savings relative to current budget | intent/state/optimizer | GUARDED | `scripts/test-mvp004-soft-savings-meat-quality.mjs` | PR #423 |
| `REG-033` | P1 | Train and frozen eval contain the same normalized `user_request + session_context` under different row IDs | Preserve the historical frozen eval for corrected same-adapter comparison, but block semantic train/eval overlap for future training; sanitize iteration-2 Gold against the frozen holdout and require reviewed non-heldout Gold to replenish the minimum before retraining | training/eval | GUARDED | `teacher-lab/training/automated-pipeline-smoke.py` + `teacher-lab/training/iteration2_readiness_smoke.py` | PR #433 + PR #434 |
| `REG-034` | P1 | Fresh exact-store receipt has proof + strong product identity but no independent current availability signal | Keep the receipt as purchase-time price/history evidence; do not promote it into a verified/rankable live StoreBasket until current exact-store availability is independently verified | truth | GUARDED | `scripts/test-receipt-verification.mjs` + `scripts/test-receipt-price-adapter.mjs` | PR #438 |
| `REG-035` | P1 | Retailer title states the sale pack in one dimension (for example `1л`) while page characteristics also expose physical package mass (for example `1.028кг`) | Preserve the explicit sale pack as comparison identity, retain the physical characteristic separately as provenance, and keep strict pack matching unchanged | truth/matcher | GUARDED | `scripts/test-magnit-collector.mjs` | PR #443 + live collector #16 |
| `REG-036` | P1 | Slow mobile cold start/tab opening exposes stale Bay, retired `Тамдешевле`/comparison UI or older V2 Home before approved Roxy Home | Keep app content hidden behind a branded Votonobay boot surface until approved Roxy Home is ready; the first visible app frame must be canonical and no retired/intermediate UI may paint | UX/runtime | GUARDED | `scripts/test-cold-start-home.py` + `scripts/test-votonobay-brand.mjs` | PR #446 |
| `REG-037` | P0 | Optional account/cloud or receipt flow can transfer user data without a clear per-action participation boundary | Show a plain-language disclosure before transfer; cancel, backdrop dismissal or Escape must perform no auth/cloud/receipt operation, and approval may replay the intended action exactly once | UX/security | GUARDED | `scripts/test-gate-f-user-data-notice.py` | PR #450 |
| `REG-038` | P1 | Exact-store price evidence ages past the fresh TTL but remains usable under the bounded stale window | Keep the stale observation visibly distinct from fresh truth everywhere it is shown or compared; disclose its stale status and advise re-checking before purchase while expired evidence still fails closed | truth/UX | FIXED | `scripts/test-trust-ui.mjs` | PR #487 |
| `REG-039` | P1 | Exact-store retailer evidence for Magnit shop `770105` is applied under the generic chain key `magnit`, allowing another branch or generic chain comparison to inherit its price or stock state | Bind verified exact-store evidence to a physical-store scoped price key (`magnit:770105`); keep generic chain values approximate/non-rankable and allow exact prices only through a verified point/store bridge | truth/runtime | FIXED | `scripts/test-retailer-overlay.mjs` + `scripts/test-store-id-bridge.mjs` | successor to PR #489 |

## Lifecycle

1. Reproduce the failure with the smallest realistic scenario.
2. Add the case here or in the executable bank before/with the fix when practical.
3. Fix root cause, not only wording.
4. Add/extend automated coverage.
5. Verify adjacent cases.
6. Mark `FIXED`/`GUARDED` only when the relevant test passes in the merged state.

A regression case should be deleted only if the product capability itself is intentionally removed or an ADR explicitly supersedes the behavior.
