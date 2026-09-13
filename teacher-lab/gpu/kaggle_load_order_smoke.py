#!/usr/bin/env python3
import importlib.util
from pathlib import Path

MODULE=Path(__file__).with_name('kaggle_t4x2_teachers.py')
spec=importlib.util.spec_from_file_location('kaggle_teachers',MODULE)
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

seen=[]
def fake_loader(profile_id,cfg):
    seen.append((profile_id,cfg['gpu']))
    return f'tok:{profile_id}',f'model:{profile_id}'

loaded=mod.load_teachers(fake_loader)
assert seen==[('deepseek_r1_distill_qwen_7b',0),('qwen3_8b',1)],seen
assert list(loaded)==['deepseek_r1_distill_qwen_7b','qwen3_8b']
assert loaded['deepseek_r1_distill_qwen_7b'][1]=='model:deepseek_r1_distill_qwen_7b'
print('Kaggle teacher load order passed.')
