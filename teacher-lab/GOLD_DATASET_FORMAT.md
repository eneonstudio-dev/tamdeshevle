# Bai Gold Dataset v1

Each JSONL row is one shopping example with these top-level fields:

- `id`: stable example id.
- `schema_version`: `1.0`.
- `language`: `ru`.
- `user_request`: original/sanitized user wording.
- `session_context`: budget, people, days, store mode, persistent constraints, current basket.
- `target`: structured answer only: `intent`, `hard_constraints`, `soft_preferences`, `shopping_plan`, `actions`, `critic`, `confidence`.
- `provenance`: `kind` and one or more `source_id` values present in `sources.json`.
- `review`: `candidate`, `approved`, or `rejected`.
- `privacy`: must be `{ "sanitized": true, "contains_personal_data": false }` for train export.

Forbidden anywhere in a trainable row: `chain_of_thought`, `reasoning`, `hidden_reasoning`, `scratchpad`.

A row can be exported for training only when:
1. every provenance source is `training_allowed`;
2. privacy flags pass;
3. review status is `approved`;
4. structured target validation passes.

Evaluation-only teacher output may be used to score a candidate, but must not be copied into the trainable target.
