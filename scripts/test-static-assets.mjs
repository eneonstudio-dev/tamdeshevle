import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const normalize=raw=>{
  const value=String(raw||"").trim().replace(/^['"]|['"]$/g,"");
  if(!value||/^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(value)||value.includes("${"))return null;
  const clean=value.split(/[?#]/,1)[0].replace(/^\.\//,"").replace(/^\//,"");
  return clean||null;
};
const exists=file=>fs.existsSync(path.join(root,file));
const requireLocal=(raw,source)=>{
  const file=normalize(raw);
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
      if(!ref||ref.startsWith("var("))continue;
      cssRefs+=1;
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),ref));
      assert.ok(exists(resolved),`${rel} references missing CSS asset: ${resolved}`);
    }
  }
}

console.log(`Static asset integrity passed: ${localScripts.length} local scripts, ${localLinks.length} local links, ${assetRefs} asset refs, ${cssRefs} CSS urls.`);
