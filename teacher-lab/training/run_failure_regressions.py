#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from analyze_candidate_failures import classify

def rows(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--regressions',required=True); ap.add_argument('--predictions',required=True); ap.add_argument('--out',required=True); ap.add_argument('--require-pass',action='store_true'); a=ap.parse_args()
    regs=rows(a.regressions); preds={str(x.get('id') or ''):x for x in rows(a.predictions)}; failed=[]
    for case in regs:
        if case.get('purpose')!='evaluation_regression_only' or case.get('training_allowed') is not False: raise SystemExit('regression must stay evaluation-only')
        sid=str(case.get('source_eval_id') or ''); labels=classify({'target':case.get('expected') or {},'session_context':case.get('session_context') or {}},preds.get(sid))
        if labels: failed.append({'id':case.get('id'),'source_eval_id':sid,'labels':labels})
    total=len(regs); summary={'regressions':total,'passed':total-len(failed),'failed':len(failed),'pass_rate':round((total-len(failed))/total,4) if total else None,'training_allowed':False}
    out=Path(a.out); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps({'summary':summary,'failures':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(summary,ensure_ascii=False))
    if a.require_pass and failed: raise SystemExit(f'{len(failed)} regression cases still fail')

if __name__=='__main__': main()
