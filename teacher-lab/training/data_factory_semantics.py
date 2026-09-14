#!/usr/bin/env python3
from copy import deepcopy
from collections import defaultdict

DAIRY={'йогурт','сыр','кефир','творог','молоко'}
SNACKS={'йогурт','орехи','хлебцы','сыр','кефир'}

CASE_BY_REQUEST={
    'мяса сделай получше, остальное оставь как есть':'protein_quality_up',
    'убери ветчину, но бюджет и остальные условия не меняй':'remove_ham',
    'сделай всё из одного магазина':'force_one_store',
    'добавь фруктов, ничего другого не выкидывай':'add_fruit',
    'давай подешевле, но не трогай белок':'save_except_protein',
    'не бери самый дешёвый вариант, качество важнее':'avoid_cheapest',
    'замени последнее на похожее, остальные условия сохрани':'replace_last',
    'верни прошлый вариант и оставь мой бюджет':'restore_previous',
    'готовить хочу по минимуму, остальное не меняй':'minimal_cooking',
    'сделай чуть полезнее без фанатизма':'healthier_soft',
    'белок оставь нормальным, а на остальном сэкономь':'economy_except_protein',
    'убери молочку, остальную корзину не меняй':'remove_dairy',
    'можно два магазина, если так заметно выгоднее':'allow_two_stores',
    'добавь перекусов, но бюджет не расширяй':'add_snacks',
    'бренды больше не важны, остальные запреты оставь':'relax_brand',
    'сделай быстрее по покупке, цена не главное':'prefer_convenience',
    'уменьши количество макарон на одну пачку':'decrement_pasta',
    'бюджет теперь 4000, больше ничего не меняй':'change_budget_4000',
    'замени курицу на индейку, остальное сохрани':'replace_chicken_turkey',
    'собери ту же корзину в другом магазине без пересборки состава':'same_basket_other_store',
}


def without_prefix(values,prefix):
    return [x for x in values if not str(x).startswith(prefix)]


def first_prefixed(values,prefix):
    return next((x for x in values if str(x).startswith(prefix)),None)


def set_quantity(context,item,value):
    q=dict(context.get('quantities') or {})
    for product in context.get('basket') or []: q.setdefault(product,1)
    q[item]=value
    context['quantities']=q


def replace_basket_item(context,old,new):
    basket=list(context.get('basket') or [])
    if old in basket: basket[basket.index(old)]=new
    elif basket: basket[-1]=new
    else: basket=[new]
    context['basket']=basket
    q=dict(context.get('quantities') or {})
    if old in q: q[new]=q.pop(old)
    q.setdefault(new,1)
    context['quantities']=q


def edit_expected(case_id,constraints):
    return {
        'intent_family':'edit_basket','case_id':case_id,
        'must_retain':list(constraints),'must_drop':[],'new_hard':[],
        'required_effects':[],'preserve_unmentioned_basket':True,
    }


