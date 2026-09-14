#!/usr/bin/env python3
import json,tempfile,zipfile
from pathlib import Path

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
    for name in ('baseline.json','candidate.json','promotion.json'): write(out/'metrics'/name)
    write(out/'comparison/candidate-comparison.json'); write(out/'comparison/candidate-comparison.md','# comparison\n')
    if status=='REEVAL_REJECTED':
        write(out/'failure-analysis/failure-summary.json'); write(out/'failure-analysis/failure-cases.jsonl'); write(out/'failure-analysis/review-candidates.jsonl')
    manifest={
        'schema_version':'1.0','mode':'existing_candidate_reevaluation','status':status,
        'candidate_adapter_sha256':sha256_tree(adapter),'eval_gold_sha256':sha256_file(eval_gold),
        'config':str(config.resolve()),'config_sha256':sha256_file(config),
        'promotion':{'pass':status=='REEVAL_PASS'},'release_created':False
    }
    write(out/'reeval-manifest.json',json.dumps(manifest)+'\n')
    return out,eval_gold,adapter

with tempfile.TemporaryDirectory() as td:
    base=Path(td)
    for status in ('REEVAL_PASS','REEVAL_REJECTED'):
        root=base/status; root.mkdir()
        out,eval_gold,adapter=fixture(root,status)
        prefix=root/'handoff'
        result=package(out,eval_gold,adapter,prefix,'test/notebook/versions/1')
        assert Path(result['evidence_zip']).is_file() and Path(result['adapter_zip']).is_file()
        assert result['status']==status and result['release_created'] is False
        assert result['next_step']==('staged_release_review' if status=='REEVAL_PASS' else 'failure_review_then_iteration_2')
        with zipfile.ZipFile(result['evidence_zip']) as z:
            names=set(z.namelist()); assert {'evidence-manifest.json','eval-gold.jsonl','student-config.json'}<=names
            evidence=json.loads(z.read('evidence-manifest.json'))
            assert evidence['candidate_adapter_sha256']==sha256_tree(adapter)
            assert all(x['path']!='evidence-manifest.json' for x in evidence['files'])
        write(adapter/'tampered.txt','tampered\n')
        try: package(out,eval_gold,adapter,root/'tampered')
        except SystemExit as exc: assert 'adapter hash mismatch' in str(exc)
        else: raise AssertionError('tampered adapter must fail')

    root=base/'wrong-eval'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS')
    write(eval_gold,'{"id":"different"}\n')
    try: package(out,eval_gold,adapter,root/'bad-eval')
    except SystemExit as exc: assert 'eval Gold hash mismatch' in str(exc)
    else: raise AssertionError('wrong eval Gold must fail')

print('Portable Bai re-eval handoff bundle passed for PASS/REJECTED and tamper guards.')
