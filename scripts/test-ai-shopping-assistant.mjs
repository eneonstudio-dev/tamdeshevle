import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const memory=new Map();
const context={console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Object,Array,Set,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},dispatchEvent(){},addEventListener(){},render(){}};
context.window=context;
context.state={city:'msk',storeId:'pyat',cart:{}};
vm.createContext(context);
vm.runInContext(`const STORES=${JSON.stringify([{id:'pyat',name:'Пятёрочка',city:['msk'],kind:'shop'},{id:'magnit',name:'Магнит',city:['msk'],kind:'shop'}])}; const PRODUCTS=${JSON.stringify([{id:'milk',name:'Молоко',pack:'1 л',emoji:'🥛',prices:{pyat:100,magnit:90}},{id:'bread',name:'Хлеб',pack:'1 шт',emoji:'🍞',prices:{pyat:70,magnit:60}},{id:'eggs',name:'Яйца',pack:'10 шт',emoji:'🥚',prices:{pyat:120,magnit:100}},{id:'banana',name:'Бананы',pack:'1 кг',emoji:'🍌',prices:{pyat:140,magnit:120}},{id:'chicken',name:'Курица',pack:'1 кг',emoji:'🍗',prices:{pyat:380,magnit:350}},{id:'buck',name:'Гречка',pack:'800 г',emoji:'🌾',prices:{pyat:95,magnit:80}},{id:'pasta',name:'Макароны',pack:'450 г',emoji:'🍝',prices:{pyat:75,magnit:65}}])};`,context);
for(const file of ['store-adapters.js','shopping-state.js','shopping-optimizer.js','shopping-conversation.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);

const result=context.TDShoppingConversation.apply('Собери продуктов до 1500 рублей. Готовить особо не люблю. Дома есть сыр, гречка, кофе и масло. Нужна вода и хотелось бы фруктов');
assert.equal(result.ok,true);
assert.equal(result.state.budget,1500);
assert.equal(result.state.cookingPreference,'minimal');
assert.ok(result.state.existingProducts.some(x=>x.includes('греч')));
assert.ok(result.state.requiredProducts.includes('water'));
assert.ok(result.state.preferredProducts.includes('фрукты'));
assert.ok(result.state.currentTotal<=1500);
assert.ok(result.state.lastPlans.length>=2);
assert.equal(result.state.lastPlans[0].quality,'ESTIMATED');
assert.ok(result.state.products.length>=7);

const dotted=context.TDShoppingConversation.apply('Собери еды до 1.500 руб');
assert.equal(dotted.state.budget,1500);

const before=result.state.currentTotal;
const changed=context.TDShoppingConversation.apply('Убери воду');
assert.ok(changed.state.excludedProducts.includes('water'));
assert.notEqual(changed.state.currentTotal,before);
const undone=context.TDShoppingConversation.apply('Верни как было');
assert.equal(undone.ok,true);
assert.equal(context.TDShoppingState.get().currentTotal,before);

const single=context.TDShoppingConversation.apply('Только Пятёрочка');
assert.equal(single.state.mode,'one');
assert.deepEqual([...single.state.stores],['pyat']);
assert.equal(single.plans.length,1);
const brand=context.TDShoppingConversation.apply('Мираторг не хочу');
assert.ok(brand.state.excludedBrands.includes('мираторг'));

const ui=fs.readFileSync(new URL('../ai-shopping-assistant.js',import.meta.url),'utf8');
const checkout=fs.readFileSync(new URL('../bai-checkout.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(ui,/SpeechRecognition/);
assert.match(ui,/speechSynthesis/);
assert.match(ui,/bai-checkout\.js/);
assert.match(checkout,/Что дальше\?/);
assert.match(checkout,/Сам заберу/);
assert.match(ui,/CHANGE_QUANTITY/);
assert.match(ui,/TDBaiShoppingAgentKernel/);
assert.match(ui,/kernel\?\.domainGate\?\.\(value\)/);
assert.match(ui,/kernel\?\.run\?await kernel\.run/);
assert.match(ui,/verified:true/);
assert.match(ui,/TDShoppingAssistant=\{open,voice,submit,adjust,remove,newSession/);
assert.match(ui,/newSession/);
assert.match(html,/ai-shopping-assistant\.js\?v=20260913-shopping-agent-v1/);
assert.match(html,/supabase-config\.js\?v=20260913-shopping-agent-v1/);
console.log('AI shopping assistant MVP passed: stateful dialogue, budget, optimizer, honest prices, undo, voice and fulfillment.');
