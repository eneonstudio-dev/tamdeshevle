# Bai Teacher Lab benchmark format

A model candidate produces JSONL rows keyed by Gold Dataset `id`.

Required evaluation fields:
- `id`
- `intent`
- `hard_constraints`
- `actions`

Optional evaluation fields:
- `retained_constraints`: persistent session constraints still respected by the candidate;
- `critic.pass`: whether the final repaired result passed the candidate/engine critic;
- `repair_attempted`: whether a bounded repair pass was needed.

`benchmark.mjs` reports:
- `intent_accuracy`
- `constraint_pass_rate`
- `action_success_rate`
- `context_retention_rate`
- `invalid_substitution_rate`
- `repair_success_rate`

The benchmark does not call a model and does not trust prose explanations. It compares structured outputs only. Price/availability truth remains outside model scoring and must come from Votonobay data modules.
