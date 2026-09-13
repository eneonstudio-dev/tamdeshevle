#!/usr/bin/env python3
import argparse,hashlib,json,random
from pathlib import Path


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--data',required=True); ap.add_argument('--out',required=True); ap.add_argument('--config',default='teacher-lab/training/student-v0.1.json'); args=ap.parse_args()
    cfg=json.loads(Path(args.config).read_text(encoding='utf-8')); rows=read_jsonl(args.data)
    minimum=int(cfg['data']['minimum_examples'])
    if len(rows)<minimum: raise SystemExit(f'Need at least {minimum} approved SFT examples, got {len(rows)}')
    import torch
    from datasets import Dataset
    from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig,TrainingArguments,Trainer,DataCollatorForSeq2Seq,set_seed
    from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training
    seed=int(cfg.get('seed',42)); random.seed(seed); set_seed(seed)
    base=cfg['base_model']; max_len=int(cfg['max_seq_length'])
    tok=AutoTokenizer.from_pretrained(base,trust_remote_code=True); tok.pad_token=tok.pad_token or tok.eos_token
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.float16,bnb_4bit_use_double_quant=True)
    model=AutoModelForCausalLM.from_pretrained(base,quantization_config=quant,device_map='auto',torch_dtype=torch.float16,trust_remote_code=True)
    model=prepare_model_for_kbit_training(model)
    lc=cfg['lora']; model=get_peft_model(model,LoraConfig(r=int(lc['r']),lora_alpha=int(lc['alpha']),lora_dropout=float(lc['dropout']),bias='none',task_type='CAUSAL_LM',target_modules=list(lc['target_modules'])))
    def encode(row):
        msgs=row['messages']; prompt=tok.apply_chat_template(msgs[:-1],tokenize=False,add_generation_prompt=True); full=tok.apply_chat_template(msgs,tokenize=False,add_generation_prompt=False)
        p=tok(prompt,add_special_tokens=False,truncation=True,max_length=max_len)['input_ids']; x=tok(full,add_special_tokens=False,truncation=True,max_length=max_len)
        labels=list(x['input_ids']); cut=min(len(p),len(labels)); labels[:cut]=[-100]*cut; x['labels']=labels; return x
    ds=Dataset.from_list(rows).map(encode,remove_columns=Dataset.from_list(rows).column_names)
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    train_args=TrainingArguments(output_dir=str(out),num_train_epochs=float(cfg['epochs']),learning_rate=float(cfg['learning_rate']),per_device_train_batch_size=int(cfg['micro_batch_size']),gradient_accumulation_steps=int(cfg['gradient_accumulation_steps']),fp16=True,bf16=False,logging_steps=10,save_strategy='epoch',report_to=[],remove_unused_columns=False,seed=seed,data_seed=seed)
    collator=DataCollatorForSeq2Seq(tok,model=model,padding=True,label_pad_token_id=-100)
    trainer=Trainer(model=model,args=train_args,train_dataset=ds,data_collator=collator)
    trainer.train(); model.save_pretrained(out/'adapter'); tok.save_pretrained(out/'adapter')
    digest=hashlib.sha256(Path(args.data).read_bytes()).hexdigest(); manifest={'name':cfg['name'],'base_model':base,'method':cfg['method'],'examples':len(rows),'data_sha256':digest,'seed':seed,'output':'adapter'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(manifest,ensure_ascii=False))

if __name__=='__main__': main()
