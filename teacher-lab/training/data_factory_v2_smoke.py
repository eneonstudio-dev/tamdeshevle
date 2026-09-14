from data_factory_v2 import build_tasks,stats
rows=build_tasks(); s=stats(rows)
assert len(rows)>=1400
assert len({x['id'] for x in rows})==len(rows)
assert s['by_category']['build_fuzzy']>=100 and s['by_category']['edit_fuzzy']>=400 and s['by_category']['constraint_conflict']>=300 and s['by_category']['multi_turn']>=400
assert s['by_difficulty']['hard']>=500
for x in rows:
    assert x['factory']=={'version':'2.0','training_allowed':False,'requires_human_review':True}
    assert x['expected']['intent_family'] in {'build_basket','edit_basket'}
    assert 'price' in x['guards']['forbid_fabrication']
print(s)
