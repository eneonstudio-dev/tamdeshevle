import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

let meta=null;
const context={console,Date,Math,Number,String,Object,Array,Set,Map,JSON};
context.window=context;
context.PRODUCTS=[{id:"milk",name:"Молоко",pack:"1 л",prices:{pyat:100},bring:{pyat:115}}];
context.STORES=[{id:"pyat",city:["msk"],kind:"shop",has_bring:true}];
context.TDPriceMeta={get:()=>meta};
vm.createContext(context);
vm.runInContext(fs.readFileSync("data-quality.js","utf8"),context,{filename:"data-quality.js"});
vm.runInContext(fs.readFileSync("store-adapters.js","utf8"),context,{filename:"store-adapters.js"});

const adapter=context.TDStoreAdapters.adapter("pyat");
const ago=hours=>new Date(Date.now()-hours*60*60*1000).toISOString();
const retailer=(hours,extra={})=>({kind:"retailer",scopeVerified:true,checkedAt:ago(hours),...extra});

meta=retailer(1);
assert.equal(adapter.getPrice("milk","shelf").quality,"LIVE","fresh scoped retailer data must be LIVE");

meta=retailer(48);
assert.equal(adapter.getPrice("milk","shelf").quality,"RECENT","usable but stale retailer data must be RECENT, never LIVE");

meta=retailer(90);
assert.equal(adapter.getPrice("milk","shelf").quality,"UNKNOWN","expired retailer metadata must fail closed");

meta=retailer(1,{scopeVerified:false});
assert.equal(adapter.getPrice("milk","shelf").quality,"UNKNOWN","unscoped retailer data must not become trusted");

meta={kind:"retailer",scope_verified:true,checkedAt:ago(1)};
assert.equal(adapter.getPrice("milk","shelf").quality,"LIVE","legacy snake_case scope metadata remains compatible during migration");

meta=null;
assert.equal(adapter.getPrice("milk","shelf").quality,"ESTIMATED","a catalog price without retailer provenance remains estimated");
assert.deepEqual(Array.from(context.TDStoreAdapters.qualities),["LIVE","RECENT","ESTIMATED","UNKNOWN"]);

const retailerSync=fs.readFileSync("retailer-price-sync.js","utf8");
assert.match(retailerSync,/scopeVerified:\s*book\.scope_verified\s*===\s*true/,"runtime retailer metadata must publish the scopeVerified field consumed by adapters");
assert.match(retailerSync,/checkedAt:\s*book\.checked_at/,"retailer metadata must carry freshness timestamp for direct API readiness");

console.log("Price trust quality passed: fresh scoped retailer data is LIVE, stale is RECENT, expired/unscoped fails closed, and estimates stay estimates.");
