# Bai student ↔ teacher loop

This layer closes the gap between the existing Teacher Lab and the Bai student/runtime without putting teachers into production.

## Contract

`task -> Bai attempt -> deterministic judge -> independent critic -> bounded repair -> review/regression record`

Rules:
- the initial Bai call receives the task only; the teacher target is not included in the student input;
- teacher output is used by the offline judge/critic as an evaluation target, never as production truth;
- deterministic checks are authoritative for intent, hard constraints, required actions and truth-guard violations;
- the critic may add semantic feedback, but cannot override a deterministic failure;
- repair feedback contains failure labels/instructions, not the teacher answer;
- repairs are bounded (`maxRepairs` is capped at 3);
- model-owned `price`, `availability`, `store`, `composition` or `quality` facts are rejected when the task forbids fabrication;
- every emitted learning record is `review.status=pending` and `training_allowed=false`;
- failed runs become regression candidates; nothing rewrites production Bai automatically.

## API

`teacher-lab/student-teacher-loop.mjs` exports:
- `deterministicJudge({ task, teacherOutput, bayOutput })`;
- `runTrainingCase({ task, teacherOutput, bayRunner, criticRunner, maxRepairs })`;
- `runTrainingBatch({ tasks, teacherResults, bayRunner, criticRunner, maxRepairs, onProgress })`.

`bayRunner` is an adapter. It can point at the current Bai checkpoint, a browser/runtime harness, or a local OpenAI-compatible student server. `criticRunner` is separate so the critic can be a second local model or a deterministic/LLM hybrid.

The loop intentionally has no network code and no production import. Local model transports stay behind adapters, following the same offline-first policy as `run-local-batch.mjs`.

## Promotion path

1. Run frozen tasks against the current Bai candidate.
2. Judge with reviewed teacher targets and an independent critic.
3. Repair only within the bounded loop.
4. Send success/failure records to review.
5. Approved successes may later enter Gold/SFT through the existing provenance firewall.
6. Failures become regression tests/eval cases.
7. A trained checkpoint still has to pass `benchmark.mjs` and `training/promotion-gate.mjs` before promotion.

This is learning by supervised evaluation and curated fine-tuning, not uncontrolled self-modification.
