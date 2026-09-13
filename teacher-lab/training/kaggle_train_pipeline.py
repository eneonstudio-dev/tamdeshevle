#!/usr/bin/env python3
import argparse,json,shutil,subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
AGG=ROOT/'teacher-lab/training/aggregate-gold.mjs'
TRAIN=ROOT/'teacher-lab/training/train_student.py'
EVAL=ROOT/'teacher-lab/training/evaluate_student.py'
BENCH=ROOT/'teacher-lab/training/benchmark-cli.mjs'
PROMOTE=ROOT/'teacher-lab/training/promotion-cli.mjs'
RELEASE=ROOT/'teacher-lab/training/prepare-brain-release.mjs'
PREFLIGHT=ROOT/'teacher-lab/training/kaggle_gpu_preflight.py'
CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def call(cmd,check=True):
    print('+',' '.join(map(str,cmd)),flush=True)
    return subprocess.run([str(x) for x in cmd],cwd=ROOT,check=check)


def ids(rows,label):
    out=[]
    for row in rows:
        value=str(row.get('id') or '').strip()
        if not value: raise SystemExit(f'{label}: row without id')
        out.append(value)
    if len(out)!=len(set(out)): raise SystemExit(f'{label}: duplicate ids')
    return set(out)


def validate_eval(rows,min_eval):
    if len(rows)<min_eval: raise SystemExit(f'Need at least {min_eval} held-out eval examples, got {len(rows)}')
    for row in rows:
        if row.get('review',{}).get('status')!='approved': raise SystemExit(f"eval row {row.get('id')} is not approved")
        if not isinstance(row.get('target'),dict): raise SystemExit(f"eval row {row.get('id')} has no target")
        if row.get('privacy',{}).get('sanitized') is not True: raise SystemExit(f"eval row {row.get('id')} is not privacy-sanitized")


