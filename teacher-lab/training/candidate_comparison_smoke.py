#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BENCH = ROOT / 'teacher-lab/training/benchmark-cli.mjs'
COMPARE = ROOT / 'teacher-lab/training/compare_candidate_runs.py'


def write_jsonl(path, rows):
    path.write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in rows) + '\n', encoding='utf-8')


with tempfile.TemporaryDirectory() as tmp_raw:
    tmp = Path(tmp_raw)
    gold_file = tmp / 'eval.jsonl'
    baseline_pred = tmp / 'baseline.jsonl'
    candidate_pred = tmp / 'candidate.jsonl'
    baseline_metrics = tmp / 'baseline-metrics.json'
    candidate_metrics = tmp / 'candidate-metrics.json'
    out = tmp / 'comparison'

    gold = [
        {
            'id': 'seed_build_001', 'user_request': 'до 5000', 'session_context': {},
            'target': {'intent': 'build_basket', 'hard_constraints': {'budget_max': 5000},
                       'actions': [{'type': 'set_constraint', 'payload': {'key': 'budget', 'value': 5000}}],
                       'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'seed_edit_001', 'user_request': 'без Мираторга',
            'session_context': {'constraints': ['exclude_brand:Мираторг']},
            'target': {'intent': 'edit_basket', 'hard_constraints': {'excluded_brands': ['Мираторг']},
                       'actions': [{'type': 'set_constraint', 'payload': {'key': 'excluded_brand', 'value': 'Мираторг'}}],
                       'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'seed_journey_01_t2', 'user_request': 'добавь фруктов',
            'session_context': {'constraints': ['budget<=5000']},
            'target': {'intent': 'edit_basket', 'hard_constraints': {'required_categories': ['fruit']},
                       'actions': [{'type': 'set_constraint', 'payload': {'key': 'required_category', 'value': 'fruit'}}],
                       'shopping_plan': {'allowed_replacements': {}}},
        },
        {
            'id': 'seed_build_002', 'user_request': 'собери корзину', 'session_context': {},
            'target': {'intent': 'build_basket', 'hard_constraints': {},
                       'actions': [{'type': 'rebuild_basket', 'payload': {'reset': False}}],
                       'shopping_plan': {'allowed_replacements': {}}},
        },
    ]
    baseline = [
        {'id': 'seed_build_001', 'intent': 'build_basket', 'hard_constraints': {'budget_max': 5000},
         'actions': [{'type': 'set_constraint', 'payload': {'key': 'budget', 'value': 5000}}], 'retained_constraints': []},
        {'id': 'seed_edit_001', 'parse_error': 'student_no_json'},
        {'id': 'seed_journey_01_t2', 'intent': 'edit_basket', 'hard_constraints': {'required_categories': ['fruit']},
         'actions': [], 'retained_constraints': []},
        {'id': 'seed_build_002', 'intent': 'edit_basket', 'hard_constraints': {},
         'actions': [{'type': 'rebuild_basket', 'payload': {'reset': False}}], 'retained_constraints': []},
    ]
    candidate = [
        {'id': 'seed_build_001', 'intent': 'build_basket', 'hard_constraints': {'budget_max': 5000},
         'actions': [{'type': 'set_constraint', 'payload': {'key': 'budget', 'value': 5000}}], 'retained_constraints': []},
        {'id': 'seed_edit_001', 'intent': 'edit_basket', 'hard_constraints': {'excluded_brands': ['Мираторг']},
         'actions': [{'type': 'set_constraint', 'payload': {'key': 'excluded_brand', 'value': 'Мираторг'}}],
         'retained_constraints': ['exclude_brand:Мираторг']},
        {'id': 'seed_journey_01_t2', 'intent': 'edit_basket', 'hard_constraints': {'required_categories': ['fruit']},
         'actions': [{'type': 'set_constraint', 'payload': {'key': 'required_category', 'value': 'fruit'}}],
         'retained_constraints': ['budget<=5000']},
        {'id': 'seed_build_002', 'intent': 'build_basket', 'hard_constraints': {},
         'actions': [{'type': 'rebuild_basket', 'payload': {'reset': False}}], 'retained_constraints': []},
    ]
    write_jsonl(gold_file, gold)
    write_jsonl(baseline_pred, baseline)
    write_jsonl(candidate_pred, candidate)

    subprocess.run(['node', str(BENCH), str(gold_file), str(baseline_pred), str(baseline_metrics)], cwd=ROOT, check=True)
    subprocess.run(['node', str(BENCH), str(gold_file), str(candidate_pred), str(candidate_metrics)], cwd=ROOT, check=True)
    subprocess.run([
        sys.executable, str(COMPARE), '--eval-gold', str(gold_file),
        '--run', 'baseline', str(baseline_pred), str(baseline_metrics),
        '--run', 'candidate-v2', str(candidate_pred), str(candidate_metrics),
        '--out-dir', str(out),
    ], cwd=ROOT, check=True)

    report = json.loads((out / 'candidate-comparison.json').read_text(encoding='utf-8'))
    assert report['comparison_contract'] == 'same_frozen_holdout_exact_id_coverage'
    assert report['eval_examples'] == 4
    assert report['baseline_label'] == 'baseline'
    assert len(report['runs']) == 2
    base, cand = report['runs']
    assert base['parsed_examples'] == 3
    assert base['failed_examples'] == 3
    assert base['failure_counts']['parse_error'] == 1
    assert cand['parsed_examples'] == 4
    assert cand['failed_examples'] == 0
    assert cand['metrics']['intent_accuracy'] == 1
    assert cand['metrics']['constraint_pass_rate'] == 1
    assert cand['metrics']['action_success_rate'] == 1
    assert cand['metrics']['context_retention_rate'] == 1
    assert cand['improvement_vs_baseline']['intent_accuracy'] > 0
    assert cand['improvement_vs_baseline']['parse_rate'] > 0
    assert (out / 'candidate-comparison.md').is_file()

    incomplete = tmp / 'incomplete.jsonl'
    write_jsonl(incomplete, candidate[:-1])
    bad = subprocess.run([
        sys.executable, str(COMPARE), '--eval-gold', str(gold_file),
        '--run', 'incomplete', str(incomplete), str(candidate_metrics), '--out-dir', str(tmp / 'bad')
    ], cwd=ROOT, text=True, capture_output=True)
    assert bad.returncode != 0
    assert 'holdout coverage mismatch' in (bad.stdout + bad.stderr)

print('Candidate comparison passed: exact holdout coverage is required and multi-run diagnostics are comparable.')
