# Bai Teacher Lab v0.1

Teacher Lab is the offline development pipeline for improving an independent Bai Shopping Brain without making production depend on external model providers.

Current components:

- `sources.json` — default-deny source registry.
- `GOLD_DATASET_FORMAT.md` / `gold-seed.jsonl` — structured shopping training format and reviewed seed examples.
- `firewall.mjs` — provenance, review and privacy gates for training eligibility.
- `benchmark.mjs` / `BENCHMARK_FORMAT.md` — stable quality metrics for model comparisons.
- `local-teacher-runner.mjs` — loopback-only adapter for self-hosted teacher models.
- `smoke.mjs` — repository smoke gate.
- `TEACHER_RUNNER_CONTRACT.md` — transport and candidate-review rules.

Principles:

1. Unknown source means blocked for training.
2. Teacher candidates are never automatically promoted to training data.
3. Structured shopping decisions are stored; unsupported price, availability and quality claims are not accepted as facts.
4. Production Bai must continue to work when every teacher is offline.
5. Training approval depends on provenance, review status and privacy checks, not on the provider name.
6. Exact checkpoint/version/license must be pinned before large-scale generation.

Pipeline:
`approved source -> local teacher candidate -> provenance firewall -> review -> Gold Dataset -> benchmark -> future Bai training`

No external model is called by CI.
