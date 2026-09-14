#!/usr/bin/env python3
from pathlib import Path

js=Path('votonobay-roxy-truth-verdict-v1.js').read_text(encoding='utf-8')
css=Path('votonobay-roxy-truth-verdict-v1.css').read_text(encoding='utf-8')
loader=Path('ai-shopping-visual-v3.js').read_text(encoding='utf-8')

required_js=(
    'truthState(plan)',
    'kind:"verified"',
    'kind:"mixed"',
    'kind:"uncertain"',
    'Итог ориентировочный',
    'total.textContent=info.kind==="verified"?base:`≈ ${base}`',
    'aria-label',
)
for token in required_js:
    assert token in js, f'missing truth token: {token}'
assert 'votonobay-roxy-truth-verdict-v1.js' in loader, 'truth layer is not loaded'
for state in ('verified','mixed','uncertain','unknown'):
    assert f'data-truth-state="{state}"' in css, f'missing visual state: {state}'
print('Roxy truth verdict source contract passed.')
