#!/usr/bin/env python3
import json,tempfile
from pathlib import Path
from summarize_factory_review import load_inputs,summarize

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp); tasks=root/'tasks.jsonl'; queue=root/'queue.json'
    task_rows=[
      {'id':'build-1','category':'build_fuzzy','difficulty':'medium','user_request':'build'},
      {'id':'edit-1','category':'edit_fuzzy','difficulty':'hard','user_request':'edit'},
      {'id':'conflict-1','category':'constraint_conflict','difficulty':'hard','user_request':'conflict'},
      {'id':'turn-1','category':'multi_turn','difficulty':'hard','user_request':'turn'},
    ]
    review=[
      {'task_id':'build-1','status':'agree','conflicts':[],'flags':[]},
      {'task_id':'edit-1','status':'conflict','conflicts':['actions'],'flags':['check_context_retention']},
      {'task_id':'conflict-1','status':'missing_teacher','conflicts':['missing_teacher'],'flags':[]},
      {'task_id':'turn-1','status':'conflict','conflicts':['hard_constraints'],'flags':[]},
    ]
    tasks.write_text(''.join(json.dumps(x)+'\n' for x in task_rows),encoding='utf-8'); queue.write_text(json.dumps(review),encoding='utf-8')
    t,r=load_inputs(tasks,queue); summary,rows=summarize(t,r)
    assert summary['total']==4 and summary['status_counts']=={'agree':1,'conflict':2,'missing_teacher':1}
    assert summary['high_priority']==3 and summary['review_required'] is True and summary['auto_training_allowed'] is False
    assert rows[0]['task_id']=='conflict-1' and all(x['training_allowed'] is False and x['decision']=='pending_review' for x in rows)
    queue.write_text(json.dumps(review[:-1]),encoding='utf-8')
    try: load_inputs(tasks,queue)
    except ValueError as exc: assert 'coverage mismatch' in str(exc)
    else: raise AssertionError('incomplete review queue must fail closed')
print('Data Factory review triage smoke passed.')
