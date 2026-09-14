#!/usr/bin/env python3
from collections import Counter,defaultdict
from data_factory_v22 import build_semantic_tasks

rows=build_semantic_tasks()
assert len(rows)==1448, len(rows)
assert all(x['factory']['version']=='2.2' for x in rows)

edits=[x for x in rows if x['category']=='edit_fuzzy']
cases=Counter(x['expected']['case_id'] for x in edits)
assert len(cases)==20 and min(cases.values())>=20, cases

by_case=defaultdict(list)
for x in edits: by_case[x['expected']['case_id']].append(x)
assert all('ветчина' in x['session_context']['basket'] for x in by_case['remove_ham'])
assert all(x['session_context']['previous_basket']!=x['session_context']['basket'] for x in by_case['restore_previous'])
assert all('макароны' in x['session_context']['basket'] and x['session_context']['quantities']['макароны']>=2 for x in by_case['decrement_pasta'])
assert all('курица' in x['session_context']['basket'] and 'индейка' not in x['session_context']['basket'] for x in by_case['replace_chicken_turkey'])
assert all(x['session_context']['budget']!=4000 and x['expected']['new_hard']==['budget<=4000'] for x in by_case['change_budget_4000'])
assert all(not any(v.startswith('exclude_brand:') for v in x['expected']['must_retain']) and x['expected']['must_drop'] for x in by_case['relax_brand'])
assert all(x['session_context']['mode']=='multi' and 'mode:one' in x['expected']['new_hard'] for x in by_case['force_one_store'])
assert all(x['session_context']['mode']=='one' and 'mode:one' in x['expected']['must_drop'] for x in by_case['allow_two_stores'])
assert all(x['session_context']['current_store_id']!=x['session_context']['requested_store_id'] for x in by_case['same_basket_other_store'])

journeys=defaultdict(list)
for x in rows:
    if x['category']=='multi_turn': journeys[x['expected']['scenario_id']].append(x)
assert len(journeys)==80
for scenario,items in journeys.items():
    items=sorted(items,key=lambda x:x['expected']['turn'])
    assert [x['expected']['turn'] for x in items]==[1,2,3,4,5,6]
    assert [len(x['session_context']['previous_requests']) for x in items]==[0,1,2,3,4,5]
    assert items[3]['session_context']['mode']=='multi'
    assert items[4]['session_context']['mode']=='one' and 'mode:one' in items[4]['session_context']['constraints']
    assert items[5]['session_context']['mode']=='one' and 'mode:one' in items[5]['expected']['must_retain']
    before_snacks=set(items[2]['session_context']['basket']) & {'йогурт','орехи','хлебцы','сыр','кефир'}
    after_snacks=set(items[3]['session_context']['basket']) & {'йогурт','орехи','хлебцы','сыр','кефир'}
    assert len(after_snacks)<len(before_snacks), scenario

print('Data Factory v2.2 semantic smoke passed: 20 executable edit contracts and 80 stateful six-turn journeys are coherent.')
