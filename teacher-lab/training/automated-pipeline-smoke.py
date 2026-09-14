#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PIPE=ROOT/'teacher-lab/training/kaggle_train_pipeline.py'


def row(i,prefix):
    return {
      'id':f'{prefix}_{i:04d}','schema_version':'1.0','language':'ru','user_request':f'Собери еду до 5000, вариант {prefix}-{i}',
      'session_context':{'budget':None,'constraints':[],'basket':[]},
      'target':{'intent':'build_basket','hard_constraints':{'budget_max':5000},'soft_preferences':{'price':'balanced'},'shopping_plan':{'categories':['protein','base','fruit']},'actions':[{'type':'CHANGE_BUDGET','value':5000}],'critic':{'pass':True,'issues':[]},'confidence':{'overall':'high','price':'unknown','availability':'unknown','quality':'unknown'}},
      'provenance':{'sources':[{'source_id':'human_votonobay_reviewed'}]},'review':{'status':'approved'},'privacy':{'sanitized':True,'contains_personal_data':False}
    }


def write(path,rows):
    path.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')

with tempfile.TemporaryDirectory() as tmp:
    base=Path(tmp); train=base/'train.jsonl'; ev=base/'eval.jsonl'; out=base/'out'
    train_rows=[row(i,'train') for i in range(500)]; eval_rows=[row(i,'eval') for i in range(50)]
    write(train,train_rows); write(ev,eval_rows)
    ok=subprocess.run([sys.executable,str(PIPE),'--gold',str(train),'--eval-gold',str(ev),'--out',str(out),'--dry-run'],cwd=ROOT,capture_output=True,text=True)
    assert ok.returncode==0,ok.stderr+ok.stdout
    manifest=json.loads((out/'pipeline-manifest.json').read_text(encoding='utf-8'))
    assert manifest['status']=='VALIDATED'; assert manifest['dataset']['ready_for_training'] is True
    assert manifest['split']['overlap']==0 and manifest['split']['fingerprint_overlap']==0

    leaked=base/'leaked.jsonl'; write(leaked,[row(0,'train')]+[row(i,'eval2') for i in range(49)])
    bad=subprocess.run([sys.executable,str(PIPE),'--gold',str(train),'--eval-gold',str(leaked),'--out',str(base/'bad'),'--dry-run'],cwd=ROOT,capture_output=True,text=True)
    assert bad.returncode!=0; assert 'train/eval leakage' in bad.stderr+bad.stdout

    semantic_rows=[row(i,'eval3') for i in range(50)]
    semantic_rows[0]['user_request']=train_rows[0]['user_request']; semantic_rows[0]['session_context']=train_rows[0]['session_context']
    semantic=base/'semantic.jsonl'; write(semantic,semantic_rows)
    sem_bad=subprocess.run([sys.executable,str(PIPE),'--gold',str(train),'--eval-gold',str(semantic),'--out',str(base/'semantic-bad'),'--dry-run'],cwd=ROOT,capture_output=True,text=True)
    assert sem_bad.returncode!=0; assert 'train/eval semantic leakage' in sem_bad.stderr+sem_bad.stdout

print('Automated Bai training pipeline passed: threshold, ID isolation, semantic holdout isolation and dry-run orchestration.')
