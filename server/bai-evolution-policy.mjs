const CRITICAL_TYPES=new Set(["RESET_BASKET","CLEAR_ONLY","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","CHANGE_STORE","SET_MODE","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","REQUIRE","PREFER","SET_ONLY_PRODUCTS","REOPTIMIZE","ASK_CLARIFICATION"]);

const stable=v=>JSON.stringify(v&&typeof v==="object"?v:null);
const opKey=op=>`${String(op?.type||"")}:${stable(op?.value)}`;
const safeOps=ops=>(Array.isArray(ops)?ops:[]).filter(op=>op&&CRITICAL_TYPES.has(op.type)).slice(0,24);

export function scoreCase(testCase,output){
  const ops=safeOps(output?.operations),keys=new Set(ops.map(opKey));
  const required=(testCase.requiredOperations||[]).map(opKey),forbidden=(testCase.forbiddenOperations||[]).map(opKey);
  const requiredTypes=new Set(testCase.requiredTypes||[]),forbiddenTypes=new Set(testCase.forbiddenTypes||[]);
  const actualTypes=new Set(ops.map(x=>x.type));
  const missingRequired=required.filter(k=>!keys.has(k));
  const missingTypes=[...requiredTypes].filter(t=>!actualTypes.has(t));
  const forbiddenHits=forbidden.filter(k=>keys.has(k));
  const forbiddenTypeHits=[...forbiddenTypes].filter(t=>actualTypes.has(t));
  const expectsClarification=Boolean(testCase.expectsClarification);
  const clarificationOk=expectsClarification?actualTypes.has("ASK_CLARIFICATION")||output?.expectsAnswer===true:!actualTypes.has("ASK_CLARIFICATION")||testCase.allowClarification===true;
  const mutationCount=ops.filter(x=>x.type!=="ASK_CLARIFICATION").length;
  const excessiveMutations=Number(testCase.maxMutations??12)<mutationCount;
  const criticalFailure=forbiddenHits.length>0||forbiddenTypeHits.length>0||(!clarificationOk&&Boolean(testCase.critical))||excessiveMutations;
  let score=100;
  score-=missingRequired.length*25;
  score-=missingTypes.length*20;
  score-=forbiddenHits.length*60;
  score-=forbiddenTypeHits.length*50;
  if(!clarificationOk)score-=30;
  if(excessiveMutations)score-=40;
  score=Math.max(0,Math.min(100,score));
  const passed=score>=Number(testCase.passScore??80)&&!criticalFailure;
  return {id:testCase.id,passed,score,criticalFailure,missingRequired,missingTypes,forbiddenHits,forbiddenTypeHits,clarificationOk,mutationCount};
}

export function scoreSuite(cases,outputs){
  const byId=new Map((outputs||[]).map(x=>[x.id,x.output||x]));
  const results=(cases||[]).map(c=>scoreCase(c,byId.get(c.id)||{}));
  const total=results.length||1,passed=results.filter(x=>x.passed).length,criticalFailures=results.filter(x=>x.criticalFailure).length;
  const averageScore=Math.round(results.reduce((s,x)=>s+x.score,0)/total*10)/10;
  return {passed,total,passRate:Math.round((passed/total)*1000)/10,averageScore,criticalFailures,results};
}

export function compareCandidate(baseline,candidate,{minGain=1,maxCriticalFailures=0,minPassRate=90}={}){
  const gain=Math.round((Number(candidate?.averageScore||0)-Number(baseline?.averageScore||0))*10)/10;
  const passRateGain=Math.round((Number(candidate?.passRate||0)-Number(baseline?.passRate||0))*10)/10;
  const reasons=[];
  if(Number(candidate?.criticalFailures||0)>maxCriticalFailures)reasons.push("critical_regression");
  if(Number(candidate?.passRate||0)<minPassRate)reasons.push("pass_rate_below_gate");
  if(gain<minGain)reasons.push("insufficient_score_gain");
  if(passRateGain<0)reasons.push("pass_rate_regression");
  return {eligible:reasons.length===0,gain,passRateGain,reasons,requiresCanary:true,autoPromote:false};
}
