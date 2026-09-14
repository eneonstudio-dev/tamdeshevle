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
print('Data Factory Kaggle calibration gate passed.')
