import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../bai-speech-lifecycle.js",import.meta.url),"utf8");
assert.doesNotMatch(code,/MutationObserver|requestAnimationFrame\s*\(/,"speech lifecycle must stay event-driven");

let nativeCalls=0,talk=false;
const root={isConnected:true,hasAttribute:name=>name==="data-bai-busy",querySelector:selector=>selector==="[data-ai-talkmode]"?{getAttribute:()=>talk?"true":"false"}:null};
const synth={speak(){nativeCalls++}};
const context={
  window:{speechSynthesis:synth},
  document:{querySelector:selector=>selector===".td-ai[data-bai-busy]"?root:null},
  queueMicrotask:fn=>fn(),
  console
};
context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context);
assert.equal(context.window.TDBaiSpeechLifecycle.installed,true);

let ended=0;
synth.speak({lang:"ru-RU",onend(){ended++}});
assert.equal(nativeCalls,1,"native speech still runs");
assert.equal(ended,1,"text mode should release Bai as soon as final speech starts");

talk=true;let talkEnded=0;
synth.speak({lang:"ru-RU",onend(){talkEnded++}});
assert.equal(nativeCalls,2);
assert.equal(talkEnded,0,"talk mode must wait for real speech end to avoid microphone echo");

console.log("Bai speech lifecycle passed: finished replies no longer stay busy during text-mode TTS.");
