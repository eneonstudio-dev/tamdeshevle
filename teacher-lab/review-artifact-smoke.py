#!/usr/bin/env python3
import json,subprocess,sys,tempfile,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'teacher-lab/review-artifact.py'
FP='a'*64
PROMPT='b'*64
OUTPUT='c'*64


def profile(name): return json.loads((ROOT/'teacher-lab/profiles'/name).read_text(encoding='utf-8'))

def row(p,source):
    return {'id':f'task.1.{p["id"]}','schema_version':'1.0','language':'ru','user_request':'собери еды на неделю','session_context':{},'target':{'intent':'build_basket','hard_constraints':{'budget_max':5000},'soft_preferences':{},'shopping_plan':{},'actions':[],'critic':{'pass':True,'issues':[]},'confidence':{'overall':'high','price':'unknown','availability':'unknown','quality':'unknown'}},'provenance':{'sources':[{'source_id':source,'model':p['model'],'revision':p['revision'],'profile_id':p['id'],'corpus_task_id':'task.1','prompt_version':'test-v1','prompt_sha256':PROMPT,'output_sha256':OUTPUT,'runtime_fingerprint':FP,'generation':{'temperature':0.2}}]},'review':{'status':'candidate'},'privacy':{'sanitized':True,'contains_personal_data':False}}


def run(*args,check=True):
    return subprocess.run([sys.executable,str(SCRIPT),*map(str,args)],cwd=ROOT,check=check,capture_output=True,text=True)


def make_archive(src,archive):
    with zipfile.ZipFile(archive,'w') as z:
        for p in src.iterdir(): z.write(p,p.name)


def main():
    with tempfile.TemporaryDirectory() as td:
        base=Path(td); src=base/'src'; src.mkdir()
        leftp=profile('deepseek-r1-distill-qwen-7b.json'); rightp=profile('qwen3-8b.json')
        left=row(leftp,'deepseek_r1_local_mit'); right=row(rightp,'qwen3_open_weights_apache2')
        (src/'left-candidates.jsonl').write_text(json.dumps(left,ensure_ascii=False)+'\n',encoding='utf-8')
        (src/'right-candidates.jsonl').write_text(json.dumps(right,ensure_ascii=False)+'\n',encoding='utf-8')
        (src/'review-queue.json').write_text(json.dumps([{'task_id':'task.1','status':'agree','conflicts':[],'flags':[]}]),encoding='utf-8')
        (src/'summary.json').write_text(json.dumps({'compared':1,'agreements':1,'auto_approved':0}),encoding='utf-8')
        (src/'run-manifest.jsonl').write_text(json.dumps({'runtime_fingerprint':FP,'schema_version':'1.0'})+'\n',encoding='utf-8')
        (src/'corpus-manifest.json').write_text(json.dumps({'teachers':[{'id':leftp['id'],'model':leftp['model'],'revision':leftp['revision']},{'id':rightp['id'],'model':rightp['model'],'revision':rightp['revision']}]}),encoding='utf-8')
        archive=base/'batch.zip'; make_archive(src,archive)
        work=base/'work'; run('prepare','--artifact',archive,'--work',work)
        assert (work/'review.html').is_file() and (work/'manifest.json').is_file()
        decisions=base/'decisions.json'; decisions.write_text(json.dumps([{'task_id':'task.1','decision':'approve_left','reviewer':'human'}]),encoding='utf-8')
        out=base/'out'; run('finalize','--review-dir',work/'artifact','--decisions',decisions,'--out',out)
        assert len((out/'gold.jsonl').read_text(encoding='utf-8').splitlines())==1
        assert len((out/'sft.jsonl').read_text(encoding='utf-8').splitlines())==1
        tampered=base/'tampered'; shutil_src=base/'tampered-src'; shutil_src.mkdir()
        for p in src.iterdir(): (shutil_src/p.name).write_bytes(p.read_bytes())
        bad_left=json.loads((shutil_src/'left-candidates.jsonl').read_text(encoding='utf-8')); bad_left['provenance']['sources'][0]['runtime_fingerprint']='d'*64
        (shutil_src/'left-candidates.jsonl').write_text(json.dumps(bad_left)+'\n',encoding='utf-8'); make_archive(shutil_src,tampered)
        assert run('prepare','--artifact',tampered,'--work',base/'tampered-work',check=False).returncode!=0
        bad=base/'bad.zip'
        with zipfile.ZipFile(bad,'w') as z: z.writestr('../escape.txt','nope')
        failed=run('prepare','--artifact',bad,'--work',base/'badwork',check=False)
        assert failed.returncode!=0 and not (base/'escape.txt').exists()
    print('Review artifact workflow passed.')

if __name__=='__main__': main()
