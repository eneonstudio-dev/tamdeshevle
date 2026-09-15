# Votonobay — PROJECT STATUS

**Updated:** 2026-09-16  
**Master:** `VOTONOBAI_MASTER_ROADMAP.md`  
**Phase:** Grocery/FMCG MVP — controlled closed beta  
**Closed-beta decision:** PASS for tested local-only scope  
**Public launch:** NOT APPROVED

Fresh-read `main`, `RELEASE_GATE.md` and issue #474 before trusting this snapshot.

## Mission now

Run the proven shopping loop with a small controlled beta cohort, observe real failures, and fix only reproduced P0/P1 defects:

`natural shopping request → correct intent/constraints → UniversalBasket → real products/prices → StoreBasket(s) → PurchasePlan → Bay verdict → honest purchase handoff`

Product UX rule for beta:

> **Сложность — наша проблема, а не проблема пользователя.**

A normal user should operate in ordinary language. Internal concepts such as SKU, provenance, confidence, rankability and exact-store scope stay behind the interface unless a human-readable caveat is necessary for an honest decision.

## Release state

| Area | State | Evidence / boundary |
|---|---|---|
| Gates A–F | **PASS — closed beta local-only** | `RELEASE_GATE.md`; fresh-main evidence replay #493; release decision merged in PR #495 |
| Owner shopping loop | **GUARDED** | PR #486: `100 ₽ dinner → привет → 7000 ₽ basket → Магнитом → да`; state/action acceptance, real retailer reprojection, honest fail-closed final confirmation |
| Exact-store Magnit truth | **GUARDED** | PRs #490/#491; physical store key `magnit:770105`; REG-039 guarded in PR #494 |
| Canonical MVP 001–030 | **GUARDED** | `MVP_ACCEPTANCE_MATRIX.md` maps all 30 scenarios to executable evidence |
| Mobile / recovery / return | **GUARDED FOR TESTED PATH** | browser/mobile regressions and A–F replay green |
| Security / personal data | **PASS ONLY FOR LOCAL-ONLY BETA SCOPE** | personal account/cloud/receipt-photo processing remains disabled pending separate privacy/legal review |
| Retailer handoff | **BOUNDED BY DECLARED CAPABILITY** | `RETAILER_CAPABILITIES.md`; no fake API_CART/API_ORDER claim |
| Public launch / Gate G | **OPEN** | final spelling, brand/domain/social/trademark hygiene and legacy public URL decision remain unresolved |
| Trained Bay checkpoint | **NOT RELEASE-BOUND** | corrected re-evaluation remains an external GPU track; deterministic runtime stays release-safe fallback |

## Current operational priority

1. **Run controlled closed beta, not another speculative rewrite.**
2. Capture real user failures with exact reproduction steps and observable state/action evidence.
3. Any beta P0/P1 follows: `reproduce → root cause → minimal fix → permanent regression → adjacent checks → CI → merge → fresh-main verify`.
4. Do not manufacture parser/UX changes without a reproduced beta problem.
5. Keep truth/security boundaries unchanged while beta runs.
6. Gate G work may proceed in parallel, but public launch remains blocked until every item in Gate G is explicitly resolved.

## Beta simplicity checks

During every live walkthrough, observe these product questions:

- Did the user understand what to type without instruction?
- Did Bay ask only questions that were genuinely necessary?
- Did the user get a clear answer to **what to buy / where / how much / how much saved / what next**?
- Was there any unnecessary screen, tap, filter or configuration step that could be removed?
- Did any internal technical term leak into normal UX?
- Was the primary next action obvious?
- Did uncertainty appear in plain language rather than fabricated certainty?

A simplicity problem becomes P1 when it prevents or materially misleads completion of the core shopping loop; otherwise batch it as P2 UX evidence rather than interrupting beta with redesign churn.

## Swarm coordination now

- **Роуг/Fixer:** own beta intake, P0/P1 triage, acceptance, merge and release state. No speculative shopping fixes.
- **Vi:** resume shopping-kernel architecture ownership when needed by a reproduced defect; no rewrite without evidence.
- **Тали:** keep exact-store/freshness/provenance quality healthy; expand rankable source coverage only with evidence.
- **Сара 2:** observe beta friction and fix reproduced critical UX; do not redesign guarded flows for taste alone.
- **Рейнхард:** keep security monitoring active; account/cloud/receipt-photo personal-data features remain disabled until separately reviewed.
- **Умняша Бая:** corrected candidate re-evaluation / Data Factory work stays parallel and cannot silently replace the deterministic release-safe path.
- **Карина/Ghost:** closed-beta communication may describe only capabilities that actually exist; no implied retailer partnership or unsupported ordering.

Canonical coordination surface: **#474 — ROGUE INBOX — Swarm Tasks & Handoffs**.

## Current known repo snapshot

At this status transition:

- closed-beta A–F decision was merged in PR #495 at `d8cffcdcb5b3a32dc75d5a4d58c5a522e1b40154`;
- REG-039 lifecycle closure PR #494 merged at `8cee600b24a1731b3a916a83dcd58123f371229d`;
- owner-loop regression #486 is merged and guarded;
- exact-store Magnit scope fix #491 is merged;
- fresh-main evidence-only replay #493 completed green across golden shopping, security, runtime, data/scripts, governance and real-browser UX;
- no known release-path P0/P1 justifies new shopping implementation at this snapshot.

Fresh-read `main` before using any SHA above as the newest repository head.

## Parallel Bay training state

The first trained Bay candidate remains **not promoted**. Historical rejection was produced by an evaluation path later found to have prompt-contract and split-integrity defects. Corrected same-adapter re-evaluation remains the next valid training decision point. Do not start iteration 2 unless corrected re-evaluation produces a validated rejection and the sanitized reviewed Gold requirements are satisfied. No trained checkpoint is a closed-beta dependency today.

## Public-launch blockers

Gate G remains open:

- final Votonobay/VOTONOBAI spelling approval;
- trademark/existing-brand/domain/social checks before public brand lock;
- replace or intentionally resolve the legacy `tamdeshevle` public URL;
- verify public copy never implies retailer partnership that does not exist.

Public launch also must not re-enable personal-data flows merely because closed beta passed in local-only mode.

## Definition of beta success

Closed beta is working when ordinary invited users repeatedly complete the golden shopping loop with honest data and correct basket decisions, while every material failure becomes reproducible evidence and a permanent regression rather than an anecdotal patch.

The next phase transition is not triggered by "more features". It is triggered by enough real beta evidence to justify a public-launch decision with Gates A–G satisfied.
