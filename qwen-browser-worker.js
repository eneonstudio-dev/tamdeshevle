const MODEL = "onnx-community/Qwen3-0.6B-ONNX";
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
let generatorPromise = null;

function progress(data){
  self.postMessage({type:"progress",data});
}

async function generator(){
  if(!generatorPromise){
    generatorPromise=(async()=>{
      const {pipeline}=await import(LIB);
      return pipeline("text-generation",MODEL,{
        device:"webgpu",
        dtype:"q4f16",
        progress_callback:progress
      });
    })();
  }
  return generatorPromise;
}

function outputText(output){
  const generated=output?.[0]?.generated_text;
  if(Array.isArray(generated)){
    const last=generated[generated.length-1];
    return String(last?.content||"");
  }
  return String(generated||"");
}

self.onmessage=async event=>{
  const {type,id,messages}=event.data||{};
  if(type!=="generate")return;
  try{
    const pipe=await generator();
    const output=await pipe(messages,{
      max_new_tokens:220,
      do_sample:false,
      return_full_text:false
    });
    self.postMessage({type:"result",id,text:outputText(output)});
  }catch(error){
    self.postMessage({type:"error",id,error:String(error?.message||error)});
  }
};
