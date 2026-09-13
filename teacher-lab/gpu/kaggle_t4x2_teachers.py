#!/usr/bin/env python3
import argparse,json,os,re,subprocess,threading,time
from pathlib import Path

SYSTEM=("Ты teacher для shopping-мозга Votonobay. Верни только один JSON-объект без markdown и без рассуждений. "
"Поля: intent, hard_constraints, soft_preferences, shopping_plan, actions, critic, confidence. "
"Не выдумывай цены, наличие, магазин, состав или качество. Hard constraints не ослабляй. "
"confidence должен содержать overall, price, availability, quality; если фактов нет, price/availability/quality=unknown.")
MODELS={
 "deepseek":{"repo":"deepseek-ai/DeepSeek-R1-Distill-Qwen-7B","gpu":0,"temperature":0.6,"thinking":None},
 "qwen":{"repo":"Qwen/Qwen3-8B","gpu":1,"temperature":0.2,"thinking":False},
}

def extract_json(text):
    text=re.sub(r"<think>.*?</think>","",text,flags=re.S|re.I).strip()
    starts=[i for i,c in enumerate(text) if c=='{']
    for a in starts:
        depth=0; quoted=False; esc=False
        for i in range(a,len(text)):
            c=text[i]
            if quoted:
                if esc: esc=False
                elif c=='\\': esc=True
                elif c=='"': quoted=False
                continue
            if c=='"': quoted=True
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    try:return json.loads(text[a:i+1])
                    except Exception:break
    raise ValueError("no valid JSON object")

def load_tasks(repo,outdir):
    export=outdir/"export"
    if not (export/"corpus.jsonl").exists():
        subprocess.run(["node",str(repo/"teacher-lab/export-corpus.mjs"),str(export)],check=True,cwd=repo)
    return [json.loads(x) for x in (export/"corpus.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]

def load_done(path):
    if not path.exists(): return set()
    done=set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row=json.loads(line)
            if row.get("task_id") and row.get("ok"): done.add(row["task_id"])
        except Exception: pass
    return done

def prompt_for(task):
    payload={"user_request":task["user_request"],"session_context":task.get("session_context",{}),"guards":task.get("guards",{})}
    return SYSTEM+"\nINPUT="+json.dumps(payload,ensure_ascii=False,separators=(",",":"))

def worker(name,cfg,tasks,outdir,max_new_tokens):
    import torch
    from transformers import AutoModelForCausalLM,AutoTokenizer,BitsAndBytesConfig
    path=outdir/f"{name}.jsonl"; done=load_done(path)
    print(f"[{name}] loading {cfg['repo']} on cuda:{cfg['gpu']} done={len(done)}",flush=True)
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type="nf4",bnb_4bit_compute_dtype=torch.float16,bnb_4bit_use_double_quant=True)
    tok=AutoTokenizer.from_pretrained(cfg["repo"],trust_remote_code=True)
    model=AutoModelForCausalLM.from_pretrained(cfg["repo"],quantization_config=quant,device_map={"":cfg["gpu"]},torch_dtype=torch.float16,trust_remote_code=True)
    model.eval()
    with path.open("a",encoding="utf-8",buffering=1) as f:
        for idx,task in enumerate(tasks,1):
            if task["id"] in done: continue
            messages=[{"role":"user","content":prompt_for(task)}]
            kw={"tokenize":False,"add_generation_prompt":True}
            if cfg.get("thinking") is False: kw["enable_thinking"]=False
            try:
                rendered=tok.apply_chat_template(messages,**kw)
            except TypeError:
                kw.pop("enable_thinking",None); rendered=tok.apply_chat_template(messages,**kw)
            inputs=tok(rendered,return_tensors="pt").to(f"cuda:{cfg['gpu']}")
            try:
                with torch.inference_mode():
                    out=model.generate(**inputs,max_new_tokens=max_new_tokens,do_sample=cfg["temperature"]>0,temperature=max(cfg["temperature"],0.01),top_p=0.9,pad_token_id=tok.eos_token_id)
                text=tok.decode(out[0][inputs["input_ids"].shape[1]:],skip_special_tokens=True)
                obj=extract_json(text)
                row={"task_id":task["id"],"profile_id":name,"model":cfg["repo"],"ok":True,"output":obj}
            except Exception as e:
                row={"task_id":task["id"],"profile_id":name,"model":cfg["repo"],"ok":False,"error":type(e).__name__}
            f.write(json.dumps(row,ensure_ascii=False,separators=(",",":"))+"\n")
            if idx%10==0: print(f"[{name}] {idx}/{len(tasks)}",flush=True)
    print(f"[{name}] complete -> {path}",flush=True)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--repo",default="."); ap.add_argument("--out",default="/kaggle/working/bai_teacher_runs"); ap.add_argument("--limit",type=int,default=0); ap.add_argument("--max-new-tokens",type=int,default=700); args=ap.parse_args()
    repo=Path(args.repo).resolve(); outdir=Path(args.out); outdir.mkdir(parents=True,exist_ok=True)
    tasks=load_tasks(repo,outdir)
    if args.limit>0: tasks=tasks[:args.limit]
    try:
        import torch
        if torch.cuda.device_count()<2: raise SystemExit("Need Kaggle T4x2: two CUDA devices required")
        print("GPUs:",[torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())])
    except ImportError: raise SystemExit("PyTorch/CUDA required")
    threads=[threading.Thread(target=worker,args=(n,cfg,tasks,outdir,args.max_new_tokens),daemon=False) for n,cfg in MODELS.items()]
    [t.start() for t in threads]; [t.join() for t in threads]
    print("Teacher generation finished. Next: import/review JSONL with Teacher Lab.")
if __name__=="__main__": main()
