#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

FINAL={'REEVAL_PASS','REEVAL_REJECTED'}


def read_json(path):
    value=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value,dict):
        raise SystemExit(f'JSON object required: {path}')
    return value


def build_decision(manifest,baseline_audit,candidate_audit,deterministic_character):
    status=manifest.get('status')
    if status not in FINAL:
        raise SystemExit(f're-evaluation is not final: {status}')
    promotion=manifest.get('promotion') or {}
    promotion_pass=bool(promotion.get('pass'))
    if promotion_pass!=(status=='REEVAL_PASS'):
        raise SystemExit('promotion/status mismatch')
    baseline_ok=baseline_audit.get('ok') is True
    candidate_ok=candidate_audit.get('ok') is True
    deterministic_ok=deterministic_character.get('ok') is True
    if deterministic_character.get('training_started') is not False or deterministic_character.get('training_allowed') is not False:
        raise SystemExit('deterministic Character baseline must be eval-only')
    if not deterministic_ok:
        raise SystemExit('deterministic release-safe Character baseline failed')
    if status=='REEVAL_REJECTED':
        next_step='failure_review_then_iteration_2'
    elif candidate_ok:
        next_step='staged_release_review'
    else:
        next_step='contract_failure_review'
    return {
        'schema_version':'1.0',
        'kind':'bai_corrected_reeval_decision',
        'promotion_status':status,
        'promotion_pass':promotion_pass,
        'baseline_contract_ok':baseline_ok,
        'candidate_contract_ok':candidate_ok,
        'deterministic_character_ok':deterministic_ok,
        'candidate_character_scope':'planner_only_not_persona_stage',
        'requires_served_character_gate_before_release':True,
        'training_started':False,
        'training_allowed':False,
        'release_created':False,
        'next_step':next_step,
    }


def main():
    ap=argparse.ArgumentParser(description='Route corrected Bai re-evaluation without retraining or automatic release.')
    ap.add_argument('--reeval-manifest',required=True)
    ap.add_argument('--baseline-audit',required=True)
    ap.add_argument('--candidate-audit',required=True)
    ap.add_argument('--deterministic-character',required=True)
    ap.add_argument('--out',required=True)
    args=ap.parse_args()
    result=build_decision(read_json(args.reeval_manifest),read_json(args.baseline_audit),read_json(args.candidate_audit),read_json(args.deterministic_character))
    out=Path(args.out); out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
