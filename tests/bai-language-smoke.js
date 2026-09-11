#!/usr/bin/env node
"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.resolve(__dirname,"..");
const CORPUS=JSON.parse(fs.readFileSync(path.join(__dirname,"bai-language-corpus.json"),"utf8"));
const BRAIN=fs.readFileSync(path.join(ROOT,"bai-brain.js"),"utf8");

const same=(actual,expected)=>{
  if(expected===null||typeof expected!=="object")return actual===expected;
  if(Array.isArray(expected))return Array.isArray(actual)&&expected.length===actual.length&&expected.every((v,i)=>same(actual[i],v));
  return actual&&typeof actual==="object"&&Object.entries(expected).every(([k,v])=>same(actual[k],v));
};

function makeBrain(initialState={}){
  let state={products:[],preferences:[],excludedProducts:[],requiredProducts:[],onlyProducts:[],quantityTargets:{},...initialState};
  const context={console,setTimeout,clearTimeout};
  context.window=context;
  context.TDShoppingState={get:()=>state};
  context.__setState=patch=>{state={...state,...patch}};
  vm.createContext(context);
  vm.runInContext(BRAIN,context,{filename:"bai-brain.js"});
  return context;
}

function findOp(ops,expected){return (ops||[]).some(op=>same(op,expected));}

function checkResult(result,spec){
  const errors=[];
  for(const expected of spec.has||[])if(!findOp(result.operations,expected))errors.push(`нет операции ${JSON.stringify(expected)}`);
  for(const forbidden of spec.notHas||[])if(findOp(result.operations,forbidden))errors.push(`лишняя операция ${JSON.stringify(forbidden)}`);
  if(Object.prototype.hasOwnProperty.call(spec,"expectsAnswer")&&Boolean(result.expectsAnswer)!==Boolean(spec.expectsAnswer))errors.push(`expectsAnswer=${result.expectsAnswer}, ожидалось ${spec.expectsAnswer}`);
  return errors;
}

async function runCase(test){
  const context=makeBrain(test.state||{}),brain=context.TDBaiBrain;
  const failures=[];
  const steps=test.steps||[test];
  for(let i=0;i<steps.length;i++){
    const step=steps[i];
    if(step.state)context.__setState(step.state);
    const result=await brain.route(step.text);
    const errors=checkResult(result,step);
    if(errors.length)failures.push({step:i+1,text:step.text,errors,operations:result.operations,reply:result.reply});
  }
  return failures;
}

(async()=>{
  let passed=0,failed=0;
  const details=[];
  for(const test of CORPUS.cases){
    const failures=await runCase(test);
    if(failures.length){failed++;details.push({id:test.id,failures});}
    else passed++;
  }
  console.log(`Bai language corpus: ${passed} passed, ${failed} failed, ${CORPUS.cases.length} total`);
  for(const item of details){
    console.log(`\nFAIL ${item.id}`);
    for(const f of item.failures){
      console.log(`  ${f.step}. ${f.text}`);
      f.errors.forEach(e=>console.log(`     - ${e}`));
      console.log(`     ops: ${JSON.stringify(f.operations)}`);
      console.log(`     reply: ${JSON.stringify(f.reply)}`);
    }
  }
  process.exitCode=failed?1:0;
})().catch(err=>{console.error(err);process.exitCode=1});
