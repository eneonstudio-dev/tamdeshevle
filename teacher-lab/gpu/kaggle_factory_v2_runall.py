#!/usr/bin/env python3
import math

CATEGORIES=('build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn')

def calibration_tasks(tasks,per_category=10):
    out=[]
    for category in CATEGORIES:
        rows=[x for x in tasks if x.get('category')==category][:per_category]
        if len(rows)!=per_category: raise ValueError(f'not enough {category} rows')
        out.extend(rows)
    if len({x['id'] for x in out})!=len(out): raise ValueError('duplicate calibration task id')
    return out

def gate(summary,expected,ratio=0.90,stage='CALIBRATION'):
    if not 0.5<=ratio<=1: raise ValueError('gate ratio must be 0.5..1')
    floor=math.ceil(expected*ratio)
    values={k:int(summary.get(k,0) or 0) for k in ('left_candidates','right_candidates','compared')}
    if min(values.values())<floor: raise RuntimeError(f'{stage} rejected: {values}, required >= {floor}')
    return values

def verify_gpu(torch_module):
    if torch_module.cuda.device_count()<2: raise RuntimeError(f'Need Kaggle T4x2: got {torch_module.cuda.device_count()} GPU(s)')
    names=[torch_module.cuda.get_device_name(i) for i in range(2)]
    if not all('T4' in x.upper() for x in names): raise RuntimeError(f'Expected T4x2, got {names}')
    return names
