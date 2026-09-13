# Votonobay — MASTER ROADMAP

**Version:** 1.0  
**Status:** living source of project direction  
**Last updated:** 2026-09-13  
**Current phase:** grocery/FMCG MVP → prove the real end-to-end shopping loop  
**Repository source of truth:** `main`

> This document is the operational constitution of Votonobay. Before substantial work: fresh-read `main`, read this roadmap, inspect relevant current files and recent PRs, then work from the actual repository state. Do not work from stale chat memory.

## 1. Product thesis

Votonobay is an **independent AI shopper on the user's side**.

Stores sell. Marketplaces deliver. **Votonobay chooses for the user.**

Bay must optimize for what the person actually wants, not blindly for the lowest sticker price. Intent can include price, quality, healthy/PP choices, speed, convenience, brands, one store, multiple stores, delivery/offline fulfillment, or combinations such as “good meat, save on everything else.”

Partner revenue must never determine Bay's recommendation.

## 2. Current MVP scope

### IN
- Grocery / FMCG.
- Online grocery / delivery.
- Natural-language shopping requests.
- Persistent basket operations: add, remove, replace, rebuild, constraints.
- Real product identity and price/store evidence.
- Whole-basket comparison.
- One-store and bounded multi-store purchase strategies.
- Honest handoff to retailer channels that are actually supported.

### OUT FOR NOW
- Electronics, furniture, fashion, auto, travel and other verticals.
- General-purpose assistant behavior such as coding, essays or unrelated knowledge tasks.
- Paid ranking.
- Pretending that unverified price, stock, store identity or cart transfer is verified.
- Unauthorized private API use, protection bypass, anti-bot evasion or ban evasion.

## 3. Golden user loop

`User intent → Bay understands constraints → UniversalBasket → candidate real products → verified price/store evidence → StoreBasket(s) → PurchasePlan → Bay verdict/explanation → purchase handoff`

Primary MVP proof:

> A person naturally says what they need. Bay understands it, builds a real basket, chooses a good purchase strategy, explains the decision, uses honest current evidence, and lets the user continue toward purchase.

## 4. Core architecture

### ShoppingIntent
What the user wants: budget, quality, health, brands, timing, fulfillment and hard/soft constraints.

### UniversalBasket
Canonical basket owned by Votonobay and independent of any retailer.

### StoreBasket
Projection of the UniversalBasket into a particular retailer/store/channel with retailer SKU, availability, evidence and costs.

### PurchasePlan
A complete executable strategy made from one or more StoreBaskets.

PurchasePlan should account for item totals, delivery/service fees, minimum-order feasibility, coverage, evidence confidence, store/fulfillment count, substitutions and user preferences. Savings are compared against the best feasible single-store plan for the same basket and constraints.

Default multi-store behavior: consider at most 2 stores. Three or more only when explicitly allowed or later justified by an approved product rule.

## 5. Bay intelligence contract

Bay is the main orchestrator and the only assistant identity the user needs to see.

Principle:

**Neural model understands/plans → deterministic code validates → code executes → result is verified → neural layer repairs/explains when needed.**

The model may reason about fuzzy intent, semantic substitutions and trade-offs. Deterministic code owns action validation, arithmetic, hard constraints, truth/rankability rules and execution contracts.

Bay is shopping-only. A Domain Gate must reject unrelated capabilities before expensive model/provider work. Tool/action capabilities must be allowlisted rather than protected only by prompting.

Failures become regression cases. No uncontrolled online self-learning from raw user behavior.

## 6. Data / matching / trust

The critical risk triangle is:

**DATA → MATCHING → TRUST**

A rankable observation should be able to answer, where applicable:

`product identity → exact retailer/store/channel → observed price → availability → timestamp → source/proof → confidence → rankability`

Product identity evidence does not automatically prove price, stock or exact store. Receipt QR metadata does not automatically prove parsed line items. Search/AI discoveries are candidates, not final price truth.

Missing data must never be silently treated as zero. Non-equivalent substitutions must not win merely because they are cheaper.

## 7. External providers

