#!/usr/bin/env python3
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def as_list(value):
    return value if isinstance(value, list) else []


def action_key(action):
    if not isinstance(action, dict):
        return ''
    kind = str(action.get('type') or '').strip().lower()
    payload = action.get('payload', action.get('value'))
    return f'{kind}:{stable(payload)}'


def hard_pass(expected, actual):
    if not isinstance(expected, dict) or not isinstance(actual, dict):
        return expected == actual
    return all(stable(value) == stable(actual.get(key)) for key, value in expected.items())


def classify(gold, actual):
    labels = []
    if actual is None:
        return ['missing_prediction']
    if actual.get('parse_error'):
        return ['parse_error']
    if actual.get('intent') != gold.get('target', {}).get('intent'):
        labels.append('intent_mismatch')
    if not hard_pass(gold.get('target', {}).get('hard_constraints', {}), actual.get('hard_constraints')):
        labels.append('hard_constraints_mismatch')

    raw_actions = actual.get('actions')
    if raw_actions is not None and not isinstance(raw_actions, list):
        labels.append('malformed_actions')
    expected_actions = {action_key(x) for x in as_list(gold.get('target', {}).get('actions'))}
    actual_actions = {action_key(x) for x in as_list(raw_actions)}
    expected_actions.discard('')
    actual_actions.discard('')
    if not expected_actions.issubset(actual_actions):
        labels.append('required_actions_missing')

    required_retained = as_list(gold.get('session_context', {}).get('constraints'))
    raw_retained = actual.get('retained_constraints')
    if raw_retained is not None and not isinstance(raw_retained, list):
        labels.append('malformed_retained_constraints')
    if required_retained:
        got = set(as_list(raw_retained))
        if not all(item in got for item in required_retained):
            labels.append('context_retention_mismatch')

    allowed = gold.get('target', {}).get('shopping_plan', {}).get('allowed_replacements', {}) or {}
    for action in as_list(raw_actions):
        if not isinstance(action, dict) or str(action.get('type') or '').lower() not in {'replace_item', 'replace_product'}:
            continue
        payload = action.get('payload', action.get('value', {})) or {}
        if str(action.get('type') or '').lower() == 'replace_item':
            source = str(payload.get('from_product_id') or '')
            target = str(payload.get('to_product_id') or '')
        else:
            source = str(payload.get('from') or '')
            target = str(payload.get('to') or '')
        if target not in as_list(allowed.get(source)):
            labels.append('invalid_substitution')
            break
    return sorted(set(labels))


def main():
    ap = argparse.ArgumentParser(description='Cluster held-out Bai candidate failures without auto-approving training data.')
    ap.add_argument('--eval-gold', required=True)
    ap.add_argument('--predictions', required=True)
    ap.add_argument('--out-dir', required=True)
    args = ap.parse_args()

    eval_file = Path(args.eval_gold).resolve()
    prediction_file = Path(args.predictions).resolve()
    out = Path(args.out_dir).resolve()
    if not eval_file.is_file():
        raise SystemExit(f'eval Gold missing: {eval_file}')
    if not prediction_file.is_file():
        raise SystemExit(f'predictions missing: {prediction_file}')

    gold_rows = read_jsonl(eval_file)
    prediction_rows = read_jsonl(prediction_file)
    predictions = {str(row.get('id') or ''): row for row in prediction_rows if str(row.get('id') or '')}
    cases = []
    counts = Counter()
    combinations = Counter()

    for gold in gold_rows:
        rid = str(gold.get('id') or '').strip()
        if not rid:
            raise SystemExit('eval row without id')
        actual = predictions.get(rid)
        labels = classify(gold, actual)
        if not labels:
            continue
        counts.update(labels)
        combinations[','.join(labels)] += 1
        cases.append({
            'id': rid,
            'user_request': gold.get('user_request'),
            'session_context': gold.get('session_context', {}),
            'expected': gold.get('target', {}),
            'observed': actual,
            'failure_labels': labels,
            'review': {'status': 'pending', 'requires_human_review': True},
            'training_allowed': False,
            'provenance': {
                'source': 'heldout_candidate_failure_analysis',
                'eval_gold_sha256': sha256_file(eval_file),
                'predictions_sha256': sha256_file(prediction_file),
            },
        })

    out.mkdir(parents=True, exist_ok=True)
    summary = {
        'schema_version': '1.0',
        'eval_examples': len(gold_rows),
        'prediction_rows': len(prediction_rows),
        'failed_examples': len(cases),
        'passed_examples': len(gold_rows) - len(cases),
        'cluster_counts': dict(sorted(counts.items())),
        'failure_combinations': dict(sorted(combinations.items())),
        'eval_gold_sha256': sha256_file(eval_file),
        'predictions_sha256': sha256_file(prediction_file),
        'review_required': True,
        'auto_training_allowed': False,
    }
    (out / 'failure-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'failure-cases.jsonl').write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in cases), encoding='utf-8')
    (out / 'review-candidates.jsonl').write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in cases), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
