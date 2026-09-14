import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const capabilities = read('RETAILER_CAPABILITIES.md');
const retailer = read('real-store-integration-v1.js');
const continueStores = read('continue-in-stores-v1.js');
const splitUi = read('basket-split-ui.js');
const uxWorkflow = read('.github/workflows/validate-ux-browser.yml');

const enabled = [
  ['Пятёрочка', 'pyat', '5ka.ru'],
  ['Магнит', 'magnit', 'magnit.ru'],
  ['Перекрёсток', 'perek', 'perekrestok.ru'],
  ['Лента', 'lenta', 'lenta.com'],
  ['Дикси', 'dixy', 'dixy.ru']
];

for (const [name, id, host] of enabled) {
  assert.match(capabilities, new RegExp(`\\| ${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\| REDIRECT \\| NO \\|`), `${name} must stay REDIRECT / no automation in the capability matrix`);
  assert.match(retailer, new RegExp(`${id}:\\{id:\"${id}\",name:\"${name}`), `${name} must be explicitly identified in the retailer handoff`);
  assert.match(retailer, new RegExp(`https:\\/\\/[^\"']*${host.replace('.', '\\.')}`), `${name} must have an HTTPS official destination`);
}

assert.match(retailer, /u\.protocol===\"https:\"/i, 'retailer destinations must be HTTPS');
assert.match(retailer, /hosts\.some\(re=>re\.test\(u\.hostname\)\)/, 'retailer destinations must be host allowlisted');
assert.match(retailer, /Собрать в «\$\{esc\(r\.name\)\}»/, 'retailer identity must be visible in the handoff title');
assert.match(retailer, /Открыть «\$\{esc\(r\.name\)\}»/, 'retailer identity must be visible on the primary retailer link');
assert.match(retailer, /добавляй их там вручную/, 'handoff must say manual retailer-side addition');
assert.match(retailer, /Публичный стабильный deep-link для автоматического наполнения корзины .*не подтверждён/, 'handoff must fail closed on deep cart transfer');
assert.match(continueStores, /Votonobay не читает корзину магазина/, 'cross-store progress must not imply cart visibility');
assert.match(continueStores, /цена, наличие и фактическое добавление подтверждаются самим магазином/, 'retailer remains authority for final state');
assert.match(splitUi, /Товары добавляешь на стороне сети вручную/, 'two-store split handoff must remain manual');
assert.doesNotMatch(`${retailer}\n${continueStores}\n${splitUi}`, /(?:товары|корзина).{0,40}(?:автоматически перенесены|автоматически добавлены)/i, 'UI must not claim automatic cart transfer');

for (const script of [
  'scripts/test-ux-browser.py',
  'scripts/test-roxy-handoff.py',
  'scripts/test-roxy-network-recovery.py',
  'scripts/test-roxy-return-continuity.py',
  'scripts/test-roxy-purchase-proof.py'
]) {
  assert.match(uxWorkflow, new RegExp(script.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), `${script} must remain in the real-browser UX gate`);
}

console.log('Sara 2 release acceptance guard passed: Gate D handoff truth/capability alignment and Gate E UX recovery coverage remain explicit.');
