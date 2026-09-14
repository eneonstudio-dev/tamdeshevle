#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path

BUDGETS=[2500,3000,3500,4000,4500,5000,6000,7000]
DAYS=[3,5,7,10]
PEOPLE=[1,2,3,4]
PROTEINS=['курица','индейка','говядина','рыба','творог','яйца']
FRUITS=['яблоки','бананы','апельсины','груши','ягоды']
BASES=['гречка','рис','макароны','картофель','овсянка']
SNACKS=['йогурт','орехи','хлебцы','сыр','кефир']
EXCLUDED=['Мираторг','Самокат','ВкусВилл']
EDIT_PHRASES=[
    'мяса сделай получше, остальное оставь как есть',
    'убери ветчину, но бюджет и остальные условия не меняй',
    'сделай всё из одного магазина',
    'добавь фруктов, ничего другого не выкидывай',
    'давай подешевле, но не трогай белок',
    'не бери самый дешёвый вариант, качество важнее',
    'замени последнее на похожее, остальные условия сохрани',
    'верни прошлый вариант и оставь мой бюджет',
    'готовить хочу по минимуму, остальное не меняй',
    'сделай чуть полезнее без фанатизма',
    'белок оставь нормальным, а на остальном сэкономь',
    'убери молочку, остальную корзину не меняй',
    'можно два магазина, если так заметно выгоднее',
    'добавь перекусов, но бюджет не расширяй',
    'бренды больше не важны, остальные запреты оставь',
    'сделай быстрее по покупке, цена не главное',
    'уменьши количество макарон на одну пачку',
    'бюджет теперь 4000, больше ничего не меняй',
    'замени курицу на индейку, остальное сохрани',
    'собери ту же корзину в другом магазине без пересборки состава',
]
CONFLICTS=[
    'хочу подешевле, но мясо бери получше',
    'экономь максимально, но не бери самый дешёвый вариант',
    'всё в одном магазине, даже если чуть дороже',
    'ПП важно, но без дорогих эко-брендов',
    'готовить минимум, но полуфабрикатов поменьше',
    'хочу быстрее, но не переплачивай сильно',
    'качество важнее, но в бюджет всё равно уложись',
    'можно два магазина, только если экономия заметная',
    'полезнее, но привычные продукты сильно не меняй',
    'без сахара, но не превращай корзину в дорогой эко-набор',
]
JOURNEY_VARIANTS=[
    ['добавь фруктов и ничего не убирай','фруктов маловато — добавь, остальное оставь','добавь ещё фруктов, корзину не сокращай','побольше фруктов, но ничего не удаляй'],
    ['теперь мясо сделай получше, остальное не трогай','белок возьми классом выше, остальное оставь','на мясе не экономь, другие товары не меняй','мясо улучши, а всю остальную корзину сохрани'],
    ['убери один случайный снек','убери один перекус и больше ничего','сократи снеки на одну позицию','один снек лишний — убери только его'],
    ['всё-таки хочу один магазин','давай всё из одного магазина','не хочу ездить по магазинам — оставь один','пересобери план на один магазин'],
    ['замени последний товар на близкий аналог','последний товар замени на похожий','подбери аналог последней позиции, остальное сохрани','замени только последнюю позицию на эквивалент'],
    ['чуть дешевле, но мои запреты сохрани','немного сэкономь, ограничения не снимай','сделай дешевле без нарушения моих запретов','ужми цену, но все жёсткие условия оставь'],
]


def guards():
    return {'forbid_fabrication':['price','availability','store','composition','quality'],'must_keep_hard_constraints':True}


def row(rid,category,request,context,expected,difficulty):
    return {
        'id':rid,'language':'ru','category':category,'user_request':request,
        'session_context':context,'guards':guards(),'expected':expected,'difficulty':difficulty,
        'factory':{'version':'2.1','training_allowed':False,'requires_human_review':True}
    }


