# Votonobay — Closed Beta Release Evidence

**Scope:** grocery/FMCG closed beta, local-only personal-data mode  
**Decision state:** CANDIDATE PASS — merge only after the final replay PR is green; verify the merged head before declaring release-ready.  
**Behavior evidence head:** `5893599c2a6c35a87552d0d2fc6d4da66a06cff5` (merged PR #454)  
**Gate-F decision head before this replay:** `0e605387cf9afb351ef72a22a8590b5e69da7d0d` (merged PR #457)

This is the release index for Gates A–F. It does not approve public launch. Gate G remains open.

## Why the behavior evidence remains valid

Between behavior head `5893599c...` and this replay base, subsequent merged changes are limited to documentation and teacher/training/evaluation tooling. No shopping runtime, truth, handoff, browser release-scope, auth/data-boundary or retailer execution behavior changed. The final replay PR still reruns release-relevant CI on its own merge candidate instead of relying on inherited evidence alone.

## Gate A — Core shopping loop

PASS evidence:
- `MVP_ACCEPTANCE_MATRIX.md`: all 30 canonical scenarios are `GUARDED`.
- Intent/state follow-up guards include MVP-002/003/004/011/012/015/021/022/023/024.
- `scripts/test-bai-domain-gate-boundary.mjs` guards non-shopping and unsupported vertical boundaries.
- `scripts/test-shopping-state-consistency.mjs`, `scripts/test-unified-cart-state.mjs` and the golden shopping workflow guard deterministic state/action execution.
- Exact behavior-head golden run `34900001886` succeeded.

## Gate B — Product/data truth

PASS evidence for the tested path:
- MVP-009/010/018/025/027/028 cover missing truth, SKU equivalence, discovery-only estimates, freshness/scope, promo eligibility and exact-store out-of-stock handling.
- `REG-001`, `REG-009`, `REG-010`, `REG-015`, `REG-016`, `REG-020`, `REG-021`, `REG-025`, `REG-034`, `REG-035` are `GUARDED`.
- `SOURCE_PROVIDER_REGISTRY.md` defines truth authority, rankability, scope, zero-budget behavior and fallback for enabled sources.
- Exact behavior-head data/scripts run `34900001805` succeeded.

This does not claim universal exact-store coverage. Unknown/unsupported evidence remains unknown or non-rankable as documented in `KNOWN_LIMITATIONS.md`.

## Gate C — Purchase strategy

PASS evidence:
- MVP-005/006/007/008/026/029/030 cover single-store baseline, max-two-store split, fees/minimums, net savings, deterministic tie-break and explanation.
- `REG-004`, `REG-011`, `REG-013`, `REG-017`, `REG-018`, `REG-029`, `REG-032` are `GUARDED`.
- Hard constraints remain above soft preferences; qualitative savings cannot silently rewrite a hard budget.
- Exact behavior-head golden run `34900001886` succeeded.

## Gate D — Handoff

PASS evidence:
- `RETAILER_CAPABILITIES.md` declares the capability ladder for every enabled retailer/channel.
- Enabled grocery retailers are bounded to `COMPARE_ONLY`/`REDIRECT` unless stronger capability is separately proven; none claims `API_CART`/`API_ORDER`.
- `scripts/test-retailer-handoff-gate.py` and `scripts/test-roxy-handoff.py` guard usable targets and honest copy.
- Exact behavior-head real-browser run `34900001694` succeeded.

## Gate E — Reliability / UX

PASS evidence:
- Mobile, long basket/product names, network recovery, return continuity and post-purchase proof are executable browser guards.
- `REGRESSION_BANK.md` currently contains no `OPEN` P0/P1 release-path regression; `REG-001`…`REG-037` are guarded at this decision point.
- Exact behavior-head real-browser `34900001694` and runtime `34900001755` succeeded.

## Gate F — Security / legal / cost

PASS **only for the closed-beta local-only scope**:
- `SECURITY_GATE_F.md` records `PASS — CLOSED-BETA LOCAL-ONLY SCOPE`.
- PR #426 made analytics opt-in and paid LLM inference require explicit server-side enablement.
- PR #454 removes personal account/cloud/receipt-photo processing from closed-beta release scope: `TD_SUPABASE = null`, remote account/cloud/receipt APIs fail closed, and local data remains available.
- Provider/source use remains bounded by `SOURCE_PROVIDER_REGISTRY.md`; no anti-bot/auth/ban bypass is required for the tested path.
- Exact behavior-head security run `34900001701` succeeded and live production boundary probes passed.

This PASS is a scope reduction, not legal advice or privacy/legal approval. Public release or re-enabling personal account/cloud/receipt-photo processing remains blocked on separate privacy/legal review.

## Gate G — intentionally not part of this decision

Gate G stays OPEN. The working brand still needs public legal/trademark/domain/social clearance and the legacy `tamdeshevle` technical URL is accepted only for closed testing. No public-launch claim is made by this document.

## Final replay rule

The final release-replay PR must pass:
- golden shopping core;
- data/scripts;
- app runtime resilience;
- master governance + `scripts/test-closed-beta-release-gate.mjs`;
- continuous security monitoring;
- real-browser UX, including retailer handoff and closed-beta local-only Gate F UX.

Any newly reproduced P0/P1 failure cancels the candidate PASS and returns to reproduce → regression → fix → merged-state verification.
