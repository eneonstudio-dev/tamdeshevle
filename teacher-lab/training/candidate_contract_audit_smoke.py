#!/usr/bin/env python3
import json
import tempfile
from pathlib import Path

from candidate_contract_audit import audit, read_jsonl


def eval_rows():
    return [
        {'id':'a','user_request':'до 5000','session_context':{},'target':{}},
        {'id':'b','user_request':'убери молоко','session_context':{},'target':{}},
    ]


def safe_predictions():
    return [
        {
            'id':'a','intent':'build_basket',
            'hard_constraints':{'store':'Магнит'},
            'soft_preferences':{'price':'economy','quality':'higher'},
            'actions':[{'type':'set_constraint','payload':{'key':'budget','value':5000}}],
            'confidence':{'overall':'high','price':'unknown','availability':'unknown','quality':'unknown'}
        },
        {
            'id':'b','intent':'edit_basket',
            'soft_preferences':{'price':'balanced'},
            'actions':[{'type':'remove_item','payload':{'product_id':'milk'}}],
            'confidence':{'overall':'high','price':'unknown','availability':'unknown','quality':'unknown'}
        },
    ]

safe=audit(eval_rows(),safe_predictions())
assert safe['ok'] is True
assert safe['parse_errors']==0
assert safe['action_contract_violations']==0
assert safe['truth_boundary_violations']==0, 'user constraints/preferences must not be misclassified as dynamic truth claims'

legacy=safe_predictions()
legacy[0]['actions']=[{'type':'set_constraint','value':{'key':'budget','value':5000}}]
report=audit(eval_rows(),legacy)
assert report['ok'] is False
assert report['action_contract_violations']>=2
assert any('legacy_value_field' in err for err in report['cases'][0]['errors'])

bad_truth=safe_predictions()
bad_truth[0]['price']=99
bad_truth[1]['confidence']['price']='verified'
report=audit(eval_rows(),bad_truth)
assert report['ok'] is False
assert report['truth_boundary_violations']==2
assert any('unverified_truth_field:price' in err for err in report['cases'][0]['errors'])
assert any('unsupported_confidence:confidence.price' in err for err in report['cases'][1]['errors'])

claim=safe_predictions()
claim[0]['claims']={'store_id':'magnit:770105','availability':'in_stock'}
report=audit(eval_rows(),claim)
assert report['ok'] is False
assert report['truth_boundary_violations']==2
assert any('unverified_truth_field:claims.store_id' in err for err in report['cases'][0]['errors'])
assert any('unverified_truth_field:claims.availability' in err for err in report['cases'][0]['errors'])

bad_coverage=safe_predictions()[:1]+[{'id':'extra','actions':[]}]
report=audit(eval_rows(),bad_coverage)
assert report['ok'] is False
assert report['coverage_exact'] is False
assert any(err.startswith('missing_predictions:') for err in report['errors'])
assert any(err.startswith('extra_predictions:') for err in report['errors'])

parse=safe_predictions()
parse[0]={'id':'a','parse_error':'student_no_json'}
report=audit(eval_rows(),parse)
assert report['ok'] is False
assert report['parse_errors']==1

with tempfile.TemporaryDirectory() as td:
    td=Path(td)
    gold=td/'eval.jsonl'; pred=td/'pred.jsonl'
    gold.write_text('\n'.join(json.dumps(x,ensure_ascii=False) for x in eval_rows())+'\n',encoding='utf-8')
    pred.write_text('\n'.join(json.dumps(x,ensure_ascii=False) for x in safe_predictions())+'\n',encoding='utf-8')
    assert len(read_jsonl(gold))==2 and len(read_jsonl(pred))==2

print('Candidate contract audit smoke passed: payload-only actions, exact coverage, parse/truth failures fail closed without confusing preferences with facts.')
