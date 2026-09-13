#!/usr/bin/env python3
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
TRAIN=ROOT/'teacher-lab/training/train_student.py'
EVAL=ROOT/'teacher-lab/training/evaluate_student.py'
PIPE=ROOT/'teacher-lab/training/kaggle_train_pipeline.py'
PREFLIGHT=ROOT/'teacher-lab/training/kaggle_gpu_preflight.py'
CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'
NOTEBOOK=ROOT/'teacher-lab/training/bai_student_kaggle_train.ipynb'

cfg=json.loads(CONFIG.read_text(encoding='utf-8'))
assert cfg['base_model']=='Qwen/Qwen3-1.7B'
assert re.fullmatch(r'[a-f0-9]{40}',cfg.get('base_revision',''))
assert cfg.get('chat_template',{}).get('enable_thinking') is False
assert cfg.get('gradient_checkpointing') is True

train=TRAIN.read_text(encoding='utf-8'); ev=EVAL.read_text(encoding='utf-8'); pipe=PIPE.read_text(encoding='utf-8'); pre=PREFLIGHT.read_text(encoding='utf-8')
for source,label in [(train,'train'),(ev,'eval')]:
    assert 'revision=revision' in source,f'{label} must pin base revision'
    assert 'enable_thinking=enable_thinking' in source,f'{label} must explicitly control Qwen3 thinking'
assert 'use_gradient_checkpointing=grad_ckpt' in train
assert "device_map={'':training_device}" in train
assert "torch.cuda.current_device()" in train
assert "device_map='auto'" not in train
assert 'bnb_4bit_compute_dtype=torch.float32' in train
assert "PREFLIGHT=ROOT/'teacher-lab/training/kaggle_gpu_preflight.py'" in pipe
assert "state['brain_release_bundle']" in pipe
assert "bai-brain-release-bundle" in pipe
assert 'base_revision_must_be_40_hex_commit' in pre
assert 'qwen3_thinking_must_be_disabled_for_json_contract' in pre
assert 'gpu_memory_too_small' in pre

nb=json.loads(NOTEBOOK.read_text(encoding='utf-8'))
flat=''.join(''.join(cell.get('source',[])) for cell in nb.get('cells',[]))
assert 'kaggle_train_pipeline.py' in flat
assert 'deterministic-bootstrap' in flat
assert 'STAGED BRAIN RELEASE' in flat
assert 'git rev-parse HEAD' in flat
assert '%cd /kaggle/working' in flat
assert 'rm -rf /kaggle/working/tamdeshevle /kaggle/working/bai_auto_train /kaggle/working/bai_seed' in flat
print('Kaggle first GPU run contract passed: pinned Qwen3, non-thinking JSON mode, GPU preflight and staged release bundle.')
