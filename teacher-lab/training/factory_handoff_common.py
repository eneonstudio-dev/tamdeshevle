#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
from reevaluate_candidate import sha256_file

KIND='bai_data_factory_v2_teacher_review_handoff'
REQUIRED_REVIEW=(
 'left-candidates.jsonl','right-candidates.jsonl','review-queue.json','summary.json',
 'run-manifest.jsonl','corpus-manifest.json','triage/review-triage-summary.json','triage/review-priority.jsonl')

def read_json(path):
    value=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value,dict): raise SystemExit(f'JSON object required: {path}')
    return value

def read_jsonl(path):
    rows=[json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]
    if not all(isinstance(x,dict) for x in rows): raise SystemExit(f'JSONL objects required: {path}')
    return rows

def compact_hash(rows):
    body=''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in rows)
    return hashlib.sha256(body.encode('utf-8')).hexdigest()

def candidate_task_id(row):
    sources=(row.get('provenance') or {}).get('sources') or []
    return str(sources[0].get('corpus_task_id','')) if sources and isinstance(sources[0],dict) else ''

def file_inventory(root,exclude=()):
    root=Path(root); excluded=set(exclude)
    return [{'path':p.relative_to(root).as_posix(),'sha256':sha256_file(p),'bytes':p.stat().st_size}
            for p in sorted(root.rglob('*')) if p.is_file() and p.relative_to(root).as_posix() not in excluded]

def validate_inventory(root,manifest):
    root=Path(root); expected={str(x.get('path')):x for x in manifest.get('files',[]) if isinstance(x,dict)}
    if not expected or len(expected)!=len(manifest.get('files',[])): raise SystemExit('invalid evidence inventory')
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name!='evidence-manifest.json'}
    if actual!=set(expected): raise SystemExit('evidence inventory coverage mismatch')
    for rel,meta in expected.items():
        p=root/rel
        if p.stat().st_size!=int(meta.get('bytes',-1)) or sha256_file(p)!=meta.get('sha256'): raise SystemExit(f'evidence file hash mismatch: {rel}')
