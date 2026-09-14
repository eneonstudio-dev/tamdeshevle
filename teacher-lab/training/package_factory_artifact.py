#!/usr/bin/env python3
import argparse,json,shutil
from pathlib import Path
from reevaluate_candidate import sha256_file
from factory_handoff_common import KIND,file_inventory
from validate_factory_handoff import validate

def package(pilot,calibration,factory_manifest,review_dir,out_prefix,source_ref=''):
    meta=validate(pilot,calibration,factory_manifest,review_dir)
    prefix=Path(out_prefix).resolve(); work=prefix.parent/(prefix.name+'-evidence')
    shutil.rmtree(work,ignore_errors=True); work.mkdir(parents=True)
    shutil.copy2(pilot,work/'pilot.jsonl')
    shutil.copy2(calibration,work/'calibration.jsonl')
    shutil.copy2(factory_manifest,work/'factory-manifest.json')
    shutil.copytree(review_dir,work/'review')
    evidence={
        'schema_version':'1.0','kind':KIND,'status':'REVIEW_READY','source_ref':source_ref or None,
        **meta,'training_allowed':False,'requires_human_review':True,
        'frozen_promotion_holdout_used':False,'next_step':'human_review_then_gold_export'}
    evidence['files']=file_inventory(work,exclude={'evidence-manifest.json'})
    (work/'evidence-manifest.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    archive=Path(shutil.make_archive(str(prefix)+'-evidence','zip',root_dir=work))
    handoff={**{k:evidence[k] for k in (
        'schema_version','kind','status','source_ref','pilot_tasks','calibration_tasks','corpus_sha256','teachers',
        'training_allowed','requires_human_review','frozen_promotion_holdout_used','next_step')},
        'evidence_zip':str(archive),'evidence_zip_sha256':sha256_file(archive)}
    handoff_file=Path(str(prefix)+'-handoff.json')
    handoff_file.write_text(json.dumps(handoff,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    shutil.rmtree(work,ignore_errors=True)
    return handoff

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--pilot',required=True); ap.add_argument('--calibration',required=True); ap.add_argument('--factory-manifest',required=True); ap.add_argument('--review-dir',required=True); ap.add_argument('--out-prefix',required=True); ap.add_argument('--source-ref',default=''); args=ap.parse_args()
    print(json.dumps(package(args.pilot,args.calibration,args.factory_manifest,args.review_dir,args.out_prefix,args.source_ref),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
