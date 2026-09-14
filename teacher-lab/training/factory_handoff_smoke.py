#!/usr/bin/env python3
import json,tempfile
from collections import Counter
from pathlib import Path
from factory_handoff_common import compact_hash
from package_factory_artifact import package
from intake_factory_handoff import intake

TEACHERS=[
 {'id':'deepseek_r1_distill_qwen_7b','source_id':'deepseek_r1_local_mit','model':'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B','revision':'1'*40},
 {'id':'qwen3_8b','source_id':'qwen3_open_weights_apache2','model':'Qwen/Qwen3-8B','revision':'2'*40},
]
CATS=['build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn']

def write(path,text):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text,encoding='utf-8')

def jsonl(path,rows): write(path,''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows))

def candidate(task,teacher):
    return {'id':f"{task['id']}.{teacher['id']}",'provenance':{'sources':[{'corpus_task_id':task['id'],'profile_id':teacher['id'],'source_id':teacher['source_id'],'model':teacher['model'],'revision':teacher['revision']}]},'review':{'status':'candidate'}}

def fixture(root):
    tasks=[]
    for i in range(400): tasks.append({'id':f'task_{i:03d}','category':CATS[i//100],'difficulty':'hard' if i%2 else 'medium','user_request':f'request {i}','session_context':{}})
    cal=[]
    for cat in CATS: cal.extend([x for x in tasks if x['category']==cat][:10])
    pilot=root/'pilot.jsonl'; calibration=root/'calibration.jsonl'; jsonl(pilot,tasks); jsonl(calibration,cal)
    factory=root/'factory-manifest.json'; write(factory,json.dumps({'schema_version':'2.0','kind':'bai_data_factory_v2_teacher_pilot','pilot_tasks':400,'calibration_tasks':40,'training_allowed':False,'requires_human_review':True,'frozen_promotion_holdout_used':False})+'\n')
    review=root/'review'; review.mkdir()
    jsonl(review/'left-candidates.jsonl',[candidate(t,TEACHERS[0]) for t in tasks]); jsonl(review/'right-candidates.jsonl',[candidate(t,TEACHERS[1]) for t in tasks])
    queue=[{'task_id':t['id'],'status':'agree','conflicts':[],'flags':[],'decision':'pending_review'} for t in tasks]
    write(review/'review-queue.json',json.dumps(queue)+'\n')
    write(review/'summary.json',json.dumps({'left_candidates':400,'right_candidates':400,'compared':400,'agreements':400,'conflicts':0,'missing':0,'auto_approved':0})+'\n')
    corpus={'schema_version':'1.0','corpus':{'tasks':400,'sha256':compact_hash(tasks)},'teachers':TEACHERS,'factory':{'kind':'bai_data_factory_v2_teacher_pilot','training_allowed':False,'requires_human_review':True,'frozen_promotion_holdout_used':False}}
    write(review/'corpus-manifest.json',json.dumps(corpus)+'\n')
    jsonl(review/'run-manifest.jsonl',[{'models':{x['id']:{'repo':x['model'],'revision':x['revision']} for x in TEACHERS}}])
    write(review/'triage/review-triage-summary.json',json.dumps({'total':400,'review_required':True,'auto_training_allowed':False})+'\n')
    jsonl(review/'triage/review-priority.jsonl',[{'task_id':t['id'],'decision':'pending_review','training_allowed':False} for t in tasks])
    return pilot,calibration,factory,review

with tempfile.TemporaryDirectory() as td:
    root=Path(td); pilot,calibration,factory,review=fixture(root)
    prefix=root/'handoff'; handoff=package(pilot,calibration,factory,review,prefix,'test/source')
    result=intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],root/'intake')
    assert result['state']=='VALIDATED_HANDOFF' and result['status']=='REVIEW_READY'
    assert result['next_step']=='human_review_then_gold_export' and result['training_allowed'] is False
    assert Path(result['review_dir']).is_dir() and Path(result['pilot_file']).is_file()
    with Path(handoff['evidence_zip']).open('ab') as f: f.write(b'tamper')
    try: intake(str(prefix)+'-handoff.json',handoff['evidence_zip'],root/'bad')
    except SystemExit as exc: assert 'evidence ZIP hash mismatch' in str(exc)
    else: raise AssertionError('tampered Data Factory evidence ZIP must fail')

print('Data Factory portable handoff round trip passed with hash and review-only guards.')
