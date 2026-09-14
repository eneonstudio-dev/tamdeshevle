#!/usr/bin/env python3
import argparse,json,shutil,zipfile
from pathlib import Path
from reevaluate_candidate import sha256_file
from factory_handoff_common import KIND,read_json,validate_inventory
from validate_factory_handoff import validate

MAX_FILES=4096
MAX_UNPACKED=2*1024*1024*1024

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

def intake(handoff_json,evidence_zip,work):
    handoff=read_json(handoff_json); evidence_zip=Path(evidence_zip).resolve(); work=Path(work).resolve()
    if handoff.get('kind')!=KIND or handoff.get('status')!='REVIEW_READY': raise SystemExit('unsupported Data Factory handoff')
    if handoff.get('training_allowed') is not False or handoff.get('requires_human_review') is not True or handoff.get('frozen_promotion_holdout_used') is not False: raise SystemExit('unsafe handoff flags')
    if handoff.get('next_step')!='human_review_then_gold_export': raise SystemExit('unsafe handoff next step')
    if not evidence_zip.is_file() or sha256_file(evidence_zip)!=handoff.get('evidence_zip_sha256'): raise SystemExit('evidence ZIP hash mismatch')
    shutil.rmtree(work,ignore_errors=True); evidence=safe_extract(evidence_zip,work/'evidence')
    manifest=read_json(evidence/'evidence-manifest.json')
    for key in ('kind','status','pilot_tasks','calibration_tasks','corpus_sha256','teachers','training_allowed','requires_human_review','frozen_promotion_holdout_used','next_step'):
        if manifest.get(key)!=handoff.get(key): raise SystemExit(f'evidence/handoff mismatch: {key}')
    validate_inventory(evidence,manifest)
    meta=validate(evidence/'pilot.jsonl',evidence/'calibration.jsonl',evidence/'factory-manifest.json',evidence/'review')
    if meta['corpus_sha256']!=handoff.get('corpus_sha256') or meta['teachers']!=handoff.get('teachers'): raise SystemExit('validated review metadata mismatch')
    result={'schema_version':'1.0','state':'VALIDATED_HANDOFF','status':'REVIEW_READY','pilot_tasks':400,'calibration_tasks':40,'corpus_sha256':meta['corpus_sha256'],'training_allowed':False,'requires_human_review':True,'frozen_promotion_holdout_used':False,'next_step':'human_review_then_gold_export','review_dir':str(evidence/'review'),'pilot_file':str(evidence/'pilot.jsonl')}
    (work/'intake.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--handoff-json',required=True); ap.add_argument('--evidence-zip',required=True); ap.add_argument('--work',required=True); args=ap.parse_args()
    print(json.dumps(intake(args.handoff_json,args.evidence_zip,args.work),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
