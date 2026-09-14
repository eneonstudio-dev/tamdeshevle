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

Long-term independence:
Gold Dataset ownership and Votonobay-specific training should grow over time. A later phase may train new weights from scratch once the dataset and compute budget justify it.
