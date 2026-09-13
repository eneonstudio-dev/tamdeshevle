(()=>{
  "use strict";
  if(window.TDBaiShoppingAgentKernel)return;

  const KEY="td:bai-shopping-session:v2",VERSION=2,MAX_HISTORY=40;
  const ACTIONS=new Set(["add_item","remove_item","replace_item","change_quantity","set_constraint","rebuild_basket","compare_stores","optimize_basket","explain_choice","prepare_purchase"]);
  const MUTATING=new Set(["add_item","remove_item","replace_item","change_quantity","set_constraint","rebuild_basket","optimize_basket"]);
  const CONSTRAINTS=new Set(["budget","people_count","duration_days","cooking","healthy","excluded_brand","excluded_product","required_category","store_mode","store_limit","store_ids","delivery_mode","delivery_deadline","delivery_max_fee","existing_product","preference","only_products","intent","user_note"]);
  const LEGACY={bread:"bread_dark",chicken:"chicken_fil",oil:"oil_sunflower",eggs:"eggs_c1",buck:"buckwheat",sour:"smetana"};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const now=()=>new Date().toISOString();
  const empty=()=>({version:VERSION,id:`shopping_${Date.now()}`,intent:"shopping",constraints:{people_count:1,duration_days:1,cooking:"normal",healthy:false,excluded_products:[],excluded_brands:[],required_categories:[],existing_products:[]},preferences:[],basket:{items:[],total:0,currency:"RUB",quality:"UNKNOWN"},store_constraints:{mode:"multi",limit:null,store_ids:[]},delivery_constraints:{mode:"any",deadline:null,max_fee:null},budget:null,history:[],updated_at:now()});

  function normalize(raw){
    const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{},base=empty(),s={...base,...source};
    s.constraints={...base.constraints,...(source.constraints||{})};s.store_constraints={...base.store_constraints,...(source.store_constraints||{})};s.delivery_constraints={...base.delivery_constraints,...(source.delivery_constraints||{})};s.basket={...base.basket,...(source.basket||{})};
    s.preferences=uniq(Array.isArray(s.preferences)?s.preferences.map(String):[]).slice(0,40);s.history=Array.isArray(s.history)?s.history.slice(-MAX_HISTORY):[];s.basket.items=Array.isArray(s.basket.items)?s.basket.items:[];
    for(const key of ["excluded_products","excluded_brands","required_categories","existing_products"])s.constraints[key]=uniq(Array.isArray(s.constraints[key])?s.constraints[key].map(String):[]).slice(0,80);
    s.store_constraints.store_ids=uniq(Array.isArray(s.store_constraints.store_ids)?s.store_constraints.store_ids.map(String):[]).slice(0,12);
    s.budget=s.budget==null?null:Math.max(0,Number(s.budget)||0);s.updated_at=String(s.updated_at||now());return s;
  }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return empty()}}
  let session=load();
  function save(next=session){session=normalize(next);session.updated_at=now();try{localStorage.setItem(KEY,JSON.stringify(session))}catch{}return snapshot()}
  function snapshot(){return clone(session)}
  function reset(){session=empty();try{localStorage.removeItem(KEY)}catch{}return save(session)}
  function catalog(){try{return window.TDStoreAdapters?.catalog?.()||[]}catch{return[]}}
  function product(id){const value=String(id||""),wanted=LEGACY[value]||value;return catalog().find(x=>String(x.id)===wanted)||catalog().find(x=>String(x.id)===value)||null}
  function productId(id){return product(id)?.id||String(id||"")}
  function legacy(){return window.TDShoppingState?.get?.()||null}
  function itemMap(items){return new Map((items||[]).map(x=>[String(x?.id||""),x]))}
  function hash(value){const text=JSON.stringify(value),parts=[...text].reduce((a,c,i)=>{a[i%4]=(a[i%4]*33+c.charCodeAt(0))>>>0;return a},[5381,52711,31,7]);return parts.map(x=>x.toString(16).padStart(8,"0")).join("")}

  function syncFromLegacy(input=legacy(),preserve=session){
    if(!input)return snapshot();const next=normalize(preserve),plan=input.lastPlans?.[0],items=(input.products||[]).map(line=>({id:String(line.id),name:String(line.name||product(line.id)?.name||line.id),brand:String(line.brand||""),quantity:Number(line.quantity)||0,store_id:String(line.storeId||""),unit_price:Number.isFinite(Number(line.unitPrice??line.price))?Number(line.unitPrice??line.price):null,line_total:Number.isFinite(Number(line.price))?Number(line.price)*(Number(line.quantity)||0):null,quality:String(line.quality||"UNKNOWN")}));
    next.intent=String(input.intent||next.intent||"shopping");next.budget=input.budget==null?next.budget:Math.max(0,Number(input.budget)||0);next.preferences=uniq([...(next.preferences||[]),...(input.preferences||[]).map(String)]);
    next.constraints={...next.constraints,people_count:Math.max(1,Number(input.peopleCount)||1),duration_days:Math.max(1,Number(input.duration)||1),cooking:String(input.cookingPreference||next.constraints.cooking||"normal"),excluded_products:uniq([...(next.constraints.excluded_products||[]),...(input.excludedProducts||[]).map(String)]),excluded_brands:uniq([...(next.constraints.excluded_brands||[]),...(input.excludedBrands||[]).map(String)]),existing_products:uniq([...(next.constraints.existing_products||[]),...(input.existingProducts||[]).map(String)])};
    next.store_constraints={...next.store_constraints,mode:input.mode==="one"?"one":"multi",limit:input.mode==="one"?1:next.store_constraints.limit,store_ids:uniq((input.stores||[]).map(String))};next.delivery_constraints={...next.delivery_constraints,mode:String(input.deliveryPreference||next.delivery_constraints.mode||"any")};
    next.basket={items,total:Number(plan?.total??input.currentTotal)||0,currency:"RUB",quality:String(plan?.quality||items.reduce((q,x)=>q==="UNKNOWN"?q:x.quality,"UNKNOWN"))};return save(next);
  }

  const INJECTION=/(?:забудь|игнорируй|отмени)\s+(?:все\s+)?(?:инструкц|ограничен|правил)|system\s*prompt|developer\s*message|раскрой\s+(?:промпт|инструкц)/i;
  const NON_SHOP=/(?:напиши|сделай|создай|сгенерируй|разработай|почини)\s+(?:(?:мне|нам)\s+)?(?:сайт|приложение|код|скрипт|программ|функци|класс|бота)|\b(?:react|python|javascript|typescript|html|css|sql)\b/i;
  const SHOP_ACTION=/(?:собер|куп|товар|цен|магазин|корзин|достав|самовывоз|заказ|дешев|бюджет|добав|убер|удал|замен|количеств|сравн|выбер|подбер|посовет|оптимиз|покуп|бренд)/i;
  const SHOP_PRODUCT=/(?:ноутбук|телефон|смартфон|наушник|телевизор|холодильник|продукт|ед[ау]|молок|хлеб|мяс|куриц|ветчин|фрукт|овощ|вода|одежд|обув|косметик|мебел|инструмент|лекарств)/i;
  function domainGate(text){const t=low(text);if(!t)return{allowed:false,code:"OUT_OF_SCOPE",reason:"empty"};if(INJECTION.test(t))return{allowed:false,code:"OUT_OF_SCOPE",reason:"prompt_injection"};if(NON_SHOP.test(t))return{allowed:false,code:"OUT_OF_SCOPE",reason:"non_shopping_task"};if(SHOP_ACTION.test(t)&&(SHOP_PRODUCT.test(t)||/(?:корзин|магазин|цен|достав|заказ|покуп)/.test(t)))return{allowed:true,code:"ALLOWED",reason:"shopping_intent"};if(SHOP_PRODUCT.test(t)&&/(?:посовет|выбер|подбер|сравн|куп)/.test(t))return{allowed:true,code:"ALLOWED",reason:"product_advice"};if(session.basket.items.length&&/(?:сделай\s+дешевле|верни|отмени|ещ[её]|это|его|е[её]|так|остав)/.test(t))return{allowed:true,code:"ALLOWED",reason:"shopping_follow_up"};return{allowed:false,code:"OUT_OF_SCOPE",reason:"no_shopping_intent"}}

  function action(type,payload={},meta={}){return{type:String(type||""),payload:payload&&typeof payload==="object"&&!Array.isArray(payload)?clone(payload):{},meta:{source:String(meta.source||"parser"),confidence:Math.max(0,Math.min(1,Number(meta.confidence)||0))}}}
  function legacyToActions(operations=[]){const out=[];for(const op of Array.isArray(operations)?operations:[]){const v=op?.value;switch(op?.type){
    case"ADD_PRODUCT":case"REQUIRE":out.push(action("add_item",{product_id:productId(v),required:op.type==="REQUIRE"}));break;
    case"REMOVE_PRODUCT":out.push(action("remove_item",{product_id:productId(v)}));break;
    case"REPLACE_PRODUCT":out.push(action("replace_item",{from_product_id:productId(v?.from),to_product_id:productId(v?.to)}));break;
    case"CHANGE_QUANTITY":out.push(action("change_quantity",{product_id:productId(v?.id),quantity:v?.quantity,delta:v?.delta}));break;
    case"SET_PRODUCT_AMOUNT":out.push(action("change_quantity",{product_id:productId(v?.id),amount:v?.amount,unit:v?.unit}));break;
    case"CHANGE_BUDGET":out.push(action("set_constraint",{key:"budget",value:v}));break;
    case"SET_PEOPLE":out.push(action("set_constraint",{key:"people_count",value:v}));break;
    case"SET_DURATION":out.push(action("set_constraint",{key:"duration_days",value:v}));break;
    case"SET_COOKING":out.push(action("set_constraint",{key:"cooking",value:v}));break;
    case"ADD_PREFERENCE":case"PREFER":out.push(action("set_constraint",{key:"preference",value:v}));break;
    case"EXCLUDE_BRAND":out.push(action("set_constraint",{key:"excluded_brand",value:v}));break;
    case"EXCLUDE_TAG":out.push(action("set_constraint",{key:"excluded_product",value:v,kind:"tag"}));break;
    case"CHANGE_STORE":out.push(action("set_constraint",{key:"store_ids",value:[v]}));break;
    case"SET_MODE":out.push(action("set_constraint",{key:"store_mode",value:v}));out.push(action("set_constraint",{key:"store_limit",value:v==="one"?1:null}));break;
    case"HAS_AT_HOME":out.push(action("set_constraint",{key:"existing_product",value:v}));break;
    case"SET_ONLY_PRODUCTS":out.push(action("set_constraint",{key:"only_products",value:(Array.isArray(v)?v:[v]).map(productId)}));break;
    case"SET_INTENT":out.push(action("set_constraint",{key:"intent",value:v}));break;
    case"NOTE":out.push(action("set_constraint",{key:"user_note",value:v}));break;
    case"RESET_BASKET":out.push(action("rebuild_basket",{reset:true}));break;
    case"REOPTIMIZE":out.push(action("optimize_basket"));break;
    case"CLEAR_ONLY":out.push(action("set_constraint",{key:"only_products",value:[]}));break;
    case"ASK_CLARIFICATION":return{ok:false,error:{code:"NEEDS_CLARIFICATION",message:String(v||"Нужно уточнение"),recoverable:true},actions:[]};
    case"UNDO":return{ok:false,error:{code:"UNSUPPORTED_ACTION",message:"Undo выполняется локальным безопасным механизмом, не AI.",recoverable:true},actions:[]};
    default:return{ok:false,error:{code:"ACTION_NOT_ALLOWLISTED",message:`Недопустимая операция: ${String(op?.type||"unknown")}`,recoverable:false},actions:[]};
  }}return{ok:true,actions:dedupe(out)}}
  function dedupe(actions){const seen=new Set();return actions.filter(x=>{const key=`${x.type}:${JSON.stringify(x.payload)}`;if(seen.has(key))return false;seen.add(key);return true})}
  function inferAction(text){const t=low(text);if(/сравн.*(?:магаз|вариант)/.test(t))return[action("compare_stores")];if(/объясни|почему\s+(?:это|так|выбрал)/.test(t))return[action("explain_choice")];if(/оформ|подготов.*(?:покуп|заказ)|купить\s+(?:здесь|это)/.test(t))return[action("prepare_purchase")];if(/оптимиз|сделай\s+дешевле|пересчитай/.test(t))return[action("optimize_basket")];return[]}
  function propose(text,operations){const mapped=legacyToActions(operations);if(!mapped.ok)return mapped;const actions=mapped.actions.length?mapped.actions:inferAction(text);return actions.length?{ok:true,actions}:{ok:false,error:{code:"NO_ACTION",message:"Не удалось получить исполняемое shopping-действие.",recoverable:true},actions:[]}}

  function validateAction(raw,current=legacy()){
    const a=raw&&typeof raw==="object"?raw:null;if(!a||!ACTIONS.has(a.type))return{ok:false,error:{code:"ACTION_NOT_ALLOWLISTED",recoverable:false}};const p=a.payload||{},items=itemMap(current?.products||[]);
    if(["add_item","remove_item","change_quantity"].includes(a.type)){const id=productId(p.product_id);if(!id||(!product(id)&&!items.has(id)))return{ok:false,error:{code:"UNKNOWN_PRODUCT",product_id:id,recoverable:true}};p.product_id=id}
    if(a.type==="remove_item"&&!items.has(p.product_id))return{ok:false,error:{code:"ITEM_NOT_IN_BASKET",product_id:p.product_id,recoverable:true}};
    if(a.type==="replace_item"){p.from_product_id=productId(p.from_product_id);p.to_product_id=productId(p.to_product_id);if(!items.has(p.from_product_id))return{ok:false,error:{code:"ITEM_NOT_IN_BASKET",product_id:p.from_product_id,recoverable:true}};if(!product(p.to_product_id)||p.from_product_id===p.to_product_id)return{ok:false,error:{code:"INVALID_REPLACEMENT",recoverable:true}}}
    if(a.type==="change_quantity"){const absolute=Number(p.quantity),delta=Number(p.delta),amount=Number(p.amount);if(!Number.isFinite(absolute)&&!Number.isFinite(delta)&&!Number.isFinite(amount))return{ok:false,error:{code:"INVALID_QUANTITY",recoverable:true}};if(Number.isFinite(absolute)&&(absolute<0||absolute>99))return{ok:false,error:{code:"INVALID_QUANTITY",recoverable:true}}}
    if(a.type==="set_constraint"){
      const key=String(p.key);if(!CONSTRAINTS.has(key))return{ok:false,error:{code:"INVALID_CONSTRAINT",key,recoverable:true}};
      if(key==="budget"&&(!Number.isFinite(Number(p.value))||Number(p.value)<1||Number(p.value)>10000000))return{ok:false,error:{code:"INVALID_BUDGET",recoverable:true}};
      if(["people_count","duration_days","store_limit"].includes(key)&&p.value!=null&&(!Number.isInteger(Number(p.value))||Number(p.value)<1||Number(p.value)>365))return{ok:false,error:{code:"INVALID_CONSTRAINT_VALUE",key,recoverable:true}};
      if(key==="store_mode"&&!['one','multi'].includes(String(p.value)))return{ok:false,error:{code:"INVALID_STORE_MODE",recoverable:true}};
      if(key==="store_ids"){const known=new Set((typeof STORES!=="undefined"?STORES:[]).map(x=>String(x.id)));if(!Array.isArray(p.value)||!p.value.length||p.value.some(x=>!/^[a-z0-9_-]{1,64}$/.test(String(x))||(known.size&&!known.has(String(x)))))return{ok:false,error:{code:"INVALID_STORE_IDS",recoverable:true}}}
      if(key==="delivery_max_fee"&&p.value!=null&&(!Number.isFinite(Number(p.value))||Number(p.value)<0))return{ok:false,error:{code:"INVALID_DELIVERY_CONSTRAINT",recoverable:true}};
      if(key==="only_products"&&(!Array.isArray(p.value)||p.value.some(x=>!product(x))))return{ok:false,error:{code:"UNKNOWN_PRODUCT",recoverable:true}};
      if(["excluded_brand","excluded_product","required_category","existing_product","preference","intent","user_note"].includes(key)&&!String(p.value||"").trim())return{ok:false,error:{code:"EMPTY_CONSTRAINT",key,recoverable:true}};
    }
    if(a.type==="prepare_purchase"&&!(current?.products||[]).length)return{ok:false,error:{code:"EMPTY_BASKET",recoverable:true}};
    return{ok:true,action:action(a.type,p,a.meta)};
  }
  function toLegacy(a){const p=a.payload||{};switch(a.type){
    case"add_item":return{type:p.required?"REQUIRE":"ADD_PRODUCT",value:p.product_id};case"remove_item":return{type:"REMOVE_PRODUCT",value:p.product_id};case"replace_item":return{type:"REPLACE_PRODUCT",value:{from:p.from_product_id,to:p.to_product_id}};
    case"change_quantity":return p.amount!=null?{type:"SET_PRODUCT_AMOUNT",value:{id:p.product_id,amount:Number(p.amount),unit:String(p.unit||"pack")}}:{type:"CHANGE_QUANTITY",value:{id:p.product_id,...(p.quantity==null?{}:{quantity:Number(p.quantity)}),...(p.delta==null?{}:{delta:Number(p.delta)})}};
    case"rebuild_basket":return p.reset?{type:"RESET_BASKET"}:{type:"REOPTIMIZE"};case"optimize_basket":return{type:"REOPTIMIZE"};
    case"set_constraint":{const map={budget:"CHANGE_BUDGET",people_count:"SET_PEOPLE",duration_days:"SET_DURATION",cooking:"SET_COOKING",preference:"ADD_PREFERENCE",excluded_brand:"EXCLUDE_BRAND",excluded_product:p.kind==="tag"?"EXCLUDE_TAG":"REMOVE_PRODUCT",store_ids:"CHANGE_STORE",store_mode:"SET_MODE",existing_product:"HAS_AT_HOME",only_products:"SET_ONLY_PRODUCTS",intent:"SET_INTENT",user_note:"NOTE"};if(p.key==="store_limit")return p.value===1?{type:"SET_MODE",value:"one"}:{type:"SET_MODE",value:"multi"};if(p.key==="healthy")return{type:"ADD_PREFERENCE",value:p.value?"healthy":""};if(p.key==="required_category")return{type:"PREFER",value:p.value};if(/^delivery_/.test(p.key))return{type:"NOTE",value:`${p.key}:${String(p.value)}`};const type=map[p.key];return type?{type,value:p.key==="store_ids"?(Array.isArray(p.value)?p.value[0]:p.value):p.value}:null}
    default:return null;
  }}

  function projectSession(base,actions){const next=normalize(base);for(const a of actions){if(a.type!=="set_constraint")continue;const p=a.payload||{},key=p.key,value=p.value;if(key==="budget")next.budget=Number(value);if(key==="people_count")next.constraints.people_count=Number(value);if(key==="duration_days")next.constraints.duration_days=Number(value);if(key==="cooking")next.constraints.cooking=String(value);if(key==="healthy")next.constraints.healthy=Boolean(value);if(key==="excluded_brand")next.constraints.excluded_brands=uniq([...next.constraints.excluded_brands,String(value)]);if(key==="excluded_product")next.constraints.excluded_products=uniq([...next.constraints.excluded_products,String(value)]);if(key==="required_category")next.constraints.required_categories=uniq([...next.constraints.required_categories,String(value)]);if(key==="existing_product")next.constraints.existing_products=uniq([...next.constraints.existing_products,String(value)]);if(key==="preference")next.preferences=uniq([...next.preferences,String(value)]);if(key==="store_mode")next.store_constraints.mode=String(value);if(key==="store_limit")next.store_constraints.limit=value==null?null:Number(value);if(key==="store_ids")next.store_constraints.store_ids=uniq(value.map(String));if(key==="delivery_mode")next.delivery_constraints.mode=String(value);if(key==="delivery_deadline")next.delivery_constraints.deadline=String(value);if(key==="delivery_max_fee")next.delivery_constraints.max_fee=value==null?null:Number(value);if(key==="intent")next.intent=String(value)}return next}

  function validateState(current=legacy(),agent=session){const failures=[],items=current?.products||[],plan=current?.lastPlans?.[0]||null,total=Number(current?.currentTotal),budget=Number(current?.budget),excluded=new Set((current?.excludedProducts||[]).map(String)),brands=(current?.excludedBrands||[]).map(low);
    if(items.some(x=>!Number.isInteger(Number(x.quantity))||Number(x.quantity)<=0||Number(x.quantity)>99))failures.push({code:"INVALID_QUANTITY"});
    if(items.some(x=>excluded.has(String(x.id))))failures.push({code:"EXCLUDED_PRODUCT_PRESENT"});
    if(items.some(x=>brands.some(b=>b&&low(x.brand).includes(b))))failures.push({code:"EXCLUDED_BRAND_PRESENT"});
    const storeLimit=current?.mode==="one"?1:Number(agent?.store_constraints?.limit)||null,stores=new Set(items.map(x=>x.storeId).filter(Boolean));if(storeLimit&&stores.size>storeLimit)failures.push({code:"STORE_LIMIT_EXCEEDED",actual:stores.size,limit:storeLimit});
    if(Number.isFinite(budget)&&budget>0&&Number.isFinite(total)&&total>budget)failures.push({code:"BUDGET_EXCEEDED",actual:total,limit:budget});
    const lineTotal=items.reduce((sum,x)=>sum+(Number(x.price)||0)*(Number(x.quantity)||0),0),planGoods=Number(plan?.goods);if(plan&&Number.isFinite(planGoods)&&Math.abs(planGoods-lineTotal)>.01)failures.push({code:"TOTAL_MISMATCH",expected:planGoods,actual:lineTotal});if(plan&&Number.isFinite(Number(plan.total))&&Number.isFinite(total)&&Math.abs(Number(plan.total)-total)>.01)failures.push({code:"CURRENT_TOTAL_MISMATCH"});
    for(const category of agent?.constraints?.required_categories||[]){const found=items.some(x=>{const p=product(x.id);return low(p?.category).includes(low(category))||(p?.tags||[]).some(t=>low(t).includes(low(category)))});if(!found)failures.push({code:"REQUIRED_CATEGORY_MISSING",category})}
    if(agent?.delivery_constraints?.mode==="delivery"&&items.some(x=>{const s=(typeof STORES!=="undefined"?STORES:[]).find(store=>store.id===x.storeId);return s&&s.kind!=="delivery"}))failures.push({code:"DELIVERY_CONSTRAINT_FAILED"});
    return{ok:failures.length===0,failures,computed:{line_total:lineTotal,current_total:Number.isFinite(total)?total:null,stores:[...stores]}}}
  function verifyActions(actions,before,after,agent=session){const errors=[],b=itemMap(before?.products||[]),a=itemMap(after?.products||[]);for(const x of actions){const p=x.payload||{};if(x.type==="add_item"&&!a.has(p.product_id))errors.push({code:"ADD_NOT_APPLIED",product_id:p.product_id});if(x.type==="remove_item"&&a.has(p.product_id))errors.push({code:"REMOVE_NOT_APPLIED",product_id:p.product_id});if(x.type==="replace_item"&&(a.has(p.from_product_id)||!a.has(p.to_product_id)))errors.push({code:"REPLACE_NOT_APPLIED",from:p.from_product_id,to:p.to_product_id});if(x.type==="change_quantity"){const old=Number(b.get(p.product_id)?.quantity)||0,next=Number(a.get(p.product_id)?.quantity)||0,expected=Number.isFinite(Number(p.quantity))?Number(p.quantity):Number.isFinite(Number(p.delta))?Math.max(0,old+Number(p.delta)):next;if(next!==expected)errors.push({code:"QUANTITY_NOT_APPLIED",product_id:p.product_id,expected,actual:next})}if(x.type==="set_constraint"){const key=p.key,checks={budget:()=>Number(agent.budget)===Number(p.value),people_count:()=>Number(agent.constraints.people_count)===Number(p.value),duration_days:()=>Number(agent.constraints.duration_days)===Number(p.value),cooking:()=>agent.constraints.cooking===String(p.value),healthy:()=>agent.constraints.healthy===Boolean(p.value),excluded_brand:()=>agent.constraints.excluded_brands.includes(String(p.value)),excluded_product:()=>agent.constraints.excluded_products.includes(String(p.value)),required_category:()=>agent.constraints.required_categories.includes(String(p.value)),existing_product:()=>agent.constraints.existing_products.includes(String(p.value)),preference:()=>agent.preferences.includes(String(p.value)),store_mode:()=>agent.store_constraints.mode===String(p.value),store_limit:()=>agent.store_constraints.limit===(p.value==null?null:Number(p.value)),store_ids:()=>JSON.stringify(agent.store_constraints.store_ids)===JSON.stringify(p.value.map(String)),delivery_mode:()=>agent.delivery_constraints.mode===String(p.value),delivery_deadline:()=>agent.delivery_constraints.deadline===String(p.value),delivery_max_fee:()=>agent.delivery_constraints.max_fee===(p.value==null?null:Number(p.value)),intent:()=>agent.intent===String(p.value),only_products:()=>true,user_note:()=>true};if(checks[key]&&!checks[key]())errors.push({code:"CONSTRAINT_NOT_APPLIED",key})}}
    return{ok:errors.length===0,errors};
  }
  function replyFor(actions,before,after){const names=id=>product(id)?.name||id,diff=[];for(const a of actions){const p=a.payload||{};if(a.type==="add_item")diff.push(`Добавил ${names(p.product_id)}.`);if(a.type==="remove_item")diff.push(`Убрал ${names(p.product_id)}.`);if(a.type==="replace_item")diff.push(`Заменил ${names(p.from_product_id)} на ${names(p.to_product_id)}.`);if(a.type==="change_quantity")diff.push(`Изменил количество ${names(p.product_id)}.`)}const total=Number(after?.currentTotal)||0;return`${diff.join(" ")||"Корзина проверена и обновлена."}${(after?.products||[]).length?` Сейчас ${(after.products||[]).length} позиций, итог ≈ ${Math.round(total)} ₽.`:""}`}
  function error(code,message,details={},recoverable=true){return{ok:false,status:"ERROR",error:{code,message:message||code,recoverable,details},state:snapshot(),actions:[],provider_actions_executed:false}}

  function execute(actions,{input=""}={}){
    if(!Array.isArray(actions)||!actions.length)return error("NO_ACTION","Нет действия для исполнения.");const beforeLegacy=clone(legacy()||{}),beforeSession=syncFromLegacy(beforeLegacy),valid=[];
    for(const raw of actions){const check=validateAction(raw,beforeLegacy);if(!check.ok)return error(check.error.code,"Действие не прошло проверку.",check.error,check.error.recoverable!==false);valid.push(check.action)}
    const passive=valid.filter(x=>!MUTATING.has(x.type));const mutations=valid.filter(x=>MUTATING.has(x.type));
    if(!mutations.length){const type=passive[0]?.type;if(["compare_stores","explain_choice","prepare_purchase"].includes(type)){const state=syncFromLegacy();return{ok:true,status:"VERIFIED",actions:valid,state,verification:{ok:true,passive:true},message:type==="compare_stores"?"Варианты магазинов готовы к сравнению.":type==="explain_choice"?"Могу объяснить выбор по данным текущей корзины.":"Покупка подготовлена к следующему подтверждённому шагу.",provider_actions_executed:false}}return error("NO_MUTATION","Действие ничего не меняет.")}
    const legacyOps=mutations.map(toLegacy).filter(Boolean);if(!legacyOps.length)return error("NO_EXECUTABLE_ACTION","Не удалось собрать безопасную операцию.");
    let applied;try{applied=window.TDShoppingConversation?.apply?.(input,legacyOps)}catch(e){return error("EXECUTION_FAILED","Не удалось применить действие.",{cause:String(e?.message||e)})}const afterLegacy=clone(legacy()||{}),projected=projectSession(beforeSession,mutations),post=syncFromLegacy(afterLegacy,projected),effect=verifyActions(mutations,beforeLegacy,afterLegacy,post),invariants=validateState(afterLegacy,post);
    if(!effect.ok||!invariants.ok){try{window.TDShoppingState?.undo?.();syncFromLegacy(legacy(),beforeSession)}catch{save(beforeSession)}return error(!effect.ok?"EFFECT_NOT_VERIFIED":"CONSTRAINT_VIOLATION","Изменение не подтверждено и было отменено.",{effects:effect.errors,constraints:invariants.failures})}
    session.history.push({id:`act_${Date.now()}`,at:now(),input:String(input).slice(0,500),actions:clone(valid),before_hash:hash(beforeSession),after_hash:hash(post),result:"VERIFIED"});save(session);
    return{ok:true,status:"VERIFIED",actions:valid,state:snapshot(),verification:{ok:true,effects:effect,constraints:invariants},message:replyFor(valid,beforeLegacy,afterLegacy),provider_actions_executed:true,legacy_result:applied};
  }

  async function run({text,operations=[]}={}){const gate=domainGate(text);if(!gate.allowed)return{ok:false,status:"OUT_OF_SCOPE",gate,error:{code:"OUT_OF_SCOPE",message:"Я занимаюсь покупками: могу подобрать товар, собрать корзину, сравнить варианты или подготовить покупку.",recoverable:true},actions:[],provider_actions_executed:false};const proposal=propose(text,operations);if(!proposal.ok)return{...proposal,status:"ERROR",gate,state:snapshot(),provider_actions_executed:false};return{...(execute(proposal.actions,{input:text})),gate}}

  window.TDBaiShoppingAgentKernel={version:VERSION,actions:[...ACTIONS],domainGate,propose,validateAction,validateState,verifyActions,execute,run,state:{get:snapshot,save,reset,syncFromLegacy},_test:{legacyToActions,toLegacy,projectSession,normalize,hash}};
})();
