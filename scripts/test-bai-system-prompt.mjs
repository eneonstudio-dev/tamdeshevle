import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const promptSource=fs.readFileSync(new URL('../bai-system-prompt-v1.js',import.meta.url),'utf8');
const characterSource=fs.readFileSync(new URL('../bai-character.js',import.meta.url),'utf8');

const context={console,JSON,Math,Number,String,Object,Array,Set,RegExp,Promise};
context.window=context;context.globalThis=context;
context.TDBaiBrain={route:async raw=>({reply:`Отличный вопрос! Нашёл за 730 ₽ 👋`,operations:[{type:'NOTE',value:raw}]})};
context.TDShoppingConversation={apply:raw=>({message:`С удовольствием! ${raw}: 2 730 ₽ 👋`})};
vm.createContext(context);
vm.runInContext(promptSource,context);
vm.runInContext(characterSource,context);

const bai=context.TDBaiCharacter;
const prompt=bai.systemPrompt();
const scenarios=[];
const check=(name,fn)=>scenarios.push({name,fn});

check('01 mission is decision quality',()=>assert.ok(prompt.includes('Бай защищает человека не от высокой цены. Бай защищает человека от плохого решения.')));
check('02 nonsense is the enemy',()=>assert.ok(prompt.includes('Твой главный враг — **бессмысленность**.')));
check('03 user is busy not stupid',()=>assert.ok(prompt.includes('человек не тупой — человек занятой.')));
check('04 expensive can be correct',()=>assert.ok(prompt.includes('Иногда правильный вариант дороже.')));
check('05 unnecessary purchase can be rejected',()=>assert.ok(prompt.includes('Иногда никакая покупка вообще не нужна.')));
check('06 answer order is fact decision character',()=>assert.ok(prompt.includes('1. Что произошло? Факты.')&&prompt.includes('2. Что человеку делать? Решение.')&&prompt.includes('3. Что Бай об этом думает? Характер.')));
check('07 character is optional',()=>assert.ok(prompt.includes('Третий пункт НЕ обязателен.')));
check('08 do not ask pointless clarifications',()=>assert.ok(prompt.includes('Не задавай бессмысленных уточнений.')));
check('09 bot opener excellent question removed',()=>assert.equal(bai.filter('Отличный вопрос! Нашёл за 500 ₽',{userText:'цена'}),'Нашёл за 500 ₽'));
check('10 bot opener of course removed',()=>assert.equal(bai.filter('Конечно! Нашёл за 500 ₽',{userText:'цена'}),'Нашёл за 500 ₽'));
check('11 bot opener happy to help removed',()=>assert.equal(bai.filter('С удовольствием! Нашёл за 500 ₽',{userText:'цена'}),'Нашёл за 500 ₽'));
check('12 generic lets figure it out removed',()=>assert.equal(bai.filter('Давайте разберёмся. Нашёл за 500 ₽',{userText:'цена'}),'Нашёл за 500 ₽'));
check('13 emoji removed',()=>assert.equal(bai.filter('Нашёл 👋',{userText:'ищи'}),'Нашёл'));
check('14 repeated exclamation collapsed',()=>assert.equal(bai.filter('Нашёл!!',{userText:'ищи'}),'Нашёл!'));
check('15 numeric facts preserved',()=>assert.deepEqual(bai.filter('Нашёл за 2 730 ₽',{userText:'ищи'}).match(/\d+/g),['2','730']));
check('16 payment context is serious',()=>assert.equal(bai.isSerious('деньги списались, заказа нет'),true));
check('17 health context is serious',()=>assert.equal(bai.isSerious('кажется, отравился'),true));
check('18 debt context is serious',()=>assert.equal(bai.isSerious('у меня долг'),true));
check('19 serious mode strips recurring joke',()=>assert.equal(bai.filter('Деньги списались. Я свою работу сделал.',{userText:'деньги списались'}),'Деньги списались.'));
check('20 explicit serious mode strips recurring joke',()=>assert.equal(bai.filter('Проверил. Сейчас понюхаю интернет.',{userText:'обычный запрос',serious:true}),'Проверил.'));
check('21 clean user does not get introduced profanity',()=>assert.equal(bai.filter('Тут я проебал условие.',{userText:'почему так'}),'Тут я упустил условие.'));
check('22 clean user gets neutral replacement for profanity',()=>assert.equal(bai.filter('Это хуйня.',{userText:'почему так'}),'Это ерунда.'));
check('23 profanity can mirror user register',()=>assert.ok(bai.filter('Тут я проебал условие.',{userText:'что за хуйня'}).includes('проебал')));
check('24 no fabricated memory rule exists',()=>assert.ok(prompt.includes('Не выдумывай память.')));
check('25 competitor fairness rule exists',()=>assert.ok(prompt.includes('Если конкурент предлагает лучший вариант — говоришь об этом.')));
check('26 serious mode says solve first',()=>assert.ok(prompt.includes('Сначала реши проблему. Характер можно вернуть позже.')));
check('27 humor is not mandatory',()=>assert.ok(prompt.includes('Ты НЕ комик. Ты не обязан шутить.')));
check('28 anti ChatGPT plus sarcasm test exists',()=>assert.ok(prompt.includes('обычный ChatGPT + мат + сарказм')));
check('29 system prompt version is explicit',()=>assert.equal(context.TDBaiSystemPromptV1.version,'bai-system-prompt-v1.0'));
check('30 final identity rule survives',()=>assert.ok(prompt.includes('Ты не обязан быть смешным. Ты обязан быть **Баем**.')));

let passed=0;
for(const scenario of scenarios){
  try{scenario.fn();passed+=1}
  catch(error){throw new Error(`${scenario.name}: ${error.message}`)}
}
assert.equal(scenarios.length,30,'stress suite must keep exactly 30 baseline scenarios');
assert.equal(passed,30,'all Bai system prompt stress scenarios must pass');

const routed=await context.TDBaiBrain.route('найди дешевле');
assert.equal(routed.reply,'Нашёл за 730 ₽','runtime wrapper still styles model replies after canonical prompt integration');
assert.equal(routed.operations[0].value,'найди дешевле','runtime wrapper must not alter operations');
const applied=context.TDShoppingConversation.apply('Корзина');
assert.equal(applied.message,'Корзина: 2 730 ₽','final conversation wrapper must preserve factual totals');

console.log(`Bai production prompt stress passed: ${passed}/30 policy scenarios + runtime wrapper integrity.`);
