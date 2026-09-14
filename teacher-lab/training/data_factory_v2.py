#!/usr/bin/env python3
import argparse, json
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
EDIT_PHRASES=['мяса сделай получше, остальное оставь как есть','убери ветчину, но бюджет и остальные условия не меняй','сделай всё из одного магазина','добавь фруктов, ничего другого не выкидывай','давай подешевле, но не трогай белок','не бери самый дешёвый вариант, качество важнее','замени последнее на похожее, остальные условия сохрани','верни прошлый вариант и оставь мой бюджет','готовить хочу по минимуму, остальное не меняй','сделай чуть полезнее без фанатизма']
CONFLICTS=['хочу подешевле, но мясо бери получше','экономь максимально, но не бери самый дешёвый вариант','всё в одном магазине, даже если чуть дороже','ПП важно, но без дорогих эко-брендов','готовить минимум, но полуфабрикатов поменьше']
JOURNEY=['добавь фруктов и ничего не убирай','теперь мясо сделай получше, остальное не трогай','убери один случайный снек','всё-таки хочу один магазин','замени последний товар на близкий аналог','чуть дешевле, но мои запреты сохрани']

def guards(): return {'forbid_fabrication':['price','availability','store','composition','quality'],'must_keep_hard_constraints':True}
def row(rid,category,request,context,expected,difficulty):
    return {'id':rid,'language':'ru','category':category,'user_request':request,'session_context':context,'guards':guards(),'expected':expected,'difficulty':difficulty,'factory':{'version':'2.0','training_allowed':False,'requires_human_review':True}}

def build_tasks():
    out=[]; n=0
    for budget in BUDGETS:
      for duration in DAYS:
        for count in PEOPLE:
          protein=PROTEINS[n%len(PROTEINS)]; fruit=FRUITS[(n*3)%len(FRUITS)]; base=BASES[(n*5)%len(BASES)]
          one=n%4==0; exclude=EXCLUDED[n%len(EXCLUDED)] if n%3==0 else None
          constraints=[f'budget<={budget}',f'people:{count}',f'days:{duration}']
          if one: constraints.append('mode:one')
          if exclude: constraints.append(f'exclude_brand:{exclude}')
          parts=[f'собери еду на {duration} дней для {count} чел. до {budget} ₽',f'основа {base}, {protein} возьми нормальный, добавь {fruit}','хочу всё в одном магазине' if one else 'можно максимум два магазина',f'бренд {exclude} не бери' if exclude else '','экономь где это не портит еду' if n%2==0 else 'не бери самый дешман']
          n+=1
          out.append(row(f'v2_build_{n:04d}','build_fuzzy',', '.join(x for x in parts if x),{'budget':None,'people':count,'days':1,'mode':'multi','constraints':[],'basket':[]},{'intent_family':'build_basket','must_retain':[],'new_hard':constraints},'hard' if n%5==0 else 'medium'))
    for i in range(480):
      budget=BUDGETS[i%len(BUDGETS)]; duration=DAYS[i%len(DAYS)]; count=PEOPLE[i%len(PEOPLE)]; exclude=EXCLUDED[i%len(EXCLUDED)]
      constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']
      if i%3==0: constraints.append('mode:one')
      if i%5==0: constraints.append('cooking:minimal')
      basket=[PROTEINS[i%len(PROTEINS)],BASES[i%len(BASES)],FRUITS[i%len(FRUITS)],SNACKS[i%len(SNACKS)]]
      out.append(row(f'v2_edit_{i+1:04d}','edit_fuzzy',EDIT_PHRASES[i%len(EDIT_PHRASES)],{'budget':budget,'people':count,'days':duration,'mode':'one' if 'mode:one' in constraints else 'multi','constraints':constraints,'basket':basket,'last_focus':basket[i%len(basket)]},{'intent_family':'edit_basket','must_retain':list(constraints)},'hard' if i%4==0 else 'medium'))
    for i in range(360):
      budget=BUDGETS[(i*3)%len(BUDGETS)]; exclude=EXCLUDED[(i*2)%len(EXCLUDED)]; constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']; basket=[PROTEINS[i%len(PROTEINS)],BASES[(i+2)%len(BASES)],FRUITS[(i+1)%len(FRUITS)],'хлеб']
      request=CONFLICTS[i%len(CONFLICTS)]+('. Бюджет и запрет бренда не меняй.' if i%2==0 else '. Сохрани все прошлые ограничения.')
      out.append(row(f'v2_conflict_{i+1:04d}','constraint_conflict',request,{'budget':budget,'people':1+i%3,'days':3+i%5,'mode':'multi','constraints':constraints,'basket':basket,'last_focus':basket[0]},{'intent_family':'edit_basket','must_retain':list(constraints)},'hard'))
    for s in range(80):
      budget=BUDGETS[s%len(BUDGETS)]; exclude=EXCLUDED[s%len(EXCLUDED)]; constraints=[f'budget<={budget}',f'exclude_brand:{exclude}']; mode='multi'; basket=['курица','гречка','яблоки','йогурт']; scenario=f'v2_journey_{s+1:03d}'
      for t,request in enumerate(JOURNEY,1):
        if t==4: mode='one'; constraints=constraints+['mode:one']
        out.append(row(f'{scenario}_t{t}','multi_turn',request,{'budget':budget,'people':1+s%2,'days':5+s%3,'mode':mode,'constraints':list(constraints),'basket':list(basket),'last_focus':basket[-1] if t==5 else None},{'intent_family':'edit_basket','must_retain':list(constraints),'scenario_id':scenario,'turn':t},'hard' if t>=4 else 'medium'))
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
    return {'schema_version':'2.0','total':len(rows),'by_category':dict(Counter(x['category'] for x in rows)),'by_difficulty':dict(Counter(x['difficulty'] for x in rows)),'training_allowed':False,'requires_human_review':True}

def balanced_pilot(rows,per_category=100):
    categories=['build_fuzzy','edit_fuzzy','constraint_conflict','multi_turn']
    selected=[]; unique=dedupe_tasks(rows)
    for category in categories:
        pool=[x for x in unique if x['category']==category]
        pool.sort(key=lambda x:(0 if x['difficulty']=='hard' else 1,x['id']))
        if len(pool)<per_category: raise RuntimeError(f'not enough {category} rows')
        selected.extend(pool[:per_category])
    if len({semantic_key(x) for x in selected})!=len(selected): raise RuntimeError('pilot contains semantic duplicates')
    return selected

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--pilot-out'); ap.add_argument('--pilot-per-category',type=int,default=100); args=ap.parse_args(); raw=build_tasks(); rows=dedupe_tasks(raw); Path(args.out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows),encoding='utf-8')
    result=stats(rows); result['raw_total']=len(raw); result['deduped_total']=len(rows)
    if args.pilot_out:
        pilot=balanced_pilot(rows,args.pilot_per_category); Path(args.pilot_out).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in pilot),encoding='utf-8'); result['pilot_total']=len(pilot); result['pilot_by_category']=dict(Counter(x['category'] for x in pilot))
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
