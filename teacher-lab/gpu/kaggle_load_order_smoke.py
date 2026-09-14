#!/usr/bin/env python3
import importlib.util,json,subprocess,sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
MODULE=HERE/'kaggle_t4x2_teachers.py'
spec=importlib.util.spec_from_file_location('kaggle_t4x2_teachers',MODULE)
mod=importlib.util.module_from_spec(spec); sys.modules['kaggle_t4x2_teachers']=mod; spec.loader.exec_module(mod)

seen=[]
def fake_loader(profile_id,cfg):
    assert len(cfg['revision'])==40
    seen.append((profile_id,cfg['gpu']))
    return f'tok:{profile_id}',f'model:{profile_id}'

loaded=mod.load_teachers(fake_loader)
assert seen==[('deepseek_r1_distill_qwen_7b',0),('qwen3_8b',1)],seen
assert list(loaded)==['deepseek_r1_distill_qwen_7b','qwen3_8b']
assert loaded['deepseek_r1_distill_qwen_7b'][1]=='model:deepseek_r1_distill_qwen_7b'

strict_spec=importlib.util.spec_from_file_location('kaggle_factory_teachers',HERE/'kaggle_factory_teachers.py')
strict=importlib.util.module_from_spec(strict_spec); strict_spec.loader.exec_module(strict)
assert strict.assert_contract() and strict.PROMPT_VERSION=='bai-shopping-teacher-v2'
assert mod.PROMPT_VERSION=='bai-shopping-teacher-v2','strict wrapper must bind the actual base runner globals'

notebook=HERE.parent/'training/bai_qwen_teacher_kaggle_pilot.ipynb'
text=notebook.read_text(encoding='utf-8'); json.loads(text)
for token in ['kaggle_factory_teachers','teacher_prompt_version','data_factory_v22.py','semantic_contracts_validated','CALIBRATION PASS','summarize_factory_review.py','review-priority.jsonl','package_factory_artifact.py']:
    assert token in text,token
subprocess.run([sys.executable,str(HERE/'kaggle_factory_v2_smoke.py')],check=True)
prepare=HERE/'prepare_factory_review.mjs'
subprocess.run(['node','--check',str(prepare)],check=True)
subprocess.run(['node',str(HERE/'prepare_factory_review_smoke.mjs')],check=True)
training=HERE.parent/'training'
subprocess.run([sys.executable,str(training/'data_factory_semantics_smoke.py')],check=True)
subprocess.run([sys.executable,str(training/'summarize_factory_review_smoke.py')],check=True)
subprocess.run([sys.executable,str(training/'factory_handoff_smoke.py')],check=True)
print('Kaggle teacher load order, strict prompt v2, semantic Data Factory v2.2, contract critic, priority review, triage, and portable handoff contracts passed.')
