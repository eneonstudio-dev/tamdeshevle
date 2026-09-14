# Bai Shopping Brain v0.1

v0.1 is the first self-hostable student checkpoint, not a from-scratch foundation model.

Training contract:
- base: pinned permissive open-weight model from `student-v0.1.json`;
- input data: only rows accepted by the Teacher Lab provenance firewall;
- review status must be `approved`;
- every contributing source must be `training_allowed`;
- training examples contain structured shopping targets only;
- no external teacher/API is required at inference time;
- raw model reasoning is not part of the SFT format;
- price, availability and quality remain data-layer facts, not language-model claims.

Promotion contract:
- benchmark the student on the same frozen corpus as the current baseline;
- hard-constraint pass rate must not regress and must be at least 0.98;
- invalid substitution rate must not increase;
- context retention, action success and intent accuracy must not regress;
- a failed promotion gate means the checkpoint stays experimental.

## Re-evaluate before retraining

If a candidate was trained successfully but the evaluation harness itself later changes, do not spend another training run until the same adapter is re-evaluated under the corrected contract.

`reevaluate_candidate.py`:
- accepts an existing adapter directory and approved held-out Gold;
- never invokes `train_student.py`;
- hashes the adapter tree, eval Gold and config into `reeval-manifest.json`;
- evaluates baseline and candidate with the current `evaluate_student.py` prompt contract;
- runs the unchanged benchmark and promotion gate;
- never creates a release or deploys the adapter automatically.

If re-evaluation still fails, run `analyze_candidate_failures.py` over the held-out Gold and candidate predictions. It emits failure clusters plus a pending human-review queue. Those rows always have `training_allowed: false`; failure analysis never auto-promotes model outputs into Gold.

## Compare candidates on one frozen holdout

`compare_candidate_runs.py` compares baseline and any number of later candidate runs without changing the promotion gate. Every run must contain exactly the same held-out IDs and its benchmark metrics must cover the full holdout; missing or extra prediction IDs fail closed.

Example:

```bash
python teacher-lab/training/compare_candidate_runs.py \
  --eval-gold /path/eval-gold.jsonl \
  --run baseline /path/baseline-predictions.jsonl /path/baseline-metrics.json \
  --run candidate-v1 /path/candidate-v1-predictions.jsonl /path/candidate-v1-metrics.json \
  --run candidate-v2 /path/candidate-v2-predictions.jsonl /path/candidate-v2-metrics.json \
  --out-dir /path/comparison
```

The report includes parse coverage, benchmark metrics, direction-normalized improvements versus the first run, failure labels, and per-category pass rates. It writes both machine-readable `candidate-comparison.json` and a compact `candidate-comparison.md`. The comparison is diagnostic only: promotion still requires the existing promotion gate.

Long-term independence:
Gold Dataset ownership and Votonobay-specific training should grow over time. A later phase may train new weights from scratch once the dataset and compute budget justify it.
