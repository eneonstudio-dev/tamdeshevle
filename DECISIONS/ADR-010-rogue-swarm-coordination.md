# ADR-010 — Rogue as swarm delivery coordination boundary

**Date:** 2026-09-15
**Status:** ACTIVE
**Owner approval required:** yes — approved by owner in project chat on 2026-09-15
**Related:** `AGENTS.md`, `VOTONOBAI_MASTER_ROADMAP.md`, `PROJECT_STATUS.md`

## Context

Votonobay is developed by multiple specialized roles operating in parallel. Autonomous specialist work is useful for speed, but unrestricted repository/architecture changes from several roles can create duplicate PRs, conflicting implementations, priority drift and parallel technical tracks.

The project therefore needs a clear distinction between **independent specialist thinking** and **delivery authority**.

## Decision

**Роуг is the operational delivery coordination boundary for the swarm.**

Changes that affect any of the following are coordinated through Роуг:

- repository code or implementation state;
- architecture or a new technical track;
- MASTER roadmap or project status;
- release state / acceptance / release declaration;
- project priorities;
- allocation or reassignment of work across roles;
- unplanned PR creation, merge or release work.

Specialized roles may independently:

- research and inspect;
- reproduce and analyze;
- compare alternatives;
- identify risks;
- prepare recommendations;
- propose implementation approaches.

Default cross-cutting flow:

`specialist research → options/trade-offs → recommendation → Роуг priority/assignment → implementation → acceptance → merge/release`

### Arbiter boundary

Арбитр is a **Technical Strategy Advisor**, not an operational commander or independent implementer.

Арбитр flow:

`research → options → trade-offs → recommendation → handoff to Роуг`

Арбитр may challenge assumptions, flag overengineering/vendor lock-in/cost/risk and recommend a technical direction. Арбитр does not independently start a technical track, alter repository state or override release priorities.

### Autonomous execution exception

This decision does **not** require specialist roles to request approval for every small implementation detail.

If a task is already unambiguously approved in the current MASTER/STATUS/active plan and the specialist role has explicit execution authority, that role may autonomously perform safe, reversible, in-scope work, including the normal reproduce → fix → test loop defined by its assignment.

Escalation to Роуг is required when the work would:

- create a new technical track;
- materially change architecture or approved boundaries;
- change project/release priority;
- cross ownership boundaries;
- create duplicate/competing implementation work;
- require an unplanned PR/merge/release decision;
- require owner-level strategy/budget/legal approval.

## Why

The chosen model preserves both important properties of the swarm:

1. **Speed:** specialists do not wait for permission to think, investigate or execute clearly assigned work.
2. **Coherence:** one operational role reconciles priorities, parallel work, acceptance and repository integration.

A fully centralized model would slow routine work. A fully decentralized model would increase duplicated code, conflicting PRs, architecture drift and unreliable release state. The coordination boundary separates those concerns.

## Consequences

- Research can happen broadly and in parallel.
- Delivery tracks have a single coordination point.
- Роуг owns priority decision, assignment, acceptance and merge/release coordination.
- Owner approval remains required for foundational strategy, risky/irreversible actions, budget, legal/privacy decisions and other existing owner gates.
- Current explicitly approved specialist workstreams remain autonomous inside their defined scope.
- Repository changes made outside an approved assignment should be treated as coordination violations and reconciled before merge.

## Supersedes / Superseded by

Does not supersede product or architecture ADRs. It refines the multi-agent operating/governance model used to deliver them.
