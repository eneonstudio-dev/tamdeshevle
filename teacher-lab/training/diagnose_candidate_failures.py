#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def category(row):
    rid=str(row.get('id') or '')
    if rid.startswith('seed_build_'): return 'build_fuzzy'
    if rid.startswith('seed_edit_'): return 'edit_fuzzy'
    if rid.startswith('seed_journey_'): return 'multi_turn'
    return 'unknown'


def kind(labels):
    labels=set(labels or [])
    if labels & {'missing_prediction','parse_error'}: return 'parse'
    if labels & {'malformed_actions','malformed_retained_constraints'}: return 'schema'
    return 'semantic'


def main():
    ap=argparse.ArgumentParser(description='Produce actionable diagnostics and frozen regressions from held-out candidate failures.')
    ap.add_argument('--failures',required=True)
    ap.add_argument('--out-dir',required=True)
    args=ap.parse_args()
    rows=read_jsonl(args.failures); out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    by_category=Counter(); by_kind=Counter(); by_intent=Counter(); by_action=Counter(); by_hard=Counter(); label_by_category=Counter()
    regressions=[]
    for row in rows:
        labels=list(row.get('failure_labels') or [])
        cat=category(row); fk=kind(labels); target=row.get('expected') or {}
        intent=str(target.get('intent') or 'unknown')
        actions=target.get('actions') if isinstance(target.get('actions'),list) else []
        action_types=sorted({str(x.get('type') or '').lower() for x in actions if isinstance(x,dict) and x.get('type')})
        hard_keys=sorted((target.get('hard_constraints') or {}).keys()) if isinstance(target.get('hard_constraints'),dict) else []
        by_category[cat]+=1; by_kind[fk]+=1; by_intent[intent]+=1
        for label in labels: label_by_category[(cat,label)]+=1
        for name in action_types or ['none']: by_action[name]+=1
        for name in hard_keys or ['none']: by_hard[name]+=1
        regressions.append({
            'id':f"reg_{row.get('id')}", 'source_eval_id':row.get('id'),
            'purpose':'evaluation_regression_only','category':cat,'failure_kind':fk,
            'failure_labels':labels,'user_request':row.get('user_request'),
            'session_context':row.get('session_context') or {},'expected':target,
            'training_allowed':False,'provenance':row.get('provenance') or {}
        })
    nested={}
    for (cat,label),count in sorted(label_by_category.items()): nested.setdefault(cat,{})[label]=count
    summary={'schema_version':'1.0','failed_examples':len(rows),'by_category':dict(sorted(by_category.items())),
             'failure_kinds':dict(sorted(by_kind.items())),'by_intent':dict(sorted(by_intent.items())),
             'by_expected_action_type':dict(sorted(by_action.items())),'by_expected_hard_constraint':dict(sorted(by_hard.items())),
             'label_by_category':nested,'heldout_must_not_enter_training':True,'auto_training_allowed':False}
    (out/'diagnostics.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'regression-cases.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in regressions),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__': main()
