#!/usr/bin/env python3
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from analyze_candidate_failures import classify
from diagnose_candidate_failures import category

METRICS = [
    'intent_accuracy',
    'constraint_pass_rate',
    'action_success_rate',
    'context_retention_rate',
    'invalid_substitution_rate',
    'repair_success_rate',
]
LOWER_IS_BETTER = {'invalid_substitution_rate'}


def read_jsonl(path):
    rows = [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]
    if not all(isinstance(x, dict) for x in rows):
        raise SystemExit(f'{path}: JSONL rows must be objects')
    return rows


def read_json(path):
    value = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise SystemExit(f'{path}: JSON must be object')
    return value


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def unique_index(rows, label):
    out = {}
    for row in rows:
        rid = str(row.get('id') or '').strip()
        if not rid:
            raise SystemExit(f'{label}: row without id')
        if rid in out:
            raise SystemExit(f'{label}: duplicate id {rid}')
        out[rid] = row
    return out


def rate(a, b):
    return round(a / b, 4) if b else None


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def fmt(value):
    return '-' if value is None else f'{value:.4f}' if isinstance(value, float) else str(value)


def main():
    ap = argparse.ArgumentParser(description='Compare multiple Bai evaluation runs on exactly the same frozen holdout.')
    ap.add_argument('--eval-gold', required=True)
    ap.add_argument('--run', action='append', nargs=3, metavar=('LABEL', 'PREDICTIONS', 'METRICS'), required=True,
                    help='repeat for baseline/candidates; first run is comparison baseline')
    ap.add_argument('--out-dir', required=True)
    args = ap.parse_args()

    eval_file = Path(args.eval_gold).resolve()
    if not eval_file.is_file():
        raise SystemExit(f'eval Gold missing: {eval_file}')
    gold_rows = read_jsonl(eval_file)
    gold = unique_index(gold_rows, 'eval')
    eval_ids = set(gold)
    if not eval_ids:
        raise SystemExit('eval Gold is empty')

    seen_labels = set()
    runs = []
    for label, pred_raw, metrics_raw in args.run:
        label = str(label).strip()
        if not label or label in seen_labels:
            raise SystemExit(f'invalid/duplicate run label: {label!r}')
        seen_labels.add(label)
        pred_file = Path(pred_raw).resolve()
        metrics_file = Path(metrics_raw).resolve()
        if not pred_file.is_file():
            raise SystemExit(f'{label}: predictions missing: {pred_file}')
        if not metrics_file.is_file():
            raise SystemExit(f'{label}: metrics missing: {metrics_file}')
        predictions = unique_index(read_jsonl(pred_file), f'{label} predictions')
        pred_ids = set(predictions)
        missing = sorted(eval_ids - pred_ids)
        extra = sorted(pred_ids - eval_ids)
        if missing or extra:
            raise SystemExit(f'{label}: holdout coverage mismatch missing={missing[:5]} extra={extra[:5]}')

        metrics = read_json(metrics_file)
        if metrics.get('examples') != len(eval_ids):
            raise SystemExit(f"{label}: metrics.examples={metrics.get('examples')} expected={len(eval_ids)}")

        failures = Counter()
        failures_by_category = Counter()
        passed_by_category = Counter()
        total_by_category = Counter()
        parsed = 0
        failed = 0
        for rid, expected in gold.items():
            actual = predictions[rid]
            cat = category(expected)
            total_by_category[cat] += 1
            labels = classify(expected, actual)
            if actual.get('parse_error') is None:
                parsed += 1
            if labels:
                failed += 1
                failures.update(labels)
                for item in labels:
                    failures_by_category[(cat, item)] += 1
            else:
                passed_by_category[cat] += 1

        category_pass = {cat: rate(passed_by_category[cat], total) for cat, total in sorted(total_by_category.items())}
        nested = {}
        for (cat, failure), count in sorted(failures_by_category.items()):
            nested.setdefault(cat, {})[failure] = count

        metric_values = {}
        for key in METRICS:
            value = metrics.get(key)
            if value is not None and not number(value):
                raise SystemExit(f'{label}: non-numeric metric {key}={value!r}')
            metric_values[key] = value

        runs.append({
            'label': label,
            'predictions_sha256': sha256_file(pred_file),
            'metrics_sha256': sha256_file(metrics_file),
            'parsed_examples': parsed,
            'parse_rate': rate(parsed, len(eval_ids)),
            'failed_examples': failed,
            'pass_rate': rate(len(eval_ids) - failed, len(eval_ids)),
            'metrics': metric_values,
            'failure_counts': dict(sorted(failures.items())),
            'category_pass_rate': category_pass,
            'failure_by_category': nested,
        })

    baseline = runs[0]
    for run in runs:
        improvement = {'parse_rate': None}
        if run['parse_rate'] is not None and baseline['parse_rate'] is not None:
            improvement['parse_rate'] = round(run['parse_rate'] - baseline['parse_rate'], 4)
        for key in METRICS:
            current = run['metrics'].get(key)
            base = baseline['metrics'].get(key)
            if current is None or base is None:
                improvement[key] = None
            elif key in LOWER_IS_BETTER:
                improvement[key] = round(base - current, 4)
            else:
                improvement[key] = round(current - base, 4)
        run['improvement_vs_baseline'] = improvement

    report = {
        'schema_version': '1.0',
        'comparison_contract': 'same_frozen_holdout_exact_id_coverage',
        'eval_gold_sha256': sha256_file(eval_file),
        'eval_examples': len(eval_ids),
        'baseline_label': baseline['label'],
        'metric_direction': {key: ('lower_is_better' if key in LOWER_IS_BETTER else 'higher_is_better') for key in METRICS},
        'runs': runs,
    }

    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / 'candidate-comparison.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    headers = ['run', 'parse', 'intent', 'constraints', 'actions', 'context', 'invalid_sub', 'pass']
    lines = ['# Bai candidate comparison', '', f"Frozen holdout: {len(eval_ids)} examples — `{report['eval_gold_sha256']}`", '', '| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join(['---'] * len(headers)) + ' |']
    for run in runs:
        m = run['metrics']
        lines.append('| ' + ' | '.join([
            run['label'], fmt(run['parse_rate']), fmt(m['intent_accuracy']), fmt(m['constraint_pass_rate']),
            fmt(m['action_success_rate']), fmt(m['context_retention_rate']), fmt(m['invalid_substitution_rate']), fmt(run['pass_rate'])
        ]) + ' |')
    lines += ['', 'Positive improvement values are better than the first run; invalid substitution is direction-normalized so lower raw rate counts as improvement.', '']
    for run in runs:
        lines += [f"## {run['label']}", '', f"Failures: {run['failed_examples']} / {len(eval_ids)}", '', '```json', json.dumps(run['failure_counts'], ensure_ascii=False, indent=2), '```', '']
    (out / 'candidate-comparison.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps({'runs': len(runs), 'eval_examples': len(eval_ids), 'baseline': baseline['label'], 'out': str(out)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
