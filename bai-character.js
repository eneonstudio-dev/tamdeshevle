(()=>{
  "use strict";
  if(window.TDBaiCharacter)return;

  const GENERIC_OPENERS=[
    /^\s*(?:отличный|хороший|прекрасный)\s+вопрос[!.]?\s*/i,
    /^\s*(?:конечно|разумеется|безусловно)[!.]?\s*/i,
    /^\s*(?:с\s+удовольствием|я\s+рад\s+помочь|рад\s+помочь)[!.]?\s*/i,
    /^\s*давайте\s+(?:вместе\s+)?разбер[её]мся[!.]?\s*/i,
    /^\s*привет[!.]?\s*👋?\s*я\s+бай[^.!?]*[.!?]?\s*/i
  ];
  const SERIOUS=/(?:списал(?:и|ось)?\s+деньг|деньги\s+(?:пропал|списал|не вернул)|оплат(?:а|ил|ила|или).*(?:не прош|нет заказ|ошиб)|возврат|банк|карт(?:а|ы|ой)|мошенн|обманул|здоров|аллерг|отрав|реб[её]н|безопас|травм|долг|кредит|последн(?:ие|их)\s+деньг)/i;
  const USER_PROFANITY=/(?:бля|бляд|хуй|хуйн|пизд|еба|ёба|ебан|заеб|проеб|охуе|нихуя|нахуй)/i;
  const JOKE_ONLY=/(?:понюхаю интернет|не потрать всё сразу|не потрать все сразу|разработчики.*задум|разработчики.*нерв|я свою работу сделал|исторический документ)/i;
  const EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
  let brainWrapped=false,conversationWrapped=false;

  const FALLBACK_PROMPT=[
    "Ты Бай, главный AI-персонаж и интеллектуальный интерфейс Votonobay. Ты не изображаешь Бая — ты и есть Бай.",
    "Твоя работа — защищать человека не от высокой цены как таковой, а от плохого решения: бессмысленной переплаты, лишней поездки, неудобной корзины, сомнительной выгоды и ненужной сложности.",
    "Сначала помоги. Потом, только если уместно, прояви характер.",
    "Порядок ответа: факт -> что делать/что ты сделал -> необязательная короткая реакция Бая.",
    "Пиши коротко, простым русским языком. Допустимы отдельные вводные: «Так.», «Во.», «Хм.», «Есть нюанс.», но не превращай их в тик.",
    "Юмор сухой и наблюдательный. Не шути ради шутки. Большинство ответов могут быть без шутки.",
    "Считай, что человек не тупой, а занятой. Не унижай пользователя и не делай его объектом шутки.",
    "Не защищай Votonobay из корпоративной лояльности. Если конкурент реально выгоднее, так и скажи.",
    "Дороже допустимо, если это разумнее. Экономия не культ.",
    "Если ситуация серьёзная — оплата, потеря денег, безопасность, здоровье, сильный стресс — полностью выключи стёб и помогай спокойно.",
    "Мат — редкая специя. Только если пользователь сам так говорит и это естественно; никогда не направляй мат на пользователя.",
    "Не используй корпоративные клише и не изображай молодёжный сленг.",
    "Никогда не выдумывай цену, наличие, скидку, магазин, память пользователя или подтверждение. Если не уверен — скажи это и перепроверь/уточни.",
    "Фирменные штуки вроде «понюхаю интернет» и шуток про разработчиков используй редко: это пасхалки, не catchphrases.",
    "Узнаваемость Бая идёт от мировоззрения: полезный скепсис, сухая забота, самостоятельность и ненависть к бессмысленности."
  ].join("\n");

  function systemPrompt(){
    const canonical=window.TDBaiSystemPromptV1;
    return canonical&&canonical.version==="bai-system-prompt-v1.0"&&typeof canonical.text==="string"?canonical.text:FALLBACK_PROMPT;
  }

  function isSerious(userText="",reply=""){return SERIOUS.test(`${userText} ${reply}`)}
  function removeGenericOpeners(text){let out=text;for(const pattern of GENERIC_OPENERS)out=out.replace(pattern,"");return out}
  function stripSeriousJokes(text){
    const parts=String(text||"").split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(Boolean);
    const kept=parts.filter(x=>!JOKE_ONLY.test(x));
    return kept.join(" ");
  }
  function filter(reply,{userText="",serious=null}={}){
    const original=String(reply??"").trim();if(!original)return original;
    let out=original.replace(EMOJI,"").replace(/\s+([,.!?])/g,"$1").replace(/!{2,}/g,"!");
    out=removeGenericOpeners(out)
      .replace(/к\s+сожалению,?\s+произошла\s+техническая\s+ошибка[.!]?/ig,"Не получилось.")
      .replace(/благодарим\s+(?:вас\s+)?за\s+терпение[.!]?/ig,"")
      .replace(/\s{2,}/g," ").trim();
    const hard=serious==null?isSerious(userText,out):Boolean(serious);
    if(hard)out=stripSeriousJokes(out);
    if(!USER_PROFANITY.test(userText))out=out.replace(/(?:бля(?:дь)?|хуйня|проебал|нахуя|нахуй)/ig,match=>({"хуйня":"ерунда","проебал":"упустил","нахуя":"зачем","нахуй":""}[match.toLowerCase()]||""));
    out=out.replace(/\s{2,}/g," ").trim();
    return out||original.replace(EMOJI,"").trim();
  }

  function styleResult(result,userText){
    if(!result||typeof result!=="object")return result;
    if(typeof result.reply==="string")result.reply=filter(result.reply,{userText});
    if(typeof result.message==="string")result.message=filter(result.message,{userText});
    return result;
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__baiCharacterWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiCharacterWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){return styleResult(await original(raw,history,...rest),raw)};
    brainWrapped=true;return brain;
  }
  function wrapConversation(conversation){
    if(!conversation?.apply||conversation.__baiCharacterWrapped)return conversation;
    const original=conversation.apply.bind(conversation);
    Object.defineProperty(conversation,"__baiCharacterWrapped",{value:true,configurable:true});
    conversation.apply=function(raw,...rest){const value=original(raw,...rest);return value?.then?value.then(x=>styleResult(x,raw)):styleResult(value,raw)};
    conversationWrapped=true;return conversation;
  }
  function installGlobal(name,wrapper){
    const current=window[name];if(current){wrapper(current);return true}
    const desc=Object.getOwnPropertyDescriptor(window,name);
    if(desc?.get&&desc?.set&&desc.configurable){
      Object.defineProperty(window,name,{configurable:true,enumerable:desc.enumerable,get:desc.get,set(next){desc.set.call(window,next);const ready=desc.get.call(window);if(ready)wrapper(ready)}});return true;
    }
    let value;try{Object.defineProperty(window,name,{configurable:true,enumerable:true,get(){return value},set(next){value=wrapper(next)}});return true}catch{return false}
  }
  function install(){installGlobal("TDBaiBrain",wrapBrain);installGlobal("TDShoppingConversation",wrapConversation);return status()}
  function status(){return{brainWrapped,conversationWrapped,version:"character-v1.1",systemPromptVersion:window.TDBaiSystemPromptV1?.version||"fallback"}}

  window.TDBaiCharacter={systemPrompt,filter,isSerious,install,status,rules:{maxJokesPerReply:1,profanity:"mirror-only",seriousMode:"no-humor",order:["fact","action","optional-character"],systemPrompt:"bai-system-prompt-v1.0"}};
  install();
})();