def enrich_edit(task):
    task=deepcopy(task); request=task['user_request']; case_id=CASE_BY_REQUEST.get(request)
    if not case_id: raise ValueError(f'unknown edit request: {request}')
    ctx=task['session_context']; constraints=list(ctx.get('constraints') or [])
    ctx['quantities']={x:1 for x in ctx.get('basket') or []}
    expected=edit_expected(case_id,constraints)

    if case_id=='protein_quality_up': expected['required_effects']=['protein_quality:higher']
    elif case_id=='remove_ham':
        replace_basket_item(ctx,ctx['basket'][-1] if ctx.get('basket') else None,'ветчина'); expected['required_effects']=['remove_product:ветчина']
    elif case_id=='force_one_store':
        ctx['mode']='multi'; constraints=without_prefix(constraints,'mode:'); ctx['constraints']=constraints
        expected=edit_expected(case_id,constraints); expected['new_hard']=['mode:one']; expected['required_effects']=['store_mode:one']
    elif case_id=='add_fruit': expected['required_effects']=['increase_category:fruit']
    elif case_id=='save_except_protein': expected['required_effects']=['price:cheaper','preserve_category:protein']
    elif case_id=='avoid_cheapest': expected['required_effects']=['preference:avoid_cheapest']
    elif case_id=='replace_last':
        ctx['last_focus']=ctx['basket'][-1]; expected['required_effects']=[f'replace_product:{ctx["last_focus"]}:similar']
    elif case_id=='restore_previous':
        previous=list(ctx.get('basket') or []); current=list(previous)
        if current: current[-1]='печенье' if current[-1]!='печенье' else 'хлебцы'
        ctx['previous_basket']=previous; ctx['basket']=current; ctx['previous_constraints']=list(constraints)
        ctx['last_focus']=current[-1] if current else None; ctx['quantities']={x:1 for x in current}
        expected['required_effects']=['restore_previous_basket']
    elif case_id=='minimal_cooking':
        constraints=without_prefix(constraints,'cooking:'); ctx['constraints']=constraints
        expected=edit_expected(case_id,constraints); expected['new_hard']=['cooking:minimal']; expected['required_effects']=['cooking:minimal']
    elif case_id=='healthier_soft': expected['required_effects']=['preference:healthy']
    elif case_id=='economy_except_protein': expected['required_effects']=['price:economy','preserve_category:protein']
    elif case_id=='remove_dairy':
        if not any(x in DAIRY for x in ctx.get('basket') or []): replace_basket_item(ctx,ctx['basket'][-1] if ctx.get('basket') else None,'йогурт')
        expected['required_effects']=['remove_category:dairy']
    elif case_id=='allow_two_stores':
        constraints=without_prefix(constraints,'mode:')+['mode:one']; ctx['constraints']=constraints; ctx['mode']='one'
        expected=edit_expected(case_id,without_prefix(constraints,'mode:')); expected['must_drop']=['mode:one']; expected['new_hard']=['mode:max2']; expected['required_effects']=['store_mode:max2_if_worthwhile']
    elif case_id=='add_snacks': expected['required_effects']=['increase_category:snacks','preserve_budget']
    elif case_id=='relax_brand':
        brand=first_prefixed(constraints,'exclude_brand:')
        retained=without_prefix(constraints,'exclude_brand:')
        expected=edit_expected(case_id,retained); expected['must_drop']=[brand] if brand else []; expected['required_effects']=['clear_brand_exclusions']
    elif case_id=='prefer_convenience': expected['required_effects']=['preference:convenience_over_minor_savings']
    elif case_id=='decrement_pasta':
        replace_basket_item(ctx,ctx['basket'][1] if len(ctx.get('basket') or [])>1 else None,'макароны'); set_quantity(ctx,'макароны',2)
        expected['required_effects']=['decrement_product:макароны:1']
    elif case_id=='change_budget_4000':
        old=int(ctx.get('budget') or 0)
        if old==4000:
            old=4500; ctx['budget']=old
        constraints=without_prefix(constraints,'budget<=')+[f'budget<={old}']; ctx['constraints']=constraints
        retained=without_prefix(constraints,'budget<='); expected=edit_expected(case_id,retained)
        expected['must_drop']=[f'budget<={old}']; expected['new_hard']=['budget<=4000']; expected['required_effects']=['budget:4000']
    elif case_id=='replace_chicken_turkey':
        replace_basket_item(ctx,ctx['basket'][0] if ctx.get('basket') else None,'курица'); expected['required_effects']=['replace_product:курица:индейка']
    elif case_id=='same_basket_other_store':
        ctx['current_store_id']='magnit'; ctx['requested_store_id']='perekrestok'; ctx['universal_basket']=list(ctx.get('basket') or [])
        expected['required_effects']=['reproject_same_basket:perekrestok','preserve_exact_quantities']

    task['session_context']=ctx; task['expected']=expected; task['factory']['version']='2.2'
    return task


def substitute(item):
    mapping={'йогурт':'кефир','кефир':'йогурт','сыр':'творог','хлебцы':'овсянка','орехи':'сыр','яблоки':'груши','бананы':'апельсины','апельсины':'яблоки','груши':'яблоки','ягоды':'бананы','гречка':'рис','рис':'гречка','макароны':'картофель','картофель':'макароны','овсянка':'гречка','курица':'индейка','индейка':'курица','говядина':'индейка','рыба':'курица','творог':'яйца','яйца':'творог'}
    return mapping.get(item,'хлебцы' if item!='хлебцы' else 'йогурт')