def build_tasks():
    out=[]; n=0
    for budget in BUDGETS:
        for duration in DAYS:
            for count in PEOPLE:
                protein=PROTEINS[(n*5+n//7)%len(PROTEINS)]
                fruit=FRUITS[(n*3+n//4)%len(FRUITS)]
                base=BASES[(n*2+n//3)%len(BASES)]
                one=(n+n//4)%4==0
                exclude=EXCLUDED[(n+n//5)%len(EXCLUDED)] if (n+n//4)%3==0 else None
                constraints=[f'budget<={budget}',f'people:{count}',f'days:{duration}']
                if one: constraints.append('mode:one')
                if exclude: constraints.append(f'exclude_brand:{exclude}')
                parts=[
                    f'собери еду на {duration} дней для {count} чел. до {budget} ₽',
                    f'основа {base}, {protein} возьми нормальный, добавь {fruit}',
                    'хочу всё в одном магазине' if one else 'можно максимум два магазина',
                    f'бренд {exclude} не бери' if exclude else '',
                    'экономь где это не портит еду' if (n+n//2)%2==0 else 'не бери самый дешман',
                ]
                out.append(row(
                    f'v2_build_{n+1:04d}','build_fuzzy',', '.join(x for x in parts if x),
                    {'budget':None,'people':count,'days':1,'mode':'multi','constraints':[],'basket':[]},
                    {'intent_family':'build_basket','must_retain':[],'new_hard':constraints},
                    'hard' if (n*3+n//4)%5==0 else 'medium'
                ))
                n+=1

    for i in range(480):
        budget=BUDGETS[(i*3+i//11)%len(BUDGETS)]
        duration=DAYS[(i*3+i//7)%len(DAYS)]
        count=PEOPLE[(i+i//9)%len(PEOPLE)]
        exclude=EXCLUDED[(i*2+i//5)%len(EXCLUDED)]
        constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']
        one=(i*3+i//7)%4==0
        if one: constraints.append('mode:one')
        if (i*2+i//11)%5==0: constraints.append('cooking:minimal')
        basket=[
            PROTEINS[(i*5+i//4)%len(PROTEINS)],
            BASES[(i*2+i//3)%len(BASES)],
            FRUITS[(i*3+i//7)%len(FRUITS)],
            SNACKS[(i*4+i//11)%len(SNACKS)],
        ]
        out.append(row(
            f'v2_edit_{i+1:04d}','edit_fuzzy',EDIT_PHRASES[(i*7+i//13)%len(EDIT_PHRASES)],
            {'budget':budget,'people':count,'days':duration,'mode':'one' if one else 'multi','constraints':constraints,'basket':basket,'last_focus':basket[(i+i//5)%len(basket)]},
            {'intent_family':'edit_basket','must_retain':list(constraints)},
            'hard' if (i*3+i//7)%4==0 else 'medium'
        ))

    for i in range(360):
        budget=BUDGETS[(i*3+i//7)%len(BUDGETS)]
        exclude=EXCLUDED[(i*2+i//5)%len(EXCLUDED)]
        constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']
        basket=[
            PROTEINS[(i*5+i//4)%len(PROTEINS)],
            BASES[(i*2+i//3)%len(BASES)],
            FRUITS[(i*3+i//7)%len(FRUITS)],
            'хлеб',
        ]
        request=CONFLICTS[(i*7+i//13)%len(CONFLICTS)]+('. Бюджет и запрет бренда не меняй.' if (i+i//5)%2==0 else '. Сохрани все прошлые ограничения.')
        out.append(row(
            f'v2_conflict_{i+1:04d}','constraint_conflict',request,
            {'budget':budget,'people':PEOPLE[(i+i//7)%len(PEOPLE)],'days':DAYS[(i*3+i//11)%len(DAYS)],'mode':'multi','constraints':constraints,'basket':basket,'last_focus':basket[0]},
            {'intent_family':'edit_basket','must_retain':list(constraints)},'hard'
        ))

    for s in range(80):
        budget=BUDGETS[(s*3+s//7)%len(BUDGETS)]
        exclude=EXCLUDED[(s*2+s//5)%len(EXCLUDED)]
        constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']
        mode='multi'
        basket=[
            PROTEINS[(s*5+s//4)%len(PROTEINS)],
            BASES[(s*2+s//3)%len(BASES)],
            FRUITS[(s*3+s//7)%len(FRUITS)],
            SNACKS[(s*4+s//11)%len(SNACKS)],
        ]
        scenario=f'v2_journey_{s+1:03d}'
        for t in range(1,7):
            request=JOURNEY_VARIANTS[t-1][(s+t)%len(JOURNEY_VARIANTS[t-1])]
            if t==4:
                mode='one'
                constraints=constraints+['mode:one']
            out.append(row(
                f'{scenario}_t{t}','multi_turn',request,
                {'budget':budget,'people':PEOPLE[(s+s//7)%len(PEOPLE)],'days':DAYS[(s*3+s//11)%len(DAYS)],'mode':mode,'constraints':list(constraints),'basket':list(basket),'last_focus':basket[-1] if t==5 else None},
                {'intent_family':'edit_basket','must_retain':list(constraints),'scenario_id':scenario,'turn':t},
                'hard' if t>=4 else 'medium'
            ))

    ids=[x['id'] for x in out]
    if len(ids)!=len(set(ids)): raise RuntimeError('duplicate task ids')
    return out


def semantic_key(item):
    expected=dict(item.get('expected') or {})
    expected.pop('scenario_id',None); expected.pop('turn',None)
    payload={'category':item.get('category'),'user_request':item.get('user_request'),'session_context':item.get('session_context') or {},'guards':item.get('guards') or {},'expected':expected}
    return json.dumps(payload,ensure_ascii=False,sort_keys=True,separators=(',',':'))


def dedupe_tasks(rows):
    seen=set(); unique=[]
    for item in rows:
        key=semantic_key(item)
        if key in seen: continue
        seen.add(key); unique.append(item)
    return unique


def stats(rows):
    return {
        'schema_version':'2.1','total':len(rows),
        'by_category':dict(Counter(x['category'] for x in rows)),
        'by_difficulty':dict(Counter(x['difficulty'] for x in rows)),
        'training_allowed':False,'requires_human_review':True
    }


def constraint(item,prefix):
    values=(item.get('expected') or {}).get('new_hard') or (item.get('expected') or {}).get('must_retain') or []
    return next((x for x in values if str(x).startswith(prefix)),None)


def balanced_select(pool,count,features):
    remaining=list(pool); selected=[]; counts=[Counter() for _ in features]
    if len(remaining)<count: raise RuntimeError(f'not enough rows: {len(remaining)} < {count}')
    while len(selected)<count:
        def score(item):
            balance=sum(counts[i][fn(item)] for i,fn in enumerate(features))
            difficulty=0 if item.get('difficulty')=='hard' else 1
            return balance,difficulty,item['id']
        chosen=min(remaining,key=score)
        remaining.remove(chosen); selected.append(chosen)
        for i,fn in enumerate(features): counts[i][fn(chosen)]+=1
    return selected


def balanced_pilot(rows,per_category=100):
    unique=dedupe_tasks(rows)
    pools={category:[x for x in unique if x['category']==category] for category in ['build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn']}
    selected=[]
    selected.extend(balanced_select(pools['build_fuzzy'],per_category,[lambda x:constraint(x,'budget<='),lambda x:constraint(x,'days:'),lambda x:constraint(x,'people:')]))
    selected.extend(balanced_select(pools['edit_fuzzy'],per_category,[lambda x:x['user_request'],lambda x:x['session_context']['budget'],lambda x:x['session_context']['days'],lambda x:x['session_context']['people']]))
    selected.extend(balanced_select(pools['constraint_conflict'],per_category,[lambda x:x['user_request'],lambda x:x['session_context']['budget'],lambda x:x['session_context']['days'],lambda x:x['session_context']['people']]))
    selected.extend(balanced_select(pools['multi_turn'],per_category,[lambda x:x['expected']['turn'],lambda x:x['session_context']['budget'],lambda x:x['session_context']['days'],lambda x:x['session_context']['people']]))
    if len({semantic_key(x) for x in selected})!=len(selected): raise RuntimeError('pilot contains semantic duplicates')
    return selected


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--pilot-out'); ap.add_argument('--pilot-per-category',type=int,default=100); args=ap.parse_args()
    raw=build_tasks(); rows=dedupe_tasks(raw)
    Path(args.out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')
    result=stats(rows); result['raw_total']=len(raw); result['deduped_total']=len(rows)
    if args.pilot_out:
        pilot=balanced_pilot(rows,args.pilot_per_category)
        Path(args.pilot_out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in pilot),encoding='utf-8')
        result['pilot_total']=len(pilot); result['pilot_by_category']=dict(Counter(x['category'] for x in pilot))
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=='__main__': main()
