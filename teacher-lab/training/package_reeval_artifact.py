#!/usr/bin/env python3
import argparse,json,shutil
from pathlib import Path

from reevaluate_candidate import sha256_file,sha256_tree

FINAL={'REEVAL_PASS','REEVAL_REJECTED'}
REQUIRED=(
    'reeval-manifest.json','baseline-predictions.jsonl','candidate-predictions.jsonl',
    'metrics/baseline.json','metrics/candidate.json','metrics/promotion.json',
    'comparison/candidate-comparison.json','comparison/candidate-comparison.md'
)
REJECTED_REQUIRED=(
    'failure-analysis/failure-summary.json','failure-analysis/failure-cases.jsonl',
    'failure-analysis/review-candidates.jsonl'
)

def file_inventory(root,exclude=()):
    root=Path(root); excluded=set(exclude)
    return [{'path':p.relative_to(root).as_posix(),'sha256':sha256_file(p),'bytes':p.stat().st_size}
            for p in sorted(root.rglob('*')) if p.is_file() and p.relative_to(root).as_posix() not in excluded]

def validate(reeval_dir,eval_gold,adapter):
    reeval_dir=Path(reeval_dir).resolve(); eval_gold=Path(eval_gold).resolve(); adapter=Path(adapter).resolve()
    manifest_path=reeval_dir/'reeval-manifest.json'
    if not manifest_path.is_file(): raise SystemExit('reeval-manifest.json missing')
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('mode')!='existing_candidate_reevaluation': raise SystemExit('unexpected re-eval mode')
    status=manifest.get('status')
    if status not in FINAL: raise SystemExit(f're-evaluation is not final: {status}')
    if manifest.get('release_created') is not False: raise SystemExit('re-eval artifact must not create a release')
    if not eval_gold.is_file() or sha256_file(eval_gold)!=manifest.get('eval_gold_sha256'): raise SystemExit('eval Gold hash mismatch')
    if not adapter.is_dir() or sha256_tree(adapter)!=manifest.get('candidate_adapter_sha256'): raise SystemExit('candidate adapter hash mismatch')
    promotion=manifest.get('promotion') or {}
    if bool(promotion.get('pass'))!=(status=='REEVAL_PASS'): raise SystemExit('promotion/status mismatch')
    required=list(REQUIRED)+(list(REJECTED_REQUIRED) if status=='REEVAL_REJECTED' else [])
    missing=[x for x in required if not (reeval_dir/x).is_file()]
    if missing: raise SystemExit(f're-eval evidence missing: {missing}')
    config=Path(str(manifest.get('config') or '')).resolve()
    if not config.is_file() or sha256_file(config)!=manifest.get('config_sha256'): raise SystemExit('config hash mismatch')
    return manifest,config

def package(reeval_dir,eval_gold,adapter,out_prefix,source_ref=''):
    reeval_dir=Path(reeval_dir).resolve(); eval_gold=Path(eval_gold).resolve(); adapter=Path(adapter).resolve(); prefix=Path(out_prefix).resolve()
    manifest,config=validate(reeval_dir,eval_gold,adapter)
    work=prefix.parent/(prefix.name+'-evidence')
    shutil.rmtree(work,ignore_errors=True); work.mkdir(parents=True)
    shutil.copytree(reeval_dir,work/'reeval')
    shutil.copy2(eval_gold,work/'eval-gold.jsonl')
    shutil.copy2(config,work/'student-config.json')
    evidence_manifest={
        'schema_version':'1.0','kind':'bai_existing_candidate_reeval_handoff','status':manifest['status'],
        'source_ref':source_ref or None,'candidate_adapter_sha256':manifest['candidate_adapter_sha256'],
        'eval_gold_sha256':manifest['eval_gold_sha256'],'config_sha256':manifest['config_sha256'],
        'promotion_pass':bool((manifest.get('promotion') or {}).get('pass')),
        'release_created':False,'next_step':'staged_release_review' if manifest['status']=='REEVAL_PASS' else 'failure_review_then_iteration_2',
    }
    evidence_manifest['files']=file_inventory(work,exclude={'evidence-manifest.json'})
    (work/'evidence-manifest.json').write_text(json.dumps(evidence_manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    evidence_zip=Path(shutil.make_archive(str(prefix)+'-evidence','zip',root_dir=work))
    adapter_zip=Path(shutil.make_archive(str(prefix)+'-adapter','zip',root_dir=adapter.parent,base_dir=adapter.name))
    handoff={
        **{k:evidence_manifest[k] for k in ('schema_version','kind','status','source_ref','candidate_adapter_sha256','eval_gold_sha256','config_sha256','promotion_pass','release_created','next_step')},
        'evidence_zip':str(evidence_zip),'evidence_zip_sha256':sha256_file(evidence_zip),
        'adapter_zip':str(adapter_zip),'adapter_zip_sha256':sha256_file(adapter_zip)
    }
    handoff_file=Path(str(prefix)+'-handoff.json')
    handoff_file.write_text(json.dumps(handoff,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    shutil.rmtree(work,ignore_errors=True)
    return handoff

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--reeval-dir',required=True); ap.add_argument('--eval-gold',required=True); ap.add_argument('--candidate-adapter',required=True); ap.add_argument('--out-prefix',required=True); ap.add_argument('--source-ref',default=''); args=ap.parse_args()
    print(json.dumps(package(args.reeval_dir,args.eval_gold,args.candidate_adapter,args.out_prefix,args.source_ref),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
