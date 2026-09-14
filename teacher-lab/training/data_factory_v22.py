#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path

from data_factory_v2 import build_tasks,dedupe_tasks,balanced_pilot
from data_factory_semantics import enrich_tasks,validate_tasks


def build_semantic_tasks():
    raw=build_tasks()
    enriched=enrich_tasks(raw)
    validate_tasks(enriched)
    unique=dedupe_tasks(enriched)
    if len(unique)!=len(enriched):
        raise RuntimeError(f'semantic enrichment introduced duplicates: {len(enriched)} -> {len(unique)}')
    return unique


def summary(rows):
    return {
        'schema_version':'2.2','total':len(rows),
        'by_category':dict(Counter(x['category'] for x in rows)),
        'by_difficulty':dict(Counter(x['difficulty'] for x in rows)),
        'training_allowed':False,'requires_human_review':True,
        'semantic_contracts_validated':True,
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--pilot-out'); ap.add_argument('--pilot-per-category',type=int,default=100)
    args=ap.parse_args()
    rows=build_semantic_tasks()
    Path(args.out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')
    result=summary(rows)
    if args.pilot_out:
        pilot=balanced_pilot(rows,args.pilot_per_category)
        validate_tasks(pilot)
        Path(args.pilot_out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in pilot),encoding='utf-8')
        result['pilot_total']=len(pilot); result['pilot_by_category']=dict(Counter(x['category'] for x in pilot))
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=='__main__': main()
