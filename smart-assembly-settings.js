(function(){
  "use strict";
  const KEY="td:smart-assembly-settings";
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");return{minutes:Math.max(0,Math.min(180,Number(x.minutes)||0)),rubPerMinute:Math.max(0,Math.min(100,Number(x.rubPerMinute)||0)),transportRub:Math.max(0,Math.min(5000,Number(x.transportRub)||0))};}catch{return{minutes:0,rubPerMinute:0,transportRub:0};}}
  function save(next){const value={...read(),...next};localStorage.setItem(KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent("td:assembly-settings",{detail:value}));return value;}
  function extraStopCost(){const x=read();return Math.round(x.minutes*x.rubPerMinute+x.transportRub);}
  window.TDAssemblyPreferences={read,save,extraStopCost};
})();
