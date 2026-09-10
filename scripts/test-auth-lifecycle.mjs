import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../auth-client.js',import.meta.url),'utf8');
async function setup({sdkFailure=false}={}) {
  const events=[],timers=[],writes=[],storage=new Map();
  let callback,locked=false,created=0,attempts=0;
  const session={user:{id:'12345678-1234-4123-8123-123456789012',user_metadata:{}}};
  const rows={profiles:{display_name:'Облачное имя'},baskets:[],addresses:[],basket_history:[]};
  const client={auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:fn=>{callback=fn;},signInWithOtp:async()=>({error:null})},from(table){
    assert.equal(locked,false,'Network request must run outside auth callback lock');
    let write=false,row; const q={};
    for(const method of ['select','eq','order','limit','maybeSingle']) q[method]=()=>q;
    q.upsert=value=>{write=true;row=value;return q;};
    q.then=(resolve,reject)=>Promise.resolve({data:write?(writes.push({table,row}),[row]):rows[table],error:null}).then(resolve,reject);
    return q;
  }};
  const window={TD_SUPABASE:{url:'https://test.supabase.co',anonKey:'public-test-key-long-enough'},addEventListener(){},dispatchEvent:e=>events.push(e)};
  const document={getElementById:()=>true,createElement:()=>({}),head:{appendChild:s=>{attempts++;queueMicrotask(()=>{if(sdkFailure&&attempts===1)s.onerror();else{window.supabase={createClient:()=>{created++;return client;}};s.onload();}});}}};
  vm.runInNewContext(source,{window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:id=>{if(id)timers[id-1]=null;},console:{warn(){}},location:{origin:'https://example.org',pathname:'/app/'}});
  await new Promise(resolve=>setImmediate(resolve));
  return {window,storage,writes,events,created:()=>created,async flush(){while(timers.length){const fn=timers.shift();if(fn)await fn();}},fire(){locked=true;try{const result=callback('SIGNED_IN',session);assert.equal(result,undefined,'Callback must be synchronous');}finally{locked=false;}}};
}
const a=await setup();
await Promise.all([a.window.TDAuth.init(),a.window.TDAuth.init()]);
assert.equal(a.created(),1);
a.fire();await a.flush();
assert.equal(a.writes.find(x=>x.table==='profiles').row.display_name,'Облачное имя','Do not overwrite cloud name with default on a fresh device');
const b=await setup({sdkFailure:true});
await b.window.TDAuth.init();assert.equal(b.created(),1,'SDK load failure is retryable');
const listeners={};
const status={textContent:''},button={textContent:'',dataset:{}};
const root={querySelector:s=>s==='.td-account-status'?status:button};
const uiWindow={TDAuth:{user:()=>({email:'test@example.org'}),configured:()=>true},addEventListener:(type,fn)=>listeners[type]=fn};
vm.runInNewContext(fs.readFileSync(new URL('../account-auth-ui.js',import.meta.url),'utf8'),{window:uiWindow,TDAuth:uiWindow.TDAuth,document:{querySelector:()=>root,addEventListener(){},readyState:'complete'}});
status.textContent='stale';listeners['td:account-opened']();assert.match(status.textContent,/test@example.org/);assert.equal(button.dataset.mode,'signout');
console.log('Auth lifecycle passed: shared initialization, SDK retry, lock-safe sync, cloud name preservation, account-open status.');
