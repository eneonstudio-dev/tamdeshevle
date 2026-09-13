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
