from collections import Counter
from data_factory_v2 import build_tasks, stats, balanced_pilot

rows = build_tasks()
s = stats(rows)
pilot = balanced_pilot(rows, 100)

checks = [
    (len(rows) == 1448, 'corpus_size'),
    (len({x['id'] for x in rows}) == len(rows), 'unique_ids'),
    (s['by_category'] == {'build_fuzzy':128,'edit_fuzzy':480,'constraint_conflict':360,'multi_turn':480}, 'category_counts'),
    (s['by_difficulty'].get('hard', 0) >= 700, 'hard_case_floor'),
    (len(pilot) == 400, 'pilot_size'),
    (dict(Counter(x['category'] for x in pilot)) == {'build_fuzzy':100,'edit_fuzzy':100,'constraint_conflict':100,'multi_turn':100}, 'pilot_balance'),
    (all(x['factory']['training_allowed'] is False and x['factory']['requires_human_review'] is True for x in rows), 'review_only'),
    (all({'price','availability','store','composition','quality'}.issubset(set(x['guards']['forbid_fabrication'])) for x in rows), 'truth_guard'),
]
failed = [name for ok, name in checks if not ok]
if failed:
    raise SystemExit('Data Factory v2 smoke failed: ' + ', '.join(failed))
print({'corpus': s, 'pilot_total': len(pilot)})
