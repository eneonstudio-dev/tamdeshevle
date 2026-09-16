#!/usr/bin/env python3
from reeval_decision import build_decision


def manifest(status):
    return {'status':status,'promotion':{'pass':status=='REEVAL_PASS'}}

def audit(ok):
    return {'ok':ok}

def character(ok=True):
    return {'ok':ok,'training_started':False,'training_allowed':False}

passed=build_decision(manifest('REEVAL_PASS'),audit(True),audit(True),character())
assert passed['next_step']=='staged_release_review'
assert passed['candidate_contract_ok'] is True
assert passed['requires_served_character_gate_before_release'] is True
assert passed['candidate_character_scope']=='planner_only_not_persona_stage'
assert passed['training_started'] is False and passed['training_allowed'] is False

contract_bad=build_decision(manifest('REEVAL_PASS'),audit(True),audit(False),character())
assert contract_bad['next_step']=='contract_failure_review'
assert contract_bad['promotion_pass'] is True
assert contract_bad['candidate_contract_ok'] is False

rejected=build_decision(manifest('REEVAL_REJECTED'),audit(True),audit(False),character())
assert rejected['next_step']=='failure_review_then_iteration_2'
assert rejected['promotion_pass'] is False

try:
    build_decision(manifest('REEVAL_PASS'),audit(True),audit(True),character(False))
except SystemExit as exc:
    assert 'deterministic release-safe Character baseline failed' in str(exc)
else:
    raise AssertionError('failed deterministic Character baseline must block routing')

bad=manifest('REEVAL_PASS'); bad['promotion']['pass']=False
try:
    build_decision(bad,audit(True),audit(True),character())
except SystemExit as exc:
    assert 'promotion/status mismatch' in str(exc)
else:
    raise AssertionError('promotion/status mismatch must fail')

print('Corrected Bai re-eval decision smoke passed: metric PASS cannot bypass contract audit or deterministic Character baseline.')
