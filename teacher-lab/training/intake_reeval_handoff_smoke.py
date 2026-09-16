#!/usr/bin/env python3
import json,tempfile
from pathlib import Path

from intake_reeval_handoff import intake
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
    promotion={'pass':status=='REEVAL_PASS'}; write(out/'metrics/promotion.json',json.dumps(promotion)+'\n')
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
    manifest={'schema_version':'1.0','mode':'existing_candidate_reevaluation','status':status,'candidate_adapter_sha256':sha256_tree(adapter),'eval_gold_sha256':sha256_file(eval_gold),'config':str(config.resolve()),'config_sha256':sha256_file(config),'promotion':promotion,'release_created':False}
    write(out/'reeval-manifest.json',json.dumps(manifest)+'\n')
    return out,eval_gold,adapter

with tempfile.TemporaryDirectory() as td:
    base=Path(td)
    for status,contract_ok in (('REEVAL_PASS',True),('REEVAL_PASS',False),('REEVAL_REJECTED',False)):
        root=base/f'{status}-{contract_ok}'; root.mkdir(); out,eval_gold,adapter=fixture(root,status,contract_ok)
        prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix,'test/source')
        result=intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],handoff['adapter_zip'],root/'intake')
        assert result['state']=='VALIDATED_HANDOFF' and result['status']==status
        assert result['next_step']==next_step(status,contract_ok)
        assert result['candidate_contract_ok'] is contract_ok
        assert result['deterministic_character_ok'] is True
        assert result['training_started'] is False and result['training_allowed'] is False
        assert result['release_created'] is False
        assert Path(result['adapter_dir']).is_dir() and Path(result['evidence_dir']).is_dir()

    root=base/'tamper'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS')
    prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix)
    with Path(handoff['evidence_zip']).open('ab') as f: f.write(b'tamper')
    try: intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],handoff['adapter_zip'],root/'bad')
    except SystemExit as exc: assert 'evidence ZIP hash mismatch' in str(exc)
    else: raise AssertionError('tampered evidence ZIP must fail')

    root=base/'route-tamper'; root.mkdir(); out,eval_gold,adapter=fixture(root,'REEVAL_PASS',False)
    prefix=root/'bundle'; handoff=package(out,eval_gold,adapter,prefix)
    handoff_file=Path(str(prefix)+'-handoff.json')
    broken=json.loads(handoff_file.read_text(encoding='utf-8')); broken['next_step']='staged_release_review'
    handoff_file.write_text(json.dumps(broken)+'\n',encoding='utf-8')
    try: intake(handoff_file,handoff['evidence_zip'],handoff['adapter_zip'],root/'bad-route')
    except SystemExit as exc: assert 'unsafe handoff routing state' in str(exc)
    else: raise AssertionError('contract-failing metric PASS must not route to staged release')

print('Bai corrected re-eval handoff round trip passed for metric PASS, contract failure and rejection with hash/routing guards.')
