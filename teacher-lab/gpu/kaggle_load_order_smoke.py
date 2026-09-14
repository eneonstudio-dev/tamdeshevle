#!/usr/bin/env python3
import importlib.util,json,subprocess,sys
from pathlib import Path

MODULE=Path(__file__).with_name('kaggle_t4x2_teachers.py')
spec=importlib.util.spec_from_file_location('kaggle_teachers',MODULE)
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

seen=[]
def fake_loader(profile_id,cfg):
    assert len(cfg['revision'])==40
    seen.append((profile_id,cfg['gpu']))
    return f'tok:{profile_id}',f'model:{profile_id}'

loaded=mod.load_teachers(fake_loader)
assert seen==[('deepseek_r1_distill_qwen_7b',0),('qwen3_8b',1)],seen
assert list(loaded)==['deepseek_r1_distill_qwen_7b','qwen3_8b']
assert loaded['deepseek_r1_distill_qwen_7b'][1]=='model:deepseek_r1_distill_qwen_7b'
notebook=Path(__file__).resolve().parents[1]/'training/bai_qwen_teacher_kaggle_pilot.ipynb'
text=notebook.read_text(encoding='utf-8'); json.loads(text)
assert 'data_factory_v2.py' in text and 'CALIBRATION PASS' in text
subprocess.run([sys.executable,str(Path(__file__).with_name('kaggle_factory_v2_smoke.py'))],check=True)
prepare=Path(__file__).with_name('prepare_factory_review.mjs')
subprocess.run(['node','--check',str(prepare)],check=True)
subprocess.run(['node',str(Path(__file__).with_name('prepare_factory_review_smoke.mjs'))],check=True)
print('Kaggle teacher load order, pinned revisions, and Data Factory pilot contract passed.')
