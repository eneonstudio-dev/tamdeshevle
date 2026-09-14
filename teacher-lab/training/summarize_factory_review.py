#!/usr/bin/env python3
import argparse,json
from collections import Counter,defaultdict
from pathlib import Path


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line.strip()]

def load_inputs(tasks_file,review_file):
    tasks=read_jsonl(tasks_file); review=json.loads(Path(review_file).read_text(encoding='utf-8'))
    if not isinstance(review,list): raise ValueError('review queue must be a JSON array')
    task_ids=[str(x.get('id','')) for x in tasks]; review_ids=[str(x.get('task_id','')) for x in review]
    if any(not x for x in task_ids+review_ids): raise ValueError('missing task id')
    if len(set(task_ids))!=len(task_ids): raise ValueError('duplicate task ids')
    if len(set(review_ids))!=len(review_ids): raise ValueError('duplicate review task ids')
    if set(task_ids)!=set(review_ids):
        missing=sorted(set(task_ids)-set(review_ids)); extra=sorted(set(review_ids)-set(task_ids))
        raise ValueError(f'review coverage mismatch missing={missing[:10]} extra={extra[:10]}')
    return tasks,review

def priority(task,item):
    flags=sorted(set((item.get('conflicts') or [])+(item.get('flags') or [])))
    score=0
    if item.get('status')=='missing_teacher': score+=100
    elif item.get('status')=='conflict': score+=50
    if task.get('difficulty')=='hard': score+=20
    if task.get('category')=='multi_turn': score+=15
    score+=5*len(flags)
    if item.get('status')=='agree' and not flags: score-=10
    return score,flags

def summarize(tasks,review):
    task_by_id={x['id']:x for x in tasks}; status=Counter(); flag_counts=Counter(); category=defaultdict(Counter); difficulty=defaultdict(Counter); rows=[]
    for item in review:
        task=task_by_id[item['task_id']]; st=item.get('status') or 'unknown'; status[st]+=1
        score,flags=priority(task,item)
        for flag in flags: flag_counts[flag]+=1
        category[task.get('category','unknown')][st]+=1
        difficulty[task.get('difficulty','unknown')][st]+=1
        rows.append({'task_id':item['task_id'],'priority_score':score,'category':task.get('category'),'difficulty':task.get('difficulty'),'status':st,'flags':flags,'user_request':task.get('user_request',''),'decision':'pending_review','training_allowed':False})
    rows.sort(key=lambda x:(-x['priority_score'],x['task_id']))
    summary={'schema_version':'1.0','total':len(review),'status_counts':dict(status),'flag_counts':dict(flag_counts),'by_category':{k:dict(v) for k,v in sorted(category.items())},'by_difficulty':{k:dict(v) for k,v in sorted(difficulty.items())},'high_priority':sum(1 for x in rows if x['priority_score']>=50),'review_required':True,'auto_training_allowed':False}
    return summary,rows

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--tasks',required=True); ap.add_argument('--review-queue',required=True); ap.add_argument('--out-dir',required=True); args=ap.parse_args()
    tasks,review=load_inputs(args.tasks,args.review_queue); summary,rows=summarize(tasks,review); out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    (out/'review-triage-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'review-priority.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
