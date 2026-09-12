(()=>{"use strict";
const KEY="td_bai_learning_v1",MAX_CASES=80,MAX_TEXT=220,ALLOWED=new Set(["ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","REQUIRE","SET_ONLY_PRODUCTS","SET_PRODUCT_AMOUNT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","PREFER","CHANGE_STORE","SET_MODE","RESET_BASKET","CLEAR_ONLY"]);
const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
const redact=v=>String(v||"").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email]").replace(/(?:\+?\d[\d\s()\-]{8,}\d)/g,"[phone]").replace(/https?:\/\/\S+/gi,"[url]").slice(0,MAX_TEXT);
const correction=t=>/(^|[\s,.;!?])(нет|не так|я имел|я хотел|имел в виду|хотел сказать|исправь|поправь|лучше|вместо|не это|не то)(?=$|[\s,.;!?])/.test(low(t));
const tokens=t=>new Set(low(t).replace(/[^а-яa-z0-9 ]/g," ").split(/\s+/).filter(x=>x.length>1));
const similarity=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)};
const clone=v=>JSON.parse(JSON.stringify(v));
const safeOps=ops=>(Array.isArray(ops)?ops:[]).filter(o=>o&&ALLOWED.has(o.type)).slice(0,12).map(clone);
const opsKey=ops=>JSON.stringify(safeOps(ops));
function blank(){return{version:1,cases:[],observations:0,corrections:0,applied:0}}
let db;try{db={...blank(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{db=blank()}db.cases=Array.isArray(db.cases)?db.cases:[];
let last=null,wrappedBrain=false,wrappedMemory=false;
function save(){db.cases=db.cases.slice(-MAX_CASES);try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}return db}
function addCase(input,correctionText,operations){const original=redact(input),fix=redact(correctionText),ops=safeOps(operations);if(!original||!ops.length)return null;const n=low(original),k=opsKey(ops);let item=db.cases.find(x=>x.normalized===n&&opsKey(x.operations)===k);if(item){item.count=(item.count||1)+1;item.lastSeen=Date.now();item.correction=fix||item.correction}else{item={input:original,normalized:n,correction:fix,operations:ops,count:1,createdAt:Date.now(),lastSeen:Date.now()};db.cases.push(item)}db.corrections++;save();return clone(item)}
function observe(raw,result){const text=redact(raw),ops=safeOps(result?.operations);db.observations++;if(last&&correction(text)&&ops.length)addCase(last.text,text,ops);last={text,operations:ops,at:Date.now()};save()}
function best(text){const n=low(redact(text));if(!n)return null;let winner=null,score=0;for(const item of db.cases){let s=item.normalized===n?1:similarity(item.input,n);if(s<.96)continue;s+=Math.min(.02,Math.max(0,(item.count||1)-1)*.005);if(s>score){score=s;winner=item}}return winner?{case:clone(winner),confidence:Math.min(1,score)}:null}
function sameOps(a,b){return opsKey(a)===opsKey(b)}
function wrapBrain(){if(wrappedBrain||!window.TDBaiBrain?.route)return;wrappedBrain=true;const original=window.TDBaiBrain.route.bind(window.TDBaiBrain);window.TDBaiBrain.route=async function(raw,...rest){const learned=best(raw),routed=await original(raw,...rest);if(!learned)return routed;if(routed?.expectsAnswer||routed?.selfCheck?.safe===false)return routed;const learnedOps=safeOps(learned.case.operations);if(!learnedOps.length)return routed;if(sameOps(routed?.operations,learnedOps))return{...routed,learning:{matched:true,confidence:learned.confidence,applied:false}};db.applied++;save();return{...routed,provider:"bai-learning-loop",operations:learnedOps,reply:routed?.reply||"Понял по твоему прошлому исправлению.",learning:{matched:true,confidence:learned.confidence,applied:true}}}}
function wrapMemory(){if(wrappedMemory||!window.TDBaiMemory?.learn)return;wrappedMemory=true;const original=window.TDBaiMemory.learn.bind(window.TDBaiMemory);window.TDBaiMemory.learn=function(raw,result){const out=original(raw,result);try{observe(raw,result);wrapBrain()}catch{}return out}}
function clear(){db=blank();last=null;try{localStorage.removeItem(KEY)}catch{}return clone(db)}
function stats(){return{version:db.version,cases:db.cases.length,observations:db.observations,corrections:db.corrections,applied:db.applied}}
window.TDBaiLearning={observe,best,stats,clear,exportCases:()=>clone(db.cases)};
wrapMemory();wrapBrain();
})();
