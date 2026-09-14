#!/usr/bin/env python3
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'teacher-lab/training/student-v0.1.json'
PROMPT=ROOT/'teacher-lab/training/student-prompt-contract.json'
MAX_BODY=128*1024
BRAIN=None
TOKEN=''


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def extract_object(text):
    raw=str(text or '').strip(); start=raw.find('{'); end=raw.rfind('}')
    if start<0 or end<start: raise ValueError('student_no_json')
    value=json.loads(raw[start:end+1])
    if not isinstance(value,dict): raise ValueError('student_bad_json')
    return value


def release_from_bundle(bundle):
    manifest=load_json(Path(bundle)/'brain-release.json')
    if manifest.get('schema_version')!='1.0' or manifest.get('kind')!='trained' or manifest.get('status')!='promoted' or manifest.get('promotion',{}).get('pass') is not True:
        raise RuntimeError('release_not_promoted')
    checkpoint=str(manifest.get('checkpoint_sha256') or '').lower()
    if len(checkpoint)!=64 or any(c not in '0123456789abcdef' for c in checkpoint): raise RuntimeError('release_bad_checkpoint')
    if manifest.get('action_contract')!='bai-actions-v1': raise RuntimeError('release_contract_mismatch')
    adapter=Path(bundle)/'adapter'
    if not adapter.is_dir(): raise RuntimeError('adapter_missing')
    return manifest,adapter


def load_model(adapter):
    import torch
    from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig
    from peft import PeftModel
    if not torch.cuda.is_available(): raise RuntimeError('cuda_required')
    cfg=load_json(CONFIG); base=cfg['base_model']; revision=cfg['base_revision']
    tok=AutoTokenizer.from_pretrained(base,revision=revision,trust_remote_code=True); tok.pad_token=tok.pad_token or tok.eos_token
    quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.float16,bnb_4bit_use_double_quant=True)
    model=AutoModelForCausalLM.from_pretrained(base,revision=revision,quantization_config=quant,device_map={'':0},torch_dtype=torch.float16,trust_remote_code=True)
    model=PeftModel.from_pretrained(model,str(adapter)); model.eval()
    return tok,model,cfg


class Brain:
    def __init__(self,bundle):
        self.release,self.adapter=release_from_bundle(bundle)
        self.system=load_json(PROMPT)['system_prompt']
        self.tokenizer,self.model,self.config=load_model(self.adapter)
        self.max_new_tokens=max(64,min(1200,int(os.getenv('BAI_MAX_NEW_TOKENS','700'))))
    def pin(self):
        return {'id':self.release['id'],'checkpoint_sha256':self.release['checkpoint_sha256'],'action_contract':self.release['action_contract']}
    def predict(self,user_request,session_context):
        import torch
        payload={'user_request':str(user_request or '').strip()[:1000],'session_context':session_context if isinstance(session_context,dict) else {}}
        if not payload['user_request']: raise ValueError('empty_message')
        messages=[{'role':'system','content':self.system},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}]
        text=self.tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=bool(self.config.get('chat_template',{}).get('enable_thinking',False)))
        batch=self.tokenizer(text,return_tensors='pt').to(self.model.device)
        with torch.inference_mode():
            out=self.model.generate(**batch,max_new_tokens=self.max_new_tokens,do_sample=False,use_cache=True,pad_token_id=self.tokenizer.eos_token_id)
        generated=self.tokenizer.decode(out[0][batch['input_ids'].shape[1]:],skip_special_tokens=True)
        return extract_object(generated)


def configure():
    global BRAIN,TOKEN
    bundle=os.getenv('BAI_BUNDLE_DIR','').strip(); token=os.getenv('BAI_BACKEND_TOKEN','').strip()
    if not bundle: raise RuntimeError('BAI_BUNDLE_DIR required')
    if len(token)<24: raise RuntimeError('BAI_BACKEND_TOKEN required')
    BRAIN=Brain(bundle);TOKEN=token
    return BRAIN


class Handler(BaseHTTPRequestHandler):
    server_version='BaiTrainedInference/1.0'
    def send_json(self,status,body):
        raw=json.dumps(body,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def authorized(self):
        return bool(TOKEN) and hmac.compare_digest(self.headers.get('Authorization',''),f'Bearer {TOKEN}')
    def do_GET(self):
        if self.path!='/health': return self.send_json(404,{'ok':False,'error':'not_found'})
        if BRAIN is None:return self.send_json(503,{'ok':False,'error':'not_ready'})
        return self.send_json(200,{'ok':True,'release':BRAIN.pin(),'model':BRAIN.release.get('model'),'ready':True})
    def do_POST(self):
        if self.path not in ('/','/infer'): return self.send_json(404,{'ok':False,'error':'not_found'})
        if BRAIN is None:return self.send_json(503,{'ok':False,'error':'not_ready'})
        if not self.authorized(): return self.send_json(401,{'ok':False,'error':'unauthorized'})
        try:length=int(self.headers.get('Content-Length','0'))
        except:length=0
        if length<1 or length>MAX_BODY:return self.send_json(413,{'ok':False,'error':'payload_size_invalid'})
        try:body=json.loads(self.rfile.read(length))
        except:return self.send_json(400,{'ok':False,'error':'invalid_json'})
        if body.get('release')!=BRAIN.pin(): return self.send_json(409,{'ok':False,'error':'release_pin_mismatch'})
        try:output=BRAIN.predict(body.get('user_request'),body.get('session_context'))
        except ValueError as exc:return self.send_json(422,{'ok':False,'error':str(exc)})
        except Exception:return self.send_json(500,{'ok':False,'error':'inference_failed'})
        return self.send_json(200,{'ok':True,'release':BRAIN.pin(),'output':output})
    def log_message(self,fmt,*args):
        print(json.dumps({'remote':self.client_address[0],'message':fmt%args},ensure_ascii=False),flush=True)


def main():
    brain=configure();host=os.getenv('BAI_HOST','0.0.0.0');port=int(os.getenv('PORT','8080'))
    print(json.dumps({'status':'ready','host':host,'port':port,'release':brain.pin()},ensure_ascii=False),flush=True)
    ThreadingHTTPServer((host,port),Handler).serve_forever()


if __name__=='__main__':main()
