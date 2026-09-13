# Bai Gold Pipeline

Only explicitly reviewed teacher candidates may become Gold data. Agreement between teachers is not auto-approval.

A review decision is one JSON object per line:

```json
{"task_id":"...","decision":"approve_left","reviewer":"human"}
```

Allowed decisions: `approve_left`, `approve_right`, `approve_edited`, `reject`. `approve_edited` must include `edited_target`. Every approved row receives `human_votonobay_reviewed` provenance and is validated again by the existing firewall.

Export reviewed data with:

```bash
node teacher-lab/training/review-export.mjs REVIEW_DIR decisions.jsonl OUT_DIR
```

The output contains `gold.jsonl`, `sft.jsonl`, and `summary.json`. The student trainer refuses to start until the configured minimum of 500 approved SFT examples is available.

## Automated Kaggle train → eval → promotion

Training data and evaluation data must be separate reviewed Gold files. The pipeline rejects overlapping IDs, non-approved holdout rows, unsanitized holdout rows, and fewer than 50 holdout examples by default.

```bash
python teacher-lab/training/kaggle_train_pipeline.py \
  --gold /kaggle/input/bai-gold/batch-001/gold.jsonl \
  --gold /kaggle/input/bai-gold/batch-002/gold.jsonl \
  --eval-gold /kaggle/input/bai-holdout/eval-gold.jsonl \
  --out /kaggle/working/bai_auto_train
```

The pipeline:

1. aggregates approved Gold and re-runs the provenance firewall;
2. refuses to train below the configured 500-example floor;
3. trains the QLoRA student checkpoint;
4. evaluates the previous baseline and the new candidate on the same held-out approved Gold;
5. computes benchmark metrics with `benchmark.mjs`;
6. runs `promotion-gate.mjs` and creates a promotable checkpoint archive only when the candidate passes.

A failed gate leaves an experiment artifact for debugging but does not create `bai-promotable-checkpoint.zip`. For later training rounds pass `--baseline-adapter PATH` so the candidate is compared against the currently promoted Bai checkpoint rather than the untouched base model.

Use `--dry-run` to validate Gold count, provenance, privacy and train/eval isolation without loading a GPU model.
