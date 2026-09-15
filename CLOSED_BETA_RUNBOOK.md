# Votonobay — Controlled Closed Beta Runbook

**Status:** active after Gates A–F closed-beta PASS  
**Scope:** tested local-only release path only  
**Public launch:** not approved

This runbook defines how Votonobay moves from internal proof to real-user evidence without turning beta into uncontrolled feature development.

## 1. Beta objective

Prove that an ordinary shopper can use Votonobay naturally and complete the core loop repeatedly:

`request → understood constraints → basket → honest store/price evidence → purchase plan → clear Bay verdict → supported next action`

The beta is not a contest to add features. Its job is to find real failures in the already-approved loop.

## 2. Product simplicity rule

> **Сложность — наша проблема, а не проблема пользователя.**

The user should not need to understand Votonobay's internal architecture.

Normal UX should reduce to:

**что купить → где купить → сколько стоит → сколько экономит → что делать дальше**

Keep SKU, provenance, confidence, rankability, exact-store keys and internal state-machine terms out of normal user-facing copy. When uncertainty matters, translate it into plain language such as “цена могла измениться — лучше перепроверить перед покупкой”.

Before accepting any beta UX change, ask:

**Можно ли сделать это на один шаг проще?**

## 3. Binding scope limits

Closed beta currently allows only the scope already passed by `RELEASE_GATE.md`.

Do not silently enable:

- personal account/cloud processing;
- receipt-photo personal-data processing;
- unsupported API_CART/API_ORDER behavior;
- unsupported retailer partnerships;
- paid providers in zero-budget mode;
- unpromoted trained Bay checkpoints.

Retailer capability remains bounded by `RETAILER_CAPABILITIES.md`. Truth remains bounded by source/provenance/freshness/rankability contracts.

## 4. What to observe in every beta session

Capture the user's natural wording before coaching them.

Then observe:

1. Can they start without an explanation of the interface?
2. Does Bay understand the shopping goal and constraints?
3. Does Bay avoid unnecessary clarification?
4. Does the UniversalBasket persist through follow-ups?
5. Does changing retailer/constraint reproject the real StoreBasket/PurchasePlan rather than only changing text?
6. Are budget and hard constraints obeyed?
7. Are price/store/availability claims honest about evidence and freshness?
8. Is the result conclusion-first and understandable?
9. Is the primary next action obvious and actually supported?
10. Can the user recover from back/refresh/network/error states without losing or corrupting the basket?
11. On mobile, can the entire flow be completed without hidden controls, broken composer behavior or layout traps?
12. Did the user encounter an unnecessary tap, filter, screen or technical term?

## 5. Evidence format for a failure

A beta failure is actionable when it includes enough evidence to reproduce it.

Record:

```text
BETA CASE: <short id/date>
DEVICE / VIEWPORT: <if relevant>
START STATE: <new/returning basket state>
USER INPUTS:
1. ...
2. ...

EXPECTED:
<observable user-level result>

ACTUAL:
<observable result>

STATE / ACTION EVIDENCE:
<UniversalBasket / StoreBasket / PurchasePlan / action evidence when available>

TRUTH EVIDENCE:
<source/store/timestamp/provenance if relevant>

SEVERITY:
P0 | P1 | P2 | P3
```

Do not record secrets, credentials or unnecessary personal data.

## 6. Triage policy

### P0 — stop and fix immediately

Examples:

- app hangs or core flow becomes unusable;
- fabricated verified price/store/stock/order state;
- basket corruption or destructive state loss;
- critical security/privacy failure in enabled beta scope.

### P1 — current beta workstream

Examples:

- wrong basket/store/retailer reprojection;
- hard budget or constraint violation;
- misleading handoff/capability claim;
- mobile/recovery bug that blocks the shopping loop;
- simplicity/UX defect that prevents or materially misleads completion.

### P2/P3 — batch, do not derail beta

Copy polish, animation taste, optional affordances and cosmetic improvements that do not block or mislead the core loop.

## 7. Fix loop

Every P0/P1 follows the same path:

`reproduce → isolate root cause → minimal fix → permanent regression → adjacent checks → CI → merge → fresh-main verification → beta replay`

Rules:

- no “fix” that weakens truth or deterministic validation;
- no text-only workaround for a state/action defect;
- no broad architecture rewrite without evidence that the current architecture is the root cause;
- no DONE before the fix is in `main` and the original beta case is replayed successfully.

Material state changes go to issue **#474 — ROGUE INBOX** using the normal handoff protocol.

## 8. Session outcome labels

Use one of these outcomes after a beta session:

- **PASS** — user completed the intended loop without material help or P0/P1 failure.
- **PASS WITH FRICTION** — loop completed; P2/P3 friction captured for batching.
- **FAIL P1** — shopping loop materially failed or misled; regression work required.
- **FAIL P0** — stop affected beta path until resolved.

Do not convert subjective dislike into P1 without showing how it blocked or misled the core loop.

## 9. Beta evidence board

For every material session, keep a compact record of:

- natural user request;
- success/failure outcome;
- number and type of necessary clarifications;
- whether the user understood Bay's verdict;
- whether the user knew what to do next;
- any reproduced P0/P1;
- any repeated P2 friction pattern.

The point is not vanity metrics. The point is to discover repeated failure patterns before public launch.

## 10. Exit toward public-launch review

Closed beta does **not** automatically become public launch.

Before a public-launch decision:

- beta evidence must show repeated successful completion of the golden loop;
- no known release-path P0/P1 may remain open;
- Gates A–F must still pass on fresh `main`;
- Gate G must be fully resolved;
- personal-data scope must be separately reviewed before any disabled account/cloud/receipt-photo path is re-enabled;
- public copy must remain honest about retailer relationships and handoff capability.

The release owner records the decision in `RELEASE_GATE.md` and `PROJECT_STATUS.md` with evidence, not intuition.
