#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVAL = ROOT / 'teacher-lab/training/evaluate_student.py'
BENCH = ROOT / 'teacher-lab/training/benchmark-cli.mjs'
PROMOTE = ROOT / 'teacher-lab/training/promotion-cli.mjs'
PREFLIGHT = ROOT / 'teacher-lab/training/kaggle_gpu_preflight.py'
CONFIG = ROOT / 'teacher-lab/training/student-v0.1.json'


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def sha256_file(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sha256_tree(root):
    root = Path(root)
    h = hashlib.sha256()
    for file in sorted(p for p in root.rglob('*') if p.is_file()):
        rel = file.relative_to(root).as_posix().encode()
        h.update(len(rel).to_bytes(8, 'big'))
        h.update(rel)
        with file.open('rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
    return h.hexdigest()


def validate_eval(rows, min_eval):
    if len(rows) < min_eval:
        raise SystemExit(f'Need at least {min_eval} held-out eval examples, got {len(rows)}')
    ids = []
    for row in rows:
        rid = str(row.get('id') or '').strip()
        if not rid:
            raise SystemExit('eval row without id')
        ids.append(rid)
        if row.get('review', {}).get('status') != 'approved':
            raise SystemExit(f'eval row {rid} is not approved')
        if not isinstance(row.get('target'), dict):
            raise SystemExit(f'eval row {rid} has no target')
        if row.get('privacy', {}).get('sanitized') is not True:
            raise SystemExit(f'eval row {rid} is not privacy-sanitized')
    if len(ids) != len(set(ids)):
        raise SystemExit('eval contains duplicate ids')


def call(cmd, check=True, env=None):
    print('+', ' '.join(map(str, cmd)), flush=True)
    return subprocess.run([str(x) for x in cmd], cwd=ROOT, check=check, env=env)


def main():
    ap = argparse.ArgumentParser(description='Re-evaluate an already-trained Bai adapter without retraining it.')
    ap.add_argument('--eval-gold', required=True)
    ap.add_argument('--candidate-adapter', required=True)
    ap.add_argument('--out', default='/kaggle/working/bai_candidate_reeval')
    ap.add_argument('--config', default=str(CONFIG))
    ap.add_argument('--baseline-adapter')
    ap.add_argument('--min-eval', type=int, default=50)
    ap.add_argument('--max-new-tokens', type=int, default=700)
    ap.add_argument('--skip-preflight', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    eval_file = Path(args.eval_gold).resolve()
    adapter = Path(args.candidate_adapter).resolve()
    out = Path(args.out).resolve()
    metrics = out / 'metrics'
    config_file = Path(args.config).resolve()

    if not eval_file.is_file():
        raise SystemExit(f'eval Gold missing: {eval_file}')
    if not adapter.is_dir():
        raise SystemExit(f'candidate adapter missing: {adapter}')
    if not config_file.is_file():
        raise SystemExit(f'config missing: {config_file}')

    validate_eval(read_jsonl(eval_file), args.min_eval)
    out.mkdir(parents=True, exist_ok=True)
    metrics.mkdir(parents=True, exist_ok=True)

    state = {
        'schema_version': '1.0',
        'mode': 'existing_candidate_reevaluation',
        'status': 'VALIDATED',
        'candidate_adapter': str(adapter),
        'candidate_adapter_sha256': sha256_tree(adapter),
        'eval_gold': str(eval_file),
        'eval_gold_sha256': sha256_file(eval_file),
        'config': str(config_file),
        'config_sha256': sha256_file(config_file),
        'baseline_adapter': str(Path(args.baseline_adapter).resolve()) if args.baseline_adapter else None,
        'promotion': None,
        'preflight': None,
        'release_created': False,
    }
    manifest = out / 'reeval-manifest.json'
    manifest.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if args.dry_run:
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return

    if not args.skip_preflight:
        preflight = out / 'gpu-preflight.json'
        call([sys.executable, PREFLIGHT, '--config', config_file, '--out', preflight])
        state['preflight'] = json.loads(preflight.read_text(encoding='utf-8'))
        manifest.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    model_env = {**os.environ, 'CUDA_VISIBLE_DEVICES': '0'}
    baseline_pred = out / 'baseline-predictions.jsonl'
    candidate_pred = out / 'candidate-predictions.jsonl'

    baseline_cmd = [
        sys.executable, EVAL,
        '--eval', eval_file,
        '--out', baseline_pred,
        '--config', config_file,
        '--max-new-tokens', str(args.max_new_tokens),
    ]
    if args.baseline_adapter:
        baseline_cmd += ['--adapter', Path(args.baseline_adapter).resolve()]
    call(baseline_cmd, env=model_env)

    call([
        sys.executable, EVAL,
        '--eval', eval_file,
        '--out', candidate_pred,
        '--config', config_file,
        '--adapter', adapter,
        '--max-new-tokens', str(args.max_new_tokens),
    ], env=model_env)

    baseline_metrics = metrics / 'baseline.json'
    candidate_metrics = metrics / 'candidate.json'
    promotion = metrics / 'promotion.json'
    call(['node', BENCH, eval_file, baseline_pred, baseline_metrics])
    call(['node', BENCH, eval_file, candidate_pred, candidate_metrics])
    verdict = call(['node', PROMOTE, baseline_metrics, candidate_metrics, promotion], check=False)

    report = json.loads(promotion.read_text(encoding='utf-8'))
    state['promotion'] = report
    state['status'] = 'REEVAL_PASS' if report.get('pass') else 'REEVAL_REJECTED'
    state['baseline_predictions'] = str(baseline_pred)
    state['candidate_predictions'] = str(candidate_pred)
    state['baseline_metrics'] = str(baseline_metrics)
    state['candidate_metrics'] = str(candidate_metrics)
    state['promotion_file'] = str(promotion)
    manifest.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(state, ensure_ascii=False, indent=2))

    if verdict.returncode != 0:
        raise SystemExit('Existing candidate rejected by unchanged promotion gate under current eval contract')


if __name__ == '__main__':
    main()
