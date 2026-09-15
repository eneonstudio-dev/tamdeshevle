const GENERIC_AI = [
  /(?:^|\s)отличный вопрос[!.]?/i,
  /(?:^|\s)конечно[!.]?/i,
  /(?:^|\s)с удовольствием[!.]?/i,
  /(?:^|\s)я рад помочь[!.]?/i,
  /давайте (?:вместе )?разбер[её]мся/i,
  /уважаем(?:ый|ая) пользователь/i,
  /надеюсь,? (?:эта|данная) информация была полез/i,
  /есть ли что-то ещё,? с чем я могу помочь/i
];

const PROFANITY = /(?:бля(?:дь)?|хуй|хуйн|пизд|еба|ёба|ебан|заеб|проеб|охуе|нахуй)/i;
const SERIOUS_JOKE = /(?:понюхаю интернет|не потрать всё сразу|исторический документ|втор(?:ой|ого) квест|сильное решение|😂|🤣|😹)/i;
const CORPORATE_EXCUSE = /(?:непредвиденн(?:ая|ые) техническ|благодарим (?:вас )?за терпение|ваш запрос очень важен)/i;
const ERROR_ADMISSION = /(?:мой косяк|тут мой косяк|ошиб(?:ся|лась|ка)|неверно|неправильно|я посчитал|я упустил)/i;

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

export function evaluateCharacterCandidate(scenario,candidate){
  const errors=[];
  if(!scenario||typeof scenario!=="object")return{ok:false,errors:["scenario_invalid"]};
  if(!candidate||typeof candidate!=="object")return{ok:false,errors:["candidate_invalid"]};
  const expected=scenario.expected||{};
  const reply=String(candidate.reply||"").trim();

  if(candidate.decision!==expected.decision)errors.push(`decision:${candidate.decision||"missing"}!=${expected.decision||"missing"}`);

  const clarification=String(candidate.clarification||"").trim();
  if(expected.clarification==="none"&&clarification)errors.push("unnecessary_clarification");
  if(expected.clarification==="required"&&!clarification)errors.push("missing_clarification");
  if(expected.max_questions!=null&&clarification){
    const questionCount=(clarification.match(/\?/g)||[]).length||1;
    if(questionCount>Number(expected.max_questions))errors.push("too_many_questions");
  }

  if(!reply)errors.push("reply_missing");
  if(Number(expected.max_reply_chars)>0&&reply.length>Number(expected.max_reply_chars))errors.push("reply_too_long");
  for(const pattern of GENERIC_AI)if(pattern.test(reply))errors.push("generic_ai_voice");
  if(expected.serious===true&&SERIOUS_JOKE.test(reply))errors.push("humor_in_serious_mode");
  if(expected.allow_profanity!==true&&PROFANITY.test(reply))errors.push("invented_profanity");
  if(expected.must_admit_error===true&&!ERROR_ADMISSION.test(reply))errors.push("error_not_admitted");
  if(expected.must_be_corrected===true&&candidate.corrected!==true)errors.push("error_not_corrected");
  if(CORPORATE_EXCUSE.test(reply))errors.push("corporate_excuse");

  const facts=scenario.verified_facts&&typeof scenario.verified_facts==="object"?scenario.verified_facts:{};
  const claims=candidate.claims&&typeof candidate.claims==="object"?candidate.claims:{};
  for(const [key,value] of Object.entries(claims)){
    if(!Object.prototype.hasOwnProperty.call(facts,key))errors.push(`unverified_claim:${key}`);
    else if(!same(value,facts[key]))errors.push(`mutated_verified_fact:${key}`);
  }

  const updates=Array.isArray(candidate.memory_updates)?candidate.memory_updates:[];
  if(expected.memory_policy==="none"&&updates.length)errors.push("memory_overreach");
  if(expected.memory_policy==="provisional"){
    if(!updates.length)errors.push("missing_provisional_memory");
    for(const update of updates){
      if(!String(update?.source||"").trim())errors.push("memory_source_missing");
      const confidence=Number(update?.confidence);
      if(!Number.isFinite(confidence)||confidence<=0||confidence>=1)errors.push("memory_confidence_not_bounded");
      if(!String(update?.freshness||"").trim()||String(update?.freshness)==="permanent")errors.push("memory_freshness_invalid");
      if(update?.correctable!==true)errors.push("memory_not_correctable");
    }
  }

  return{ok:errors.length===0,errors:[...new Set(errors)]};
}

export const CHARACTER_REGRESSION_RULES={
  version:"1.0",
  exactWordingRequired:false,
  truthClaims:"verified-only",
  memory:"source-confidence-freshness-correctable",
  seriousMode:"no-humor",
  genericAiVoice:"forbidden"
};
