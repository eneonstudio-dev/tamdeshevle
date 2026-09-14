#!/usr/bin/env python3
import json,subprocess,tempfile
from pathlib import Path
from iteration2_readiness import readiness
from package_reeval_artifact import package
from reevaluate_candidate import sha256_file,sha256_tree

ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'

def write(path,text='{}\n'):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text,encoding='utf-8')

def read_jsonl(path): return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]

def reeval_bundle(root,status,eval_gold):
    adapter=root/'adapter'; adapter.mkdir(parents=True); write(adapter/'adapter_config.json','{"test":true}\n')
    out=root/'reeval'; (out/'metrics').mkdir(parents=True); (out/'comparison').mkdir()
    write(out/'baseline-predictions.jsonl','{"id":"x"}\n'); write(out/'candidate-predictions.jsonl','{"id":"x"}\n')
    write(out/'metrics/baseline.json'); write(out/'metrics/candidate.json')
    promotion={'pass':status=='REEVAL_PASS'}; write(out/'metrics/promotion.json',json.dumps(promotion)+'\n')
    write(out/'comparison/candidate-comparison.json'); write(out/'comparison/candidate-comparison.md','# comparison\n')
    if status=='REEVAL_REJECTED':
        write(out/'failure-analysis/failure-summary.json'); write(out/'failure-analysis/failure-cases.jsonl','{"id":"x"}\n'); write(out/'failure-analysis/review-candidates.jsonl','{"id":"x"}\n')
    manifest={'schema_version':'1.0','mode':'existing_candidate_reevaluation','status':status,'candidate_adapter_sha256':sha256_tree(adapter),'eval_gold_sha256':sha256_file(eval_gold),'config':str(CONFIG.resolve()),'config_sha256':sha256_file(CONFIG),'promotion':promotion,'release_created':False}
    write(out/'reeval-manifest.json',json.dumps(manifest)+'\n')
    prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix,'smoke/source')
    return str(prefix)+'-handoff.json',handoff['evidence_zip'],handoff['adapter_zip']

with tempfile.TemporaryDirectory() as td:
    base=Path(td); seed=base/'seed'
    subprocess.run(['node',str(ROOT/'teacher-lab/training/deterministic-seed.mjs'),str(seed)],cwd=ROOT,check=True,capture_output=True,text=True)
    aggregate=base/'aggregate'
    subprocess.run(['node',str(ROOT/'teacher-lab/training/aggregate-gold.mjs'),str(aggregate),str(seed/'gold.jsonl')],cwd=ROOT,check=True,capture_output=True,text=True)
    rejected=base/'rejected'; rejected.mkdir(); handoff,evidence,adapter=reeval_bundle(rejected,'REEVAL_REJECTED',seed/'eval-gold.jsonl')
    out=base/'ready.json'; result=readiness(handoff,evidence,adapter,aggregate,base/'work',out)
    assert result['state']=='READY_FOR_ITERATION_2' and result['examples']==500
    assert result['holdout_id_overlap']==0 and result['holdout_fingerprint_overlap']==0 and result['release_created'] is False

    train=read_jsonl(seed/'gold.jsonl'); ev=read_jsonl(seed/'eval-gold.jsonl'); leaked=dict(ev[0]); leaked['id']='semantic_leak_new_id'
    leaked_file=base/'leaked-gold.jsonl'; leaked_file.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in train+[leaked]),encoding='utf-8')
    leaked_agg=base/'leaked-aggregate'
    subprocess.run(['node',str(ROOT/'teacher-lab/training/aggregate-gold.mjs'),str(leaked_agg),str(leaked_file)],cwd=ROOT,check=True,capture_output=True,text=True)
    try: readiness(handoff,evidence,adapter,leaked_agg,base/'leak-work',base/'leak.json')
    except SystemExit as exc: assert 'semantic leakage' in str(exc)
    else: raise AssertionError('iteration 2 semantic holdout leak must fail')

    passed=base/'passed'; passed.mkdir(); pass_handoff,pass_evidence,pass_adapter=reeval_bundle(passed,'REEVAL_PASS',seed/'eval-gold.jsonl')
    try: readiness(pass_handoff,pass_evidence,pass_adapter,aggregate,base/'pass-work',base/'pass.json')
    except SystemExit as exc: assert 'requires validated REEVAL_REJECTED' in str(exc)
    else: raise AssertionError('iteration 2 must not start after corrected re-eval PASS')

print('Iteration 2 readiness passed: REJECTED-only routing, approved Gold threshold, provenance, and semantic holdout isolation are guarded.')
