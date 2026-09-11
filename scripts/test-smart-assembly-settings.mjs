import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const storage=new Map(),events=[];const window={dispatchEvent:e=>events.push(e)};const context={window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../smart-assembly-settings.js',import.meta.url),'utf8'),context);
window.TDAssemblyPreferences.save({minutes:12,rubPerMinute:8,transportRub:40});assert.equal(window.TDAssemblyPreferences.extraStopCost(),136);assert.equal(events[0].type,'td:assembly-settings');
window.TDAssemblyPreferences.save({minutes:999,rubPerMinute:-5,transportRub:9000});assert.deepEqual(JSON.parse(JSON.stringify(window.TDAssemblyPreferences.read())),{minutes:180,rubPerMinute:0,transportRub:5000});
console.log('Smart Assembly preference cost and bounds passed.');
