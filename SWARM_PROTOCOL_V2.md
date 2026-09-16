# VOTONOBAI — Swarm Protocol v2

**Purpose:** increase delivery speed without lowering truth, security or release quality.

This protocol supplements `AGENTS.md`, `PROJECT_STATUS.md`, `VOTONOBAI_MASTER_ROADMAP.md` and ROGUE INBOX `#474`.

## 1. Operating principle

Agents are not rewarded for activity, long reports, number of issues or number of PRs.

The unit of progress is:

`one verified user/release problem → one owner → one smallest safe change/research result → evidence → acceptance → DONE`

Default rule:

> **Finish before expanding. Evidence before opinion. Delta before retelling.**

## 2. Tiered fresh-read

Do not reread the entire repository for every small step.

### Tier A — every new substantial task/session
Read only:
1. fresh `main` / current head;
2. `AGENTS.md`;
3. `PROJECT_STATUS.md`;
4. ROGUE INBOX `#474` latest relevant state;
5. this protocol.

### Tier B — task-specific
Read only documents that govern the touched boundary:
- data/truth → `SOURCE_PROVIDER_REGISTRY.md`, `REGRESSION_BANK.md`, `RETAILER_CAPABILITIES.md`;
- release → `RELEASE_GATE.md`, `MVP_SCENARIOS.md` / acceptance matrix;
- architecture → relevant ADR + MASTER section;
- brand → `BRAND_CANON.md` + Gate G docs;
- training/eval → training/eval contracts and REG-033;
- security → Gate F/security docs.

### Tier C — full constitutional reread
Use full MASTER/decision/history reread only when changing architecture, roadmap, release state, product scope or when current sources conflict.

This keeps freshness without wasting agent cycles.

## 3. Task Envelope — mandatory before implementation

Every implementation task must have this compact contract, either in `#474`, an issue, or PR body:

```text
TASK_ID: <issue/PR or short stable id>
OWNER_ROLE: <one role>
PRIORITY: P0 | P1 | P2 | P3
USER/RELEASE_PROBLEM: <observable problem, one paragraph max>
SUCCESS: <what must be true when finished>
EVIDENCE_REQUIRED: <tests / browser replay / source proof / security proof>
ALLOWED_SCOPE: <files/layers allowed>
NO_TOUCH: <layers explicitly forbidden>
STOP_IF: <conditions requiring Rogue/owner/security escalation>
```

If `SUCCESS` or `EVIDENCE_REQUIRED` is missing, the task is research, not implementation.

## 4. WIP limit

Per specialist role:
- maximum **1 implementation task/PR IN PROGRESS**;
- maximum **1 research task** in parallel;
- no second implementation PR until the first is in `ACCEPTANCE`, `DONE` or `BLOCKED` by an external dependency.

Rogue may temporarily override this only for independent P0/P1 incidents.

Reason: unfinished parallel work creates merge debt, stale branches and duplicated thinking.

## 5. No speculative implementation

During controlled beta:
- P0/P1 may interrupt current work when reproduced;
- P2/P3 are collected/batched unless explicitly promoted;
- no parser, UX, architecture, provider or source changes from taste alone;
- no new engine/provider/feature track without measured need or approved research handoff.

A broad audit without a decision/action is not a delivery task.

## 6. Regression-first bug loop

For reproducible P0/P1:

`reproduce → define expected structured outcome → add/extend regression when practical → root cause → minimal fix → adjacent checks → CI → fresh-main verify`

Do not patch wording when state/action is wrong.
Do not patch state/action when the only failure is wording/visual hierarchy.
Do not weaken truth/budget/security constraints to make a test pass.

## 7. Acceptance before merge

The implementing role cannot self-declare release significance.

A PR reaching `ACCEPTANCE` must provide only:
- exact head SHA;
- changed behavior;
- exact test/replay evidence;
- known residual limits;
- whether adjacent truth/security/user-flow contracts changed.

Rogue accepts/merges release-affecting work. Reinhard may block on reproduced P0 security risk. Tali may block a data/truth promotion that lacks evidence.

## 8. Delta-only handoffs

Do not repost project history into `#474`.

Use:

```text
ROLE:
TASK:
STATE:
PRIORITY:
DELTA: <what changed since last handoff>
EVIDENCE: <PR/SHA/test/run/source>
BLOCKER: <only if concrete>
NEXT: <single next action>
```

Target size: 5–15 lines unless evidence genuinely requires more.

## 9. Red-CI ownership

If a role owns a PR and CI is red:
- inspect the failing job immediately;
- fix an in-scope deterministic failure autonomously;
- do not ask the owner what to do;
- do not open another feature task while owned CI is red;
- if failure belongs to another layer, post one blocker/handoff with exact failing step and evidence.

