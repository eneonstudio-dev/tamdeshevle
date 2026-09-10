import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync("smart-substitutions.js","utf8");
const PRODUCTS=[
  {id:"milk",name:"Молоко 2,5%",pack:"1 л",prices:{pyat:104},bring:{pyat:119}},
  {id:"bread",name:"Хлеб дарницкий",pack:"650 г",prices:{pyat:69},bring:{pyat:79}}
];
const STORES=[{id:"pyat",kind:"shop"}];
const state={screen:"cart",storeId:"pyat",cart:{milk:2,bread:1},city:"msk",address:""};
const window={state,TDCompare:{defaultChannel(){return"shelf";}},dispatchEvent(){},render(){},persist(){}};
const document={readyState:"loading",addEventListener(){},getElementById(){return null;},querySelector(){return null;},createElement(){return{style:{},appendChild(){}};},head:{appendChild(){}}};
class MutationObserver{constructor(){}observe(){}}
const context=vm.createContext({window,document,MutationObserver,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},PRODUCTS,STORES,state,localStorage:{setItem(){}}});
vm.runInContext(code,context,{filename:"smart-substitutions.js"});

function assert(ok,msg){if(!ok)throw new Error(msg);}
const api=window.TDSmartSubstitutions;
assert(api,"API missing");
api.installCatalog();
assert(PRODUCTS.some(p=>p.id==="milk_value"),"alternative catalog not installed");
const list=api.suggestions();
const milk=list.find(x=>x.original.id==="milk");
assert(milk,"milk suggestion missing");
assert(milk.alt.id==="milk_value","wrong milk substitute");
assert(milk.save===30,"quantity-aware savings must be 30 RUB");
assert(!list.some(x=>x.original.id==="bread"),"bread saving below threshold must be hidden");
assert(api.apply("milk","milk_value")===true,"apply failed");
assert(!state.cart.milk&&state.cart.milk_value===2,"cart replacement must preserve quantity");
assert(api.suggestions().every(x=>x.original.id!=="milk"),"replaced item must not be suggested again");
console.log("Smart substitutions tests passed.");
