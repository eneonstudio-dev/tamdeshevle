(function(){
  "use strict";
  const KEY="td:shopping-session:v1";
  const blank=()=>({id:"shop_"+Date.now(),budget:null,currentTotal:0,location:"",stores:[],products:[],existingProducts:[],requiredProducts:[],preferredProducts:[],excludedProducts:[],excludedBrands:[],preferences:[],cookingPreference:"normal",deliveryPreference:"any",peopleCount:1,duration:1,userNotes:[],mode:"multi",history:[],updatedAt:new Date().toISOString()});
  function load(){try{return{...blank(),...JSON.parse(localStorage.getItem(KEY)||"null")}}catch{return blank()}}
  let state=load();
  const snapshot=()=>JSON.parse(JSON.stringify({...state,history:[]}));
  function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent("td:shopping-state",{detail:snapshot()}));return state;}
  function commit(type,mutate,description){state.history.push({type,before:snapshot(),description,at:new Date().toISOString()});if(state.history.length>30)state.history.shift();mutate(state);return save();}
  function undo(){const event=state.history.pop();if(!event)return{ok:false,state,message:"Отменять пока нечего"};const rest=state.history;state={...blank(),...event.before,history:rest};save();return{ok:true,state,message:`Вернул как было: ${event.description||event.type}`};}
  function reset(){state=blank();return save();}
  function syncCart(){if(!window.state)return;state.cart=Object.fromEntries(state.products.filter(x=>x.sourceId).map(x=>[x.sourceId,x.quantity||1]));window.state.cart={...state.cart};window.state.cartTouched=true;try{const saved=JSON.parse(localStorage.getItem("td")||"{}");localStorage.setItem("td",JSON.stringify({...saved,cart:window.state.cart,cartTouched:true}))}catch{}window.render?.();}
  window.TDShoppingState={get:()=>state,commit,undo,reset,save,snapshot,syncCart,operations:["ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_QUANTITY","CHANGE_STORE","CHANGE_BUDGET","ADD_CONSTRAINT","REMOVE_CONSTRAINT"]};
})();
