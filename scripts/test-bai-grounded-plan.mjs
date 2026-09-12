import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const products=[
  {id:"milk",name:"Молоко 2,5%",pack:"1 л",price:95},
  {id:"eggs_c1",name:"Яйца куриные С1",pack:"10 шт",price:110},
  {id:"bread_dark",name:"Хлеб дарницкий",pack:"650 г",price:65},
  {id:"chicken_fil",name:"Филе куриное",pack:"1 кг",price:350},
  {id:"buckwheat",name:"Гречка",pack:"800 г",price:90},
  {id:"cheese_hard",name:"Сыр твёрдый",pack:"200 г",price:230},
  {id:"water",name:"Вода негазированная",pack:"5 л",price:109},
  {id:"banana",name:"Бананы",pack:"1 кг",price:119},
  {id:"apple",name:"Яблоки",pack:"1 кг",price:137},
  {id:"dumplings",name:"Пельмени",pack:"500 г",price:210},
  {id:"noodles",name:"Лапша",pack:"90 г",price:49},
  {id:"waffles",name:"Вафли",pack:"200 г",price:90}
];
const context={console,JSON,Math,Number,String,Object,Array,Set,Map};
context.window=context;context.state={city:"msk",storeId:"pyat"};context.STORES=[{id:"pyat",city:["msk"],kind:"shop"}];
context.TDStoreAdapters={catalog:()=>products,adapter:storeId=>({getProduct:id=>products.find(x=>x.id===id)||null,getPrice:id=>({value:products.find(x=>x.id===id)?.price??null,quality:"ESTIMATED"})})};
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL("../shopping-optimizer.js",import.meta.url),"utf8"),context);

const plans=context.TDShoppingOptimizer.optimize({budget:1500,peopleCount:1,duration:3,cookingPreference:"minimal",mode:"one",stores:["pyat"],requiredProducts:["water"],preferredProducts:[],existingProducts:["гречка","сыр"],excludedProducts:[],excludedBrands:[],quantityTargets:{},selectionMode:"auto"});
const ids=plans[0].products.map(x=>x.id);
assert.ok(ids.includes("water"),"an explicitly required product must survive optimization");
assert.ok(ids.includes("eggs_c1")&&ids.includes("bread_dark"),"legacy meal knowledge must resolve to current catalog ids");
assert.equal(ids.includes("buckwheat"),false,"home stock must not be bought again");
assert.equal(ids.includes("cheese_hard"),false,"cheese at home must not be bought again");
assert.equal(ids.some(id=>["eggs","bread","buck"].includes(id)),false,"no stale product ids may enter a production plan");
console.log("Bai grounded plan passed: required water, current catalog ids and home-stock exclusions.");
