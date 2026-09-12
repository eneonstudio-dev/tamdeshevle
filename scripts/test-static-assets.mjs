import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const rawLocal=raw=>{
  const value=String(raw||"").trim().replace(/^['"]|['"]$/g,"");
  if(!value||/^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(value)||value.includes("${"))return null;
  return value.split(/[?#]/,1)[0]||null;
};
const normalize=raw=>{
  const value=rawLocal(raw);
  if(!value)return null;
  const clean=value.replace(/^\.\//,"").replace(/^\//,"");
  return clean||null;
};
const resolveFrom=(raw,source)=>{
  const value=rawLocal(raw);
  if(!value)return null;
  if(value.startsWith("/"))return value.replace(/^\/+/,"");
  return path.posix.normalize(path.posix.join(path.posix.dirname(source),value));
};
const exists=file=>fs.existsSync(path.join(root,file));
const requireLocal=(raw,source)=>{
  const file=normalize(raw);
  if(!file)return null;
  assert.ok(exists(file),`${source} references missing local file: ${file}`);
  return file;
};
const requireFrom=(raw,source)=>{
  const file=resolveFrom(raw,source);
  if(!file)return null;
  assert.ok(exists(file),`${source} references missing local file: ${file}`);
  return file;
};

const index=read("index.html");
const scriptRefs=[...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map(match=>match[1]);
const linkRefs=[...index.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gi)].map(match=>match[1]);
const localScripts=scriptRefs.map(ref=>requireLocal(ref,"index.html <script>")).filter(Boolean);
const localLinks=linkRefs.map(ref=>requireLocal(ref,"index.html <link>")).filter(Boolean);
assert.equal(new Set(localScripts).size,localScripts.length,"index.html must not load the same local script more than once");
assert.equal(new Set(localLinks).size,localLinks.length,"index.html must not load the same local link target more than once");

const scriptIndex=new Map(localScripts.map((file,index)=>[file,index]));
const before=(dependency,consumer)=>{
  assert.ok(scriptIndex.has(dependency),`${dependency} must be loaded directly by index.html`);
  assert.ok(scriptIndex.has(consumer),`${consumer} must be loaded directly by index.html`);
  assert.ok(scriptIndex.get(dependency)<scriptIndex.get(consumer),`${dependency} must load before ${consumer}`);
};
before("comparison-engine.js","app.js");
before("app.js","price-sync.js");
before("app.js","app-store-guard.js");
before("basket-split.js","basket-split-ui.js");
before("supabase-config.js","auth-client.js");
before("auth-client.js","account-auth-ui.js");
before("savings-ledger.js","purchase-flow.js");
before("store-adapters.js","shopping-state.js");
before("shopping-state.js","shopping-optimizer.js");
before("shopping-optimizer.js","shopping-conversation.js");

const reachableScripts=new Set();
const dynamicStyles=new Set();
function visitScript(file){
  if(reachableScripts.has(file))return;
  reachableScripts.add(file);
  const source=read(file);
  for(const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)){
    const imported=requireFrom(match[1],file);
    if(imported&&/\.m?js$/i.test(imported))visitScript(imported);
  }
  for(const match of source.matchAll(/\.href\s*=\s*["']([^"']+\.css(?:\?[^"']*)?)["']/gi)){
    const style=requireFrom(match[1],file);
    if(style)dynamicStyles.add(style);
  }
}
localScripts.forEach(visitScript);

const reachableStyles=new Set();
function visitStyle(file){
  if(reachableStyles.has(file))return;
  reachableStyles.add(file);
  const source=read(file);
  for(const match of source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/gi)){
    const imported=requireFrom(match[1],file);
    if(imported&&/\.css$/i.test(imported))visitStyle(imported);
  }
}
localLinks.filter(file=>/\.css$/i.test(file)).forEach(visitStyle);
dynamicStyles.forEach(visitStyle);
for(const canonical of ["votonobay-bay-first.css","votonobay-design-system-v2.css","votonobay-final-polish-v3.css"]){
  assert.ok(reachableStyles.has(canonical),`${canonical} must remain reachable from the production CSS graph`);
}

const runtimeWorkflow=read(".github/workflows/validate-app-runtime.yml");
const checkedRuntimeScripts=[...runtimeWorkflow.matchAll(/node --check\s+([^\s]+\.js)\b/g)]
  .map(match=>match[1])
  .filter(file=>!file.startsWith("scripts/")&&!file.startsWith("tests/"));
const unreachableChecked=[...new Set(checkedRuntimeScripts)].filter(file=>!reachableScripts.has(file));
assert.deepEqual(unreachableChecked,[],`CI syntax-checks runtime modules that production cannot reach from index.html: ${unreachableChecked.join(", ")}`);

const manifest=JSON.parse(read("manifest.json"));
for(const icon of manifest.icons||[])requireLocal(icon&&icon.src,"manifest.json icon");

function walk(dir){
  const result=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name===".git"||entry.name==="node_modules")continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

const files=walk(root).filter(file=>/\.(?:html|css|js|mjs)$/i.test(file));
let assetRefs=0,cssRefs=0;
for(const file of files){
  const rel=path.relative(root,file).replaceAll(path.sep,"/");
  const source=fs.readFileSync(file,"utf8");
  for(const match of source.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|svg|gif|ico)/gi)){
    assetRefs+=1;
    assert.ok(exists(match[0]),`${rel} references missing asset: ${match[0]}`);
  }
  if(/\.css$/i.test(file)){
    for(const match of source.matchAll(/url\(([^)]+)\)/gi)){
      const ref=normalize(match[1]);
      if(!ref||ref.startsWith("var(")||/\.css$/i.test(ref))continue;
      cssRefs+=1;
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),ref));
      assert.ok(exists(resolved),`${rel} references missing CSS asset: ${resolved}`);
    }
  }
}

console.log(`Static runtime integrity passed: ${localScripts.length} direct scripts, ${reachableScripts.size} reachable scripts, ${reachableStyles.size} reachable styles, ${dynamicStyles.size} dynamic styles, ${localLinks.length} direct links, ${assetRefs} asset refs, ${cssRefs} CSS urls.`);
