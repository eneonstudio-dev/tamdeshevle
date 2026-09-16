#!/usr/bin/env python3
import argparse,json,shutil,zipfile
from pathlib import Path

from reevaluate_candidate import sha256_file,sha256_tree

MAX_FILES=2048
MAX_UNPACKED=2*1024*1024*1024
FINAL={'REEVAL_PASS','REEVAL_REJECTED'}


def expected_next(status,candidate_contract_ok):
    if status=='REEVAL_REJECTED': return 'failure_review_then_iteration_2'
    return 'staged_release_review' if candidate_contract_ok else 'contract_failure_review'


def safe_extract(archive,dest):
    archive=Path(archive).resolve(); dest=Path(dest).resolve(); dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        infos=z.infolist()
        if len(infos)>MAX_FILES: raise SystemExit('handoff archive has too many files')
        if sum(x.file_size for x in infos)>MAX_UNPACKED: raise SystemExit('handoff archive is too large')
        for info in infos:
            name=Path(info.filename)
            if name.is_absolute() or '..' in name.parts: raise SystemExit('unsafe zip path')
            target=(dest/name).resolve()
            if dest not in target.parents and target!=dest: raise SystemExit('unsafe zip target')
        z.extractall(dest)
    return dest


def read_json(path):
    value=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value,dict): raise SystemExit(f'JSON object required: {path}')
    return value


def validate_inventory(root,manifest):
    root=Path(root)
    expected={str(x.get('path')):x for x in manifest.get('files',[]) if isinstance(x,dict)}
    if not expected or len(expected)!=len(manifest.get('files',[])): raise SystemExit('invalid evidence inventory')
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name!='evidence-manifest.json'}
    if actual!=set(expected): raise SystemExit(f'evidence inventory coverage mismatch missing={sorted(set(expected)-actual)[:5]} extra={sorted(actual-set(expected))[:5]}')
    for rel,meta in expected.items():
        p=root/rel
        if p.stat().st_size!=int(meta.get('bytes',-1)) or sha256_file(p)!=meta.get('sha256'): raise SystemExit(f'evidence file hash mismatch: {rel}')


def find_adapter(root):
    matches=[p.parent for p in Path(root).rglob('adapter_config.json')]
    if len(matches)!=1: raise SystemExit(f'expected exactly one adapter root, got {len(matches)}')
    return matches[0]


