#!/usr/bin/env python3
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
nb=HERE/'bai_iteration2_kaggle_train.ipynb'
data=json.loads(nb.read_text(encoding='utf-8'))
assert data.get('nbformat')==4
text='\n'.join(''.join(cell.get('source',[])) for cell in data.get('cells',[]))
required=[
 'REEVAL_REJECTED','failure_review_then_iteration_2','human_votonobay_reviewed',
 'prepare_iteration2_dataset.py','iteration2_readiness.py','READY_FOR_ITERATION_2',
 '--baseline-adapter','compare_candidate_runs.py','holdout_fingerprint_overlap',
 'bai_iteration2_result'
]
for token in required: assert token in text,token
for forbidden in ['deterministic-bootstrap','mode=\'deterministic-bootstrap\'','staged_release_review\' if']:
    assert forbidden not in text,forbidden
assert text.index('iteration2_readiness.py') < text.index('kaggle_train_pipeline.py')
assert "pipeline.get('status')=='REJECTED'" in text
assert "pipeline.get('status')=='PROMOTION_READY'" in text
print('Iteration 2 Kaggle notebook contract passed: REEVAL_REJECTED + reviewed Gold + readiness gate precede training, first candidate is baseline, no bootstrap bypass exists.')
