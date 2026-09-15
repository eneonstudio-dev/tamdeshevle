# Votonobay Agent Operating Contract

This repository is worked on by multiple specialized agents/chats. This file defines the mandatory entry protocol so work does not drift across conversations.

## Before changing anything

1. Fresh-read `main`.
2. Read `VOTONOBAI_MASTER_ROADMAP.md`.
3. Read `PROJECT_STATUS.md`.
4. Read the active **ROGUE INBOX — Swarm Tasks & Handoffs** issue: `#474`.
5. Read the files and recent PRs relevant to your workstream.
6. Check `DECISIONS/`, `SOURCE_PROVIDER_REGISTRY.md`, and `REGRESSION_BANK.md` when the task touches architecture, providers/data/truth, or known failure behavior.
7. Do not work from stale chat memory when repository state can answer the question.

## Source-of-truth order

1. Current merged implementation in `main` for factual code state.
2. `VOTONOBAI_MASTER_ROADMAP.md` for approved product direction and invariants.
3. Active ADRs in `DECISIONS/` for durable decisions.
4. `PROJECT_STATUS.md` for current priorities/blockers.
5. ROGUE INBOX `#474` for live cross-role assignments, handoffs and acceptance state.
6. Specialized docs/tests for subsystem contracts.
7. Chat memory only as context, never as authority when it conflicts with the repository.

If code and MASTER conflict, do not guess or silently rewrite strategy. Inspect history/decision context and reconcile explicitly.

## Ownership boundaries

- Роуг: operational coordination, priority decision, assignment, acceptance, merge/release control.
- Vi: shopping kernel/state/actions/validator/engineering architecture.
- Price 2: price/data/provenance/source truth.
- Умняша Бая: reasoning/planner/critic/evaluation and training quality.
- Roxy/design: approved UX/visual direction.
- Reinhard: security/release risk.
- Арбитр: technical strategy advisor; researches options/trade-offs and recommends, but does not independently start implementation tracks or change the repository.

Stay inside the task and ownership boundary unless a cross-cutting defect must be fixed to keep P0/P1 behavior safe.

## Swarm coordination boundary

All changes that affect code, architecture, roadmap, release state, project priorities, cross-role task allocation, or require a PR/merge are coordinated through **Роуг**.

Specialized roles may independently:
- research and inspect;
- reproduce/analyze problems;
- compare alternatives;
- identify risks;
- prepare recommendations and implementation proposals.

They must not independently start a new technical track, change repository state, open implementation PRs, alter architecture/roadmap/release-state, or reassign work across roles unless the task is already unambiguously approved in the current plan and that role has explicit execution authority for it.

Default decision flow for non-trivial or cross-cutting work:

`specialist research → options/trade-offs → recommendation → Роуг priority/assignment → implementation → acceptance → merge/release`

For **Арбитр** the boundary is explicit:

`research → options → trade-offs → recommendation → handoff to Роуг`

Арбитр advises; Роуг decides when/if the work enters the delivery path.

This rule is not meant to serialize every implementation detail. Once Роуг/current MASTER/STATUS has clearly approved a task and assigned execution authority, the owning role may complete safe, reversible, in-scope implementation details autonomously without asking for approval on every edit.

## ROGUE INBOX handoff protocol

Canonical live coordination issue: **`#474 — ROGUE INBOX — Swarm Tasks & Handoffs`**.

The project owner must not act as a courier between specialist chats.

Never tell the owner to copy or forward a technical handoff to another project role. Instead:

1. Put the substantial finding/result/blocker in issue `#474` as a comment.
2. Include `ROLE`, `TASK`, `STATE`, `PRIORITY`, `EVIDENCE`, and `RECOMMENDATION / NEXT` when applicable.
3. Use the shared states: `RESEARCH → APPROVED → IN PROGRESS → ACCEPTANCE → DONE`; use `BLOCKED` for a concrete blocker.
4. Link PRs/issues/SHAs/tests instead of pasting long duplicate narratives.
5. Do not log every small action; post when state changes, evidence appears, a blocker is found, or acceptance is needed.

Operational rule:

`owner → Роуг → assignment → specialist → #474 handoff → Роуг acceptance/merge/release`

Specialist-to-specialist dependencies also route through `#474` when they change scope, priority or ownership. This keeps the owner out of internal message routing while preserving autonomous execution inside already-approved workstreams.

## Mandatory invariants

- Bay is a specialized shopping agent, not a general-purpose assistant.
- UniversalBasket is retailer-independent.
- StoreBasket is a retailer/store/channel projection.
- PurchasePlan is the executable strategy and may contain bounded multiple StoreBaskets.
- Neural output never bypasses deterministic action/truth/constraint validation.
- Discovery is not proof.
- Missing/ambiguous price/store/stock evidence never becomes fake verified truth.
- Partner revenue never changes recommendation ranking.
- Never imply deeper retailer integration than actually exists.
- No auth/protection/anti-bot/ban bypass.
- Zero-budget mode must not silently incur paid provider usage.

## Bug policy

P0/P1 discovered in the active workstream: reproduce → root cause → fix → test → verify adjacent behavior. Do not stop at an audit note when a safe in-scope fix can be made.

## Definition of Done

Use the MASTER Definition of Done. Writing code alone is not completion. Relevant tests/contracts must pass; the intended scenario must be verified; truth/security boundaries must hold; material status/decision docs must be updated.

## After substantial work

- Convert important failures into regression coverage and update `REGRESSION_BANK.md` when materially useful.
- Update `SOURCE_PROVIDER_REGISTRY.md` when adding/changing a provider or data source.
- Add/supersede an ADR for durable strategy/architecture changes.
- Update `PROJECT_STATUS.md` when a real blocker or priority changes.
- Post the handoff/result/blocker to ROGUE INBOX `#474` when another role or Роуг needs it.
- Never silently change foundational scope/strategy; obtain explicit owner approval.

When an unblocked next task is already unambiguous in the MASTER/STATUS, belongs to your role, and your role has explicit execution authority for it, proceed without asking the owner or Роуг to restate the roadmap. If the work would create a new technical track, change priority/architecture/release state, cross ownership boundaries, or require unplanned PR/merge work, hand it to Роуг first through issue `#474`.