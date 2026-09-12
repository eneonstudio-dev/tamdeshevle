import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../bai-character.js',import.meta.url),'utf8');
const gemma=fs.readFileSync(new URL('../gemma-router.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../backend/bai-agent-core.ts',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');
const bible=fs.readFileSync(new URL('../BAI_CHARACTER_BIBLE.md',import.meta.url),'utf8');

assert.equal(source.includes('MutationObserver'),false,'character voice must not add DOM observers');
assert.equal(source.includes('setInterval'),false,'character voice must not add recurring loops');
assert.ok(source.includes('плохого решения'),'character contract must define Bai around decision quality, not cheapest-price obsession');
assert.ok(source.includes('человек не тупой, а занятой'),'character contract must forbid punching down at the user');
assert.ok(source.includes('полностью выключи стёб'),'character contract must include a serious no-humor mode');
assert.ok(gemma.includes('TDBaiCharacter?.systemPrompt'),'local Gemma must consume the shared Bai character prompt');
assert.ok(gemma.includes('shopping-agent Votonobay'),'local model must use current Votonobay identity');
assert.ok(server.includes('const BAI_CHARACTER'),'server agent must carry the same character contract for a future cloud model');
assert.ok(server.includes('самостоятельный интернет-персонаж внутри Votonobay'),'server character prompt must identify Bai as a character, not a generic assistant');
assert.ok(bible.includes('полезный скепсис + сухая забота + самостоятельность + ненависть к бессмысленности'),'repo must retain the canonical character fingerprint');
assert.ok(config.indexOf('bai-shopping-journey.js')<config.indexOf('bai-character.js'),'character voice must wrap the composed agent/journey last');

const context={console,JSON,Math,Number,String,Object,Array,Set,RegExp,Promise};
context.window=context;context.globalThis=context;
context.TDBaiBrain={route:async()=>({ok:true,reply:'Отличный вопрос! Конечно! Нашёл вариант за 730 ₽ 👋',operations:[{type:'CHANGE_BUDGET',value:730}]})};
context.TDShoppingConversation={apply:()=>({ok:true,message:'С удовольствием! Корзина пересчитана: 2 730 ₽ 👋'})};
vm.createContext(context);vm.runInContext(source,context);

const prompt=context.TDBaiCharacter.systemPrompt();
assert.ok(prompt.includes('Сначала помоги'),'system prompt must prioritize utility before personality');
assert.ok(prompt.includes('Мат — редкая специя'),'system prompt must bound profanity instead of making it a gimmick');

let filtered=context.TDBaiCharacter.filter('Отличный вопрос! Конечно! Нашёл вариант за 730 ₽ 👋',{userText:'найди дешевле'});
assert.equal(filtered,'Нашёл вариант за 730 ₽','filter must strip generic bot openers and emoji without touching the fact');
assert.deepEqual(filtered.match(/\d+/g),['730'],'voice filter must preserve numeric facts');

filtered=context.TDBaiCharacter.filter('Деньги списались. Я свою работу сделал.',{userText:'деньги списались, а заказа нет'});
assert.equal(filtered,'Деньги списались.','serious payment context must strip a recurring joke');

filtered=context.TDBaiCharacter.filter('Да. Тут я проебал условие про один магазин.',{userText:'почему ты взял два магазина'});
assert.equal(filtered,'Да. Тут я упустил условие про один магазин.','Bai must not introduce profanity when the user did not');
filtered=context.TDBaiCharacter.filter('Да. Тут я проебал условие про один магазин.',{userText:'что за хуйня, почему два магазина'});
assert.ok(filtered.includes('проебал'),'Bai may mirror bounded profanity when the user already speaks that way');

const routed=await context.TDBaiBrain.route('найди дешевле');
assert.equal(routed.reply,'Нашёл вариант за 730 ₽','brain wrapper must style model/rule replies');
assert.equal(routed.operations[0].value,730,'voice wrapper must never mutate operations');
const applied=context.TDShoppingConversation.apply('пересчитай');
assert.equal(applied.message,'Корзина пересчитана: 2 730 ₽','conversation wrapper must style the final visible shopping message');

assert.equal(context.TDBaiCharacter.rules.maxJokesPerReply,1,'character runtime must expose bounded-humor policy');
assert.equal(context.TDBaiCharacter.rules.profanity,'mirror-only','character runtime must expose mirror-only profanity policy');

console.log('Bai character voice passed: utility-first prompt, serious mode, anti-corporate filter, bounded profanity, numeric/operation preservation and Votonobay identity.');
