# VOTONOBAI — MASTER ROADMAP

**Version:** 1.1  
**Status:** living product constitution  
**Last updated:** 2026-09-16  
**Current phase:** Grocery/FMCG — controlled closed beta  
**Repository source of truth:** `main`

This file contains durable product direction and invariants. Operational detail belongs in `PROJECT_STATUS.md`, `SWARM_PROTOCOL_V2.md`, `RELEASE_GATE.md`, issue `#474`, ADRs, registries and regression suites.

Before substantial work follow `AGENTS.md` + `SWARM_PROTOCOL_V2.md`. Do not reread this whole file for a small in-scope fix unless the task changes architecture, roadmap, scope, release state or sources conflict.

## 1. Product thesis

**VOTONOBAI is an independent AI shopper on the user's side.**

Stores sell. Marketplaces deliver. **VOTONOBAI helps the user choose how to buy better.**

Bay optimizes for the user's actual conditions, not blindly for the lowest sticker price. Relevant intent may include price, quality, health preferences, time, convenience, brands, one store, multiple stores and delivery/offline fulfillment.

Business invariant:

> **Money comes after Bay's decision and never determines Bay's decision.**

No paid ranking.

## 2. Canonical brand

Binding brand contract: `BRAND_CANON.md`.

- Latin product brand: **VOTONOBAI**.
- Russian rendering: **Вотонобай**.
- Assistant / character: **Бай**.
- `Votonobay` is a superseded spelling for new public copy.
- Former «Там дешевле / Там Дешевле / Тамдешевле» identity is not the product name; those words may appear only as ordinary descriptive language where semantically appropriate.

Bay is the snow-leopard shopping agent and the main visible assistant identity. Approved Bay-first / Roxy visual direction should not be reinvented casually.

Public brand consistency is still a release concern: browser-visible migration, trademark/domain/social evidence and the legacy `tamdeshevle` public URL are governed by Gate G.

## 3. Current product scope

### IN now
- Grocery / FMCG.
- Natural-language shopping requests.
- Persistent basket operations: add, remove, replace, rebuild and constraints.
- Real product identity and price/store evidence.
- Whole-basket comparison.
- One-store and bounded multi-store strategies.
- Honest retailer handoff limited to capabilities actually supported.
- Controlled closed-beta observation and regression hardening.

### OUT for now
- General-purpose assistant behavior unrelated to shopping.
- Electronics/furniture/fashion/auto/travel vertical expansion.
- Paid ranking.
- Fabricated price, stock, exact-store identity, savings or cart/order transfer.
- Unauthorized private API use, auth/protection bypass, anti-bot evasion or ban evasion.
- Public-launch claims not supported by Gate G evidence.

## 4. Golden user loop

`natural request → ShoppingIntent → UniversalBasket → real candidate products → verified evidence → StoreBasket(s) → PurchasePlan → Bay verdict/explanation → honest handoff`

The user-facing mental model should stay simpler:

> **что купить → где купить → сколько стоит → сколько экономит / какой компромисс → что делать дальше**

Product law:

> **Сложность — наша проблема, а не проблема пользователя.**

Internal concepts such as SKU, provenance, confidence, rankability and exact-store scope stay behind the interface unless translated into a human-readable caveat needed for an honest decision.

## 5. Core shopping architecture

### ShoppingIntent
The user's goals and constraints: budget, quality, health preferences, brands, timing, fulfillment and hard/soft requirements.

### UniversalBasket
Canonical retailer-independent basket owned by VOTONOBAI.

### StoreBasket
Projection of the UniversalBasket into a particular retailer/store/channel with retailer SKU, evidence, availability semantics and costs.

### PurchasePlan
Executable purchase strategy containing one or bounded multiple StoreBaskets.

PurchasePlan may account for item totals, known delivery/service fees, minimum-order feasibility, coverage, evidence quality, store count, substitutions and user preferences.

Default multi-store behavior: at most **2 stores** unless an explicitly approved later rule says otherwise.

Savings must compare the same basket and constraints. Hard constraints dominate soft preferences.

Do not introduce a competing second state model for a local bug.

## 6. Bay intelligence contract

Bay is the orchestrator; deterministic code remains authority for truth-critical execution.

Principle:

> **Neural model understands/plans → deterministic code validates → code executes → result is verified → neural layer repairs/explains when needed.**

The model may reason about fuzzy intent, semantic substitutions, trade-offs and explanation. Deterministic code owns:
- action validation;
- arithmetic;
- hard constraints;
- truth/rankability rules;
- store/channel scope;
- capability limits;
- execution contracts.

**Model proposes; VOTONOBAI decides.**

