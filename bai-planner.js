(() => {
  "use strict";

  const clone = value => JSON.parse(JSON.stringify(value || {}));
  const uniq = values => [...new Set((values || []).filter(Boolean))];
  const low = value => String(value || "").toLowerCase().replace(/ё/g, "е");

  const PRESETS = {
    economy: {
      title: "Экономный",
      blurb: "минимум лишних трат, можно разнести покупки по магазинам",
      required: ["eggs", "buck", "pasta", "bread", "water"],
      apply(base){
        const s=clone(base); s.mode="multi"; s.preferences=uniq([...(s.preferences||[]),"budget"]);
        if(s.budget) s.budget=Math.max(500,Math.round(s.budget*.78));
        s.requiredProducts=uniq([...(s.requiredProducts||[]),...this.required]); return s;
      },
      operations(base){const ops=[{type:"SET_MODE",value:"multi"},{type:"ADD_PREFERENCE",value:"budget"}];if(base.budget)ops.unshift({type:"CHANGE_BUDGET",value:Math.max(500,Math.round(base.budget*.78))});this.required.forEach(id=>ops.push({type:"REQUIRE",value:id}));ops.push({type:"REOPTIMIZE"});return ops;}
    },
    balanced: {
      title: "Сбалансированный",
      blurb: "нормальный запас еды без сильного перекоса в цену или удобство",
      required: ["chicken", "eggs", "bread", "banana", "apple", "water"],
      apply(base){const s=clone(base);s.preferences=uniq([...(s.preferences||[]),"balanced"]);s.requiredProducts=uniq([...(s.requiredProducts||[]),...this.required]);return s;},
      operations(){const ops=[{type:"ADD_PREFERENCE",value:"balanced"}];this.required.forEach(id=>ops.push({type:"REQUIRE",value:id}));ops.push({type:"REOPTIMIZE"});return ops;}
    },
    easy: {
      title: "Без возни",
      blurb: "еда, которую можно быстро съесть или приготовить с минимумом действий",
      required: ["dumplings", "noodles", "eggs", "banana", "water"],
      apply(base){const s=clone(base);s.cookingPreference="minimal";s.preferences=uniq([...(s.preferences||[]),"convenience"]);s.requiredProducts=uniq([...(s.requiredProducts||[]),...this.required]);return s;},
      operations(){const ops=[{type:"SET_COOKING",value:"minimal"},{type:"ADD_PREFERENCE",value:"convenience"}];this.required.forEach(id=>ops.push({type:"REQUIRE",value:id}));ops.push({type:"REOPTIMIZE"});return ops;}
    },
    hearty: {
      title: "Сытный",
      blurb: "больше основы и плотной еды, меньше пустых перекусов",
      required: ["chicken", "eggs", "buck", "pasta", "bread"],
      apply(base){const s=clone(base);s.preferences=uniq([...(s.preferences||[]),"hearty"]);s.requiredProducts=uniq([...(s.requiredProducts||[]),...this.required]);return s;},
      operations(){const ops=[{type:"ADD_PREFERENCE",value:"hearty"}];this.required.forEach(id=>ops.push({type:"REQUIRE",value:id}));ops.push({type:"REOPTIMIZE"});return ops;}
    },
    healthy: {
      title: "Полегче",
      blurb: "больше обычной еды и фруктов, меньше случайных сладких добивок",
      required: ["chicken", "eggs", "buck", "apple", "banana", "water", "cottage"],
      apply(base){const s=clone(base);s.preferences=uniq([...(s.preferences||[]),"healthy"]);s.requiredProducts=uniq([...(s.requiredProducts||[]),...this.required]);return s;},
      operations(){const ops=[{type:"ADD_PREFERENCE",value:"healthy"}];this.required.forEach(id=>ops.push({type:"REQUIRE",value:id}));ops.push({type:"REOPTIMIZE"});return ops;}
    }
  };

  function choosePresetIds(state, text){
    const t=low(text), prefs=(state.preferences||[]).join(" ");
    if(/готовить.*(лень|не хочу)|без готовки|быстро/.test(t)||state.cookingPreference==="minimal") return ["easy","economy","balanced"];
    if(/сытн|плотн/.test(t)||prefs.includes("hearty")) return ["hearty","balanced","economy"];
    if(/полез|полегче|здоров/.test(t)||prefs.includes("healthy")) return ["healthy","balanced","economy"];
    if(/дешев|эконом|бюджет/.test(t)||prefs.includes("budget")) return ["economy","balanced","easy"];
    return ["balanced","economy","easy"];
  }

  function score(id,state,text,plan){
    const t=low(text),prefs=(state.preferences||[]).join(" "); let n=50;
    if(id==="economy"&&(/дешев|эконом|бюджет/.test(t)||prefs.includes("budget")))n+=35;
    if(id==="easy"&&(/лень|без готовки|быстро/.test(t)||state.cookingPreference==="minimal"))n+=35;
    if(id==="hearty"&&(/сытн|плотн/.test(t)||prefs.includes("hearty")))n+=35;
    if(id==="healthy"&&(/полез|здоров|полегче/.test(t)||prefs.includes("healthy")))n+=35;
    if(id==="balanced")n+=10;
    if(state.budget&&plan.total<=state.budget)n+=10;
    if(state.budget&&plan.total>state.budget)n-=30;
    return n;
  }

  function build(state,text=""){
    if(!window.TDShoppingOptimizer) return {strategies:[],recommended:null};
    const base=clone(state), ids=choosePresetIds(base,text), strategies=[];
    for(const id of ids){
      const preset=PRESETS[id], scenario=preset.apply(base), plans=window.TDShoppingOptimizer.optimize(scenario)||[], best=plans[0];
      if(!best) continue;
      strategies.push({
        id,title:preset.title,description:preset.blurb,total:Math.round(best.total||0),goods:Math.round(best.goods||0),stores:(best.stores||[]).length,
        productCount:(best.products||[]).length,unitCount:(best.products||[]).reduce((n,p)=>n+(p.quantity||1),0),
        productNames:(best.products||[]).slice(0,5).map(p=>p.name),operations:preset.operations(base),score:score(id,base,text,best),actionText:`Выбираю вариант «${preset.title}»`
      });
    }
    strategies.sort((a,b)=>b.score-a.score);
    const recommended=strategies[0]||null;
    return {strategies,recommended};
  }

  function explain(result,state){
    const r=result?.recommended, list=result?.strategies||[]; if(!r)return "";
    const cheapest=[...list].sort((a,b)=>a.total-b.total)[0];
    let why=`Я бы выбрал «${r.title}»: ${r.description}.`;
    if(cheapest&&cheapest.id!==r.id){const diff=r.total-cheapest.total;if(diff>0)why+=` Он примерно на ${diff} ₽ дороже самого дешёвого, но лучше попадает в твою задачу.`;}
    else if(cheapest&&cheapest.id===r.id) why+=" И он же сейчас выходит самым дешёвым из нормальных вариантов.";
    if(state.budget) why+=` Ориентир по бюджету — ${state.budget} ₽.`;
    return why;
  }

  window.TDBaiPlanner={build,explain,presets:PRESETS};
})();
