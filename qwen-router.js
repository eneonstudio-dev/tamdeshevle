(() => {
  "use strict";

  const STORAGE = {
    enabled: "td_qwen_enabled",
    endpoint: "td_qwen_endpoint",
    model: "td_qwen_model"
  };
  const DEFAULT_ENDPOINT = "http://127.0.0.1:11434/v1/chat/completions";
  const DEFAULT_MODEL = "qwen3:4b";
  const ALLOWED = new Set([
    "UNDO","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING",
    "ADD_PREFERENCE","CHANGE_STORE","SET_MODE","REMOVE_PRODUCT","REQUIRE",
    "PREFER","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","NOTE"
  ]);

  const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const set = (key,value) => { try { localStorage.setItem(key,value); } catch {} };
  const remove = key => { try { localStorage.removeItem(key); } catch {} };
  const enabled = () => get(STORAGE.enabled) === "1";
  const config = () => ({
    enabled: enabled(),
    endpoint: get(STORAGE.endpoint) || DEFAULT_ENDPOINT,
    model: get(STORAGE.model) || DEFAULT_MODEL
  });

  function cleanJson(text){
    const raw=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
    const first=raw.indexOf("{"),last=raw.lastIndexOf("}");
    if(first<0||last<first)throw new Error("Qwen returned no JSON");
    return JSON.parse(raw.slice(first,last+1));
  }

  function validateOperations(value){
    if(!Array.isArray(value))return null;
    const ops=value.filter(op=>op&&ALLOWED.has(op.type)).slice(0,20).map(op=>({type:op.type,value:op.value}));
    return ops.length?ops:null;
  }

  function stateContext(){
    const s=window.TDShoppingState?.get?.();
    if(!s)return{};
    return {
      budget:s.budget||null,
      peopleCount:s.peopleCount||null,
      duration:s.duration||null,
      mode:s.mode||null,
      stores:s.stores||[],
      requiredProducts:s.requiredProducts||[],
      preferredProducts:s.preferredProducts||[],
      excludedBrands:s.excludedBrands||[],
      existingProducts:s.existingProducts||[]
    };
  }

  async function callLocalQwen(text){
    const cfg=config();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    const system=`Ты языковой маршрутизатор ассистента покупок «Бай» сервиса «Там дешевле».\nТвоя задача — только понять команду пользователя и вернуть JSON без пояснений.\nФормат: {"operations":[{"type":"...","value":...}]}\nРазрешённые type: CHANGE_BUDGET, SET_PEOPLE, SET_DURATION, SET_COOKING, ADD_PREFERENCE, CHANGE_STORE, SET_MODE, REMOVE_PRODUCT, REQUIRE, PREFER, EXCLUDE_BRAND, HAS_AT_HOME, EXCLUDE_TAG, NOTE, UNDO.\nИзвестные id магазинов: pyat, magnit, perek, lenta, dixy, lavka, vprok.\nИзвестные id базовых продуктов: milk, bread, chicken, banana, oil, eggs, buck, sour, sugar, pasta, water, apple, ham, dumplings, noodles, waffles, cottage.\nНе придумывай цены. Не выбирай конкретную цену. Не меняй корзину сам. Если смысл не укладывается в операции — NOTE с исходным смыслом. Возвращай только JSON.`;
    try{
      const response=await fetch(cfg.endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:cfg.model,
          messages:[
            {role:"system",content:system},
            {role:"user",content:`Текущее состояние: ${JSON.stringify(stateContext())}\nКоманда: ${text}`}
          ],
          temperature:0.1,
          stream:false
        }),
        signal:controller.signal
      });
      if(!response.ok)throw new Error(`Qwen HTTP ${response.status}`);
      const data=await response.json();
      const parsed=cleanJson(data?.choices?.[0]?.message?.content);
      const operations=validateOperations(parsed.operations);
      if(!operations)throw new Error("Qwen returned invalid operations");
      return {ok:true,provider:"local-qwen",model:cfg.model,operations};
    } finally { clearTimeout(timer); }
  }

  async function route(text){
    if(!enabled())return {ok:true,provider:"rules",operations:null};
    try{return await callLocalQwen(text)}
    catch(error){
      console.warn("[TD Qwen] fallback to local rules:",error);
      return {ok:true,provider:"rules",operations:null,error:String(error?.message||error)};
    }
  }

  window.TDQwenRouter={
    route,
    status:config,
    enable(options={}){
      if(options.endpoint)set(STORAGE.endpoint,options.endpoint);
      if(options.model)set(STORAGE.model,options.model);
      set(STORAGE.enabled,"1");
      return config();
    },
    disable(){remove(STORAGE.enabled);return config();},
    configure(options={}){
      if(options.endpoint)set(STORAGE.endpoint,options.endpoint);
      if(options.model)set(STORAGE.model,options.model);
      return config();
    },
    reset(){Object.values(STORAGE).forEach(remove);return config();}
  };
})();
