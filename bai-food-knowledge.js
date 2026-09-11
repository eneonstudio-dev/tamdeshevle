(()=>{"use strict";
const FOOD={
 milk:{roles:["protein","dairy","breakfast"],meals:["breakfast","snack"],pairs:["eggs","bread","cottage"],easy:3},
 bread:{roles:["carb","base"],meals:["breakfast","snack","dinner"],pairs:["eggs","ham","chicken","cottage"],easy:5},
 chicken:{roles:["protein","main"],meals:["lunch","dinner"],pairs:["buck","pasta","bread"],easy:2},
 banana:{roles:["fruit","snack","carb"],meals:["breakfast","snack"],pairs:["milk","cottage"],easy:5},
 oil:{roles:["fat","cooking"],meals:["lunch","dinner"],pairs:["chicken","buck","pasta"],easy:1},
 eggs:{roles:["protein","breakfast","main"],meals:["breakfast","dinner"],pairs:["bread","milk","ham"],easy:4},
 buck:{roles:["carb","side","base"],meals:["lunch","dinner"],pairs:["chicken","eggs"],easy:2},
 sour:{roles:["dairy","sauce"],meals:["lunch","dinner"],pairs:["dumplings","buck"],easy:5},
 sugar:{roles:["sweet"],meals:["breakfast"],pairs:["milk"],easy:5},
 pasta:{roles:["carb","side","base"],meals:["lunch","dinner"],pairs:["chicken","ham"],easy:3},
 water:{roles:["drink"],meals:["any"],pairs:[],easy:5},
 apple:{roles:["fruit","snack"],meals:["breakfast","snack"],pairs:["cottage"],easy:5},
 ham:{roles:["protein","ready"],meals:["breakfast","snack","dinner"],pairs:["bread","eggs","pasta"],easy:5},
 dumplings:{roles:["protein","carb","main","quick"],meals:["lunch","dinner"],pairs:["sour"],easy:4},
 noodles:{roles:["carb","main","quick"],meals:["lunch","dinner"],pairs:["eggs"],easy:5},
 waffles:{roles:["sweet","snack"],meals:["snack"],pairs:["milk"],easy:5},
 cottage:{roles:["protein","dairy"],meals:["breakfast","snack"],pairs:["banana","apple"],easy:5}
};
const RECIPES=[
 {id:"chicken_buck",meal:"dinner",title:"Курица с гречкой",items:["chicken","buck","oil"]},
 {id:"chicken_pasta",meal:"dinner",title:"Курица с макаронами",items:["chicken","pasta","oil"]},
 {id:"eggs_bread",meal:"breakfast",title:"Яйца с хлебом",items:["eggs","bread"]},
 {id:"cottage_fruit",meal:"breakfast",title:"Творог с фруктами",items:["cottage","banana","apple"]},
 {id:"ham_eggs",meal:"breakfast",title:"Яйца с ветчиной",items:["eggs","ham","bread"]},
 {id:"dumplings_sour",meal:"dinner",title:"Пельмени со сметаной",items:["dumplings","sour"]},
 {id:"noodles_eggs",meal:"dinner",title:"Лапша с яйцом",items:["noodles","eggs"]}
];
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function roles(ids){return uniq((ids||[]).flatMap(id=>FOOD[id]?.roles||[]))}
function coverage(ids){const r=roles(ids),missing=[];if(!r.includes("protein"))missing.push("protein");if(!r.some(x=>x==="carb"||x==="base"))missing.push("base");if(!r.includes("fruit"))missing.push("fruit");return{roles:r,missing,score:Math.max(0,100-missing.length*24)}}
function compatible(a,b){return Boolean(FOOD[a]?.pairs?.includes(b)||FOOD[b]?.pairs?.includes(a))}
function recipesFor(ids,meal){const set=new Set(ids||[]);return RECIPES.map(r=>({...r,have:r.items.filter(x=>set.has(x)),missing:r.items.filter(x=>!set.has(x))})).filter(r=>(!meal||r.meal===meal)&&r.have.length).sort((a,b)=>a.missing.length-b.missing.length)}
function enrich(ids){return(ids||[]).map(id=>({id,...FOOD[id]})).filter(x=>x.roles)}
window.TDBaiFoodKnowledge={food:FOOD,recipes:RECIPES,roles,coverage,compatible,recipesFor,enrich,sources:{openFoodFacts:"taxonomy model inspired by Open Food Facts categories",mealDB:"meal/ingredient relationship model compatible with TheMealDB",usda:"nutrition enrichment slot compatible with FoodData Central"}};
})();