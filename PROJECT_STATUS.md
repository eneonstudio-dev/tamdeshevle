# VOTONOBAI — PROJECT STATUS

**Updated:** 2026-09-16  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Execution protocol:** `SWARM_PROTOCOL_V2.md`  
**Phase:** Grocery/FMCG — controlled closed beta  
**Closed-beta decision:** PASS for tested local-only scope  
**Public launch:** NOT APPROVED

Fresh-read `main`, this file and issue `#474` before acting. Use task-specific docs only for the touched boundary.

## Mission now

Run the proven shopping loop with a small controlled beta cohort, capture real failures, and improve only where evidence justifies it:

`natural request → ShoppingIntent → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest handoff`

User-facing rule:

> **Сложность — наша проблема, а не проблема пользователя.**

A normal user should understand what to buy, where, how much it costs, what trade-off/saving exists and what to do next without learning SKU/provenance/rankability/internal architecture.

## Current release state

| Area | State | Evidence / boundary |
|---|---|---|
| Gates A–F | **PASS — closed beta local-only** | `RELEASE_GATE.md`; evidence replay #493; release decision #495 |
| Owner shopping loop | **GUARDED** | #486 covers `100 ₽ → привет → 7000 ₽ → Магнитом → да` with state/action assertions |
| Exact-store Magnit truth | **GUARDED** | #490/#491; physical `magnit:770105`; REG-039 guarded by #494 |
| Canonical MVP 001–030 | **GUARDED** | `MVP_ACCEPTANCE_MATRIX.md` executable evidence |
| Mobile/recovery/return | **GUARDED FOR TESTED PATH** | browser/mobile regression + release replay |
| Security/personal data | **PASS ONLY FOR LOCAL-ONLY BETA** | account/cloud/receipt-photo personal-data processing remains outside approved beta scope |
| Retailer handoff | **CAPABILITY-BOUNDED** | `RETAILER_CAPABILITIES.md`; no fake API_CART/API_ORDER |
| Brand canon | **LOCKED** | #498 + `BRAND_CANON.md`: VOTONOBAI / Вотонобай / Бай |
| PWA canonical identity | **MERGED** | #506: manifest now uses VOTONOBAI; old assertions updated without runtime semantics change |
| Swarm operating model | **ACTIVE** | #507: tiered fresh-read, Task Envelope, WIP/red-CI ownership, delta-only handoff |
| Public launch / Gate G | **OPEN** | browser-visible legacy strings, trademark/domain/social evidence, legacy URL decision remain |
| Trained Bay checkpoint | **NOT RELEASE-BOUND** | corrected same-adapter re-evaluation remains parallel; deterministic safe path stays authoritative |

## Active delivery outcomes — keep small

### 1. Gate G browser normalization — issue #499
**Owner:** Sara 2 / Roxy  
**Priority:** P1 public-launch hygiene

Success:
- browser-visible public product identity follows `BRAND_CANON.md`;
- no `Votonobay` as active public brand spelling;
- no «Тамдешевле / Там Дешевле» presented as product/app name;
- descriptive ordinary-language uses are not blindly replaced;
- runtime/browser/brand checks remain green;
- shopping/truth/state semantics remain untouched.

PWA/manifest slice is already merged in #506. Remaining work is visible browser surfaces + manual desktop/mobile verification.

### 2. Controlled-beta live walkthrough — issue #500
**Owner:** Fixer / QA with Rogue acceptance  
**Priority:** P1 beta evidence

Run fresh deployed `main` on PC + Android through:

`natural request → basket → retailer/store choice → comparison/PurchasePlan → honest handoff`

Also verify Search tap, Bay collapse/restore, List actions, fresh-storage state, back/refresh/return and recovery states. Record exact beta failure intake from `SWARM_PROTOCOL_V2.md`. Do not redesign from taste.

### 3. Truth coverage / exact-store health — issue #502
**Owner:** Tali / Price 2  
**Priority:** P1 truth quality / research + approved fixes

