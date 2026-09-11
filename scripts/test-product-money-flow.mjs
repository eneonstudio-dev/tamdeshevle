import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const storage=new Map(),events=[];
const window={addEventListener(){},dispatchEvent:e=>events.push(e),open(){throw new Error('must not open for shelf')},state:{cart:{milk:1}},TDGeo:{openMap(){window.mapOpened=true;}},TDCompare:{fromWindow:()=>[{id:'pyat',channel:'shelf',rankable:true,verifiedComplete:true,total:80,save:25,name:'Пятёрочка'}]}};
const context={window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:{randomUUID:()=>"id"},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},document:{readyState:'loading',addEventListener(){},querySelectorAll(){return[];}},requestAnimationFrame(){},console};vm.createContext(context);
for(const file of ['savings-ledger.js','purchase-flow.js','unit-economics.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
assert.equal(window.TDPurchase.start('pyat','shelf'),true);assert.equal(window.mapOpened,true);assert.equal(window.TDSavingsLedger.stats().confirmed,25);window.TDPurchase.start('pyat','shelf');assert.equal(window.TDSavingsLedger.stats().confirmed,25,'same decision must be idempotent');
assert.deepEqual(JSON.parse(JSON.stringify(window.TDUnitEconomics.parse('1,5 л'))),{value:1500,base:'мл'});assert.equal(window.TDUnitEconomics.format({pack:'500 г'},100),'200 ₽/кг');
window.TDCompare.fromWindow=()=>[{id:'pyat',channel:'shelf',rankable:false,verifiedComplete:false,total:80,save:25,name:'Пятёрочка'}];assert.equal(window.TDPurchase.start('pyat','shelf'),false);assert.equal(window.TDSavingsLedger.stats().confirmed,25);
console.log('Purchase gate, confirmed savings ledger and unit economics passed.');
