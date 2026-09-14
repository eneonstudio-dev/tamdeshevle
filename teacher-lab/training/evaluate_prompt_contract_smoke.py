#!/usr/bin/env python3
import ast
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
contract=json.loads((ROOT/'student-prompt-contract.json').read_text(encoding='utf-8'))
source=(ROOT/'evaluate_student.py').read_text(encoding='utf-8')
tree=ast.parse(source)
assert contract['system_prompt']
assert "PROMPT_CONTRACT=Path(__file__).with_name('student-prompt-contract.json')" in source
assert "'guards'" not in ast.get_source_segment(source,next(node for node in ast.walk(tree) if isinstance(node,ast.FunctionDef) and node.name=='predict'))
assert "'session_context'" in source and "'user_request'" in source
print('Student evaluation prompt contract passed')
