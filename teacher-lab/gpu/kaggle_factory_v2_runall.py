#!/usr/bin/env python3
import argparse,json,math,shutil,subprocess,sys
from pathlib import Path
import kaggle_t4x2_teachers as teachers

ROOT=Path(__file__).resolve().parents[2]
PREPARE=ROOT/'teacher-lab/gpu/prepare_factory_review.mjs'
CONSOLE=ROOT/'teacher-lab/review-console.mjs'
FACTORY_SCRIPT=ROOT/'teacher-lab/training/data_factory_v2.py'
WORK=Path('/kaggle/working/bai_factory_v2')
RUN=WORK/'teacher_run'; REVIEWS=WORK/'reviews'
FULL_TASKS=WORK/'pilot.jsonl'; CAL_TASKS=WORK/'calibration.jsonl'
MANIFEST=WORK/'factory-manifest.json'
SUMMARY=Path('/kaggle/working/bai_factory_v2_summary.json')
CATEGORIES=('build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn')

def call(cmd):
    print('+',' '.join(map(str,cmd)),flush=True)
    subprocess.check_call([str(x) for x in cmd],cwd=ROOT)

def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]

def write_jsonl(path,rows):
    Path(path).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')

def calibration_tasks(tasks,per_category=10):
    out=[]
    for category in CATEGORIES:
        rows=[x for x in tasks if x.get('category')==category][:per_category]
        if len(rows)!=per_category: raise ValueError(f'not enough {category} rows')
        out.extend(rows)
    if len({x['id'] for x in out})!=len(out): raise ValueError('duplicate calibration task id')
    return out

def gate(summary,expected,ratio,stage):
    floor=math.ceil(expected*ratio)
    values={k:int(summary.get(k,0) or 0) for k in ('left_candidates','right_candidates','compared')}
    print(stage,values,'floor',floor,flush=True)
    if min(values.values())<floor: raise SystemExit(f'{stage} rejected: {values}, required >= {floor}')

if __name__=='__main__':
    print('Bai Data Factory v2 Kaggle orchestration ready for GPU stages')
