#!/usr/bin/env python3
import argparse,hashlib,json,re,shutil,subprocess,sys,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REQUIRED=('left-candidates.jsonl','right-candidates.jsonl','review-queue.json','summary.json','run-manifest.jsonl','corpus-manifest.json')
MAX_FILES=64
MAX_UNPACKED=64*1024*1024
HEX64=re.compile(r'^[0-9a-f]{64}$',re.I)


def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def read_jsonl(path):
    out=[]
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if line.strip(): out.append(json.loads(line))
    return out


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


def validate_provenance(review,candidates):
    manifests=read_jsonl(review/'run-manifest.jsonl')
    runtime_ids={str(x.get('runtime_fingerprint','')) for x in manifests if HEX64.match(str(x.get('runtime_fingerprint','')))}
    if not runtime_ids: raise SystemExit('run manifest has no valid runtime fingerprint')
    corpus=json.loads((review/'corpus-manifest.json').read_text(encoding='utf-8'))
    teachers={str(x.get('id')):x for x in corpus.get('teachers',[]) if isinstance(x,dict)}
    if not teachers: raise SystemExit('corpus manifest has no teacher profiles')
    for candidate in candidates:
        sources=candidate.get('provenance',{}).get('sources',[])
        if not sources: raise SystemExit('candidate is missing provenance source')
        source=sources[0]; profile_id=str(source.get('profile_id','')); teacher=teachers.get(profile_id)
        if not teacher: raise SystemExit(f'candidate profile missing from corpus manifest: {profile_id}')
        if source.get('model')!=teacher.get('model') or source.get('revision')!=teacher.get('revision'):
            raise SystemExit(f'candidate model provenance mismatch: {profile_id}')
        fp=str(source.get('runtime_fingerprint',''))
        if fp not in runtime_ids: raise SystemExit(f'unknown runtime fingerprint: {fp}')
        for key in ('prompt_sha256','output_sha256'):
            if not HEX64.match(str(source.get(key,''))): raise SystemExit(f'invalid candidate provenance hash: {key}')
    return {'runtime_records':len(manifests),'teacher_profiles':len(teachers)}


def validate_review_dir(review):
    review=Path(review)
    left_rows=read_jsonl(review/'left-candidates.jsonl'); right_rows=read_jsonl(review/'right-candidates.jsonl')
    queue=json.loads((review/'review-queue.json').read_text(encoding='utf-8'))
    summary=json.loads((review/'summary.json').read_text(encoding='utf-8'))
    if not isinstance(queue,list): raise SystemExit('review queue must be an array')
    if len(left_rows)!=len(right_rows) or len(queue)!=len(left_rows): raise SystemExit(f'review counts mismatch: left={len(left_rows)} right={len(right_rows)} queue={len(queue)}')
    if summary.get('auto_approved') not in (0,None): raise SystemExit('artifact must not contain auto-approved rows')
    provenance=validate_provenance(review,[*left_rows,*right_rows])
    return {'left':len(left_rows),'right':len(right_rows),'queue':len(queue),'summary':summary,**provenance}


def call(cmd): subprocess.check_call([str(x) for x in cmd],cwd=ROOT)


def prepare(args):
    work=Path(args.work).resolve(); shutil.rmtree(work,ignore_errors=True); work.mkdir(parents=True)
    source=Path(args.artifact).resolve()
    if not source.is_file(): raise SystemExit('artifact not found')
    extracted=safe_extract(source,work/'artifact') if zipfile.is_zipfile(source) else source
    review=find_review_dir(extracted); meta=validate_review_dir(review)
    console=work/'review.html'; call(['node',ROOT/'teacher-lab/review-console.mjs',review,console])
    manifest={'artifact':str(source),'artifact_sha256':sha256(source),'review_dir':str(review),'console':str(console),**meta}
    (work/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))


def finalize(args):
    review=find_review_dir(Path(args.review_dir).resolve()); validate_review_dir(review)
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
