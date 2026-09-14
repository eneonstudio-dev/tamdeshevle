#!/usr/bin/env python3
from collections import Counter
from data_factory_v2 import build_tasks,dedupe_tasks,balanced_pilot

rows=dedupe_tasks(build_tasks())
pilot=balanced_pilot(rows,100)
assert len(rows)==1448, len(rows)
assert len(pilot)==400, len(pilot)
assert len({x['id'] for x in pilot})==400
assert Counter(x['category'] for x in pilot)=={'build_fuzzy':100,'edit_fuzzy':100,'constraint_conflict':100,'multi_turn':100}

build=[x for x in rows if x['category']=='build_fuzzy']
bases=Counter(next((b for b in ['гречка','рис','макароны','картофель','овсянка'] if b in x['user_request']),None) for x in build)
assert len(bases)==5 and min(bases.values())>=20, bases
one_people=Counter(next(v for v in x['expected']['new_hard'] if v.startswith('people:')) for x in build if 'mode:one' in x['expected']['new_hard'])
assert set(one_people)=={'people:1','people:2','people:3','people:4'} and min(one_people.values())>=6, one_people

edit=[x for x in rows if x['category']=='edit_fuzzy']
assert len({(x['session_context']['days'],x['session_context']['people']) for x in edit})==16
assert len({x['user_request'] for x in edit})==20

conf=[x for x in rows if x['category']=='constraint_conflict']
brand_people={(next(v for v in x['session_context']['constraints'] if v.startswith('exclude_brand:')),x['session_context']['people']) for x in conf}
assert len(brand_people)==12, len(brand_people)
assert len({x['user_request'] for x in conf})==20

multi=[x for x in rows if x['category']=='multi_turn']
assert len({tuple(x['session_context']['basket']) for x in multi})>=70
assert len({x['user_request'] for x in multi})>=24

pbuild=[x for x in pilot if x['category']=='build_fuzzy']
for prefix in ('days:','people:'):
    counts=Counter(next(v for v in x['expected']['new_hard'] if v.startswith(prefix)) for x in pbuild)
    assert max(counts.values())-min(counts.values())<=1, (prefix,counts)
budgets=Counter(next(v for v in x['expected']['new_hard'] if v.startswith('budget<=')) for x in pbuild)
assert max(budgets.values())-min(budgets.values())<=1, budgets

pedit=[x for x in pilot if x['category']=='edit_fuzzy']
phrases=Counter(x['user_request'] for x in pedit)
assert len(phrases)==20 and max(phrases.values())-min(phrases.values())<=1, phrases

pmulti=[x for x in pilot if x['category']=='multi_turn']
turns=Counter(x['expected']['turn'] for x in pmulti)
assert set(turns)==set(range(1,7)) and max(turns.values())-min(turns.values())<=1, turns

print('Data Factory v2.1 quality passed: 1448 unique decorrelated tasks, 400 balanced pilot, broad product/context/turn coverage.')
