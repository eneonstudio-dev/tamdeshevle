#!/usr/bin/env python3
import json,tempfile
from pathlib import Path

from intake_reeval_handoff import intake
from package_reeval_artifact import package
from reevaluate_candidate import sha256_file,sha256_tree


def write(path,text='{}\n'):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text,encoding='utf-8')

def fixture(root,status):
    adapter=root/'adapter'; adapter.mkdir(); write(adapter/'adapter_config.json','{"test":true}\n')
    eval_gold=root/'eval-gold.jsonl'; write(eval_gold,'{"id":"eval_1"}\n')
    config=root/'config.json'; write(config,'{"config":true}\n')
    out=root/'reeval'; (out/'metrics').mkdir(parents=True); (out/'comparison').mkdir()
    for name in ('baseline-predictions.jsonl','candidate-predictions.jsonl'): write(out/name,'{"id":"eval_1"}\n')
    write(out/'metrics/baseline.json'); write(out/'metrics/candidate.json')
    promotion={'pass':status=='REEVAL_PASS'}; write(out/'metrics/promotion.json',json.dumps(promotion)+'\n')
    write(out/'comparison/candidate-comparison.json'); write(out/'comparison/candidate-comparison.md','# comparison\n')
    if status=='REEVAL_REJECTED':
        write(out/'failure-analysis/failure-summary.json'); write(out/'failure-analysis/failure-cases.jsonl'); write(out/'failure-analysis/review-candidates.jsonl')
    manifest={'schema_version':'1.0','mode':'existing_candidate_reevaluation','status':status,'candidate_adapter_sha256':sha256_tree(adapter),'eval_gold_sha256':sha256_file(eval_gold),'config':str(config.resolve()),'config_sha256':sha256_file(config),'promotion':promotion,'release_created':False}
    write(out/'reeval-manifest.json',json.dumps(manifest)+'\n')
    return out,eval_gold,adapter

with tempfile.TemporaryDirectory() as td:
    base=Path(td)
    for status in ('REEVAL_PASS','REEVAL_REJECTED'):
        root=base/status; root.mkdir(); out,eval_gold,adapter=fixture(root,status)
        prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix,'test/source')
        result=intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],handoff['adapter_zip'],root/'intake')
        assert result['state']=='VALIDATED_HANDOFF' and result['status']==status
        assert result['next_step']==('staged_release_review' if status=='REEVAL_PASS' else 'failure_review_then_iteration_2')
        assert result['release_created'] is False
        assert Path(result['adapter_dir']).is_dir() and Path(result['evidence_dir']).is_dir()

    root=base/'tamper'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS')
    prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix)
    with Path(handoff['evidence_zip']).open('ab') as f: f.write(b'tamper')
    try: intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],handoff['adapter_zip'],root/'bad')
    except SystemExit as exc: assert 'evidence ZIP hash mismatch' in str(exc)
    else: raise AssertionError('tampered evidence ZIP must fail')

print('Bai re-eval handoff round trip passed for PASS/REJECTED with hash guards.')
