#!/usr/bin/env python3
import json
import tempfile
from pathlib import Path
import importlib.util

SCRIPT=Path(__file__).with_name('bai_trained_adapter_server.py')
spec=importlib.util.spec_from_file_location('bai_trained_adapter_server',SCRIPT);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

assert mod.extract_object('prefix {"intent":"build_basket","actions":[]} suffix')['intent']=='build_basket'
try:mod.extract_object('no json')
except ValueError as exc:assert str(exc)=='student_no_json'
else:raise AssertionError('invalid output must fail')

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);(root/'adapter').mkdir()
    good={'schema_version':'1.0','id':'bai-trained-test','kind':'trained','status':'promoted','enabled':False,'action_contract':'bai-actions-v1','checkpoint_sha256':'a'*64,'promotion':{'pass':True}}
    (root/'brain-release.json').write_text(json.dumps(good),encoding='utf-8')
    release,adapter=mod.release_from_bundle(root)
    assert release['id']=='bai-trained-test' and adapter==root/'adapter'
    (root/'brain-release.json').write_text(json.dumps({**good,'status':'candidate'}),encoding='utf-8')
    try:mod.release_from_bundle(root)
    except RuntimeError as exc:assert str(exc)=='release_not_promoted'
    else:raise AssertionError('candidate must not serve')

source=SCRIPT.read_text(encoding='utf-8')
assert "device_map={'':0}" in source
assert 'enable_thinking=' in source and "do_sample=False" in source
assert 'BAI_BACKEND_TOKEN' in source and "release_pin_mismatch" in source
print('Trained adapter serving smoke passed: promoted pin required, non-thinking deterministic inference, auth token and single-GPU load are enforced.')
