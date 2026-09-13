#!/usr/bin/env python3
import argparse,json
from pathlib import Path

SYSTEM='''Ты Bai Shopping Brain. Решай только shopping-задачу. Верни только JSON с полями intent, hard_constraints, soft_preferences, shopping_plan, actions, retained_constraints, critic, confidence. Actions используют production-контракт: add_item, remove_item, replace_item, change_quantity, set_constraint, rebuild_basket, compare_stores, optimize_basket, explain_choice, prepare_purchase; аргументы действия всегда в payload. Сохраняй hard constraints из session_context. Не выдумывай price, availability, store, composition или quality. Не пиши скрытые рассуждения.'''


def read_jsonl(path):
    return [json.loads(x) for x in Path(path).read_text(encoding='utf-8').splitlines() if x.strip()]


def extract_object(text):
    raw=str(text or '').strip(); start=raw.find('{'); end=raw.rfind('}')
    if start<0 or end<start: raise ValueError('student_no_json')
    value=json.loads(raw[start:end+1])
    if not isinstance(value,dict): raise ValueError('student_bad_json')
    return value


def render_chat(tokenizer,messages,add_generation_prompt,enable_thinking):
    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=add_generation_prompt,
        enable_thinking=enable_thinking,
    )


def load_model(config,adapter=None):
    import torch
    from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig
    base=config['base_model']; revision=config.get('base_revision')
    tok=AutoTokenizer.from_pretrained(base,revision=revision,trust_remote_code=True); tok.pad_token=tok.pad_token or tok.eos_token
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.float16,bnb_4bit_use_double_quant=True)
    model=AutoModelForCausalLM.from_pretrained(base,revision=revision,quantization_config=quant,device_map='auto',torch_dtype=torch.float16,trust_remote_code=True)
    if adapter:
        from peft import PeftModel
        model=PeftModel.from_pretrained(model,adapter)
    model.eval(); return tok,model


def predict(tok,model,row,max_new_tokens,enable_thinking):
    import torch
    payload={'user_request':row.get('user_request'),'session_context':row.get('session_context',{}),'guards':row.get('guards',{})}
    messages=[{'role':'system','content':SYSTEM},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}]
    text=render_chat(tok,messages,True,enable_thinking)
    batch=tok(text,return_tensors='pt').to(model.device)
    with torch.inference_mode():
        out=model.generate(**batch,max_new_tokens=max_new_tokens,do_sample=False,use_cache=True,pad_token_id=tok.eos_token_id)
    generated=tok.decode(out[0][batch['input_ids'].shape[1]:],skip_special_tokens=True)
    return extract_object(generated)


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--eval',required=True); ap.add_argument('--out',required=True); ap.add_argument('--config',default='teacher-lab/training/student-v0.1.json'); ap.add_argument('--adapter'); ap.add_argument('--max-new-tokens',type=int,default=700); args=ap.parse_args()
    cfg=json.loads(Path(args.config).read_text(encoding='utf-8')); rows=read_jsonl(args.eval); tok,model=load_model(cfg,args.adapter)
    thinking=bool(cfg.get('chat_template',{}).get('enable_thinking',False)); target=Path(args.out); target.parent.mkdir(parents=True,exist_ok=True); ok=0
    with target.open('w',encoding='utf-8') as f:
        for i,row in enumerate(rows,1):
            try:
                result=predict(tok,model,row,args.max_new_tokens,thinking); result={'id':row.get('id'),**result}; ok+=1
            except Exception as exc:
                result={'id':row.get('id'),'parse_error':str(exc)}
            f.write(json.dumps(result,ensure_ascii=False)+'\n'); print(f'{i}/{len(rows)} ok={ok}',flush=True)
    print(json.dumps({'examples':len(rows),'parsed':ok,'predictions':str(target),'adapter':args.adapter or None,'base_model':cfg.get('base_model'),'base_revision':cfg.get('base_revision'),'enable_thinking':thinking},ensure_ascii=False))

if __name__=='__main__': main()