Bay is shopping-only. Domain Gate and allowlisted actions must reject unsupported domains/actions before expensive or unsafe provider work.

Failures become regression/eval cases. No uncontrolled online self-learning from raw user behavior.

## 7. Data, matching and truth

Critical chain:

`DATA → MATCHING → TRUST`

A rankable observation should answer, where applicable:

`product identity → retailer/store/channel → observed price → availability semantics → timestamp → source/proof → confidence → rankability`

Rules:
- discovery is not proof;
- regional is not exact store;
- unknown is not zero;
- AI output is not verified retailer truth;
- product identity evidence does not automatically prove price/stock/store;
- do not mix prices from different physical stores as one exact-store fact;
- non-equivalent substitutions cannot win only because they are cheaper;
- stale-but-usable evidence must be visibly disclosed according to truth policy;
- when evidence is insufficient, fail closed rather than invent breadth.

Tali / Price 2 owns the truth/source boundary. `SOURCE_PROVIDER_REGISTRY.md`, `REGRESSION_BANK.md` and retailer capability contracts carry operational detail.

## 8. External provider / Bay Engine contract

Architecture:

`Bay → Provider Router → permitted provider(s) → evidence/truth layer → deterministic validation`

LLMs/providers are replaceable engines; none owns price truth or shopping authority.

Provider Guard requirements:
- allowed-use registry;
- zero-budget default / no silent paid upgrade;
- rate limits/queues;
- cache/deduplication;
- bounded retry/backoff;
- stop on auth/rate-limit failures rather than retry storms;
- circuit breaker / kill switch;
- provenance logging;
- deterministic fallback.

New provider/engine work must be justified by measured need or an approved bake-off. Do not build an engine zoo.

## 9. Retailer capability ladder

A retailer may independently sit at:

`COMPARE_ONLY → REDIRECT → DEEP_LINK → PARTNER → API_CART → API_ORDER`

Never imply deeper integration than `RETAILER_CAPABILITIES.md` proves. UniversalBasket must survive even when a retailer supports only comparison or redirect.

No retailer partnership claim without a real partnership.

## 10. UX contract

Decision hierarchy should remain conclusion-first:

`Bay verdict → why → trade-off / uncertainty → primary action → quieter alternatives → basket details`

Loading, empty, offline, error, mobile, browser-back/return and reduced-motion are product states.

Default UX question:

> **Можно ли сделать это на один шаг проще?**

Prefer removing unnecessary steps/controls over adding configuration. During beta, fix reproduced completion-blocking UX first; batch taste-only polish.

## 11. Security, privacy and legality

- Never bypass authentication, CAPTCHA, anti-bot protection or access controls.
- Never rotate identities/keys to evade provider enforcement.
- Public availability does not automatically grant unrestricted reuse rights.
- Minimize secrets and sensitive data in browser/client code.
- Zero-budget mode cannot silently create paid usage.
- User receipts/photos/account/cloud/session data require explicit lawful participation and a separately reviewed scope.
- Closed-beta Gate F approval currently applies only to the tested **local-only** scope.

Reinhard may block release on a reproduced P0 security/privacy/cost boundary failure.

## 12. Ownership and coordination

| Area | Primary role | Boundary |
|---|---|---|
| priorities / assignments / acceptance / merge / release | **Роуг** | owns delivery sequencing and release state |
| shopping kernel/state/actions/validator | **Vi** | does not redefine truth or approved UX strategy |
| price/data/provenance/sources | **Tali / Price 2** | does not redefine Bay UX/neural orchestration |
| reasoning/planner/critic/eval/training quality | **Умняша Бая** | cannot bypass deterministic truth/action contracts |
| UX/visual direction | **Sara 2 / Roxy** | does not alter ranking/truth/kernel semantics |
| security/release risk | **Reinhard** | may block on reproduced P0 security risk |
| architecture/options research | **Арбитр** | research/recommendation only unless Rogue approves implementation |
| beta growth/communication | **Карина / Ghost** | markets only proven capabilities |

Canonical live coordination surface: **#474 — ROGUE INBOX**.

Execution mechanics are defined by `SWARM_PROTOCOL_V2.md`: tiered fresh-read, Task Envelope, WIP limit, red-CI ownership, delta-only handoffs and Fast Done.

## 13. Priority policy

- **P0:** site unusable/hanging, data lie, critical security/truth failure → interrupt and fix.
- **P1:** wrong Bay/basket/store/price/multi-store/mobile behavior or completion-blocking UX → fix current workstream.
- **P2:** non-blocking UX/text/animation/quality issue → batch unless explicitly promoted.
- **P3:** cosmetic/nice-to-have → defer.

