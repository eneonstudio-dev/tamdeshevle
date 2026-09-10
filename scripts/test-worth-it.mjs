import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("worth-it.js","utf8");
const window={addEventListener(){}};
const document={readyState:"loading",addEventListener(){},head:{appendChild(){}},getElementById(){return null;},createElement(){return{style:{},appendChild(){}};},querySelectorAll(){return[];},querySelector(){return null;}};
const context=vm.createContext({window,document,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),console});
vm.runInContext(source,context,{filename:"worth-it.js"});
const api=window.TDWorthIt;
if(!api)throw new Error("TDWorthIt was not exported");
function assert(v,m){if(!v)throw new Error(m);}

const good=api.evaluate({distanceKm:.6,savings:420,verified:true});
assert(good.worth===true&&good.state==="worth","strong nearby savings should be worth the walk");
assert(good.walkMinutes>=9&&good.walkMinutes<=11,"walk estimate should include route factor");
const weak=api.evaluate({distanceKm:1.5,savings:170,verified:true});
assert(weak.worth===false&&weak.state==="marginal","small saving with long walk should be marginal");
const worse=api.evaluate({distanceKm:.2,savings:-20,verified:true});
assert(worse.state==="no_saving"&&worse.worth===false,"negative saving should never recommend walking");
const unknown=api.evaluate({distanceKm:.2,savings:500,verified:false});
assert(unknown.state==="unknown"&&unknown.worth===null,"unverified basket must not receive a recommendation");
assert(api.policy.minSavingsRub===150&&api.policy.minRubPerTravelMin===8,"policy thresholds changed unexpectedly");
console.log("Worth-it tests passed: distance, verified savings and travel-value thresholds.");