Maintain current exact-store/freshness/provenance guards and investigate the next legally/permissibly usable source only with explicit evidence. No anti-bot/auth bypass. Broad weak coverage is not progress.

## Parallel non-blocking tracks

- **Arbiter / #503:** engine/aggregator architecture inventory and smallest measured next experiment. Research only; must include what not to build.
- **Umnyasha / #504:** corrected same-adapter Bay re-evaluation. No retraining or promotion until eval gates justify it.
- **Karina / #505:** zero-budget controlled-beta cohort and useful failure-feedback capture. Optimize for qualified usage, not reach.
- **Reinhard / #501:** Gate G/security/legal/cost preflight, including domain/trademark/social/legacy URL evidence and CI/tooling security debt. No legal-clearance claims from ordinary search absence.
- **Vi:** activate only for a reproduced kernel/state/action invariant failure or an explicitly approved architecture task.

## Swarm rules now

All agents follow `AGENTS.md` + `SWARM_PROTOCOL_V2.md`.

Operational defaults:
- one implementation PR per specialist at a time;
- one research task may run in parallel;
- red owned CI outranks new P2/P3 work;
- no new technical track without Rogue assignment unless already explicitly approved;
- handoffs in #474 are delta-only;
- finish before expanding;
- evidence before opinion.

## Beta simplicity questions

For every live walkthrough:
- Did the user know what to type without instruction?
- Did Bay ask only genuinely necessary questions?
- Was the result clear: **what / where / price / trade-off or saving / next action**?
- Was any screen/tap/filter unnecessary?
- Did internal jargon leak?
- Was uncertainty explained plainly rather than hidden or fabricated?
- Could the same result be reached in one fewer step?

A simplicity problem is P1 only when it prevents or materially misleads completion; otherwise collect it as P2 beta evidence.

## Stable facts that should not be reopened without new evidence

- Controlled closed beta A–F is already PASS for the tested local-only scope.
- UniversalBasket → StoreBasket → PurchasePlan is the approved shopping architecture.
- Default multi-store is bounded to at most 2 stores.
- Exact-store price truth cannot be generalized from one physical store to a generic chain.
- Discovery/regional/AI output does not become rankable truth by convenience.
- Final `да` must not fabricate ordering/capability.
- Brand is VOTONOBAI / Вотонобай; assistant is Бай.
- Paid/provider/model work cannot silently become a release dependency.
- Personal account/cloud/receipt-photo processing is not automatically approved by the local-only beta decision.

## Known queue hygiene

Several old open PRs predate the current guarded architecture and controlled-beta decision. An open PR must mean an active merge candidate, not historical storage. Rogue is closing only branches proven superseded/expired; uncertain ideas remain history/backlog until a reproduced beta need justifies a fresh branch from current `main`.

## Public-launch blockers

Gate G remains OPEN. Remaining evidence:
- finish browser-visible migration to `BRAND_CANON.md`;
- authoritative trademark/existing-brand preflight appropriate to intended launch scope;
- verified selected domain/social control or availability decisions;
- intentional decision for legacy `tamdeshevle` public URL;
- continue public-copy partnership/capability guard;
- keep Gates A–F healthy through beta.

Public launch must not be inferred from closed-beta PASS.

## Training / Bay intelligence

The first trained candidate is **not promoted**. Historical rejection was affected by evaluation-contract/split-integrity defects. The next valid decision point is corrected same-adapter re-evaluation. Do not start iteration 2 unless corrected evidence justifies it and sanitized reviewed-Gold requirements are met.

Provider/engine research is allowed in parallel, but deterministic truth/action authority and safe fallback remain binding.

## Definition of beta success

Controlled beta succeeds when ordinary invited users repeatedly complete the golden shopping loop with honest data and correct basket decisions, while material failures become reproducible regression/eval evidence rather than anecdotal patches.

The next phase transition is driven by **real beta evidence + Gate G**, not by adding more features.