def enrich_journey_group(rows):
    rows=sorted((deepcopy(x) for x in rows),key=lambda x:x['expected']['turn'])
    first=rows[0]['session_context']; state={
        'budget':first['budget'],'people':first['people'],'days':first['days'],'mode':'multi',
        'constraints':without_prefix(first.get('constraints') or [],'mode:'),'basket':list(first.get('basket') or []),
        'quantities':{x:1 for x in first.get('basket') or []},'soft_preferences':{},'previous_requests':[]
    }
    out=[]
    for task in rows:
        turn=int(task['expected']['turn']); ctx=deepcopy(state)
        expected={
            'intent_family':'edit_basket','case_id':f'journey_turn_{turn}','must_retain':list(state['constraints']),
            'must_drop':[],'new_hard':[],'required_effects':[],'preserve_unmentioned_basket':True,
            'scenario_id':task['expected']['scenario_id'],'turn':turn
        }
        if turn==1:
            fruit=next((x for x in state['basket'] if x in {'яблоки','бананы','апельсины','груши','ягоды'}),state['basket'][-1])
            expected['required_effects']=['increase_category:fruit']; state['quantities'][fruit]=state['quantities'].get(fruit,1)+1
        elif turn==2:
            expected['required_effects']=['protein_quality:higher']; state['soft_preferences']['protein_quality']='higher'
        elif turn==3:
            snack=next((x for x in state['basket'] if x in SNACKS),None)
            if snack is None:
                snack='йогурт'; state['basket'].append(snack); state['quantities'][snack]=1; ctx=deepcopy(state)
            ctx['last_focus']=snack; expected['required_effects']=[f'remove_product:{snack}']
            state['basket']=[x for x in state['basket'] if x!=snack]; state['quantities'].pop(snack,None)
        elif turn==4:
            expected['new_hard']=['mode:one']; expected['required_effects']=['store_mode:one']
            state['mode']='one'; state['constraints']=without_prefix(state['constraints'],'mode:')+['mode:one']
        elif turn==5:
            target=state['basket'][-1]; replacement=substitute(target); ctx['last_focus']=target
            expected['must_retain']=list(state['constraints']); expected['required_effects']=[f'replace_product:{target}:similar']
            state['basket'][-1]=replacement; qty=state['quantities'].pop(target,1); state['quantities'][replacement]=qty
        elif turn==6:
            expected['must_retain']=list(state['constraints']); expected['required_effects']=['price:cheaper','preserve_hard_constraints']
            state['soft_preferences']['price']='economy'
        task['session_context']=ctx; task['expected']=expected; task['factory']['version']='2.2'; out.append(task)
        state['previous_requests']=list(state['previous_requests'])+[task['user_request']]
    return out


def enrich_tasks(rows):
    edits=[]; journeys=defaultdict(list); other=[]
    for task in rows:
        if task.get('category')=='edit_fuzzy': edits.append(enrich_edit(task))
        elif task.get('category')=='multi_turn': journeys[task['expected']['scenario_id']].append(task)
        else:
            item=deepcopy(task); item['factory']['version']='2.2'; other.append(item)
    for group in journeys.values(): other.extend(enrich_journey_group(group))
    return other+edits


def validate_tasks(rows):
    seen_cases=set()
    for task in rows:
        expected=task.get('expected') or {}; retain=set(expected.get('must_retain') or []); drop=set(expected.get('must_drop') or [])
        if retain&drop: raise ValueError(f"{task['id']}: same constraint retained and dropped: {sorted(retain&drop)}")
        if task.get('category')=='edit_fuzzy':
            case=expected.get('case_id'); seen_cases.add(case); ctx=task['session_context']; basket=ctx.get('basket') or []
            if case=='remove_ham' and 'ветчина' not in basket: raise ValueError(f"{task['id']}: remove_ham lacks ham")
            if case=='restore_previous' and (not ctx.get('previous_basket') or ctx.get('previous_basket')==basket): raise ValueError(f"{task['id']}: restore_previous lacks distinct previous state")
            if case=='remove_dairy' and not any(x in DAIRY for x in basket): raise ValueError(f"{task['id']}: remove_dairy lacks dairy")
            if case=='decrement_pasta' and ('макароны' not in basket or int((ctx.get('quantities') or {}).get('макароны',0))<2): raise ValueError(f"{task['id']}: decrement_pasta lacks quantity precondition")
            if case=='replace_chicken_turkey' and ('курица' not in basket or 'индейка' in basket): raise ValueError(f"{task['id']}: chicken replacement precondition failed")
            if case=='change_budget_4000' and (ctx.get('budget')==4000 or 'budget<=4000' not in expected.get('new_hard',[])): raise ValueError(f"{task['id']}: budget change is not a change")
            if case=='relax_brand' and (not expected.get('must_drop') or any(str(x).startswith('exclude_brand:') for x in retain)): raise ValueError(f"{task['id']}: brand relaxation keeps brand exclusion")
            if case=='force_one_store' and ctx.get('mode')=='one': raise ValueError(f"{task['id']}: one-store request already one-store")
            if case=='allow_two_stores' and ctx.get('mode')!='one': raise ValueError(f"{task['id']}: two-store relaxation lacks one-store precondition")
            if case=='same_basket_other_store' and ctx.get('current_store_id')==ctx.get('requested_store_id'): raise ValueError(f"{task['id']}: store reprojection target unchanged")
        if task.get('category')=='multi_turn':
            turn=int(expected.get('turn') or 0); ctx=task['session_context']
            if len(ctx.get('previous_requests') or [])!=turn-1: raise ValueError(f"{task['id']}: multi-turn history length mismatch")
            if turn==4 and ctx.get('mode')=='one': raise ValueError(f"{task['id']}: one-store transition already applied before request")
            if turn>=5 and ctx.get('mode')!='one': raise ValueError(f"{task['id']}: prior one-store state not retained")
    if seen_cases and seen_cases!=set(CASE_BY_REQUEST.values()):
        raise ValueError(f'edit case coverage mismatch missing={sorted(set(CASE_BY_REQUEST.values())-seen_cases)} extra={sorted(seen_cases-set(CASE_BY_REQUEST.values()))}')
    return True