def validate_split(train_files,eval_file,min_eval=50):
    train_rows=[]
    for file in train_files: train_rows.extend(read_jsonl(file))
    eval_rows=read_jsonl(eval_file); validate_eval(eval_rows,min_eval)
    train_ids=ids(train_rows,'train'); eval_ids=ids(eval_rows,'eval'); overlap=sorted(train_ids & eval_ids)
    if overlap: raise SystemExit(f'train/eval leakage: {len(overlap)} overlapping ids; first={overlap[:5]}')
    return {'raw_train_rows':len(train_rows),'eval_rows':len(eval_rows),'overlap':0}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--gold',action='append',required=True,help='approved Gold JSONL; repeat for multiple reviewed batches')
    ap.add_argument('--eval-gold',required=True,help='separate approved held-out Gold JSONL')
    ap.add_argument('--out',default='/kaggle/working/bai_auto_train')
    ap.add_argument('--config',default=str(CONFIG)); ap.add_argument('--baseline-adapter'); ap.add_argument('--min-eval',type=int,default=50)
    ap.add_argument('--max-new-tokens',type=int,default=700); ap.add_argument('--dry-run',action='store_true'); ap.add_argument('--skip-preflight',action='store_true'); ap.add_argument('--resume',action='store_true'); args=ap.parse_args()
    out=Path(args.out); dataset=out/'dataset'; candidate=out/'candidate'; metrics=out/'metrics'; out.mkdir(parents=True,exist_ok=True); metrics.mkdir(parents=True,exist_ok=True)
    split=validate_split(args.gold,args.eval_gold,args.min_eval)
    call(['node',AGG,dataset,*args.gold])
    manifest=json.loads((dataset/'manifest.json').read_text(encoding='utf-8'))
    if not manifest.get('ready_for_training'): raise SystemExit(f"Gold not ready: {manifest.get('examples')} / {manifest.get('minimum_examples')}")
    state={'schema_version':'1.1','status':'VALIDATED','split':split,'dataset':manifest,'baseline_adapter':args.baseline_adapter or None,'preflight':None}
    pipeline_manifest=out/'pipeline-manifest.json'
    pipeline_manifest.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.dry_run:
        print(json.dumps(state,ensure_ascii=False,indent=2)); return

    if not args.skip_preflight:
        preflight=out/'gpu-preflight.json'; call([sys.executable,PREFLIGHT,'--config',args.config,'--out',preflight]); state['preflight']=json.loads(preflight.read_text(encoding='utf-8'))
        pipeline_manifest.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    train_cmd=[sys.executable,TRAIN,'--data',dataset/'sft.jsonl','--out',candidate,'--config',args.config]
    if args.resume: train_cmd.append('--resume')
    call(train_cmd)
    state['status']='TRAINED_AWAITING_EVAL'; pipeline_manifest.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    baseline_pred=out/'baseline-predictions.jsonl'; candidate_pred=out/'candidate-predictions.jsonl'
    baseline_cmd=[sys.executable,EVAL,'--eval',args.eval_gold,'--out',baseline_pred,'--config',args.config,'--max-new-tokens',str(args.max_new_tokens)]
    if args.baseline_adapter: baseline_cmd += ['--adapter',args.baseline_adapter]
    call(baseline_cmd)
    call([sys.executable,EVAL,'--eval',args.eval_gold,'--out',candidate_pred,'--config',args.config,'--adapter',candidate/'adapter','--max-new-tokens',str(args.max_new_tokens)])
    baseline_metrics=metrics/'baseline.json'; candidate_metrics=metrics/'candidate.json'; promotion=metrics/'promotion.json'
    call(['node',BENCH,args.eval_gold,baseline_pred,baseline_metrics]); call(['node',BENCH,args.eval_gold,candidate_pred,candidate_metrics])
    verdict=call(['node',PROMOTE,baseline_metrics,candidate_metrics,promotion],check=False)
    report=json.loads(promotion.read_text(encoding='utf-8')); state['promotion']=report; state['status']='PROMOTION_READY' if report.get('pass') else 'REJECTED'
    experiment=shutil.make_archive(str(out/'bai-candidate-experiment'),'zip',candidate)
    state['experiment_artifact']=experiment
    if report.get('pass'):
        release_root=out/'promotable'; shutil.rmtree(release_root,ignore_errors=True); release_root.mkdir(parents=True)
        shutil.copytree(candidate/'adapter',release_root/'adapter'); shutil.copy2(candidate/'manifest.json',release_root/'training-manifest.json'); shutil.copy2(promotion,release_root/'promotion.json')
        state['promotable_artifact']=shutil.make_archive(str(out/'bai-promotable-checkpoint'),'zip',release_root)
        state['brain_release_manifest']=str(out/'brain-release.json')
        state['brain_release_bundle']=str(out/'bai-brain-release-bundle.zip')
    pipeline_manifest.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if report.get('pass'):
        release_file=out/'brain-release.json'; call(['node',RELEASE,pipeline_manifest,release_file])
        bundle=out/'brain-release-bundle'; shutil.rmtree(bundle,ignore_errors=True); bundle.mkdir(parents=True)
        shutil.copytree(release_root/'adapter',bundle/'adapter'); shutil.copy2(release_root/'training-manifest.json',bundle/'training-manifest.json'); shutil.copy2(promotion,bundle/'promotion.json'); shutil.copy2(release_file,bundle/'brain-release.json'); shutil.copy2(pipeline_manifest,bundle/'pipeline-manifest.json')
        if (out/'gpu-preflight.json').is_file(): shutil.copy2(out/'gpu-preflight.json',bundle/'gpu-preflight.json')
        shutil.make_archive(str(out/'bai-brain-release-bundle'),'zip',bundle)
    print(json.dumps(state,ensure_ascii=False,indent=2));
    if verdict.returncode!=0: raise SystemExit('Candidate trained but rejected by promotion gate')

if __name__=='__main__': main()
