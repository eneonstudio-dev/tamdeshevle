#!/usr/bin/env python3
import argparse,hashlib,json,shutil,subprocess,sys,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REQUIRED=('left-candidates.jsonl','right-candidates.jsonl','review-queue.json','summary.json')
MAX_FILES=64
MAX_UNPACKED=64*1024*1024


def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def safe_extract(archive,dest):
    dest=Path(dest).resolve(); dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        infos=z.infolist()
        if len(infos)>MAX_FILES: raise SystemExit('artifact has too many files')
        total=sum(i.file_size for i in infos)
        if total>MAX_UNPACKED: raise SystemExit('artifact is too large')
        for info in infos:
            name=Path(info.filename)
            if name.is_absolute() or '..' in name.parts: raise SystemExit('unsafe zip path')
            target=(dest/name).resolve()
            if dest not in target.parents and target!=dest: raise SystemExit('unsafe zip target')
        z.extractall(dest)
    return dest


def find_review_dir(root):
    root=Path(root)
    for base in [root,*[p for p in root.rglob('*') if p.is_dir()]]:
        if all((base/name).is_file() for name in REQUIRED): return base
    raise SystemExit('review artifact is missing required files')


def validate_review_dir(review):
    review=Path(review)
    left=sum(1 for x in (review/'left-candidates.jsonl').read_text(encoding='utf-8').splitlines() if x.strip())
    right=sum(1 for x in (review/'right-candidates.jsonl').read_text(encoding='utf-8').splitlines() if x.strip())
    queue=json.loads((review/'review-queue.json').read_text(encoding='utf-8'))
    summary=json.loads((review/'summary.json').read_text(encoding='utf-8'))
    if not isinstance(queue,list): raise SystemExit('review queue must be an array')
    if left!=right or len(queue)!=left: raise SystemExit(f'review counts mismatch: left={left} right={right} queue={len(queue)}')
    if summary.get('auto_approved') not in (0,None): raise SystemExit('artifact must not contain auto-approved rows')
    return {'left':left,'right':right,'queue':len(queue),'summary':summary}


def call(cmd):
    subprocess.check_call([str(x) for x in cmd],cwd=ROOT)


def prepare(args):
    work=Path(args.work).resolve(); shutil.rmtree(work,ignore_errors=True); work.mkdir(parents=True)
    source=Path(args.artifact).resolve()
    if not source.is_file(): raise SystemExit('artifact not found')
    extracted=safe_extract(source,work/'artifact') if zipfile.is_zipfile(source) else source
    review=find_review_dir(extracted); meta=validate_review_dir(review)
    console=work/'review.html'
    call(['node',ROOT/'teacher-lab/review-console.mjs',review,console])
    manifest={'artifact':str(source),'artifact_sha256':sha256(source),'review_dir':str(review),'console':str(console),**meta}
    (work/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))


def finalize(args):
    review=find_review_dir(Path(args.review_dir).resolve())
    validate_review_dir(review)
    decisions=Path(args.decisions).resolve()
    if not decisions.is_file(): raise SystemExit('decisions file not found')
    out=Path(args.out).resolve(); out.mkdir(parents=True,exist_ok=True)
    call(['node',ROOT/'teacher-lab/training/review-export.mjs',review,decisions,out])
    summary=json.loads((out/'summary.json').read_text(encoding='utf-8'))
    result={'review_dir':str(review),'decisions_sha256':sha256(decisions),'out':str(out),**summary}
    (out/'artifact-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))


def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd',required=True)
    p=sub.add_parser('prepare'); p.add_argument('--artifact',required=True); p.add_argument('--work',required=True); p.set_defaults(fn=prepare)
    f=sub.add_parser('finalize'); f.add_argument('--review-dir',required=True); f.add_argument('--decisions',required=True); f.add_argument('--out',required=True); f.set_defaults(fn=finalize)
    args=ap.parse_args(); args.fn(args)

if __name__=='__main__': main()
