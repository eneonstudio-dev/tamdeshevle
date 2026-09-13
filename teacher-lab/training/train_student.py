#!/usr/bin/env python3
import argparse,hashlib,json,random
from pathlib import Path




def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]




def render_chat(tokenizer,messages,add_generation_prompt,enable_thinking):
    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=add_generation_prompt,
        enable_thinking=enable_thinking,
    )




def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--data',required=True); ap.add_argument('--out',required=True); ap.add_argument('--config',default='teacher-lab/training/student-v0.1.json'); ap.add_argument('--resume',action='store_true'); args=ap.parse_args()
    cfg=json.loads(Path(args.config).read_text(encoding='utf-8')); rows=read_jsonl(args.data)
    minimum=int(cfg['data']['minimum_examples'])
    if len(rows)<minimum: raise SystemExit(f'Need at least {minimum} approved SFT examples, got {len(rows)}')
    import torch,transformers
    from datasets import Dataset
    from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig,TrainingArguments,Trainer,DataCollatorForSeq2Seq,set_seed
    from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training
    seed=int(cfg.get('seed',42)); random.seed(seed); set_seed(seed)
    base=cfg['base_model']; revision=cfg.get('base_revision'); max_len=int(cfg['max_seq_length'])
    thinking=bool(cfg.get('chat_template',{}).get('enable_thinking',False)); grad_ckpt=bool(cfg.get('gradient_checkpointing',True))
    tok=AutoTokenizer.from_pretrained(base,revision=revision,trust_remote_code=True); tok.pad_token=tok.pad_token or tok.eos_token
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.float32,bnb_4bit_use_double_quant=True)
    # QLoRA models must be loaded onto the same device that Trainer will use.
    # `device_map="auto"` can shard a tiny model across both Kaggle T4s; the
    # single-process Trainer then rejects the 4-bit model during prepare().
    if not torch.cuda.is_available():
