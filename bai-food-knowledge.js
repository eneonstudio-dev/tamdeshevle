(()=>{"use strict";
const FOOD={
 milk:{category:"dairy",roles:["protein","dairy"],meals:["breakfast","snack"],pairs:["eggs","bread","cottage","banana"],subs:["cottage","eggs"],prep:"ready",easy:5},
 bread:{category:"grain",roles:["carb","base"],meals:["breakfast","snack","dinner"],pairs:["eggs","ham","chicken","cottage"],subs:["pasta","buck"],prep:"ready",easy:5},
 chicken:{category:"meat",roles:["protein","main"],meals:["lunch","dinner"],pairs:["buck","pasta","bread"],subs:["eggs","ham","dumplings"],prep:"cook",easy:2},
 banana:{category:"fruit",roles:["fruit","snack","carb"],meals:["breakfast","snack"],pairs:["milk","cottage"],subs:["apple"],prep:"ready",easy:5},
 oil:{category:"fat",roles:["fat","cooking"],meals:["lunch","dinner"],pairs:["chicken","buck","pasta"],subs:[],prep:"ingredient",easy:1},
 eggs:{category:"eggs",roles:["protein","main"],meals:["breakfast","lunch","dinner"],pairs:["bread","milk","ham","buck","noodles"],subs:["chicken","cottage","ham"],prep:"quick",easy:4},
 buck:{category:"grain",roles:["carb","base","side"],meals:["lunch","dinner"],pairs:["chicken","eggs","sour"],subs:["pasta","bread"],prep:"cook",easy:2},
 sour:{category:"dairy",roles:["dairy","sauce"],meals:["lunch","dinner"],pairs:["dumplings","buck"],subs:[],prep:"ready",easy:5},
 sugar:{category:"sweetener",roles:["sweet"],meals:["breakfast"],pairs:["milk"],subs:[],prep:"ingredient",easy:5},
 pasta:{category:"grain",roles:["carb","base","side"],meals:["lunch","dinner"],pairs:["chicken","ham","eggs"],subs:["buck","bread"],prep:"cook",easy:3},
 water:{category:"drink",roles:["drink"],meals:["any"],pairs:[],subs:[],prep:"ready",easy:5},
 apple:{category:"fruit",roles:["fruit","snack"],meals:["breakfast","snack"],pairs:["cottage"],subs:["banana"],prep:"ready",easy:5},
 ham:{category:"meat",roles:["protein","ready"],meals:["breakfast","snack","dinner"],pairs:["bread","eggs","pasta"],subs:["eggs","chicken","cottage"],prep:"ready",easy:5},
 dumplings:{category:"prepared",roles:["protein","carb","main","quick"],meals:["lunch","dinner"],pairs:["sour"],subs:["noodles","eggs"],prep:"quick",easy:4},
 noodles:{category:"prepared",roles:["carb","main","quick"],meals:["lunch","dinner"],pairs:["eggs"],subs:["dumplings","pasta"],prep:"quick",easy:5},
 waffles:{category:"snack",roles:["sweet","snack"],meals:["snack"],pairs:["milk"],subs:["banana","apple"],prep:"ready",easy:5},
 cottage:{category:"dairy",roles:["protein","dairy","ready"],meals:["breakfast","snack"],pairs:["banana","apple","bread"],subs:["eggs","milk"],prep:"ready",easy:5}
};
const MEALS={
 breakfast:{needs:[["protein"],["carb","fruit"]],label:"завтрак"},
 lunch:{needs:[["protein"],["carb","base"]],label:"обед"},
 dinner:{needs:[["protein"],["carb","base"]],label:"ужин"},
 snack:{needs:[["fruit","snack","protein"]],label:"перекус"}
};
const RECIPES=[
 {id:"chicken_buck",meal:"dinner",title:"Курица с гречкой",items:["chicken","buck","oil"]},
 {id:"chicken_pasta",meal:"dinner",title:"Курица с макаронами",items:["chicken","pasta","oil"]},
 {id:"eggs_bread",meal:"breakfast",title:"Яйца с хлебом",items:["eggs","bread"]},
 {id:"cottage_fruit",meal:"breakfast",title:"Творог с фруктами",items:["cottage","banana"]},
 {id:"ham_eggs",meal:"breakfast",title:"Яйца с ветчиной и хлебом",items:["eggs","ham","bread"]},
 {id:"dumplings_sour",meal:"dinner",title:"Пельмени со сметаной",items:["dumplings","sour"]},
 {id:"noodles_eggs",meal:"dinner",title:"Лапша с яйцом",items:["noodles","eggs"]},
 {id:"buck_eggs",meal:"lunch",title:"Гречка с яйцом",items:["buck","eggs"]}
];
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const info=id=>FOOD[id]||null;
function roles(ids){return uniq((ids||[]).flatMap(id=>info(id)?.roles||[]))}
function coverage(ids,meal=null){const r=roles(ids),missing=[];if(!r.includes("protein"))missing.push("protein");if(!r.some(x=>x==="carb"||x==="base"))missing.push("base");if(!r.includes("fruit"))missing.push("fruit");if(!r.includes("drink"))missing.push("drink");let mealMissing=[];if(meal&&MEALS[meal])mealMissing=MEALS[meal].needs.filter(group=>!group.some(x=>r.includes(x))).map(group=>group[0]);return{roles:r,missing,mealMissing,score:Math.max(0,100-missing.length*16-mealMissing.length*18)}}
function compatible(a,b){return Boolean(info(a)?.pairs?.includes(b)||info(b)?.pairs?.includes(a))}
function recipesFor(ids,meal){const set=new Set(ids||[]);return RECIPES.map(r=>({...r,have:r.items.filter(x=>set.has(x)),missing:r.items.filter(x=>!set.has(x))})).filter(r=>(!meal||r.meal===meal)&&r.have.length).sort((a,b)=>a.missing.length-b.missing.length||b.have.length-a.have.length)}
function substitutions(id,available=[]){const allowed=new Set(available||[]);const all=info(id)?.subs||[];return allowed.size?all.filter(x=>allowed.has(x)):all}
function suggestAdditions(ids,meal=null){const have=new Set(ids||[]),c=coverage(ids,meal),out=[];const roleCandidates={protein:["eggs","chicken","cottage","ham"],base:["buck","pasta","bread","noodles"],fruit:["banana","apple"],drink:["water"]};for(const miss of [...c.mealMissing,...c.missing])for(const id of roleCandidates[miss]||[]){if(!have.has(id)){out.push(id);break}}return uniq(out)}
function balancePlan(ids,meal=null){const c=coverage(ids,meal),recipes=recipesFor(ids,meal).slice(0,3),add=suggestAdditions(ids,meal);return{coverage:c,recipes,additions:add,balanced:c.score>=72&&c.mealMissing.length===0}}
function scorePlan(ids,meal=null){const b=balancePlan(ids,meal);let score=b.coverage.score;const pairs=(ids||[]).flatMap((a,i)=>ids.slice(i+1).map(b=>compatible(a,b)?1:0)).reduce((a,b)=>a+b,0);score+=Math.min(12,pairs*2);if(b.recipes.some(r=>r.missing.length===0))score+=8;return Math.min(120,score)}
function explain(ids,meal=null){const b=balancePlan(ids,meal),bits=[];if(b.coverage.mealMissing.includes("protein")||b.coverage.missing.includes("protein"))bits.push("не хватает белковой основы");if(b.coverage.mealMissing.includes("base")||b.coverage.missing.includes("base"))bits.push("не хватает нормального гарнира или основы");if(b.coverage.missing.includes("fruit"))bits.push("нет фруктов для перекуса");if(b.coverage.missing.includes("drink"))bits.push("нет базового напитка");const ready=b.recipes.find(r=>r.missing.length===0);if(ready)bits.push(`уже складывается блюдо «${ready.title}»`);else if(b.recipes[0]?.missing.length===1)bits.push(`до «${b.recipes[0].title}» не хватает одного продукта`);return bits}
window.TDBaiFoodKnowledge={food:FOOD,meals:MEALS,recipes:RECIPES,info,roles,coverage,compatible,recipesFor,substitutions,suggestAdditions,balancePlan,scorePlan,explain,sources:{foodOn:"generic food categories and facets",openFoodFacts:"product/category taxonomy model",mealDB:"recipe and ingredient relationship model",usda:"nutrition-enrichment source slot; no numeric nutrients embedded in this MVP"}};
})();