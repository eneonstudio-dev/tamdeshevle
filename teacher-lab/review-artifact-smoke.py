#!/usr/bin/env python3
import json,subprocess,sys,tempfile,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'teacher-lab/review-artifact.py'


def row(profile,source):
    return {'id':f'task.1.{profile}','schema_version':'1.0','language':'ru','user_request':'собери еды на неделю','session_context':{},'target':{'intent':'build_basket','hard_constraints':{'budget_max':5000},'soft_preferences':{},'shopping_plan':{},'actions':[],'critic':{'pass':True,'issues':[]},'confidence':{'overall':'high','price':'unknown','availability':'unknown','quality':'unknown'}},'provenance':{'sources':[{'source_id':source,'profile_id':profile,'corpus_task_id':'task.1'}]},'review':{'status':'candidate'},'privacy':{'sanitized':True,'contains_personal_data':False}}


def run(*args,check=True):
    return subprocess.run([sys.executable,str(SCRIPT),*map(str,args)],cwd=ROOT,check=check,capture_output=True,text=True)


def main():
    with tempfile.TemporaryDirectory() as td:
        base=Path(td); src=base/'src'; src.mkdir()
        left=row('deepseek_r1_distill_qwen_7b','deepseek_r1_local_mit')
        right=row('qwen3_8b','qwen3_open_weights_apache2')
        (src/'left-candidates.jsonl').write_text(json.dumps(left,ensure_ascii=False)+'\n',encoding='utf-8')
        (src/'right-candidates.jsonl').write_text(json.dumps(right,ensure_ascii=False)+'\n',encoding='utf-8')
        (src/'review-queue.json').write_text(json.dumps([{'task_id':'task.1','status':'agree','conflicts':[],'flags':[]}]),encoding='utf-8')
        (src/'summary.json').write_text(json.dumps({'compared':1,'agreements':1,'auto_approved':0}),encoding='utf-8')
        archive=base/'batch.zip'
        with zipfile.ZipFile(archive,'w') as z:
            for p in src.iterdir(): z.write(p,p.name)
        work=base/'work'; run('prepare','--artifact',archive,'--work',work)
        assert (work/'review.html').is_file() and (work/'manifest.json').is_file()
        decisions=base/'decisions.json'
        decisions.write_text(json.dumps([{'task_id':'task.1','decision':'approve_left','reviewer':'human'}]),encoding='utf-8')
        out=base/'out'; run('finalize','--review-dir',work/'artifact','--decisions',decisions,'--out',out)
        assert len((out/'gold.jsonl').read_text(encoding='utf-8').splitlines())==1
        assert len((out/'sft.jsonl').read_text(encoding='utf-8').splitlines())==1
        bad=base/'bad.zip'
        with zipfile.ZipFile(bad,'w') as z: z.writestr('../escape.txt','nope')
        failed=run('prepare','--artifact',bad,'--work',base/'badwork',check=False)
        assert failed.returncode!=0 and not (base/'escape.txt').exists()
    print('Review artifact workflow passed.')

if __name__=='__main__': main()
