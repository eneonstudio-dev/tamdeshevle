# Bai Gold Pipeline

Teacher/model candidates require explicit review before they may become Gold data. Agreement between teachers is not auto-approval.

A review decision is one JSON object per line:

```json
{"task_id":"...","decision":"approve_left","reviewer":"human"}
```

Allowed decisions: `approve_left`, `approve_right`, `approve_edited`, `reject`. `approve_edited` must include `edited_target`. Every approved teacher row receives `human_votonobay_reviewed` provenance and is validated again by the existing firewall.

Export reviewed data with:

```bash
node teacher-lab/training/review-export.mjs REVIEW_DIR decisions.jsonl OUT_DIR
```

The output contains `gold.jsonl`, `sft.jsonl`, and `summary.json`.

## Deterministic bootstrap

The first student can be bootstrapped without pretending synthetic rows were human-reviewed:

```bash
node teacher-lab/training/deterministic-seed.mjs /tmp/bai-seed
```

This produces exactly 500 training rows and 60 disjoint holdout rows from the repository-owned 560-task corpus. Targets are mechanically derived from constraints and the production action allowlist, use provenance `votonobay_deterministic_seed_v1`, and set `human_reviewed:false`. This path never accepts or auto-approves neural teacher outputs.

## Automated Kaggle train → eval → promotion

Training data and evaluation data must be separate eligible Gold files. The pipeline rejects overlapping IDs, non-approved holdout rows, unsanitized holdout rows, and fewer than 50 holdout examples by default.

```bash
python teacher-lab/training/kaggle_train_pipeline.py \
  --gold /kaggle/input/bai-gold/batch-001/gold.jsonl \
  --gold /kaggle/input/bai-gold/batch-002/gold.jsonl \
  --eval-gold /kaggle/input/bai-holdout/eval-gold.jsonl \
  --out /kaggle/working/bai_auto_train
```

The pipeline:

1. aggregates eligible Gold and re-runs the provenance firewall;
2. refuses to train below the configured 500-example floor;
3. trains the QLoRA student checkpoint;
4. evaluates the previous baseline and the new candidate on the same held-out Gold;
5. computes benchmark metrics with `benchmark.mjs`;
6. runs `promotion-gate.mjs` and creates a promotable checkpoint archive only when the candidate passes.

A failed gate leaves an experiment artifact for debugging but does not create `bai-promotable-checkpoint.zip`. For later training rounds pass `--baseline-adapter PATH` so the candidate is compared against the currently promoted Bai checkpoint rather than the untouched base model.

The Kaggle notebook uses reviewed Gold when it is supplied as input. If no reviewed dataset is attached, it generates the deterministic bootstrap automatically. Teacher/model outputs are never auto-approved by this fallback.

Use `--dry-run` to validate Gold count, provenance, privacy and train/eval isolation without loading a GPU model.
