const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('bai-brain.js','utf8');
let s={budget:3000,products:[]};
global.window={TDShoppingState:{get:()=>s}};vm.runInThisContext(code);
const has=(ops,type,value)=>ops.some(o=>o.type===type&&(value===undefined||JSON.stringify(o.value)===JSON.stringify(value)));
(async()=>{
  let r=await window.TDBaiBrain.route('дешевле на 500');if(!has(r.operations,'CHANGE_BUDGET',2500))throw Error('budget phrase');
  r=await window.TDBaiBrain.route('оставь как есть');if(r.expectsAnswer||r.operations.length)throw Error('no-op phrase');
  r=await window.TDBaiBrain.route('молока побольше');if(!r.expectsAnswer||!/сколько/i.test(r.reply))throw Error('more milk clarification');
  window.TDBaiBrain.reset();await window.TDBaiBrain.route('добавь курицу');
  r=await window.TDBaiBrain.route('эту хрень убери');if(!has(r.operations,'REMOVE_PRODUCT','chicken'))throw Error('context remove');
  window.TDBaiBrain.reset();await window.TDBaiBrain.route('добавь курицу');
  r=await window.TDBaiBrain.route('возьми что-нибудь вместо этого');if(!r.expectsAnswer||!/на что заменить/i.test(r.reply))throw Error('context replace clarification');
  console.log('Bai ordinary phrases: OK');
})().catch(e=>{console.error(e);process.exit(1)});