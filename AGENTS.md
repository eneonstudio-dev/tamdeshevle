# Votonobay Agent Operating Contract

This repository is worked on by multiple specialized agents/chats. This file defines the mandatory entry protocol so work does not drift across conversations.

## Execution efficiency overlay

`SWARM_PROTOCOL_V2.md` is the canonical execution-speed overlay for all active agents. It defines tiered fresh-read, Task Envelopes, WIP limits, regression-first bug work, delta-only handoffs, red-CI ownership and role-specific behavioral patches.

If this file and `SWARM_PROTOCOL_V2.md` differ, safety/truth/authority rules in this file win; otherwise follow the v2 protocol for execution mechanics.

## Before changing anything

1. Fresh-read `main`.
2. Read `PROJECT_STATUS.md`.
3. Read the active **ROGUE INBOX — Swarm Tasks & Handoffs** issue: `#474`.
4. Read `SWARM_PROTOCOL_V2.md`.
5. Read the files, recent PRs and task-specific governing docs relevant to your workstream.
6. Read the full `VOTONOBAI_MASTER_ROADMAP.md` / relevant ADR history when the task changes architecture, roadmap, release state, product scope, or when current sources conflict.
7. Check `DECISIONS/`, `SOURCE_PROVIDER_REGISTRY.md`, `REGRESSION_BANK.md`, release/security/brand/training contracts only when the task touches those boundaries.
8. Do not work from stale chat memory when repository state can answer the question.

This is a tiered fresh-read. Do not reread every long project document for a small in-scope fix when the current task boundary is already clear.

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
- Tali / Price 2: price/data/provenance/source truth.
- Умняша Бая: reasoning/planner/critic/evaluation and training quality.
- Roxy / Sara 2 / design: approved UX/visual direction.
- Reinhard: security/release risk.
- Карина / Ghost: closed-beta growth/communication inside proven product claims.
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

## Task / WIP rule

Implementation must follow the Task Envelope and WIP limits in `SWARM_PROTOCOL_V2.md`.

Default:
- one implementation task/PR IN PROGRESS per specialist role;
- one research task may run in parallel;
- no new P2/P3 implementation while the role owns red CI;
- a new technical track needs Rogue assignment unless already approved by current plan.

## ROGUE INBOX handoff protocol

Canonical live coordination issue: **`#474 — ROGUE INBOX — Swarm Tasks & Handoffs`**.

The project owner must not act as a courier between specialist chats.

Never tell the owner to copy or forward a technical handoff to another project role. Instead:

1. Put the substantial finding/result/blocker in issue `#474` as a comment.
2. Use the compact delta-only format from `SWARM_PROTOCOL_V2.md`; include `ROLE`, `TASK`, `STATE`, `PRIORITY`, `DELTA`, `EVIDENCE`, `BLOCKER` when concrete, and one `NEXT` action.
3. Use the shared states: `RESEARCH → APPROVED → IN PROGRESS → ACCEPTANCE → DONE`; use `BLOCKED` for a concrete blocker.
4. Link PRs/issues/SHAs/tests instead of pasting long duplicate narratives.
5. Do not log every small action or retell project history; post when state changes, evidence appears, a blocker is found, or acceptance is needed.

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

P0/P1 discovered in the active workstream: reproduce → define expected structured outcome → root cause → minimal fix → permanent regression when practical → adjacent checks → CI → fresh-main verify.

Do not stop at an audit note when a safe in-scope fix can be made. Do not weaken truth, budget, security or capability boundaries to make a regression pass.

## Definition of Done

Use the MASTER Definition of Done plus `SWARM_PROTOCOL_V2.md` Fast Done rules. Writing code alone is not completion. Relevant tests/contracts must pass; the intended scenario must be verified; truth/security boundaries must hold; material status/decision docs must be updated only when materially changed.

## After substantial work

- Convert important failures into regression coverage and update `REGRESSION_BANK.md` when materially useful.
- Update `SOURCE_PROVIDER_REGISTRY.md` when adding/changing a provider or data source.
- Add/supersede an ADR for durable strategy/architecture changes.
- Update `PROJECT_STATUS.md` when a real blocker or priority changes.
- Post one final delta handoff/result/blocker to ROGUE INBOX `#474` when another role or Роуг needs it.
- Never silently change foundational scope/strategy; obtain explicit owner approval.

When an unblocked next task is already unambiguous in the MASTER/STATUS, belongs to your role, and your role has explicit execution authority for it, proceed without asking the owner or Роуг to restate the roadmap. If the work would create a new technical track, change priority/architecture/release state, cross ownership boundaries, or require unplanned PR/merge work, hand it to Роуг first through issue `#474`.