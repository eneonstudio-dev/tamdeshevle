#!/usr/bin/env python3
import json,subprocess,tempfile
from pathlib import Path
from iteration2_readiness import readiness
from prepare_iteration2_dataset import prepare
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

def human_extra(row,i):
    out=json.loads(json.dumps(row)); out['id']=f'human_extra_{i:03d}'; out['user_request']=str(row['user_request'])+f' Дополнительный проверенный сценарий {i}.'
    out['provenance']={'sources':[{'source_id':'human_votonobay_reviewed','model':'human-reviewed','reviewer':'smoke-reviewer'}]}; out['review']={'status':'approved','reviewer':'smoke-reviewer'}
    return out

with tempfile.TemporaryDirectory() as td:
    base=Path(td); seed=base/'seed'
    subprocess.run(['node',str(ROOT/'teacher-lab/training/deterministic-seed.mjs'),str(seed)],cwd=ROOT,check=True,capture_output=True,text=True)
    seed_train=read_jsonl(seed/'gold.jsonl'); heldout=seed/'eval-gold.jsonl'

    audit=prepare([seed/'gold.jsonl'],heldout,base/'seed-only',require_ready=False)
    assert audit['removed_examples']>0 and audit['removed_heldout_fingerprints']>0
    assert audit['kept_examples']<500 and audit['ready_for_training'] is False

    extras=base/'extras.jsonl'; extras.write_text(''.join(json.dumps(human_extra(seed_train[i],i),ensure_ascii=False)+'\n' for i in range(100)),encoding='utf-8')
    prepared=base/'prepared'; prep=prepare([seed/'gold.jsonl',extras],heldout,prepared,require_ready=True)
    assert prep['removed_examples']>0 and prep['kept_examples']>=500 and prep['ready_for_training'] is True
    aggregate=prepared/'dataset'

    rejected=base/'rejected'; rejected.mkdir(); handoff,evidence,adapter=reeval_bundle(rejected,'REEVAL_REJECTED',heldout)
    out=base/'ready.json'; result=readiness(handoff,evidence,adapter,aggregate,base/'work',out)
    assert result['state']=='READY_FOR_ITERATION_2' and result['examples']>=500
    assert result['holdout_id_overlap']==0 and result['holdout_fingerprint_overlap']==0 and result['release_created'] is False
    assert result['human_reviewed_non_seed_rows']>=1

    clean=read_jsonl(aggregate/'gold.jsonl'); ev=read_jsonl(heldout); leaked=dict(ev[0]); leaked['id']='semantic_leak_new_id'; leaked['provenance']={'sources':[{'source_id':'human_votonobay_reviewed','model':'human-reviewed','reviewer':'smoke'}]}; leaked['review']={'status':'approved','reviewer':'smoke'}
    leaked_file=base/'leaked-gold.jsonl'; leaked_file.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in clean+[leaked]),encoding='utf-8')
    leaked_agg=base/'leaked-aggregate'
    subprocess.run(['node',str(ROOT/'teacher-lab/training/aggregate-gold.mjs'),str(leaked_agg),str(leaked_file)],cwd=ROOT,check=True,capture_output=True,text=True)
    try: readiness(handoff,evidence,adapter,leaked_agg,base/'leak-work',base/'leak.json')
    except SystemExit as exc: assert 'semantic leakage' in str(exc)
    else: raise AssertionError('iteration 2 semantic holdout leak must fail')

    passed=base/'passed'; passed.mkdir(); pass_handoff,pass_evidence,pass_adapter=reeval_bundle(passed,'REEVAL_PASS',heldout)
    try: readiness(pass_handoff,pass_evidence,pass_adapter,aggregate,base/'pass-work',base/'pass.json')
    except SystemExit as exc: assert 'requires validated REEVAL_REJECTED' in str(exc)
    else: raise AssertionError('iteration 2 must not start after corrected re-eval PASS')

print('Iteration 2 readiness passed: frozen eval stays unchanged, colliding train inputs are removed, reviewed Gold replenishes the minimum, and retraining is REJECTED-only.')
