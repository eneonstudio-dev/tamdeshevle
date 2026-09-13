const budgets=[2500,3500,5000,7000];
const days=[3,5,7];
const buildPhrases=[
  'собери нормально поесть','собери еды без лишнего','хочу нормальную корзину','подбери еду без фанатизма','собери разумно и без переплаты',
  'не самое дешёвое но без переплаты','мясо хорошее на остальном экономь','хочу ПП но без фанатизма','сделай еду попроще но нормальную','собери с минимумом готовки',
  'хочу побольше фруктов и обычную еду','перекусов немного и нормальные основные продукты','экономь где это не портит еду','не бери самый дешман','собери спокойно без лишних магазинов',
  'хочу нормально питаться и не разориться','основу подешевле а белок получше','без бессмысленных дорогих брендов','собери на каждый день без изысков','еда должна быть простая но не унылая',
  'хочу больше свежего и меньше случайных снеков','собери рацион где цена важна но не любой ценой','поменьше готовки побольше готовой базы','собери сбалансированно по бытовому','сам реши что взять но не раздувай бюджет'
];
const editPhrases=[
  'фруктов побольше','ещё фруктов','мяса маловато','мяса хочу получше','давай дешевле','не настолько дешево','не бери самый дешёвый вариант','убери эту фигню','мне это не нравится','верни как было',
  'хочу всё в одном магазине','не хочу таскаться по двум','замени ветчину чем-нибудь похожим','замени это на что-нибудь получше','дай ПП вариант','другой бренд','слишком дорого','сделай пожёстче','добавь перекусов','остальное подешевле'
];
const contextVariants=[
  {budget:5000,people:1,days:7,mode:'multi',constraints:['budget<=5000','exclude_brand:Мираторг'],basket:['chicken','ham','apple','bread']},
  {budget:3500,people:1,days:5,mode:'multi',constraints:['budget<=3500'],basket:['eggs','pasta','banana','milk']},
  {budget:7000,people:2,days:7,mode:'multi',constraints:['budget<=7000','exclude_brand:Мираторг'],basket:['chicken','buck','apple','water']},
  {budget:4500,people:1,days:7,mode:'one',constraints:['budget<=4500','mode:one'],basket:['eggs','bread','banana','cottage']},
  {budget:6000,people:3,days:5,mode:'multi',constraints:['budget<=6000','exclude_tag:dairy'],basket:['chicken','pasta','apple','water']},
  {budget:3000,people:1,days:3,mode:'multi',constraints:['budget<=3000','cooking:minimal'],basket:['dumplings','banana','bread','water']}
];

const clone=v=>JSON.parse(JSON.stringify(v));
const baseGuards=()=>({forbid_fabrication:['price','availability','store','composition','quality'],must_keep_hard_constraints:true});
function task(id,category,user_request,session_context,extra={}){
  return {id,language:'ru',category,user_request,session_context:clone(session_context),guards:{...baseGuards(),...(extra.guards||{})},...extra};
}

export function buildSingleTurnCorpus(){
  const out=[];let n=0;
  for(const phrase of buildPhrases)for(const budget of budgets)for(const duration of days){
    const ctx={budget:null,people:1,days:1,mode:'multi',constraints:[],basket:[]};
    const suffix=` до ${budget} ₽ на ${duration} дней`;
    out.push(task(`build_${String(++n).padStart(3,'0')}`,'build_fuzzy',phrase+suffix,ctx,{expected:{intent_family:'build_basket',new_hard:[`budget<=${budget}`],duration}}));
  }
  let e=0;
  for(const phrase of editPhrases)for(const ctx of contextVariants){
    out.push(task(`edit_${String(++e).padStart(3,'0')}`,'edit_fuzzy',phrase,ctx,{expected:{intent_family:'edit_basket',must_retain:[...ctx.constraints]}}));
  }
  return out;
}

const turnText=[
  ['Собери еды на неделю до 5000 ₽ без Мираторга мясо нормальное остальное подешевле','Собери на неделю до 5000 без Мираторга мясо не дешман остальное экономно','Еда на неделю до пяти тысяч Мираторг не надо мясо норм остальное дешевле'],
  ['Добавь фруктов','Фруктов ещё докинь','Фруктов маловато добавь'],
  ['Мяса хочу получше','Мясо давай классом выше','На мясе не экономь так сильно'],
  ['Убери ветчину','Ветчину убери','Без ветчины давай'],
  ['Замени чем-нибудь похожим','Подбери вместо неё что-то похожее','Замени на близкий вариант'],
  ['Хочу всё из одного магазина','Собери всё в одном месте','Не хочу таскаться по двум магазинам'],
  ['Не настолько дешево','Чуть получше можно','Экономить ок но не до крайности']
];

export function buildMultiTurnCorpus(){
  const out=[];
  for(let s=0;s<20;s++){
    const budget=[5000,4500,6000,3500][s%4];
    const people=[1,1,2,3][s%4];
    const duration=[7,5,7,3][s%4];
    let constraints=[];
    let basket=['ham','chicken','bread','apple'];
    const scenario=`journey_${String(s+1).padStart(2,'0')}`;
    for(let t=0;t<7;t++){
      if(t===1)constraints=[`budget<=${budget}`,'exclude_brand:Мираторг'];
      if(t===5)constraints=[...constraints,'mode:one'];
      const ctx={budget:t?budget:null,people,days:t?duration:1,mode:t>=5?'one':'multi',constraints:[...constraints],basket:[...basket],last_focus:t===4?'ham':null};
      const text=t===0?turnText[0][s%turnText[0].length].replace(/5000/g,String(budget)):turnText[t][s%turnText[t].length];
      out.push(task(`${scenario}_t${t+1}`,'multi_turn',text,ctx,{scenario_id:scenario,turn:t+1,expected:{intent_family:t===0?'build_basket':'edit_basket',must_retain:[...constraints]}}));
      if(t===3)basket=basket.filter(x=>x!=='ham');
    }
  }
  return out;
}

export function buildCorpus(){
  const all=[...buildSingleTurnCorpus(),...buildMultiTurnCorpus()];
  const ids=new Set();
  return all.filter(row=>{if(ids.has(row.id))return false;ids.add(row.id);return true});
}

export function corpusStats(rows=buildCorpus()){
  const byCategory={};for(const row of rows)byCategory[row.category]=(byCategory[row.category]||0)+1;
  return {total:rows.length,by_category:byCategory,multi_turn_scenarios:new Set(rows.filter(x=>x.scenario_id).map(x=>x.scenario_id)).size};
}
