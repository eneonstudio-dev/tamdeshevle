# Local teacher runbook

This pipeline is offline-first. Teacher profiles point only to loopback endpoints.

1. Export the frozen corpus and batches:

```bash
node teacher-lab/export-corpus.mjs /tmp/bai-teacher-export
```

2. Start self-hosted OpenAI-compatible inference servers for the pinned models from:
- `teacher-lab/profiles/deepseek-r1-distill-qwen-7b.json`
- `teacher-lab/profiles/qwen3-8b.json`

Keep the configured endpoints on `127.0.0.1`. Model weights are not stored in this repository.

3. Run one batch for each teacher:

```bash
node teacher-lab/run-local-batch.mjs teacher-lab/profiles/deepseek-r1-distill-qwen-7b.json /tmp/bai-teacher-export/batches/batch_001.jsonl /tmp/deepseek-batch-001.json
node teacher-lab/run-local-batch.mjs teacher-lab/profiles/qwen3-8b.json /tmp/bai-teacher-export/batches/batch_001.jsonl /tmp/qwen-batch-001.json
```

4. Feed only each file's `results` array to `candidate-import.mjs`. The importer adds provenance, resets unsupported price/availability/quality confidence, and marks every result as `candidate`.

5. Compare candidates from the two teacher sources with `teacher-consensus.mjs`. Disagreement is a review signal, never an automatic merge or approval.

6. Only reviewed rows with `review.status=approved` and `training_allowed` provenance can pass `firewall.mjs` into `training/prepare-sft.mjs`.

Production Bai never calls these teacher processes.