Controlled beta rule: no speculative parser/UX/architecture/provider rewrite without a reproduced problem or approved experiment.

## 14. Definition of Done

For implementation, DONE normally requires:
- smallest intended problem resolved;
- relevant automated contracts green;
- intended scenario verified;
- adjacent critical behavior not knowingly broken;
- truth/security/capability boundaries intact;
- merged into fresh `main` when repository change is required;
- material regression/source/status docs updated only when needed;
- one final delta handoff in #474;
- no hidden P0/P1 caused by the change.

Writing code or posting a report is not DONE by itself.

## 15. Release model

### Controlled closed beta
**PASS for the tested local-only scope.**

Gates A–F are supported by merged acceptance/regression evidence. This does not authorize public launch, cloud/account/receipt-photo personal-data processing, unsupported ordering, or broader retailer claims.

During beta:
1. run real users through the golden loop;
2. preserve their real wording;
3. turn material failures into reproducible evidence;
4. fix P0/P1 by root cause + permanent regression;
5. do not destabilize guarded behavior for speculative improvements.

### Public launch
**NOT APPROVED.**

Requires Gate G plus continued A–F health. Gate G currently includes:
- browser-visible brand normalization to `BRAND_CANON.md`;
- trademark/existing-brand evidence appropriate to launch scope;
- verified domain/social control or availability decisions;
- intentional resolution of the legacy `tamdeshevle` public URL;
- no false retailer partnership/capability claims.

## 16. Current strategic priorities

1. **Controlled beta evidence** — ordinary users complete the golden loop without explanation.
2. **Truth coverage quality** — maintain exact-store/freshness/provenance integrity and expand only with defensible evidence.
3. **Gate G** — finish public brand/domain/trademark/social/legacy-URL hygiene without blocking beta learning.
4. **Bay quality in parallel** — corrected same-adapter re-evaluation and measured provider/engine research; no unproven trained/provider path may silently replace the release-safe deterministic path.
5. **Simplicity** — reduce unnecessary steps/jargon before adding features.

The phase transition is triggered by real beta evidence and Gates A–G, not by feature count.

## 17. Decision log

| ID | Date | Decision | Status |
|---|---|---|---|
| ADR-001 | 2026-09-13 | Product is an independent AI shopper, not merely a cheapest-price aggregator | ACTIVE |
| ADR-002 | 2026-09-13 | Current product scope is Grocery/FMCG | ACTIVE |
| ADR-003 | 2026-09-13 | UniversalBasket is retailer-independent; StoreBasket is a projection; PurchasePlan is execution strategy | ACTIVE |
| ADR-004 | 2026-09-13 | Neural reasoning is bounded by deterministic action/truth validation | ACTIVE |
| ADR-005 | 2026-09-13 | Partner economics never influence recommendation ranking | ACTIVE |
| ADR-006 | 2026-09-13 | MASTER is living direction; foundational strategy cannot change silently | ACTIVE |
| ADR-007 | 2026-09-14 | Trained checkpoint remains fail-closed until promotion evidence and explicit release binding | ACTIVE |
| ADR-008 | 2026-09-15 | Bay Engine owns provider abstraction; LLMs are replaceable outside truth/action authority | ACTIVE |
| ADR-009 | 2026-09-15 | Bay Character Canon is provider-independent and regression-protected | ACTIVE |
| ADR-010 | 2026-09-15 | Rogue is the delivery coordination boundary | ACTIVE |
| BRAND-CANON | 2026-09-16 | Canonical brand = VOTONOBAI / Вотонобай; assistant = Бай | ACTIVE |
| SWARM-V2 | 2026-09-16 | Tiered fresh-read + Task Envelope + WIP/red-CI/delta-handoff execution protocol | ACTIVE |

## 18. Companion operational files

- `AGENTS.md` — mandatory agent operating contract.
- `SWARM_PROTOCOL_V2.md` — execution-speed protocol.
- `PROJECT_STATUS.md` — current dashboard, not durable strategy.
- `RELEASE_GATE.md` — release evidence / A–G decision.
- `BRAND_CANON.md` + `GATE_G_BRAND_PREFLIGHT.md` — public-brand contract and Gate G evidence.
- `DECISIONS/` — detailed ADRs.
- `REGRESSION_BANK.md` / executable suites — important failures become permanent guards.
- `SOURCE_PROVIDER_REGISTRY.md` — source/provider permissions, provenance, freshness and rankability.
- `RETAILER_CAPABILITIES.md` — handoff capability truth.
- `#474` — live assignments, blockers and handoffs.

If current merged code, this MASTER and a durable decision appear to conflict, do not guess. Inspect the decision/history and reconcile explicitly through Rogue/owner as required.
