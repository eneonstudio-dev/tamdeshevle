#!/usr/bin/env python3
import argparse,datetime,gc,hashlib,importlib.metadata,json,platform,re,subprocess,threading
from pathlib import Path

PROMPT_VERSION="bai-shopping-teacher-v1"
SYSTEM=("Ты teacher для shopping-мозга Votonobay. Верни только один JSON-объект без markdown и без рассуждений. "
"Поля: intent, hard_constraints, soft_preferences, shopping_plan, actions, critic, confidence. "
"Не выдумывай цены, наличие, магазин, состав или качество. Hard constraints не ослабляй. "
"confidence должен содержать overall, price, availability, quality; если фактов нет, price/availability/quality=unknown.")
MODELS={
 "deepseek_r1_distill_qwen_7b":{"repo":"deepseek-ai/DeepSeek-R1-Distill-Qwen-7B","revision":"916b56a44061fd5cd7d6a8fb632557ed4f724f60","gpu":0,"temperature":0.6,"thinking":None},
 "qwen3_8b":{"repo":"Qwen/Qwen3-8B","revision":"b968826d9c46dd6066d109eabc6255188de91218","gpu":1,"temperature":0.2,"thinking":False},
}

def canonical_json(value): return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
def sha256_text(text): return hashlib.sha256(text.encode("utf-8")).hexdigest()
def package_version(name):
    try:return importlib.metadata.version(name)
    except Exception:return None

def extract_json(text):
    text=re.sub(r"<think>.*?</think>","",text,flags=re.S|re.I).strip()
    for a,c0 in enumerate(text):
        if c0!='{': continue
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

def load_tasks(repo,outdir,batch_index):
    export=outdir/"export"
    if not (export/"corpus.jsonl").exists():
        subprocess.run(["node",str(repo/"teacher-lab/export-corpus.mjs"),str(export)],check=True,cwd=repo)
    source=export/"corpus.jsonl"
    if batch_index:
        source=export/"batches"/f"batch_{batch_index:03d}.jsonl"
        if not source.exists(): raise SystemExit(f"batch {batch_index} does not exist (valid: 1..9)")
    return [json.loads(x) for x in source.read_text(encoding="utf-8").splitlines() if x.strip()]

def load_done(path,cfg):
    if not path.exists(): return set()
    done=set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try: row=json.loads(line)
        except Exception: continue
        if row.get("model") not in (None,cfg["repo"]): raise RuntimeError(f"existing run model mismatch in {path}; use a clean output directory")
        if row.get("ok") and row.get("revision")!=cfg["revision"]: raise RuntimeError(f"existing run revision mismatch in {path}; use a clean output directory")
        if row.get("ok") and not all(row.get(k) for k in ("prompt_sha256","output_sha256","runtime_fingerprint")):
            raise RuntimeError(f"existing run lacks provenance fingerprints in {path}; use a clean output directory")
        if row.get("task_id") and row.get("ok"): done.add(row["task_id"])
    return done

def prompt_for(task):
    payload={"user_request":task["user_request"],"session_context":task.get("session_context",{}),"guards":task.get("guards",{})}
    return SYSTEM+"\nINPUT="+json.dumps(payload,ensure_ascii=False,separators=(",",":"))

def runtime_record(max_new_tokens):
    import torch
    base={
      "schema_version":"1.0","prompt_version":PROMPT_VERSION,"system_prompt_sha256":sha256_text(SYSTEM),
      "models":{pid:{"repo":cfg["repo"],"revision":cfg["revision"],"gpu":cfg["gpu"],"temperature":cfg["temperature"],"thinking":cfg.get("thinking")} for pid,cfg in MODELS.items()},
      "generation":{"do_sample":True,"top_p":0.9,"max_new_tokens":int(max_new_tokens)},
      "environment":{"python":platform.python_version(),"torch":getattr(torch,"__version__",None),"transformers":package_version("transformers"),"bitsandbytes":package_version("bitsandbytes"),"cuda":getattr(torch.version,"cuda",None),"gpus":[torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]}
    }
    fingerprint=sha256_text(canonical_json(base))
    return {**base,"runtime_fingerprint":fingerprint,"created_at":datetime.datetime.now(datetime.timezone.utc).isoformat()}

def ensure_runtime_record(outdir,max_new_tokens):
    outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True); path=outdir/"run-manifest.jsonl"; record=runtime_record(max_new_tokens)
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            try: existing=json.loads(line)
            except Exception: continue
            if existing.get("runtime_fingerprint")==record["runtime_fingerprint"]: return record["runtime_fingerprint"]
    with path.open("a",encoding="utf-8",buffering=1) as f:f.write(json.dumps(record,ensure_ascii=False,separators=(",",":"))+"\n")
    return record["runtime_fingerprint"]

