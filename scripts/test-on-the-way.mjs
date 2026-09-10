import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("on-the-way.js","utf8");
const window={addEventListener(){},TDGeo:{nearby:[],position:null}};
const document={readyState:"loading",addEventListener(){},getElementById(){return null;},createElement(){return{style:{},appendChild(){}}},head:{appendChild(){}},body:{},querySelector(){return null;},querySelectorAll(){return[]}};
class MutationObserver{observe(){}}
const context=vm.createContext({window,document,MutationObserver,requestAnimationFrame:fn=>fn(),fetch:async()=>{throw new Error("not_used")},URL,console});
vm.runInContext(source,context,{filename:"on-the-way.js"});
const api=window.TDOnTheWay;
function assert(condition,message){if(!condition)throw new Error(message);}
const origin={lat:55.75,lon:37.60},destination={lat:55.76,lon:37.70};
const nearRoute={lat:55.755,lon:37.65};
const farOff={lat:55.82,lon:37.65};
const good=api.evaluate({origin,destination,store:nearRoute,savings:500,verified:true});
assert(good.state==="on_way"&&good.onWay===true,"near-route profitable store should be on the way");
const bad=api.evaluate({origin,destination,store:farOff,savings:120,verified:true});
assert(bad.onWay===false,"large detour should not be recommended");
const unverified=api.evaluate({origin,destination,store:nearRoute,savings:500,verified:false});
assert(unverified.state==="unknown"&&unverified.onWay===null,"unverified basket must not get route recommendation");
const none=api.evaluate({origin,destination,store:nearRoute,savings:-10,verified:true});
assert(none.state==="no_saving"&&none.onWay===false,"no-saving store must not be recommended");
assert(api.haversine(origin,origin)===0,"distance helper should return zero for same point");
console.log("On-the-way tests passed: detour, savings and verification gates.");
