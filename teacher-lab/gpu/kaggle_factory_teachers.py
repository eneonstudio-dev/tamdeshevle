#!/usr/bin/env python3
"""Strict teacher contract used by Data Factory v2.2 without mutating historical teacher runs."""
import kaggle_t4x2_teachers as base

PROMPT_VERSION='bai-shopping-teacher-v2'
ACTION_TYPES=('add_item','remove_item','replace_item','change_quantity','set_constraint','rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase')
SYSTEM=(
    'Ты teacher для shopping-мозга Votonobay. Верни только один JSON-объект без markdown и без рассуждений. '
    'Поля: intent, hard_constraints, soft_preferences, shopping_plan, actions, critic, confidence. '
    'actions — только массив объектов {type,payload}; type только из allowlist: '+', '.join(ACTION_TYPES)+'. '
    'Все аргументы действия находятся только внутри payload; не используй корневые value, args или params. '
    'Не выдумывай цены, наличие, магазин, состав или качество. Hard constraints не ослабляй; несвязанные ограничения и состояние сохраняй. '
    'confidence должен содержать overall, price, availability, quality; если фактов нет, price/availability/quality=unknown.'
)

# The base runner functions resolve these globals in the base module at call time.
base.PROMPT_VERSION=PROMPT_VERSION
base.SYSTEM=SYSTEM

MODELS=base.MODELS
load_teachers=base.load_teachers
run_parallel=base.run_parallel
prompt_for=base.prompt_for
runtime_record=base.runtime_record
sha256_text=base.sha256_text
canonical_json=base.canonical_json


def assert_contract():
    prompt=prompt_for({'user_request':'Бюджет теперь 4000','session_context':{'budget':5000},'guards':{}})
    assert PROMPT_VERSION=='bai-shopping-teacher-v2'
    assert '{type,payload}' in SYSTEM and 'set_constraint' in SYSTEM and 'value, args' in SYSTEM
    assert 'Бюджет теперь 4000' in prompt and '"budget":5000' in prompt
    return True
