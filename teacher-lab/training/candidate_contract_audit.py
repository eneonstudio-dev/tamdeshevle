#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

ALLOWED_ACTIONS = {
    'add_item','remove_item','replace_item','change_quantity','set_constraint',
    'rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase'
}
FORBIDDEN_TRUTH_KEYS = {
    'price','price_rub','unit_price','current_price','old_price','verified_price',
    'availability','verified_availability','stock','stock_count','in_stock',
    'store','store_id','retailer','retailer_id','exact_store',
    'discount','discount_pct','saving','savings','promo','promotion',
    'quality','composition','ingredients'
}
TRUTH_NAMESPACES = {'claims','facts','evidence','observations','verified_facts','truth'}
UNKNOWN_CONFIDENCE_KEYS = {'price','availability','quality'}


def read_jsonl(path):
    rows=[]
    for line_no,line in enumerate(Path(path).read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():
            continue
        value=json.loads(line)
        if not isinstance(value,dict):
            raise SystemExit(f'JSON object required at {path}:{line_no}')
        rows.append(value)
    return rows


def walk_claims(value,path):
    violations=[]
    if isinstance(value,dict):
        for key,item in value.items():
            child=f'{path}.{key}'
            if str(key).lower() in FORBIDDEN_TRUTH_KEYS and item not in (None,'unknown',[],{}):
                violations.append(f'unverified_truth_field:{child}')
            violations.extend(walk_claims(item,child))
    elif isinstance(value,list):
        for index,item in enumerate(value):
            violations.extend(walk_claims(item,f'{path}[{index}]'))
    return violations


def truth_violations(row):
    violations=[]
    # Top-level dynamic fact fields are never part of the planner target contract.
    for key,item in row.items():
        low=str(key).lower()
        if low in FORBIDDEN_TRUTH_KEYS and item not in (None,'unknown',[],{}):
            violations.append(f'unverified_truth_field:{key}')
    # Explicit claim/evidence namespaces are factual assertions, unlike hard/soft user constraints.
    for namespace in TRUTH_NAMESPACES:
        if namespace in row:
            violations.extend(walk_claims(row[namespace],namespace))
    confidence=row.get('confidence')
    if isinstance(confidence,dict):
        for key in UNKNOWN_CONFIDENCE_KEYS:
            if key in confidence and confidence[key] not in (None,'unknown'):
                violations.append(f'unsupported_confidence:confidence.{key}={confidence[key]!r}')
    return violations


def audit(eval_rows,prediction_rows):
    eval_ids=[str(row.get('id') or '').strip() for row in eval_rows]
    pred_ids=[str(row.get('id') or '').strip() for row in prediction_rows]
    errors=[]
    if any(not rid for rid in eval_ids):
        errors.append('eval_missing_id')
    if any(not rid for rid in pred_ids):
        errors.append('prediction_missing_id')
    if len(eval_ids)!=len(set(eval_ids)):
        errors.append('eval_duplicate_id')
    if len(pred_ids)!=len(set(pred_ids)):
        errors.append('prediction_duplicate_id')
    expected=set(eval_ids)
    actual=set(pred_ids)
    if expected-actual:
        errors.append(f'missing_predictions:{len(expected-actual)}')
    if actual-expected:
        errors.append(f'extra_predictions:{len(actual-expected)}')

    predictions={str(row.get('id') or '').strip():row for row in prediction_rows if str(row.get('id') or '').strip()}
    cases=[]
    parse_errors=0
    action_contract_violations=0
    truth_boundary_violations=0
    for rid in eval_ids:
        row=predictions.get(rid)
        case_errors=[]
        if row is None:
            case_errors.append('missing_prediction')
        else:
            if row.get('parse_error'):
                parse_errors+=1
                case_errors.append('parse_error')
            actions=row.get('actions',[])
            if actions is None:
                actions=[]
            if not isinstance(actions,list):
                action_contract_violations+=1
                case_errors.append('actions_not_array')
            else:
                for index,action in enumerate(actions):
                    if not isinstance(action,dict):
                        action_contract_violations+=1
                        case_errors.append(f'action_{index}_not_object')
                        continue
                    action_type=str(action.get('type') or '').strip().lower()
                    if action_type not in ALLOWED_ACTIONS:
                        action_contract_violations+=1
                        case_errors.append(f'action_{index}_type_not_allowed:{action_type or "missing"}')
                    if 'payload' not in action:
                        action_contract_violations+=1
                        case_errors.append(f'action_{index}_missing_payload')
                    elif not isinstance(action.get('payload'),dict):
                        action_contract_violations+=1
                        case_errors.append(f'action_{index}_payload_not_object')
                    if 'value' in action:
                        action_contract_violations+=1
                        case_errors.append(f'action_{index}_legacy_value_field')
            truth_errors=truth_violations(row)
            truth_boundary_violations+=len(truth_errors)
            case_errors.extend(truth_errors)
        cases.append({'id':rid,'ok':not case_errors,'errors':case_errors})

    report={
        'schema_version':'1.0',
        'kind':'bai_candidate_contract_audit',
        'training_started':False,
        'training_allowed':False,
        'examples':len(eval_ids),
        'coverage_exact':not any(x.startswith(('missing_predictions:','extra_predictions:')) for x in errors),
        'parse_errors':parse_errors,
        'action_contract_violations':action_contract_violations,
        'truth_boundary_violations':truth_boundary_violations,
        'errors':errors,
        'cases':cases,
    }
    report['ok']=not errors and all(x['ok'] for x in cases)
    return report


def main():
    ap=argparse.ArgumentParser(description='Eval-only audit for Bai planner action schema and truth-boundary discipline.')
    ap.add_argument('--eval-gold',required=True)
    ap.add_argument('--predictions',required=True)
    ap.add_argument('--out',required=True)
    args=ap.parse_args()
    report=audit(read_jsonl(args.eval_gold),read_jsonl(args.predictions))
    out=Path(args.out); out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    raise SystemExit(0 if report['ok'] else 1)


if __name__=='__main__':
    main()
