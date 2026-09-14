#!/usr/bin/env python3
import json
from pathlib import Path
from factory_handoff_common import REQUIRED_REVIEW,read_json,read_jsonl,compact_hash,candidate_task_id

def validate(pilot,calibration,factory_manifest,review_dir):
    pilot=Path(pilot).resolve(); calibration=Path(calibration).resolve(); factory_manifest=Path(factory_manifest).resolve(); review_dir=Path(review_dir).resolve()
    for p in (pilot,calibration,factory_manifest):
        if not p.is_file(): raise SystemExit(f'missing Data Factory evidence: {p}')
    missing=[x for x in REQUIRED_REVIEW if not (review_dir/x).is_file()]
    if missing: raise SystemExit(f'review evidence missing: {missing}')
    tasks=read_jsonl(pilot); cal=read_jsonl(calibration)
    task_ids=[str(x.get('id','')) for x in tasks]; cal_ids=[str(x.get('id','')) for x in cal]
    if len(tasks)!=400 or any(not x for x in task_ids) or len(set(task_ids))!=400: raise SystemExit('pilot must contain exactly 400 unique task ids')
    if len(cal)!=40 or any(not x for x in cal_ids) or len(set(cal_ids))!=40 or not set(cal_ids)<=set(task_ids): raise SystemExit('calibration must contain 40 unique pilot task ids')
    factory=read_json(factory_manifest)
    if factory.get('kind')!='bai_data_factory_v2_teacher_pilot' or factory.get('pilot_tasks')!=400 or factory.get('calibration_tasks')!=40: raise SystemExit('invalid factory manifest')
    if factory.get('training_allowed') is not False or factory.get('requires_human_review') is not True or factory.get('frozen_promotion_holdout_used') is not False: raise SystemExit('unsafe factory manifest flags')
    corpus=read_json(review_dir/'corpus-manifest.json'); corpus_meta=corpus.get('corpus') or {}; factory_meta=corpus.get('factory') or {}
    if corpus_meta.get('tasks')!=400 or corpus_meta.get('sha256')!=compact_hash(tasks): raise SystemExit('factory corpus hash/count mismatch')
    if factory_meta.get('kind')!='bai_data_factory_v2_teacher_pilot' or factory_meta.get('training_allowed') is not False or factory_meta.get('requires_human_review') is not True or factory_meta.get('frozen_promotion_holdout_used') is not False: raise SystemExit('unsafe corpus manifest flags')
    teachers=corpus.get('teachers') or []; teacher_map={str(x.get('id','')):x for x in teachers if isinstance(x,dict)}
    if len(teachers)!=2 or len(teacher_map)!=2 or any(len(str(x.get('revision','')))!=40 for x in teacher_map.values()): raise SystemExit('exactly two pinned teachers required')
    expected=set(task_ids)
    for side in ('left-candidates.jsonl','right-candidates.jsonl'):
        rows=read_jsonl(review_dir/side); ids=[candidate_task_id(x) for x in rows]
        if len(rows)!=400 or set(ids)!=expected or len(set(ids))!=400: raise SystemExit(f'{side} task coverage mismatch')
        for row in rows:
            src=((row.get('provenance') or {}).get('sources') or [{}])[0]; teacher=teacher_map.get(str(src.get('profile_id','')))
            if not teacher or src.get('model')!=teacher.get('model') or src.get('revision')!=teacher.get('revision') or src.get('source_id')!=teacher.get('source_id'): raise SystemExit(f'{side} teacher provenance mismatch')
            if (row.get('review') or {}).get('status')!='candidate': raise SystemExit(f'{side} must remain candidate-only')
    queue=json.loads((review_dir/'review-queue.json').read_text(encoding='utf-8'))
    if not isinstance(queue,list) or len(queue)!=400: raise SystemExit('review queue must contain 400 rows')
    queue_ids=[str(x.get('task_id','')) for x in queue]
    if set(queue_ids)!=expected or len(set(queue_ids))!=400 or any(x.get('decision')!='pending_review' for x in queue): raise SystemExit('review queue coverage/state mismatch')
    summary=read_json(review_dir/'summary.json')
    if any(int(summary.get(k,0) or 0)!=400 for k in ('left_candidates','right_candidates','compared')) or int(summary.get('missing',0) or 0)!=0 or int(summary.get('auto_approved',0) or 0)!=0: raise SystemExit('review summary is incomplete or auto-approved')
    triage=read_json(review_dir/'triage/review-triage-summary.json')
    if triage.get('total')!=400 or triage.get('review_required') is not True or triage.get('auto_training_allowed') is not False: raise SystemExit('unsafe triage summary')
    priority=read_jsonl(review_dir/'triage/review-priority.jsonl'); priority_ids=[str(x.get('task_id','')) for x in priority]
    if len(priority)!=400 or set(priority_ids)!=expected or len(set(priority_ids))!=400 or any(x.get('decision')!='pending_review' or x.get('training_allowed') is not False for x in priority): raise SystemExit('triage priority coverage/state mismatch')
    runtime=read_jsonl(review_dir/'run-manifest.jsonl')
    if not runtime: raise SystemExit('teacher runtime manifest is empty')
    models=runtime[-1].get('models') or {}
    for profile,teacher in teacher_map.items():
        cfg=models.get(profile) or {}
        if cfg.get('repo')!=teacher.get('model') or cfg.get('revision')!=teacher.get('revision'): raise SystemExit('runtime teacher pin mismatch')
    return {'pilot_tasks':400,'calibration_tasks':40,'corpus_sha256':corpus_meta['sha256'],'teachers':teachers}
