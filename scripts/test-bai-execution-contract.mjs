import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const products={potato:"Картофель",apple:"Яблоки",banana:"Бананы",ham:"Ветчина",milk:"Молоко"};
const parse=text=>({items:Object.keys(products).map(id=>({id,pos:String(text).toLowerCase().indexOf(products[id].toLowerCase().slice(0,5))})).filter(x=>x.pos>=0).sort((a,b)=>a.pos-b.pos)});
const context={console,JSON,Math,Number,String,Object,Array,Set,Map};
context.window=context;context.STORES=[{id:"pyat"}];
context.TDShoppingState={get:()=>({stores:["pyat"],products:[{id:"ham",quantity:2}]})};
context.TDStoreAdapters={catalog:()=>Object.entries(products).map(([id,name])=>({id,name})),adapter:()=>({getPrice:id=>({value:{apple:150,banana:90}[id]??100})})};
context.TDBaiLiteralBasket={parse};
context.TDBaiBrain={route:async raw=>({ok:true,operations:/убери картоф/i.test(raw)?[]:/убери одну ветчин/i.test(raw)?[{type:"REMOVE_PRODUCT",value:"ham"}]:[],reply:"Не понял.",expectsAnswer:false}),reset(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../bai-execution-contract.js",import.meta.url),"utf8"),context);

let result=await context.TDBaiBrain.route("убери картошку");
assert.ok(result.operations.some(x=>x.type==="REMOVE_PRODUCT"&&x.value==="potato"),"dynamic catalog item must be removable");

result=await context.TDBaiBrain.route("замени картошку на яблоки или бананы");
assert.deepEqual({...result.operations.find(x=>x.type==="REPLACE_PRODUCT").value},{from:"potato",to:"banana"},"ambiguous alternatives must choose the cheaper named replacement");
assert.equal(result.expectsAnswer,false);

result=context.TDBaiExecutionContract.rescue("яблоки вместо картошки",{operations:[],reply:""});
assert.deepEqual({...result.operations.find(x=>x.type==="REPLACE_PRODUCT").value},{from:"potato",to:"apple"},"«X вместо Y» must keep the replacement direction");

result=await context.TDBaiBrain.route("убери одну ветчину");
assert.deepEqual({...result.operations.find(x=>x.type==="CHANGE_QUANTITY").value},{id:"ham",delta:-1},"remove one must decrement instead of deleting the whole product");
assert.equal(result.operations.some(x=>x.type==="REMOVE_PRODUCT"),false);

result=await context.TDBaiBrain.route("замени молоко");
assert.equal(result.expectsAnswer,true,"truly incomplete replacement may ask one concrete question");
result=await context.TDBaiBrain.route("яблоки");
assert.deepEqual({...result.operations.find(x=>x.type==="REPLACE_PRODUCT").value},{from:"milk",to:"apple"},"answer must resume the pending replacement");

console.log("Bai execution contract passed: dynamic edits, autonomous choice, quantity decrement and pending replacement.");