Bay may use replaceable narrow scouts/checkers for discovery or reasoning. No external provider is the product's source of truth by itself.

Architecture:

`Bay → Provider Router → permitted provider(s) → evidence/truth layer → deterministic validation`

Provider Guard requirements:
- per-provider allowed-use registry;
- zero-budget mode / no automatic paid upgrade;
- rate limits and queues;
- cache and deduplication;
- exponential backoff;
- stop on authorization/rate-limit failures rather than retry storms;
- circuit breaker and kill switch;
- provenance logging;
- fallback when a provider disappears.

No single external service should be able to kill Votonobay.

## 8. Retailer integration ladder

A retailer can independently sit at one of these capabilities:

`COMPARE_ONLY → REDIRECT → DEEP_LINK → PARTNER → API_CART → API_ORDER`

Do not imply deeper integration than actually exists. Votonobay's UniversalBasket survives even when a retailer only supports comparison or redirect.

## 9. UX / brand contract

Master brand: **Votonobay** (working brand; final legal/domain clearance still required before public launch).

Bay is the snow-leopard shopping agent and the primary product interface. Approved Bay-first/Roxy visual direction should not be reinvented casually.

Decision hierarchy should remain conclusion-first:

`Bay verdict → why → compromise/trade-off → primary action → quieter alternatives → basket details`

Loading, empty, error, offline, mobile and reduced-motion states are product states, not afterthoughts.

Public URL still contains legacy `tamdeshevle`; final brand spelling, trademark/domain/social checks and public-domain migration are a pre-release requirement.

## 10. Security and legality

- Never bypass authentication, CAPTCHA, anti-bot protections or access controls.
- Never rotate accounts/keys to evade provider enforcement.
- Public availability does not automatically grant unrestricted reuse rights.
- Separate discovery from verified evidence.
- Minimize secrets and sensitive data in client/browser code.
- Security review is a release gate.
- User-provided receipts, QR codes, photos and account/session-side data require explicit lawful user participation appropriate to the mechanism.

## 11. Business invariant

**Money comes after Bay's decision and never determines Bay's decision.**

Potential layers after product proof: affiliate/order commission, permitted CPA/referral, Bay+ subscription, transaction infrastructure, privacy-preserving aggregate B2B insights and later API/white-label.

No paid ranking.

## 12. Ownership map

| Area | Primary owner role | Boundary |
|---|---|---|
| Shopping kernel/state/actions/validator | Vi | Does not redefine price truth or approved UX strategy |
| Price/data/provenance/sources | Price 2 | Does not redefine Bay UX or neural orchestration |
| Bay reasoning/planner/critic/evals | Умняша Бая | Cannot bypass deterministic truth/action contracts |
| Product visual/UX direction | Roxy/design | Does not alter ranking/truth semantics |
| Security/release risk | Reinhard | May block release on P0 security issues |
| Master product architecture/strategy | MASTER + owner decisions | Fundamental scope/strategy changes require explicit owner approval |

Agents may update factual status, tests, blockers and completed work. They must **not silently change foundational product strategy**.

## 13. Priority policy

- **P0:** site breaks/hangs, shopping flow unusable, data lies, critical security/truth failure → fix immediately.
- **P1:** wrong Bay/basket/store/price/multi-store/mobile behavior → fix during current audit/workstream.
- **P2:** UX/text/animation/minor visual defect → batch after critical flow.
- **P3:** cosmetic/nice-to-have → defer while MVP blockers remain.

Audit loop:

`fresh main → reproduce → root cause → fix → tests → verify adjacent behavior → PR/merge → update status → next`

## 14. Definition of Done

A task is not DONE merely because code was written. For applicable work, DONE means:

- implementation is in `main`;
- relevant automated tests/contracts pass;
- intended user scenario is verified;
- adjacent critical behavior is not knowingly broken;
- truth/security boundaries remain intact;
- documentation/status is updated when the change materially affects the roadmap;
- no known P0/P1 regression caused by the change remains hidden.

## 15. MVP release gate

Public/closed-test readiness requires the critical path to work end to end:

