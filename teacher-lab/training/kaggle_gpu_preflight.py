#!/usr/bin/env python3
import argparse,json,os,re,shutil,subprocess,sys
from importlib.metadata import PackageNotFoundError,version
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'
SHA40=re.compile(r'^[a-f0-9]{40}$',re.I)


def pkg(name):
    try:return version(name)
    except PackageNotFoundError:return None


def git_sha():
    try:return subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    except Exception:return None


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--config',default=str(DEFAULT_CONFIG)); ap.add_argument('--out',default='/kaggle/working/bai_gpu_preflight.json'); ap.add_argument('--skip-hub-check',action='store_true'); args=ap.parse_args()
    cfg=json.loads(Path(args.config).read_text(encoding='utf-8'))
    base=str(cfg.get('base_model') or ''); revision=str(cfg.get('base_revision') or '')
    if not base: raise SystemExit('base_model_missing')
    if not SHA40.fullmatch(revision): raise SystemExit('base_revision_must_be_40_hex_commit')
    if cfg.get('chat_template',{}).get('enable_thinking') is not False: raise SystemExit('qwen3_thinking_must_be_disabled_for_json_contract')
    if not shutil.which('node'): raise SystemExit('node_missing')

    import torch
    if not torch.cuda.is_available() or torch.cuda.device_count()<1: raise SystemExit('cuda_gpu_required')
    gpus=[]
    for i in range(torch.cuda.device_count()):
        p=torch.cuda.get_device_properties(i); total=round(p.total_memory/(1024**3),2)
        gpus.append({'index':i,'name':p.name,'total_memory_gib':total,'capability':f'{p.major}.{p.minor}'})
    if max(x['total_memory_gib'] for x in gpus)<14: raise SystemExit(f'gpu_memory_too_small:{gpus}')

    work=Path('/kaggle/working') if Path('/kaggle/working').exists() else ROOT
    usage=shutil.disk_usage(work); free_gib=round(usage.free/(1024**3),2)
    if free_gib<8: raise SystemExit(f'not_enough_disk:{free_gib}GiB')

    hub_check='skipped'
    if not args.skip_hub_check:
        from transformers import AutoConfig
        remote=AutoConfig.from_pretrained(base,revision=revision,trust_remote_code=True)
        hub_check=getattr(remote,'model_type',None) or 'ok'

    result={
      'schema_version':'1.0','ok':True,'repo_commit':git_sha(),'python':sys.version.split()[0],
      'torch':torch.__version__,'cuda':torch.version.cuda,'gpus':gpus,'free_disk_gib':free_gib,
      'base_model':base,'base_revision':revision,'enable_thinking':False,'hub_check':hub_check,
      'packages':{name:pkg(name) for name in ['transformers','peft','datasets','accelerate','bitsandbytes','sentencepiece','huggingface-hub']},
      'kaggle_kernel_run_type':os.environ.get('KAGGLE_KERNEL_RUN_TYPE'),
    }
    out=Path(args.out); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
