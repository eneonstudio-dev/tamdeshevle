#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def stable(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))


def sha(value):
    raw=value if isinstance(value,str) else stable(value)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def clean(value):
    return ' '.join(str(value or '').split())


def fingerprint(row):
    return sha({'user_request':clean(row.get('user_request')).lower().replace('ё','е'),'session_context':row.get('session_context') or {}})


def category(row):
    rid=str(row.get('id') or '')
    if rid.startswith('seed_build_'): return 'build_fuzzy'
    if rid.startswith('seed_edit_'): return 'edit_fuzzy'
    if rid.startswith('seed_journey_'): return 'multi_turn'
    return str(row.get('category') or 'unknown')


def action_types(target):
    rows=target.get('actions') if isinstance(target,dict) and isinstance(target.get('actions'),list) else []
    return sorted({str(x.get('type') or '').lower() for x in rows if isinstance(x,dict) and x.get('type')})


def hard_keys(target):
    hard=target.get('hard_constraints') if isinstance(target,dict) else {}
    return sorted(hard.keys()) if isinstance(hard,dict) else []


def overlap(a,b):
    return len(set(a)&set(b))


def score(failure,row):
    expected=failure.get('expected') or {}; target=row.get('target') or {}; points=0
    if category(failure)==category(row): points+=8
    if str(expected.get('intent') or '')==str(target.get('intent') or ''): points+=6
    points+=2*overlap(action_types(expected),action_types(target))
    points+=2*overlap(hard_keys(expected),hard_keys(target))
    if bool((failure.get('session_context') or {}).get('constraints'))==bool((row.get('session_context') or {}).get('constraints')): points+=2
    return points


def wrap(text,index):
    prefixes=['Пожалуйста, ','Мне нужно: ','Сделай по условиям: ']
    return prefixes[index%len(prefixes)]+clean(text)


def main():
    ap=argparse.ArgumentParser(description='Create human-review remediation siblings from TRAIN rows selected by held-out failure clusters.')
    ap.add_argument('--failures',required=True); ap.add_argument('--train-gold',required=True); ap.add_argument('--eval-gold',required=True)
    ap.add_argument('--out-dir',required=True); ap.add_argument('--siblings',type=int,default=2)
    args=ap.parse_args()
    failures=read_jsonl(args.failures); train=read_jsonl(args.train_gold); heldout=read_jsonl(args.eval_gold)
    if not failures or not train or not heldout: raise SystemExit('failures, train Gold and eval Gold must be non-empty')
    for row in train:
        if (row.get('review') or {}).get('status')!='approved': raise SystemExit(f"train row {row.get('id')} is not approved")
    train_ids={str(x.get('id') or '') for x in train}; eval_ids={str(x.get('id') or '') for x in heldout}
    leaked=sorted(train_ids&eval_ids)
    if leaked: raise SystemExit(f'train/eval id leakage: {leaked[:5]}')
    eval_fp={fingerprint(x) for x in heldout}; siblings=max(1,min(5,args.siblings)); candidates=[]; queue=[]
    for failure in failures:
        fid=str(failure.get('id') or '').strip()
        if fid not in eval_ids: raise SystemExit(f'failure {fid} is not from heldout eval')
        ranked=sorted(train,key=lambda row:(-score(failure,row),str(row.get('id') or '')))
        created=0
        for source in ranked:
            if created>=siblings: break
            sid=str(source.get('id') or '').strip()
            if not sid or sid in eval_ids: continue
            request=wrap(source.get('user_request'),created)
            candidate={
                'id':'rem_'+sha({'failure':fid,'source':sid,'variant':created})[:20],
                'schema_version':'1.0','language':'ru','source_failure_id':fid,'source_train_id':sid,
                'category':category(source),'failure_labels':list(failure.get('failure_labels') or []),
                'focus':{'score':score(failure,source),'intent':(source.get('target') or {}).get('intent'),
                         'action_types':action_types(source.get('target') or {}),'hard_constraint_keys':hard_keys(source.get('target') or {})},
                'user_request':request,'session_context':source.get('session_context') or {},'guards':source.get('guards') or {},
                'suggested_target':source.get('target') or {},'review':{'status':'pending','requires_human_review':True},
                'training_allowed':False,'privacy':{'sanitized':True,'contains_personal_data':False},
                'provenance':{'source':'failure_remediation_v1','source_failure_id':fid,'source_train_id':sid,
                              'source_train_target_sha256':sha(source.get('target') or {})}
            }
            if fingerprint(candidate) in eval_fp: raise SystemExit(f"candidate {candidate['id']} collides with heldout fingerprint")
            candidates.append(candidate); queue.append({'candidate_id':candidate['id'],'source_failure_id':fid,'source_train_id':sid,
                'failure_labels':candidate['failure_labels'],'user_request':request,'suggested_target':candidate['suggested_target'],'decision':'pending_review'})
            created+=1
        if created<siblings: raise SystemExit(f'not enough non-heldout siblings for {fid}: {created}/{siblings}')
    out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    manifest={'schema_version':'1.0','source':'failure_remediation_v1','failure_examples':len(failures),'candidates':len(candidates),
              'siblings_per_failure':siblings,'heldout_ids':sorted(eval_ids),'heldout_fingerprints':sorted(eval_fp),
              'direct_heldout_to_training':False,'human_review_required':True,'auto_training_allowed':False}
    (out/'remediation-candidates.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in candidates),encoding='utf-8')
    (out/'review-queue.json').write_text(json.dumps(queue,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))

if __name__=='__main__': main()
