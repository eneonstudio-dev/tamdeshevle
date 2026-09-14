#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'teacher-lab/training/analyze_candidate_failures.py'

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    eval_file = tmp / 'eval.jsonl'
    pred_file = tmp / 'pred.jsonl'
    out = tmp / 'out'

    gold = [
        {
            'id': 'ok',
            'user_request': 'собери корзину',
            'session_context': {},
            'target': {'intent': 'build_basket', 'hard_constraints': {}, 'actions': [], 'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'parse',
            'user_request': 'до 5000',
            'session_context': {'constraints': ['budget<=5000']},
            'target': {'intent': 'build_basket', 'hard_constraints': {'budget_max': 5000}, 'actions': [{'type': 'set_constraint', 'payload': {'key': 'budget', 'value': 5000}}], 'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'semantic',
            'user_request': 'без Мираторга',
            'session_context': {'constraints': ['exclude_brand:Мираторг']},
            'target': {'intent': 'edit_basket', 'hard_constraints': {'excluded_brands': ['Мираторг']}, 'actions': [{'type': 'set_constraint', 'payload': {'key': 'excluded_brand', 'value': 'Мираторг'}}], 'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'malformed',
            'user_request': 'замени товар',
            'session_context': {},
            'target': {'intent': 'edit_basket', 'hard_constraints': {}, 'actions': [{'type': 'replace_item', 'payload': {'from_product_id': 'a', 'to_product_id': 'b'}}], 'shopping_plan': {'allowed_replacements': {'a': ['b']}}},
        },
    ]
    preds = [
        {'id': 'ok', 'intent': 'build_basket', 'hard_constraints': {}, 'actions': [], 'retained_constraints': []},
        {'id': 'parse', 'parse_error': 'student_no_json'},
        {'id': 'semantic', 'intent': 'build_basket', 'hard_constraints': {}, 'actions': [], 'retained_constraints': []},
        {'id': 'malformed', 'intent': 'edit_basket', 'hard_constraints': {}, 'actions': {'type': 'replace_item'}, 'retained_constraints': []},
    ]
    eval_file.write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in gold) + '\n', encoding='utf-8')
    pred_file.write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in preds) + '\n', encoding='utf-8')

    subprocess.run([
        sys.executable, str(SCRIPT),
        '--eval-gold', str(eval_file),
        '--predictions', str(pred_file),
        '--out-dir', str(out),
    ], cwd=ROOT, check=True)

    summary = json.loads((out / 'failure-summary.json').read_text(encoding='utf-8'))
    cases = [json.loads(x) for x in (out / 'failure-cases.jsonl').read_text(encoding='utf-8').splitlines() if x.strip()]
    assert summary['eval_examples'] == 4
    assert summary['failed_examples'] == 3
    assert summary['cluster_counts']['parse_error'] == 1
    assert summary['cluster_counts']['intent_mismatch'] == 1
    assert summary['cluster_counts']['malformed_actions'] == 1
    assert summary['auto_training_allowed'] is False
    assert all(row['review']['status'] == 'pending' for row in cases)
    assert all(row['training_allowed'] is False for row in cases)

print('Candidate failure clustering passed: parse/schema/semantic failures are review-only and never auto-approved for training.')
