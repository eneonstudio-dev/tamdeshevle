#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'teacher-lab/training/reevaluate_candidate.py'
CONFIG = ROOT / 'teacher-lab/training/student-v0.1.json'

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    adapter = tmp / 'adapter'
    adapter.mkdir()
    (adapter / 'adapter_config.json').write_text('{"test":true}\n', encoding='utf-8')
    eval_file = tmp / 'eval-gold.jsonl'
    rows = []
    for i in range(50):
        rows.append({
            'id': f'eval_{i:03d}',
            'user_request': 'собери корзину',
            'session_context': {},
            'target': {'intent': 'build_basket'},
            'review': {'status': 'approved'},
            'privacy': {'sanitized': True},
        })
    eval_file.write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in rows) + '\n', encoding='utf-8')
    out = tmp / 'out'
    subprocess.run([
        sys.executable, str(SCRIPT),
        '--eval-gold', str(eval_file),
        '--candidate-adapter', str(adapter),
        '--out', str(out),
        '--config', str(CONFIG),
        '--dry-run',
    ], cwd=ROOT, check=True)
    manifest = json.loads((out / 'reeval-manifest.json').read_text(encoding='utf-8'))
    assert manifest['mode'] == 'existing_candidate_reevaluation'
    assert manifest['status'] == 'VALIDATED'
    assert len(manifest['candidate_adapter_sha256']) == 64
    assert len(manifest['eval_gold_sha256']) == 64
    assert manifest['promotion'] is None
    assert manifest['release_created'] is False

source = SCRIPT.read_text(encoding='utf-8')
assert "'CUDA_VISIBLE_DEVICES': '0'" in source
assert "PROMOTE" in source and "check=False" in source
assert "release_created': False" in source
assert 'train_student.py' not in source
print('Existing Bai candidate re-evaluation contract passed: no retraining, pinned evidence hashes, unchanged promotion gate, no release creation.')