def intake(handoff_json,evidence_zip,adapter_zip,work):
    handoff=read_json(handoff_json); evidence_zip=Path(evidence_zip).resolve(); adapter_zip=Path(adapter_zip).resolve(); work=Path(work).resolve()
    status=handoff.get('status')
    if handoff.get('kind')!='bai_existing_candidate_reeval_handoff' or status not in FINAL: raise SystemExit('unsupported handoff kind/status')
    candidate_contract_ok=handoff.get('candidate_contract_ok') is True
    route=expected_next(status,candidate_contract_ok)
    if handoff.get('release_created') is not False or handoff.get('next_step')!=route: raise SystemExit('unsafe handoff routing state')
    if handoff.get('training_started') is not False or handoff.get('training_allowed') is not False: raise SystemExit('re-eval handoff must remain eval-only')
    if bool(handoff.get('promotion_pass'))!=(status=='REEVAL_PASS'): raise SystemExit('handoff promotion/status mismatch')
    if handoff.get('deterministic_character_ok') is not True: raise SystemExit('deterministic Character baseline did not pass')
    if handoff.get('candidate_character_scope')!='planner_only_not_persona_stage': raise SystemExit('candidate Character scope mismatch')
    if handoff.get('requires_served_character_gate_before_release') is not True: raise SystemExit('served Character gate requirement missing')
    if not evidence_zip.is_file() or sha256_file(evidence_zip)!=handoff.get('evidence_zip_sha256'): raise SystemExit('evidence ZIP hash mismatch')
    if not adapter_zip.is_file() or sha256_file(adapter_zip)!=handoff.get('adapter_zip_sha256'): raise SystemExit('adapter ZIP hash mismatch')
    shutil.rmtree(work,ignore_errors=True); evidence=safe_extract(evidence_zip,work/'evidence'); adapter_root_dir=safe_extract(adapter_zip,work/'adapter')
    evidence_manifest=read_json(evidence/'evidence-manifest.json')
    keys=(
        'kind','status','candidate_adapter_sha256','eval_gold_sha256','config_sha256','promotion_pass',
        'baseline_contract_ok','candidate_contract_ok','deterministic_character_ok','candidate_character_scope',
        'requires_served_character_gate_before_release','training_started','training_allowed','release_created','next_step'
    )
    for key in keys:
        if evidence_manifest.get(key)!=handoff.get(key): raise SystemExit(f'evidence/handoff mismatch: {key}')
    validate_inventory(evidence,evidence_manifest)
    if sha256_file(evidence/'eval-gold.jsonl')!=handoff.get('eval_gold_sha256'): raise SystemExit('bundled eval Gold hash mismatch')
    if sha256_file(evidence/'student-config.json')!=handoff.get('config_sha256'): raise SystemExit('bundled config hash mismatch')
    reeval=read_json(evidence/'reeval/reeval-manifest.json')
    if reeval.get('status')!=status or reeval.get('release_created') is not False: raise SystemExit('bundled re-eval state mismatch')
    if reeval.get('candidate_adapter_sha256')!=handoff.get('candidate_adapter_sha256') or reeval.get('eval_gold_sha256')!=handoff.get('eval_gold_sha256'): raise SystemExit('bundled re-eval hashes mismatch')
    promotion=read_json(evidence/'reeval/metrics/promotion.json')
    if promotion!=(reeval.get('promotion') or {}) or bool(promotion.get('pass'))!=(status=='REEVAL_PASS'): raise SystemExit('bundled promotion evidence mismatch')
    baseline_audit=read_json(evidence/'reeval/contract-audit/baseline.json')
    candidate_audit=read_json(evidence/'reeval/contract-audit/candidate.json')
    character=read_json(evidence/'reeval/deterministic-character-baseline.json')
    decision=read_json(evidence/'reeval/reeval-decision-summary.json')
    if decision.get('promotion_status')!=status or bool(decision.get('promotion_pass'))!=(status=='REEVAL_PASS'): raise SystemExit('bundled decision promotion mismatch')
    if decision.get('baseline_contract_ok')!=(baseline_audit.get('ok') is True) or decision.get('baseline_contract_ok')!=handoff.get('baseline_contract_ok'): raise SystemExit('bundled baseline contract mismatch')
    if decision.get('candidate_contract_ok')!=(candidate_audit.get('ok') is True) or decision.get('candidate_contract_ok')!=handoff.get('candidate_contract_ok'): raise SystemExit('bundled candidate contract mismatch')
    if character.get('ok') is not True or decision.get('deterministic_character_ok') is not True: raise SystemExit('bundled deterministic Character baseline mismatch')
    if character.get('training_started') is not False or character.get('training_allowed') is not False: raise SystemExit('bundled deterministic Character baseline is not eval-only')
    if decision.get('candidate_character_scope')!=handoff.get('candidate_character_scope') or decision.get('requires_served_character_gate_before_release') is not True: raise SystemExit('bundled Character scope mismatch')
    if decision.get('training_started') is not False or decision.get('training_allowed') is not False or decision.get('release_created') is not False: raise SystemExit('bundled decision violates eval-only boundary')
    if decision.get('next_step')!=route: raise SystemExit('bundled decision routing mismatch')
    adapter=find_adapter(adapter_root_dir)
    if sha256_tree(adapter)!=handoff.get('candidate_adapter_sha256'): raise SystemExit('extracted adapter tree hash mismatch')
    result={
        'schema_version':'1.1','state':'VALIDATED_HANDOFF','status':status,'promotion_pass':status=='REEVAL_PASS',
        'baseline_contract_ok':handoff.get('baseline_contract_ok') is True,'candidate_contract_ok':candidate_contract_ok,
        'deterministic_character_ok':True,'candidate_character_scope':'planner_only_not_persona_stage',
        'requires_served_character_gate_before_release':True,'training_started':False,'training_allowed':False,
        'next_step':route,'release_created':False,'candidate_adapter_sha256':handoff['candidate_adapter_sha256'],
        'eval_gold_sha256':handoff['eval_gold_sha256'],'adapter_dir':str(adapter),'evidence_dir':str(evidence)
    }
    (work/'intake.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--handoff-json',required=True); ap.add_argument('--evidence-zip',required=True); ap.add_argument('--adapter-zip',required=True); ap.add_argument('--work',required=True); args=ap.parse_args()
    print(json.dumps(intake(args.handoff_json,args.evidence_zip,args.adapter_zip,args.work),ensure_ascii=False,indent=2))


if __name__=='__main__': main()
