#!/usr/bin/env python3
import hashlib,json,math

CATEGORIES=('build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn')

def calibration_tasks(tasks,per_category=10):
    out=[]
    for category in CATEGORIES:
        rows=[x for x in tasks if x.get('category')==category][:per_category]
        if len(rows)!=per_category: raise ValueError(f'not enough {category} rows')
        out.extend(rows)
    if len({x['id'] for x in out})!=len(out): raise ValueError('duplicate calibration task id')
    return out

def gate(summary,expected,ratio=0.90,stage='CALIBRATION',max_contract_violation_ratio=None):
    if not 0.5<=ratio<=1: raise ValueError('gate ratio must be 0.5..1')
    if max_contract_violation_ratio is not None and not 0<=max_contract_violation_ratio<=1:
        raise ValueError('contract violation ratio must be 0..1')
    floor=math.ceil(expected*ratio)
    values={k:int(summary.get(k,0) or 0) for k in ('left_candidates','right_candidates','compared')}
    if min(values.values())<floor: raise RuntimeError(f'{stage} rejected: {values}, required >= {floor}')
    if max_contract_violation_ratio is not None:
        violations=int(summary.get('contract_violations',0) or 0)
        max_violations=math.floor(expected*max_contract_violation_ratio)
        if violations>max_violations:
            raise RuntimeError(f'{stage} rejected: contract_violations={violations}, allowed <= {max_violations}/{expected}')
        values['contract_violations']=violations
        values['max_contract_violations']=max_violations
    return values

def verify_gpu(torch_module):
    if torch_module.cuda.device_count()<2: raise RuntimeError(f'Need Kaggle T4x2: got {torch_module.cuda.device_count()} GPU(s)')
    names=[torch_module.cuda.get_device_name(i) for i in range(2)]
    if not all('T4' in x.upper() for x in names): raise RuntimeError(f'Expected T4x2, got {names}')
    return names

def review_manifest(tasks,profiles):
    if not tasks: raise ValueError('factory tasks required')
    ids=[str(x.get('id','')) for x in tasks]
    if any(not x for x in ids) or len(ids)!=len(set(ids)): raise ValueError('factory task ids must be unique')
    teachers=[]
    for p in profiles:
        item={k:str(p.get(k,'')).strip() for k in ('id','source_id','model','revision','transport','endpoint')}
        if not all(item[k] for k in ('id','source_id','model','revision')): raise ValueError('valid teacher profile required')
        if len(item['revision'])!=40 or any(c not in '0123456789abcdefABCDEF' for c in item['revision']): raise ValueError('teacher revision must be pinned commit hash')
        teachers.append(item)
    if not teachers: raise ValueError('teacher profiles required')
    body=''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in tasks)
    return {
        'schema_version':'1.0',
        'corpus':{'tasks':len(tasks),'sha256':hashlib.sha256(body.encode('utf-8')).hexdigest()},
        'teachers':teachers,
        'factory':{'kind':'bai_data_factory_v2_teacher_pilot','training_allowed':False,'requires_human_review':True,'frozen_promotion_holdout_used':False}
    }
