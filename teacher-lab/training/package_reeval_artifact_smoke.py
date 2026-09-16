#!/usr/bin/env python3
import json,tempfile,zipfile
from pathlib import Path

from package_reeval_artifact import package
from reevaluate_candidate import sha256_file,sha256_tree


def write(path,text='{}\n'):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text,encoding='utf-8')


def next_step(status,contract_ok):
    if status=='REEVAL_REJECTED': return 'failure_review_then_iteration_2'
    return 'staged_release_review' if contract_ok else 'contract_failure_review'


def fixture(root,status,contract_ok=True):
    adapter=root/'adapter'; adapter.mkdir(); write(adapter/'adapter_config.json','{"test":true}\n')
    eval_gold=root/'eval-gold.jsonl'; write(eval_gold,'{"id":"eval_1"}\n')
    config=root/'config.json'; write(config,'{"config":true}\n')
    out=root/'reeval'; (out/'metrics').mkdir(parents=True); (out/'comparison').mkdir()
    for name in ('baseline-predictions.jsonl','candidate-predictions.jsonl'): write(out/name,'{"id":"eval_1"}\n')
    write(out/'metrics/baseline.json'); write(out/'metrics/candidate.json')
    promotion={'pass':status=='REEVAL_PASS'}
    write(out/'metrics/promotion.json',json.dumps(promotion)+'\n')
    write(out/'comparison/candidate-comparison.json'); write(out/'comparison/candidate-comparison.md','# comparison\n')
    write(out/'contract-audit/baseline.json',json.dumps({'ok':True})+'\n')
    write(out/'contract-audit/candidate.json',json.dumps({'ok':contract_ok})+'\n')
    write(out/'deterministic-character-baseline.json',json.dumps({'ok':True,'training_started':False,'training_allowed':False})+'\n')
    decision={
        'schema_version':'1.0','kind':'bai_corrected_reeval_decision','promotion_status':status,
        'promotion_pass':status=='REEVAL_PASS','baseline_contract_ok':True,'candidate_contract_ok':contract_ok,
        'deterministic_character_ok':True,'candidate_character_scope':'planner_only_not_persona_stage',
        'requires_served_character_gate_before_release':True,'training_started':False,'training_allowed':False,
        'release_created':False,'next_step':next_step(status,contract_ok)
    }
    write(out/'reeval-decision-summary.json',json.dumps(decision)+'\n')
    if status=='REEVAL_REJECTED':
        write(out/'failure-analysis/failure-summary.json'); write(out/'failure-analysis/failure-cases.jsonl'); write(out/'failure-analysis/review-candidates.jsonl')
    manifest={
        'schema_version':'1.0','mode':'existing_candidate_reevaluation','status':status,
        'candidate_adapter_sha256':sha256_tree(adapter),'eval_gold_sha256':sha256_file(eval_gold),
        'config':str(config.resolve()),'config_sha256':sha256_file(config),
        'promotion':promotion,'release_created':False
    }
    write(out/'reeval-manifest.json',json.dumps(manifest)+'\n')
    return out,eval_gold,adapter

with tempfile.TemporaryDirectory() as td:
    base=Path(td)
    for status,contract_ok in (('REEVAL_PASS',True),('REEVAL_PASS',False),('REEVAL_REJECTED',False)):
        root=base/f'{status}-{contract_ok}'; root.mkdir()
        out,eval_gold,adapter=fixture(root,status,contract_ok)
        prefix=root/'handoff'
        result=package(out,eval_gold,adapter,prefix,'test/notebook/versions/1')
        assert Path(result['evidence_zip']).is_file() and Path(result['adapter_zip']).is_file()
        assert result['status']==status and result['release_created'] is False
        assert result['training_started'] is False and result['training_allowed'] is False
        assert result['candidate_contract_ok'] is contract_ok
        assert result['deterministic_character_ok'] is True
        assert result['next_step']==next_step(status,contract_ok)
        with zipfile.ZipFile(result['evidence_zip']) as z:
            names=set(z.namelist())
            assert {'evidence-manifest.json','eval-gold.jsonl','student-config.json','reeval/reeval-decision-summary.json','reeval/contract-audit/candidate.json','reeval/deterministic-character-baseline.json'}<=names
            evidence=json.loads(z.read('evidence-manifest.json'))
            assert evidence['candidate_adapter_sha256']==sha256_tree(adapter)
            assert evidence['candidate_contract_ok'] is contract_ok
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

    root=base/'wrong-promotion'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS')
    write(out/'metrics/promotion.json','{"pass":false}\n')
    try: package(out,eval_gold,adapter,root/'bad-promotion')
    except SystemExit as exc: assert 'promotion file does not match' in str(exc)
    else: raise AssertionError('tampered promotion evidence must fail')

    root=base/'wrong-character'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS')
    write(out/'deterministic-character-baseline.json','{"ok":false,"training_started":false,"training_allowed":false}\n')
    try: package(out,eval_gold,adapter,root/'bad-character')
    except SystemExit as exc: assert 'deterministic Character baseline must pass' in str(exc)
    else: raise AssertionError('failed deterministic Character baseline must fail packaging')

print('Portable Bai corrected re-eval handoff passed for PASS/contract-fail/REJECTED with eval-only and tamper guards.')
