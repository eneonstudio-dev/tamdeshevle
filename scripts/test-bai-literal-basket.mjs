import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../bai-literal-basket.js",import.meta.url),"utf8");
const products=[
  {id:"beet",name:"Свёкла",pack:"1 кг"},{id:"banana",name:"Бананы",pack:"1 кг"},{id:"apple",name:"Яблоки",pack:"1 кг"},
  {id:"milk",name:"Молоко 2,5%",pack:"1 л"},{id:"bread_dark",name:"Хлеб дарницкий",pack:"650 г"},{id:"eggs_c1",name:"Яйца куриные С1",pack:"10 шт"},
  {id:"water_still",name:"Вода б/г",pack:"1,5 л"},{id:"pasta",name:"Макароны",pack:"450 г"},{id:"chicken_fil",name:"Филе куриное",pack:"1 кг"},
  {id:"sugar",name:"Сахар",pack:"1 кг"}
];
let innerCalls=0,optimizedState=null;
const context={window:{
  TDStoreAdapters:{catalog:()=>products},
  TDBaiBrain:{async route(){innerCalls++;return{provider:"inner",operations:[],reply:"inner"}}},
  TDShoppingOptimizer:{optimize(state){optimizedState={...state};return[]}}
},console};
context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context);
const literal=context.window.TDBaiLiteralBasket;assert.ok(literal,"literal router should install");

function op(out,type){return out.operations.find(x=>x.type===type)}
function amounts(out){return out.operations.filter(x=>x.type==="SET_PRODUCT_AMOUNT").map(x=>x.value)}

let out=await context.window.TDBaiBrain.route("Свеклу 3 кг и бананы");
assert.equal(out.provider,"bai-literal-basket");
assert.equal(out.confirmedContext,true,"conservative literal parsing should survive generic self-check");
assert.deepEqual(Array.from(op(out,"SET_ONLY_PRODUCTS").value),["beet","banana"],"literal basket must contain exactly requested products");
assert.deepEqual({...amounts(out)[0]},{id:"beet",amount:3,unit:"kg"},"3 kg must stay attached to beet");
assert.equal(amounts(out).some(x=>x.id==="banana"),false,"banana must not inherit beet quantity");
assert.equal(out.operations.some(x=>["eggs_c1","bread_dark","water_still"].includes(String(x.value))),false,"literal mode must not invent extra food");

out=await context.window.TDBaiBrain.route("молоко 2 литра и хлеб");
assert.deepEqual(Array.from(op(out,"SET_ONLY_PRODUCTS").value),["milk","bread_dark"]);
assert.deepEqual({...amounts(out)[0]},{id:"milk",amount:2,unit:"l"});
assert.equal(amounts(out).some(x=>x.id==="bread_dark"),false);

out=await context.window.TDBaiBrain.route("яблоки 3 кг, яйца и вода");
assert.deepEqual(Array.from(op(out,"SET_ONLY_PRODUCTS").value),["apple","eggs_c1","water_still"]);
assert.deepEqual({...amounts(out)[0]},{id:"apple",amount:3,unit:"kg"});
assert.equal(amounts(out).length,1,"quantity must not leak across clauses");

out=await context.window.TDBaiBrain.route("две пачки макарон и курицу");
assert.deepEqual(Array.from(op(out,"SET_ONLY_PRODUCTS").value),["pasta","chicken_fil"]);
assert.deepEqual({...amounts(out)[0]},{id:"pasta",amount:2,unit:"pack"});

out=await context.window.TDBaiBrain.route("сахар килограмм, бананы и всё");
assert.deepEqual(Array.from(op(out,"SET_ONLY_PRODUCTS").value),["sugar","banana"]);
assert.deepEqual({...amounts(out)[0]},{id:"sugar",amount:1,unit:"kg"},"bare singular unit means one");

out=await context.window.TDBaiBrain.route("манго 3 кг и бананы");
assert.equal(out.provider,"bai-literal-basket");
assert.equal(out.expectsAnswer,true,"unknown quantified product must fail closed");
assert.equal(op(out,"SET_PRODUCT_AMOUNT"),undefined,"unknown 3 kg must never move to banana");
assert.match(out.reply,/количество не переношу/i);

out=await context.window.TDBaiBrain.route("собери мне свеклу и бананы на неделю");
assert.equal(out.provider,"inner","planning request must continue through full brain");
out=await context.window.TDBaiBrain.route("добавь свеклу и бананы");
assert.equal(out.provider,"inner","explicit edit must continue through normal edit logic");
assert.equal(innerCalls,2);

context.window.TDShoppingOptimizer.optimize({intent:"literal",budget:3000,peopleCount:4,duration:7,requiredProducts:["beet","banana"]});
assert.equal(optimizedState.budget,null,"old budget must not inflate literal quantities");
assert.equal(optimizedState.peopleCount,1,"old people count must not inflate literal quantities");
assert.equal(optimizedState.duration,1,"old duration must not inflate literal quantities");
context.window.TDShoppingOptimizer.optimize({intent:"build",budget:3000,peopleCount:4,duration:7});
assert.equal(optimizedState.budget,3000,"normal planning context must stay untouched");
assert.equal(optimizedState.peopleCount,4);
assert.equal(optimizedState.duration,7);

console.log("Bai literal basket passed: exact products, local quantity binding, context isolation and fail-closed unknowns.");
