#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

def read(path): return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]
def run(cmd,check=True): return subprocess.run([str(x) for x in cmd],cwd=ROOT,check=check)

with tempfile.TemporaryDirectory() as tmp:
    tmp=Path(tmp); seed=tmp/'seed'; failures=tmp/'failures.jsonl'; diag=tmp/'diag'; prep=tmp/'prep'; reviewed=tmp/'reviewed'; aggregate=tmp/'aggregate'
    run(['node','teacher-lab/training/deterministic-seed.mjs',seed]); train=read(seed/'gold.jsonl'); ev=read(seed/'eval-gold.jsonl')
    chosen=[]
    for prefix in ['seed_build_','seed_edit_','seed_journey_']:
        row=next(x for x in ev if str(x['id']).startswith(prefix)); chosen.append({'id':row['id'],'user_request':row['user_request'],'session_context':row['session_context'],'expected':row['target'],'failure_labels':['required_actions_missing']})
    failures.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in chosen),encoding='utf-8')

    run([sys.executable,'teacher-lab/training/diagnose_candidate_failures.py','--failures',failures,'--out-dir',diag])
    d=json.loads((diag/'diagnostics.json').read_text()); regs=read(diag/'regression-cases.jsonl')
    assert d['by_category']=={'build_fuzzy':1,'edit_fuzzy':1,'multi_turn':1}; assert d['heldout_must_not_enter_training'] is True
    assert len(regs)==3 and all(x['training_allowed'] is False for x in regs)

    run([sys.executable,'teacher-lab/training/prepare_failure_remediation.py','--failures',failures,'--train-gold',seed/'gold.jsonl','--eval-gold',seed/'eval-gold.jsonl','--out-dir',prep,'--siblings','1'])
    candidates=read(prep/'remediation-candidates.jsonl'); eval_ids={x['id'] for x in ev}
    assert len(candidates)==3 and all(x['source_train_id'] not in eval_ids for x in candidates) and all(x['training_allowed'] is False for x in candidates)
    decisions=[{'candidate_id':x['id'],'decision':'approve_suggested','reviewer':'smoke-reviewer','reviewed_at':'2026-09-14T00:00:00Z'} for x in candidates]
    decisions_file=tmp/'decisions.json'; decisions_file.write_text(json.dumps(decisions,ensure_ascii=False),encoding='utf-8')
    run(['node','teacher-lab/training/export_failure_remediation.mjs',prep,decisions_file,reviewed])
    gold=read(reviewed/'gold.jsonl'); assert len(gold)==3
    assert all(x['review']['status']=='approved' and x['provenance']['sources'][0]['source_id']=='human_votonobay_reviewed' for x in gold)
    run(['node','teacher-lab/training/aggregate-gold.mjs',aggregate,seed/'gold.jsonl',reviewed/'gold.jsonl'])
    manifest=json.loads((aggregate/'manifest.json').read_text()); assert manifest['examples']==503 and manifest['ready_for_training'] is True

    good=[]
    for r in regs:
        target=r['expected']; good.append({'id':r['source_eval_id'],'intent':target['intent'],'hard_constraints':target['hard_constraints'],'actions':target['actions'],'retained_constraints':r['session_context'].get('constraints',[])})
    good_file=tmp/'good.jsonl'; good_file.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in good),encoding='utf-8')
    report=tmp/'regression.json'; run([sys.executable,'teacher-lab/training/run_failure_regressions.py','--regressions',diag/'regression-cases.jsonl','--predictions',good_file,'--out',report,'--require-pass'])
    assert json.loads(report.read_text())['summary']['failed']==0
    good[0]['intent']='wrong_intent'; bad=tmp/'bad.jsonl'; bad.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in good),encoding='utf-8')
    failed=run([sys.executable,'teacher-lab/training/run_failure_regressions.py','--regressions',diag/'regression-cases.jsonl','--predictions',bad,'--out',report,'--require-pass'],check=False); assert failed.returncode!=0

print('Failure learning pipeline passed: heldout failures stay eval-only, remediation comes from train-side siblings, human review gates Gold, and frozen failures gate future candidates.')
