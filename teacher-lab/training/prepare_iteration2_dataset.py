#!/usr/bin/env python3
import argparse,json,shutil,subprocess
from pathlib import Path
from kaggle_train_pipeline import read_jsonl,semantic_fingerprint

ROOT=Path(__file__).resolve().parents[2]
AGG=ROOT/'teacher-lab/training/aggregate-gold.mjs'
CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'

def call(cmd): return subprocess.run([str(x) for x in cmd],cwd=ROOT,check=True,capture_output=True,text=True)

def ids(rows,label):
    values=[str(x.get('id') or '').strip() for x in rows]
    if any(not x for x in values) or len(values)!=len(set(values)): raise SystemExit(f'{label}: missing/duplicate ids')
    return set(values)

def prepare(gold_files,eval_gold,out_dir,config=CONFIG,require_ready=True):
    out=Path(out_dir).resolve(); shutil.rmtree(out,ignore_errors=True); out.mkdir(parents=True)
    raw=out/'raw'; final=out/'dataset'; raw.mkdir(); final.mkdir()
    call(['node',AGG,raw,*gold_files])
    train=read_jsonl(raw/'gold.jsonl'); heldout=read_jsonl(eval_gold)
    train_ids=ids(train,'train'); eval_ids=ids(heldout,'eval')
    eval_fp={semantic_fingerprint(x) for x in heldout}
    kept=[]; removed=[]
    for row in train:
        rid=str(row['id']); fp=semantic_fingerprint(row); reasons=[]
        if rid in eval_ids: reasons.append('heldout_id')
        if fp in eval_fp: reasons.append('heldout_fingerprint')
        if reasons: removed.append({'id':rid,'reasons':reasons,'fingerprint':fp})
        else: kept.append(row)
    if len({str(x['id']) for x in kept})!=len(kept): raise SystemExit('sanitized train ids are not unique')
    sanitized=out/'sanitized-gold.jsonl'
    sanitized.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in kept),encoding='utf-8')
    call(['node',AGG,final,sanitized])
    manifest=json.loads((final/'manifest.json').read_text(encoding='utf-8'))
    report={'schema_version':'1.0','raw_examples':len(train),'kept_examples':len(kept),'removed_examples':len(removed),'removed_heldout_ids':sum('heldout_id' in x['reasons'] for x in removed),'removed_heldout_fingerprints':sum('heldout_fingerprint' in x['reasons'] for x in removed),'eval_examples':len(heldout),'ready_for_training':bool(manifest.get('ready_for_training')),'minimum_examples':int(manifest.get('minimum_examples',0) or 0),'removed':removed,'frozen_eval_unchanged':True}
    (out/'sanitization-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if set(str(x['id']) for x in kept)&eval_ids: raise SystemExit('iteration 2 id leakage survived sanitizer')
    if {semantic_fingerprint(x) for x in kept}&eval_fp: raise SystemExit('iteration 2 semantic leakage survived sanitizer')
    if require_ready and not manifest.get('ready_for_training'):
        raise SystemExit(f"sanitized Gold below training minimum: {len(kept)} / {manifest.get('minimum_examples')}; add reviewed non-heldout Gold")
    return report

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--gold',action='append',required=True); ap.add_argument('--eval-gold',required=True); ap.add_argument('--out-dir',required=True); ap.add_argument('--config',default=str(CONFIG)); ap.add_argument('--allow-shortfall',action='store_true'); args=ap.parse_args()
    print(json.dumps(prepare(args.gold,args.eval_gold,args.out_dir,args.config,not args.allow_shortfall),ensure_ascii=False,indent=2))
if __name__=='__main__': main()
