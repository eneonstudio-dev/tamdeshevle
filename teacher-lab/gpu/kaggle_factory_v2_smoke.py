#!/usr/bin/env python3
import kaggle_factory_v2_runall as mod

rows=[]
for category in mod.CATEGORIES:
    rows += [{'id':f'{category}-{i}','category':category} for i in range(12)]
cal=mod.calibration_tasks(rows,10)
assert len(cal)==40 and len({x['id'] for x in cal})==40
assert all(sum(1 for x in cal if x['category']==category)==10 for category in mod.CATEGORIES)
assert mod.gate({'left_candidates':36,'right_candidates':40,'compared':38},40)=={'left_candidates':36,'right_candidates':40,'compared':38}
try: mod.gate({'left_candidates':35,'right_candidates':40,'compared':40},40)
except RuntimeError: pass
else: raise AssertionError('calibration gate must fail below 90%')
profiles=[
    {'id':'left','source_id':'left_source','model':'left/model','revision':'a'*40,'transport':'local','endpoint':'http://127.0.0.1:1'},
    {'id':'right','source_id':'right_source','model':'right/model','revision':'b'*40,'transport':'local','endpoint':'http://127.0.0.1:2'}
]
manifest=mod.review_manifest(rows,profiles)
assert manifest['corpus']['tasks']==len(rows)
assert len(manifest['corpus']['sha256'])==64
assert [x['id'] for x in manifest['teachers']]==['left','right']
assert manifest['factory']['training_allowed'] is False
assert manifest['factory']['requires_human_review'] is True
assert manifest['factory']['frozen_promotion_holdout_used'] is False
try: mod.review_manifest(rows,[{**profiles[0],'revision':'unpinned'}])
except ValueError: pass
else: raise AssertionError('review manifest must reject unpinned teacher revisions')
print('Data Factory Kaggle calibration gate and review manifest passed.')
