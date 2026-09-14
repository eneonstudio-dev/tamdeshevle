# Votonobay — MVP Acceptance Matrix

**Purpose:** executable release evidence for the canonical scenarios in `MVP_SCENARIOS.md`.

A row is `GUARDED` only when the expected behavior is represented by an executable test/contract on merged `main`. This matrix does not weaken `RELEASE_GATE.md`: closed beta still requires Gates A–F, including the independent security review.

| MVP | Acceptance behavior | Executable evidence | Status |
|---|---|---|---|
| 001 | Week basket to 5000 ₽; 7-day intent, grounded groceries, feasible plan respects hard budget | `scripts/test-mvp001-week-budget.mjs` | GUARDED — PR #424 |
| 002 | `Убери молочку` modifies current basket without resetting unrelated state | `scripts/test-mvp002-remove-dairy.mjs` | GUARDED — PR #417 / REG-028 |
| 003 | Chicken → turkey replacement preserves quantity and unrelated state | `scripts/test-mvp003-replace-turkey.mjs` | GUARDED — PR #409 / REG-027 |
| 004 | Qualitative savings stays soft; meat quality remains explicit; relative amount stays relative | `scripts/test-mvp004-soft-savings-meat-quality.mjs` | GUARDED — PR #423 / REG-032 |
| 005 | `Всё из одного магазина` forces one-store comparison | `scripts/test-one-store-choice.mjs`, `scripts/test-bai-multistore-scope.mjs` | GUARDED — PR #370 / REG-013 |
| 006 | Up to two stores only when net result is genuinely better | `scripts/test-basket-split.mjs`, `scripts/test-bai-multistore-scope.mjs` | GUARDED — PR #370 / REG-004,011 |
| 007 | Nominal split saving smaller than known extra fulfillment cost is rejected | `scripts/test-basket-split.mjs` | GUARDED — REG-004 |
| 008 | Material net split saving after known costs may be recommended and explained | `scripts/test-basket-split.mjs`, `scripts/test-basket-split-ui.mjs` | GUARDED — REG-004 |
| 009 | Missing verified price never becomes zero/full verified total | `scripts/test-data-layer-truth.mjs`, `scripts/test-comparison.mjs` | GUARDED — PR #372 / REG-001 |
| 010 | Wrong pack/fat/category/variant cannot win merely by being cheaper | `scripts/test-sku-matcher.mjs` | GUARDED — matcher contract |
| 011 | `ПП и без сахара` persists healthy preference and evidence-backed no-sugar constraint | `scripts/test-mvp011-healthy-no-sugar.mjs` | GUARDED — PR #421 / REG-031 |
| 012 | Explicit speed-over-price preference outranks minor saving without weakening truth | `scripts/test-mvp012-convenience-priority.mjs` | GUARDED — PR #416 / REG-029 |
| 013 | `Только Магнит` restricts retailer scope | `scripts/test-bai-multistore-scope.mjs`, `scripts/test-one-store-choice.mjs` | GUARDED — PR #370 / REG-013 |
| 014 | `Не Магнит` excludes Magnit without changing basket intent | `scripts/test-bai-multistore-scope.mjs` | GUARDED — PR #370 / REG-012 |
| 015 | Same UniversalBasket reprojects into Perekrestok with exact SKU/quantity/context preservation | `scripts/test-mvp015-same-basket-reprojection.mjs` | GUARDED — PR #419 / REG-030 |
| 016 | Refresh/return continuity preserves active shopping session | `scripts/test-roxy-return-continuity.py` | GUARDED — PR #375 |
| 017 | Provider/network failure fails safely, keeps basket and supports recovery | `scripts/test-roxy-network-recovery.py` | GUARDED — PR #374 |
| 018 | Attractive discovery/regional estimate cannot become rankable retailer truth without evidence | `scripts/test-retailer-estimate-freshness.mjs`, `scripts/test-comparison.mjs` | GUARDED — truth contracts |
| 019 | Coding/site request is rejected before provider/action path | `scripts/test-bai-domain-gate-boundary.mjs` | GUARDED — PR #411 |
| 020 | Non-grocery shopping advice reaches shopping domain but is stopped by grocery MVP vertical gate before quota/provider | `scripts/test-bai-domain-gate-boundary.mjs` | GUARDED — PR #411 |
| 021 | `Добавь две пачки макарон` preserves explicit word quantity | `scripts/test-mvp021-word-quantity.mjs` | GUARDED — PR #393 / REG-019 |
| 022 | `Удали одну пачку макарон` decrements one pack only | `scripts/test-mvp022-decrement-pack.mjs` | GUARDED — PR #397 / REG-023 |
| 023 | `Бюджет теперь 4000` changes only budget and re-evaluates | `scripts/test-mvp023-budget-only.mjs` | GUARDED — PR #399 / REG-024 |
| 024 | `Бренды не важны` clears brand constraints only | `scripts/test-mvp024-brand-relax.mjs` | GUARDED — PR #406 / REG-026 |
| 025 | Stale/expired/unscoped exact-store evidence is downgraded/fails closed | `scripts/test-price-trust-quality.mjs`, `scripts/test-retailer-estimate-freshness.mjs` | GUARDED — PR #372 / REG-010 |
| 026 | Unknown/unmet delivery minimum prevents confirmed total/ranking; shortfall is explicit | `scripts/test-comparison.mjs` | GUARDED — comparison operational contract |
| 027 | Unknown loyalty eligibility/terms cannot count promo as guaranteed final cost | `scripts/test-promo-eligibility.mjs`, `scripts/test-lenta-adapter.mjs` | GUARDED — PR #386 / REG-016 |
| 028 | Exact-store out-of-stock evidence suppresses stale price and prevents silent coverage loss | `scripts/test-retailer-overlay.mjs` | GUARDED — PR #384 / REG-015 |
| 029 | Equal charged cost has stable deterministic tie-break by coverage/evidence/convenience/stable id | `scripts/test-plan-tie-break.mjs` | GUARDED — PR #388 / REG-017 |
| 030 | `Почему этот вариант?` explains actual plan facts/trade-offs only | `scripts/test-mvp030-decision-explanation.py` | GUARDED — PR #390 / REG-018 |

## Final replay contract

Before a closed-beta decision:

1. Run the normal repository CI from fresh `main`, including golden shopping core, Bai/runtime/data/governance and real-browser suites.
2. Treat any newly reproduced P0/P1 failure as a blocker and add it to `REGRESSION_BANK.md`.
3. Do not reopen already guarded behavior because of wording/style preferences alone.
4. Confirm Gate D handoff remains capability-honest against `RETAILER_CAPABILITIES.md`.
5. Complete `RELEASE_GATE.md` Gate F independently; this matrix is acceptance evidence, not a security waiver.

**Current acceptance conclusion:** all 30 canonical scenarios have executable merged evidence. The remaining closed-beta release-critical work is final replay/evidence consolidation plus Gate F security/legal/cost review; trained-Bay corrected re-evaluation remains a parallel external-GPU dependency and is not allowed to weaken the deterministic fallback.
