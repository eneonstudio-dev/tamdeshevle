import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../auth-client.js',import.meta.url),'utf8');
const uid='12345678-1234-4123-8123-123456789012';
async function setup({sdkFailure=false,rows={profiles:{display_name:'Облачное имя'},baskets:[],addresses:[],basket_history:[]},fail=false}={}) {
  const events=[],writes=[],storage=new Map();
  let callback,locked=false,created=0,attempts=0,rendered=0;
  const session={user:{id:uid,user_metadata:{}}};
  const client={auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:fn=>{callback=fn;},signInWithOtp:async()=>({error:null})},from(table){
    assert.equal(locked,false,'Network request must run outside auth callback lock');
    let row;const q={};
    for(const method of ['select','eq','order','limit','maybeSingle'])q[method]=()=>q;
    q.upsert=value=>{row=value;return q;};
    q.then=(resolve,reject)=>{
      if(fail)return Promise.resolve({error:new Error('offline')}).then(resolve,reject);
      if(row){writes.push({table,row});if(table==='profiles')rows[table]=row;else{const key=table==='basket_history'?'day':'id';rows[table]=rows[table].filter(x=>x[key]!==row[key]).concat(row);}}
      return Promise.resolve({data:row?[row]:structuredClone(rows[table]),error:null}).then(resolve,reject);
    };return q;
  }};
  const window={TD_SUPABASE:{url:'https://test.supabase.co',anonKey:'public-test-key-long-enough'},addEventListener(){},dispatchEvent:e=>events.push(e),render:()=>rendered++};
  const document={getElementById:()=>true,createElement:()=>({}),head:{appendChild:s=>{attempts++;queueMicrotask(()=>{if(sdkFailure&&attempts===1)s.onerror();else{window.supabase={createClient:()=>{created++;return client;}};s.onload();}});}}};
  vm.runInNewContext(source,{window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},console:{warn(){}},location:{origin:'https://example.org',pathname:'/app/'}});
  await new Promise(resolve=>setImmediate(resolve));
  return {window,rows,storage,writes,events,created:()=>created,rendered:()=>rendered,fire(next=session){locked=true;try{const result=callback('SIGNED_IN',next);assert.equal(result,undefined);}finally{locked=false;}}};
}
const a=await setup();
await Promise.all([a.window.TDAuth.init(),a.window.TDAuth.init()]);assert.equal(a.created(),1);
a.fire();assert.equal(a.writes.length,0,'Login must never overwrite cloud data');
a.window.state={cart:{milk:3,bread:2},city:'spb',storeId:'magnit',address:'Тестовый адрес'};
a.storage.set('td:profile',JSON.stringify({name:'Тест'}));
a.storage.set('td:basket-history',JSON.stringify([{date:'2026-09-09',city:'spb',cart:{milk:9},total:900,items:9},{date:'2026-09-10',city:'spb',cart:{milk:3},total:300,items:3,verified:true}]));
await a.window.TDAuth.syncLocalToCloud();assert.equal(a.window.TDAuth.cloudStatus().status,'saved');
assert.deepEqual(JSON.parse(JSON.stringify(a.rows.baskets[0].items)),{milk:3,bread:2});assert.equal(a.rows.addresses.length,1);assert.equal(a.rows.basket_history.length,1);assert.equal(a.rows.basket_history[0].day,'2026-09-10');
const b=await setup({rows:a.rows});b.window.state={cart:{eggs:99},city:'msk'};
await b.window.TDAuth.hydrateLocalFromCloud();assert.deepEqual(JSON.parse(JSON.stringify(b.window.state.cart)),{milk:3,bread:2});assert.equal(b.window.state.city,'spb');assert.equal(b.rendered(),1);assert.equal(b.writes.length,0);assert.ok(b.storage.has('td:before-cloud-restore'));assert.equal(JSON.parse(b.storage.get('td:basket-history'))[0].verified,true);
a.window.state.cart={};await a.window.TDAuth.syncLocalToCloud();assert.equal(Object.keys(a.rows.baskets[0].items).length,0,'Empty basket must save');
const c=await setup({fail:true});await assert.rejects(c.window.TDAuth.syncLocalToCloud());assert.equal(c.window.TDAuth.cloudStatus().status,'error');assert.equal(c.events.some(x=>x.type==='td:cloud-synced'),false);
const d=await setup({sdkFailure:true});await d.window.TDAuth.init();assert.equal(d.created(),1);
const e=await setup();e.window.state={cart:{milk:1}};assert.equal(await e.window.TDAuth.hydrateLocalFromCloud(),false);assert.equal(e.window.state.cart.milk,1,'Missing cloud basket must not erase local data');
const listeners={},status={textContent:''},button={textContent:'',dataset:{}},cloudLabel={textContent:''};
const root={querySelector:s=>s==='.td-account-status'?status:s==='[data-auth]'?button:s==='.td-cloud-status'?cloudLabel:null};
const uiWindow={TDAuth:{user:()=>({email:'test@example.org'}),configured:()=>true,cloudStatus:()=>({status:'error',message:'Ошибка сохранения'})},addEventListener:(type,fn)=>listeners[type]=fn};
vm.runInNewContext(fs.readFileSync(new URL('../account-auth-ui.js',import.meta.url),'utf8'),{window:uiWindow,TDAuth:uiWindow.TDAuth,document:{querySelector:()=>root,addEventListener(){},readyState:'complete'}});
status.textContent='stale';listeners['td:account-opened']();assert.match(status.textContent,/вход выполнен/);assert.doesNotMatch(status.textContent,/синхронизация включена/);assert.equal(cloudLabel.textContent,'Ошибка сохранения');
console.log('Auth lifecycle passed: no login writes, explicit save/readback, second-device restore, empty cart, failure status, SDK retry, account UI.');
