#!/usr/bin/env python3
import argparse,json,shutil,subprocess
from pathlib import Path
import kaggle_t4x2_teachers as teachers

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'teacher-lab/gpu/prepare_review.mjs'
CONSOLE=ROOT/'teacher-lab/review-console.mjs'
OUT=Path('/kaggle/working/bai_teacher_runs')
SMOKE_OUT=Path('/kaggle/working/bai_teacher_smoke')
REVIEW_ROOT=Path('/kaggle/working/bai_teacher_reviews')
PROGRESS=Path('/kaggle/working/bai_teacher_progress.json')


def call(cmd):
    print('+',' '.join(map(str,cmd)),flush=True)
    subprocess.check_call([str(x) for x in cmd],cwd=ROOT)


def review(run_dir,out_dir,batch_index=0):
    shutil.rmtree(out_dir,ignore_errors=True); out_dir.mkdir(parents=True,exist_ok=True)
    cmd=['node',REVIEW,run_dir,out_dir]
    if batch_index: cmd.append(str(batch_index))
    call(cmd)
    call(['node',CONSOLE,out_dir,out_dir/'review.html'])
    data=json.loads((out_dir/'summary.json').read_text(encoding='utf-8'))
    print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
    return data


def verify_gpu():
    import torch
    if torch.cuda.device_count()<2: raise SystemExit(f'Need Kaggle T4x2: got {torch.cuda.device_count()} GPU(s)')
    names=[torch.cuda.get_device_name(i) for i in range(2)]
    if not all('T4' in name.upper() for name in names): raise SystemExit(f'Expected T4x2, got {names}')
    print('GPU:',names,flush=True)


def save_progress(completed):
    PROGRESS.write_text(json.dumps({'completed_batches':completed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    shutil.make_archive('/kaggle/working/bai_teacher_checkpoint','zip',OUT)


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--start-batch',type=int,default=1); ap.add_argument('--through-batch',type=int,default=9); ap.add_argument('--max-new-tokens',type=int,default=700); ap.add_argument('--skip-smoke',action='store_true'); args=ap.parse_args()
    if not 1<=args.start_batch<=args.through_batch<=9: raise SystemExit('batch range must satisfy 1 <= start <= through <= 9')
    verify_gpu(); OUT.mkdir(parents=True,exist_ok=True); REVIEW_ROOT.mkdir(parents=True,exist_ok=True)
    print('\n=== LOADING TEACHERS ONCE ===',flush=True)
    loaded=teachers.load_teachers()
    if not args.skip_smoke:
        print('\n=== SMOKE: 2 TASKS ===',flush=True)
        shutil.rmtree(SMOKE_OUT,ignore_errors=True); SMOKE_OUT.mkdir(parents=True)
        smoke_tasks=teachers.load_tasks(ROOT,OUT,1)[:2]
        teachers.run_parallel(loaded,smoke_tasks,SMOKE_OUT,args.max_new_tokens)
        smoke=review(SMOKE_OUT,REVIEW_ROOT/'smoke',0)
        if smoke.get('left_candidates')!=2 or smoke.get('right_candidates')!=2 or smoke.get('compared')!=2: raise SystemExit('Smoke failed: structured teacher outputs did not reach review pipeline')
    completed=[]
    for batch in range(args.start_batch,args.through_batch+1):
        tasks=teachers.load_tasks(ROOT,OUT,batch); expected=len(tasks)
        print(f'\n=== BATCH {batch:03d}: {expected} TASKS ===',flush=True)
        teachers.run_parallel(loaded,tasks,OUT,args.max_new_tokens)
        review_dir=REVIEW_ROOT/f'batch_{batch:03d}'
        summary=review(OUT,review_dir,batch)
        if summary.get('left_candidates')!=expected or summary.get('right_candidates')!=expected or summary.get('compared')!=expected: raise SystemExit(f'Batch {batch:03d} incomplete; rerun to resume')
        archive=shutil.make_archive(f'/kaggle/working/bai_teacher_batch{batch:03d}','zip',review_dir)
        completed.append({'batch':batch,'tasks':expected,'artifact':archive})
        save_progress(completed)
        print('READY:',archive,flush=True)
    print('\nALL REQUESTED BATCHES COMPLETE',flush=True)
    print('Progress:',PROGRESS,flush=True)
    print('Checkpoint: /kaggle/working/bai_teacher_checkpoint.zip',flush=True)

if __name__=='__main__': main()