def load_teacher(profile_id,cfg):
    import torch
    from transformers import AutoModelForCausalLM,AutoTokenizer,BitsAndBytesConfig
    print(f"[{profile_id}] loading {cfg['repo']}@{cfg['revision']} on cuda:{cfg['gpu']}",flush=True)
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type="nf4",bnb_4bit_compute_dtype=torch.float16,bnb_4bit_use_double_quant=True)
    tok=AutoTokenizer.from_pretrained(cfg["repo"],revision=cfg["revision"],trust_remote_code=True)
    model=AutoModelForCausalLM.from_pretrained(cfg["repo"],revision=cfg["revision"],quantization_config=quant,device_map={"":cfg["gpu"]},torch_dtype=torch.float16,trust_remote_code=True)
    model.eval()
    print(f"[{profile_id}] loaded",flush=True)
    return tok,model

def load_teachers(loader=load_teacher):
    loaded={}
    for profile_id,cfg in MODELS.items():
        loaded[profile_id]=loader(profile_id,cfg)
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception: pass
    return loaded

def worker(profile_id,cfg,loaded,tasks,outdir,max_new_tokens,runtime_fingerprint):
    import torch
    tok,model=loaded
    path=outdir/f"{profile_id}.jsonl"; done=load_done(path,cfg)
    print(f"[{profile_id}] generating on cuda:{cfg['gpu']} done={len(done)}",flush=True)
    generation={"temperature":cfg["temperature"],"top_p":0.9,"do_sample":True,"max_new_tokens":int(max_new_tokens)}
    with path.open("a",encoding="utf-8",buffering=1) as f:
        for idx,task in enumerate(tasks,1):
            if task["id"] in done: continue
            prompt=prompt_for(task); prompt_hash=sha256_text(prompt)
            messages=[{"role":"user","content":prompt}]
            kw={"tokenize":False,"add_generation_prompt":True}
            if cfg.get("thinking") is False: kw["enable_thinking"]=False
            try: rendered=tok.apply_chat_template(messages,**kw)
            except TypeError:
                kw.pop("enable_thinking",None); rendered=tok.apply_chat_template(messages,**kw)
            inputs=tok(rendered,return_tensors="pt").to(f"cuda:{cfg['gpu']}")
            base={"task_id":task["id"],"profile_id":profile_id,"model":cfg["repo"],"revision":cfg["revision"],"prompt_version":PROMPT_VERSION,"prompt_sha256":prompt_hash,"runtime_fingerprint":runtime_fingerprint,"generation":generation}
            try:
                with torch.inference_mode(): out=model.generate(**inputs,max_new_tokens=max_new_tokens,do_sample=True,temperature=cfg["temperature"],top_p=0.9,pad_token_id=tok.eos_token_id)
                text=tok.decode(out[0][inputs["input_ids"].shape[1]:],skip_special_tokens=True); obj=extract_json(text)
                row={**base,"ok":True,"output_sha256":sha256_text(canonical_json(obj)),"output":obj}
            except Exception as e: row={**base,"ok":False,"error":type(e).__name__}
            f.write(json.dumps(row,ensure_ascii=False,separators=(",",":"))+"\n")
            if idx%10==0: print(f"[{profile_id}] {idx}/{len(tasks)}",flush=True)
    print(f"[{profile_id}] complete -> {path}",flush=True)

def run_parallel(loaded,tasks,outdir,max_new_tokens=700):
    outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True); runtime_fingerprint=ensure_runtime_record(outdir,max_new_tokens)
    threads=[threading.Thread(target=worker,args=(pid,cfg,loaded[pid],tasks,outdir,max_new_tokens,runtime_fingerprint),daemon=False) for pid,cfg in MODELS.items()]
    [t.start() for t in threads]; [t.join() for t in threads]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--repo",default="."); ap.add_argument("--out",default="/kaggle/working/bai_teacher_runs"); ap.add_argument("--batch-index",type=int,default=1); ap.add_argument("--limit",type=int,default=0); ap.add_argument("--max-new-tokens",type=int,default=700); args=ap.parse_args()
    if args.batch_index<0 or args.batch_index>9: raise SystemExit("--batch-index must be 0 (all) or 1..9")
    repo=Path(args.repo).resolve(); outdir=Path(args.out); outdir.mkdir(parents=True,exist_ok=True); tasks=load_tasks(repo,outdir,args.batch_index)
    if args.limit>0: tasks=tasks[:args.limit]
    try:
        import torch
        if torch.cuda.device_count()<2: raise SystemExit("Need Kaggle T4x2: two CUDA devices required")
        print("GPUs:",[torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())])
    except ImportError: raise SystemExit("PyTorch/CUDA required")
    loaded=load_teachers(); run_parallel(loaded,tasks,outdir,args.max_new_tokens)
    print("Teacher generation finished. Run prepare_review.mjs next.")
if __name__=="__main__": main()
