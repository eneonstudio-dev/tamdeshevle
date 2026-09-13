#!/usr/bin/env python3
import json,shutil,subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RUNNER=ROOT/'teacher-lab/gpu/kaggle_t4x2_teachers.py'
REVIEW=ROOT/'teacher-lab/gpu/prepare_review.mjs'
OUT=Path('/kaggle/working/bai_teacher_runs')
REVIEW_DIR=Path('/kaggle/working/bai_teacher_review')

def call(cmd):
    print('+',' '.join(map(str,cmd)),flush=True)
    subprocess.check_call([str(x) for x in cmd],cwd=ROOT)

def review():
    call(['node',REVIEW,OUT,REVIEW_DIR])
    data=json.loads((REVIEW_DIR/'summary.json').read_text(encoding='utf-8'))
    print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
    return data

def main():
    import torch
    if torch.cuda.device_count()<2:
        raise SystemExit(f'Need Kaggle T4x2: got {torch.cuda.device_count()} GPU(s)')
    names=[torch.cuda.get_device_name(i) for i in range(2)]
    if not all('T4' in name.upper() for name in names):
        raise SystemExit(f'Expected T4x2, got {names}')
    print('GPU:',names,flush=True)
    OUT.mkdir(parents=True,exist_ok=True)
    print('\n=== SMOKE: 2 tasks ===',flush=True)
    call([sys.executable,RUNNER,'--repo',ROOT,'--out',OUT,'--batch-index','1','--limit','2'])
    smoke=review()
    if smoke.get('left_candidates')!=2 or smoke.get('right_candidates')!=2 or smoke.get('compared')!=2:
        raise SystemExit('Smoke failed: structured teacher outputs did not reach review pipeline')
    print('\n=== SMOKE PASSED; BATCH 001 ===',flush=True)
    call([sys.executable,RUNNER,'--repo',ROOT,'--out',OUT,'--batch-index','1'])
    full=review()
    if full.get('left_candidates')!=64 or full.get('right_candidates')!=64 or full.get('compared')!=64:
        raise SystemExit('Batch 001 incomplete; rerun this script to resume')
    archive=shutil.make_archive('/kaggle/working/bai_teacher_batch001','zip',REVIEW_DIR)
    print('\nBATCH 001 READY FOR HUMAN REVIEW',flush=True)
    print('Artifact:',archive,flush=True)
    print('Next batches: run kaggle_t4x2_teachers.py with --batch-index 2..9; resume is safe.',flush=True)

if __name__=='__main__': main()