Red CI has priority over new P2/P3 work.

## 10. Merge-train rule

Rogue should sequence changes touching guarded shared layers:
1. truth/data/security/kernel changes;
2. runtime/state changes;
3. UX/brand changes;
4. documentation/status synchronization.

Independent docs/research may proceed in parallel. After a shared-layer merge, downstream PRs must verify against fresh `main` before merge.

## 11. Beta failure intake

A beta complaint becomes actionable only when captured as:

```text
REQUEST / USER ACTION:
STARTING STATE:
EXPECTED:
ACTUAL:
VISIBLE IMPACT:
REPRODUCIBLE: yes/no
DEVICE/VIEWPORT if relevant:
EVIDENCE: screenshot/log/state/test if available
```

Then classify P0–P3. Real-user wording should be preserved for future regression/eval cases.

## 12. Role patches

These are compact behavioral patches. They complement, not replace, the role's domain prompt.

### Rogue
- Keep only the top 1–3 delivery outcomes active.
- Every assignment gets a Task Envelope.
- Reject duplicate work and stale-base PRs.
- Do not create a new track while a release-critical owned PR is red.
- Merge only with evidence; after merge, verify fresh main and close/supersede stale queue items.
- Maintain the difference between closed-beta PASS and public-launch PASS.

### Fixer / QA
- Default question: **Can I reproduce it?**
- No reproduction → evidence collection, not code.
- Reproduced P0/P1 → minimal root-cause fix + permanent regression.
- Verify state/action, not only rendered text.
- Own red CI caused by your PR until green or cross-layer blocker is proven.

### Tali / Data & Truth
- Default question: **What exactly proves this fact at this product/store/channel/time?**
- Discovery never becomes rankable truth by convenience.
- Prefer one reliable exact-store source over broad weak coverage.
- For every source promotion: identity + scope + timestamp + provenance + availability semantics + rankability + failure mode.
- Fail closed instead of fabricating breadth.

### Vi / Shopping Kernel
- Default question: **Which invariant/state transition is broken?**
- Preserve `ShoppingIntent → UniversalBasket → StoreBasket → PurchasePlan`.
- No duplicate state source or architecture rewrite for local bugs.
- Prove mutations structurally and preserve unrelated constraints.

### Sara 2 / Roxy
- Default question: **Did this friction prevent or materially confuse completion?**
- Beta P1 UX gets fixed; taste-only P2/P3 is batched.
- No truth/ranking/kernel semantics changes.
- Prefer removal/simplification over adding new controls.
- Measure success as fewer steps, clearer next action, no internal jargon.

### Reinhard
- Default question: **Is there a concrete release/security boundary violation?**
- Block only with reproducible evidence and severity.
- Separate closed-beta local-only scope from public/account/cloud scope.
- No security theatre: prioritize secrets, auth/data boundaries, provider permissions, anti-bot/legal dependencies and paid-spend guards.

### Arbiter
- Research only unless Rogue explicitly approves implementation.
- Deliver: options → evidence → trade-offs → recommendation → smallest next experiment.
- Always include **what not to build**.
- Do not create a new architecture because a cleaner diagram is possible.
- Recommend measurable bake-offs rather than vendor/model opinions.

### Umnyasha Bay / Training & Eval
- Do not retrain to fix a deterministic bug.
- Eval must preserve frozen contracts and train/eval separation.
- Report structured failure clusters, not vibes.
- No model promotion without promotion-gate evidence.
- Deterministic safe fallback remains authoritative until explicitly replaced.

### Karina / Growth
- Market only proven capabilities.
- Closed beta objective = qualified real usage + useful failure evidence, not reach.
- Every acquisition experiment must define cohort, message, expected behavior and feedback capture.
- Never imply universal live prices, partnerships or ordering capabilities that are not proven.

## 13. Stop conditions

An agent must stop the current implementation and hand off when:
- owner product choice is genuinely required;
- work changes foundational architecture/scope/business/truth policy;
- paid spend, credentials, legal acceptance or external account action is required;
- a different role owns the root cause;
- source access would require auth/protection/anti-bot bypass;
- evidence contradicts the Task Envelope;
- the task has expanded beyond the smallest safe fix.

Stopping means posting one concrete blocker with evidence, not starting an adjacent speculative task.

## 14. Definition of Fast Done

Fast does not mean fewer checks. Fast means less duplicated cognition.

A task is DONE when:
1. intended problem is resolved or research question answered;
2. required evidence exists;
3. no known new P0/P1 is hidden;
4. PR is merged/fresh-main verified when implementation was required;
5. relevant regression/status/source contract is updated only if materially changed;
6. `#474` receives one final delta handoff.

Anything else is still WIP.