- Bay understands natural grocery intent and follow-up changes;
- persistent UniversalBasket behavior is correct;
- real products are mapped with acceptable identity confidence;
- price/store/channel evidence is honest and sufficiently fresh;
- best feasible single-store plan works;
- bounded multi-store PurchasePlan works and includes real fees/constraints where known;
- Bay explains trade-offs without fabricating certainty;
- retailer handoff is honest and usable;
- mobile and network/error recovery are usable;
- regression suite passes;
- security release review passes.

## 16. Current status — v1.0 snapshot

### DONE / materially established
- Votonobay master brand is present in the current product UI/docs.
- Bay-first product direction and approved Roxy visual hierarchy are materially implemented.
- Shopping-agent engineering has deterministic action/truth boundaries and runtime fallback work in place.
- Product identity and receipt provenance foundations exist.
- Offline training/eval/promotion infrastructure and guarded trained-runtime bridge exist.
- Real Kaggle GPU training execution has begun; training pipeline has encountered and is being hardened against real T4 runtime failures.

### NOW — MVP blockers
1. Finish and prove the first successful trained Bay checkpoint through held-out eval and promotion gate; do not claim deployment before proof.
2. Complete/verify UniversalBasket → StoreBasket mapping as a first-class product contract.
3. Implement/verify deterministic Multi-Store PurchasePlan optimizer.
4. Establish a small number of useful real grocery sources with trustworthy evidence rather than chasing broad retailer count.
5. Run real end-to-end shopping scenarios and convert failures into regressions.

### NEXT
- 50 manually checked real shopping requests across the MVP loop.
- Honest retailer-specific handoff capability matrix.
- Provider Router/Guard expansion only where it improves measured coverage/quality.
- Closed test with a small group of ordinary shoppers.
- Security/release audit.

### LATER
- Additional shopping verticals.
- Deeper partner/API ordering integrations.
- Broader monetization layers.
- Large retailer/provider expansion after the core loop is proven.

## 17. Living-document protocol

Every substantial workstream should follow this protocol:

1. Fresh-read `main` and this MASTER.
2. Inspect relevant current implementation and recent PRs; never patch blind.
3. Take the highest-priority unblocked task within the agent's ownership boundary.
4. Implement and test it.
5. Fix discovered P0/P1 defects in scope rather than merely reporting them.
6. Update factual roadmap/status/decision records when materially changed.
7. Fundamental changes to scope, architecture, brand strategy, truth policy or monetization invariants require explicit owner approval.

If the MASTER conflicts with actual merged code, **do not guess**. Record the conflict, inspect the relevant decision/history, and reconcile the document with the approved reality.

## 18. Decision log

Use short durable entries. Do not rewrite history; supersede old decisions explicitly.

| ID | Date | Decision | Status |
|---|---|---|---|
| ADR-001 | 2026-09-13 | Votonobay is an independent AI shopper, not merely a cheapest-price aggregator | ACTIVE |
| ADR-002 | 2026-09-13 | Current MVP scope is Grocery/FMCG + online grocery/delivery | ACTIVE |
| ADR-003 | 2026-09-13 | UniversalBasket is retailer-independent; StoreBasket is a projection; PurchasePlan is the execution strategy | ACTIVE |
| ADR-004 | 2026-09-13 | Neural reasoning is bounded by deterministic actions, truth rules and verification | ACTIVE |
| ADR-005 | 2026-09-13 | Partner economics never influence Bay's recommendation ranking | ACTIVE |
| ADR-006 | 2026-09-13 | MASTER is a living source of direction; agents may update factual status but not silently change foundational strategy | ACTIVE |

## 19. Companion operational files

The MASTER should stay readable. Detailed operational state should progressively live in companion artifacts:

- `PROJECT_STATUS.md` — short current-state dashboard.
- `DECISIONS/` — detailed ADRs when a decision needs more than the table above.
- regression suites / regression bank — every important Bay failure becomes a permanent test.
- source/provider registry — permissions, provenance, freshness, ranking eligibility, limits and fallbacks.
- CI/release gates — automate what should not depend on agent memory.

Until a companion file exists, this MASTER remains the higher-level source of approved direction.
