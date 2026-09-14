#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from intake_reeval_handoff import intake as intake_reeval
from kaggle_train_pipeline import read_jsonl,semantic_fingerprint
from reevaluate_candidate import sha256_file

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'
REGISTRY=ROOT/'teacher-lab/sources.json'


def read_json(path):
    value=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value,dict): raise SystemExit(f'JSON object required: {path}')
    return value


def validate_dataset(aggregate_dir,eval_gold,config_path=DEFAULT_CONFIG):
    aggregate=Path(aggregate_dir).resolve(); gold=aggregate/'gold.jsonl'; sft=aggregate/'sft.jsonl'; manifest_file=aggregate/'manifest.json'
    for p in (gold,sft,manifest_file):
        if not p.is_file(): raise SystemExit(f'aggregate evidence missing: {p}')
    manifest=read_json(manifest_file); config=read_json(config_path); registry=read_json(REGISTRY)
    rows=read_jsonl(gold); heldout=read_jsonl(eval_gold)
    minimum=int((config.get('data') or {}).get('minimum_examples',0) or 0)
    if not manifest.get('ready_for_training') or int(manifest.get('examples',-1))!=len(rows) or len(rows)<minimum: raise SystemExit('aggregate Gold is not ready for training')
    if int(manifest.get('minimum_examples',-1))!=minimum: raise SystemExit('aggregate minimum_examples/config mismatch')
    if sha256_file(gold)!=manifest.get('gold_sha256'): raise SystemExit('aggregate Gold hash mismatch')
    sft_lines=[x for x in sft.read_text(encoding='utf-8').splitlines() if x.strip()]
    if len(sft_lines)!=len(rows): raise SystemExit('SFT/Gold row count mismatch')
    allowed={str(x.get('id')) for x in registry.get('sources',[]) if x.get('status')=='training_allowed' and x.get('training_other_models') is True}
    if not allowed: raise SystemExit('no training-allowed provenance sources')
    train_ids=set(); model_reviewed=0
    for row in rows:
        rid=str(row.get('id') or '')
        if not rid or rid in train_ids: raise SystemExit('duplicate or missing training id')
        train_ids.add(rid)
        if (row.get('review') or {}).get('status')!='approved': raise SystemExit(f'{rid}: training row is not approved')
        if (row.get('privacy') or {}).get('sanitized') is not True: raise SystemExit(f'{rid}: training row is not sanitized')
        sources=(row.get('provenance') or {}).get('sources') or []; source_ids={str(x.get('source_id') or '') for x in sources if isinstance(x,dict)}
        if not source_ids or not source_ids<=allowed: raise SystemExit(f'{rid}: non-training provenance reached iteration 2')
        if source_ids!={'votonobay_deterministic_seed_v1'}:
            if 'human_votonobay_reviewed' not in source_ids: raise SystemExit(f'{rid}: model/non-seed Gold lacks human review provenance')
            model_reviewed+=1
    eval_ids={str(x.get('id') or '') for x in heldout}; id_overlap=sorted(train_ids & eval_ids)
    if id_overlap: raise SystemExit(f'iteration 2 holdout id leakage: {id_overlap[:5]}')
    train_fp={semantic_fingerprint(x) for x in rows}; eval_fp={semantic_fingerprint(x) for x in heldout}; fp_overlap=sorted(train_fp & eval_fp)
    if fp_overlap: raise SystemExit(f'iteration 2 holdout semantic leakage: {fp_overlap[:5]}')
    return {'examples':len(rows),'minimum_examples':minimum,'eval_examples':len(heldout),'gold_sha256':sha256_file(gold),'sft_sha256':sha256_file(sft),'holdout_id_overlap':0,'holdout_fingerprint_overlap':0,'human_reviewed_non_seed_rows':model_reviewed}


def readiness(reeval_handoff,evidence_zip,adapter_zip,aggregate_dir,work,out,config_path=DEFAULT_CONFIG):
    work=Path(work).resolve(); work.mkdir(parents=True,exist_ok=True)
    reeval=intake_reeval(reeval_handoff,evidence_zip,adapter_zip,work/'reeval-intake')
    if reeval.get('status')!='REEVAL_REJECTED' or reeval.get('next_step')!='failure_review_then_iteration_2': raise SystemExit('iteration 2 requires validated REEVAL_REJECTED handoff')
    eval_gold=Path(reeval['evidence_dir'])/'eval-gold.jsonl'; stats=validate_dataset(aggregate_dir,eval_gold,config_path)
    result={'schema_version':'1.0','state':'READY_FOR_ITERATION_2','reeval_status':'REEVAL_REJECTED','candidate_adapter_sha256':reeval['candidate_adapter_sha256'],'eval_gold_sha256':reeval['eval_gold_sha256'],'student_config_sha256':sha256_file(config_path),**stats,'release_created':False,'promotion_gate_unchanged':True,'next_step':'iteration_2_training'}
    Path(out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--reeval-handoff-json',required=True); ap.add_argument('--reeval-evidence-zip',required=True); ap.add_argument('--reeval-adapter-zip',required=True); ap.add_argument('--aggregate-dir',required=True); ap.add_argument('--work',required=True); ap.add_argument('--out',required=True); ap.add_argument('--config',default=str(DEFAULT_CONFIG)); args=ap.parse_args()
    print(json.dumps(readiness(args.reeval_handoff_json,args.reeval_evidence_zip,args.reeval_adapter_zip,args.aggregate_dir,args.work,args.out,args.config),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
