(()=>{
  "use strict";
  if(window.TDBayEngineAdapters)return;

  const Engine=window.TDBayEngineProvider;
  if(!Engine?.create)throw new Error("TDBayEngineProvider must load before Bay Engine adapters");

  const VERSION=1;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const clean=(value,max=240)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const safeObject=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const retryableStatus=status=>[408,409,425,429,500,502,503,504].includes(Number(status));

  function toMessages(request={}){
    const source=safeObject(request);
    const messages=[];
    if(source.system)messages.push({role:"system",content:String(source.system)});
    if(Array.isArray(source.messages)){
      for(const item of source.messages){
        const row=safeObject(item);
        if(!["system","user","assistant","tool"].includes(row.role)||typeof row.content!=="string")continue;
        messages.push({role:row.role,content:row.content});
      }
    }else if(source.message!=null){
      let user=String(source.message);
      if(source.context&&typeof source.context==="object")user+=`\n\n<bounded_context>${JSON.stringify(source.context)}</bounded_context>`;
      messages.push({role:"user",content:user});
    }
    if(!messages.length)messages.push({role:"user",content:""});
    return messages;
  }

  function parseContent(content){
    if(content&&typeof content==="object"&&!Array.isArray(content))return clone(content);
    const text=String(content??"").trim();
    if(!text)return{};
    try{
      const parsed=JSON.parse(text);
      return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{reply:text};
    }catch{return{reply:text}}
  }

  function normalizeChatCompletion(raw){
    const outer=safeObject(raw);
    if(outer.ok===false){
      const status=Number(outer.status||outer.statusCode||0)||undefined;
      return{ok:false,error:{code:clean(outer.error?.code||outer.code||(status?`HTTP_${status}`:"PROVIDER_ERROR"),64),message:clean(outer.error?.message||outer.message||"Provider request failed",240),retryable:outer.error?.retryable===true||retryableStatus(status)},usage:outer.usage};
    }
    const data=safeObject(outer.data&&typeof outer.data==="object"?outer.data:outer);
    const choice=Array.isArray(data.choices)?safeObject(data.choices[0]):{};
    const message=safeObject(choice.message);
    const payload=parseContent(message.content??data.output??data.payload);
    if(Array.isArray(message.tool_calls)&&message.tool_calls.length)payload.tool_calls=clone(message.tool_calls);
    if(Array.isArray(data.tool_calls)&&data.tool_calls.length&&!payload.tool_calls)payload.tool_calls=clone(data.tool_calls);
    const usage=safeObject(data.usage);
    return{
      ok:true,
      model:clean(data.model,120),
      payload,
      finishReason:clean(choice.finish_reason||data.finish_reason,64),
      usage:{
        inputTokens:usage.prompt_tokens??usage.input_tokens,
        outputTokens:usage.completion_tokens??usage.output_tokens,
        cachedInputTokens:usage.cached_tokens??usage.cached_input_tokens,
        totalTokens:usage.total_tokens,
        costUsd:usage.cost_usd
      }
    };
  }

  function assertNoBrowserSecret(config){
    for(const key of ["apiKey","api_key","token","secret","authorization"]){
      if(Object.prototype.hasOwnProperty.call(config,key)&&config[key]!=null)throw new TypeError("Hosted Bay adapters do not accept browser credentials; inject an authenticated server-side transport instead");
    }
  }

  function createMistral(config={}){
    const source=safeObject(config);
    assertNoBrowserSecret(source);
    const transport=source.transport;
    if(typeof transport!=="function")throw new TypeError("Mistral Bay adapter requires an injected server-side transport");
    const model=clean(source.model||"mistral-small-latest",120)||"mistral-small-latest";
    const endpoint=clean(source.endpoint||"https://api.mistral.ai/v1/chat/completions",240);
    return Engine.create({
      id:clean(source.id||"mistral-hosted",64),
      capabilities:{streaming:false,tools:true,structuredOutput:true,local:false,paid:true},
      async generate(request,options={}){
        const body={model,messages:toMessages(request),response_format:{type:"json_object"}};
        if(Array.isArray(request?.tools)&&request.tools.length)body.tools=clone(request.tools);
        if(Number.isFinite(Number(options?.maxTokens)))body.max_tokens=Math.max(1,Math.floor(Number(options.maxTokens)));
        const raw=await transport({provider:"mistral",endpoint,body:clone(body),timeoutMs:Number(options?.timeoutMs)||undefined});
        return normalizeChatCompletion(raw);
      },
      async healthCheck(){
        if(typeof transport.healthCheck!=="function")return{ok:true,status:"configured",reason:"transport-injected-not-live-probed"};
        return await transport.healthCheck({provider:"mistral",endpoint,model});
      },
      estimateCost:typeof source.estimateCost==="function"?source.estimateCost:undefined
    });
  }

  function createQwenLocal(config={}){
    const source=safeObject(config);
    const runtime=source.runtime;
    const model=clean(source.model||"qwen-local",120)||"qwen-local";
    const generateFn=runtime&&typeof runtime.generate==="function"?runtime.generate.bind(runtime):(runtime&&typeof runtime.chat==="function"?runtime.chat.bind(runtime):null);
    return Engine.create({
      id:clean(source.id||"qwen-local",64),
      capabilities:{streaming:false,tools:source.tools!==false,structuredOutput:true,local:true,paid:false},
      async generate(request,options={}){
        if(!generateFn)return{ok:false,error:{code:"LOCAL_RUNTIME_UNAVAILABLE",message:"Qwen local runtime is not available",retryable:false}};
        const raw=await generateFn({model,messages:toMessages(request),tools:Array.isArray(request?.tools)?clone(request.tools):[],responseFormat:"json",timeoutMs:Number(options?.timeoutMs)||undefined});
        return normalizeChatCompletion(raw);
      },
      async healthCheck(){
        if(!runtime)return{ok:false,status:"unavailable",reason:"local-runtime-missing"};
        if(typeof runtime.healthCheck==="function")return await runtime.healthCheck({model});
        if(typeof runtime.isReady==="function")return runtime.isReady()?{ok:true,status:"ready"}:{ok:false,status:"loading"};
        return generateFn?{ok:true,status:"configured"}:{ok:false,status:"unavailable",reason:"local-generate-missing"};
      },
      estimateCost:()=>({usd:0})
    });
  }

  window.TDBayEngineAdapters={version:VERSION,createMistral,createQwenLocal,normalizeChatCompletion,toMessages};
})();
