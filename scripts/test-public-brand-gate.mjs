import fs from "node:fs";

const entry = "index.html";
const required = [entry, "app.js", "manifest.json"];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing public brand surface: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const manifestErrors = [];
if (manifest.name !== "VOTONOBAI") manifestErrors.push(`manifest.name must be VOTONOBAI, got ${JSON.stringify(manifest.name)}`);
if (manifest.short_name !== "VOTONOBAI") manifestErrors.push(`manifest.short_name must be VOTONOBAI, got ${JSON.stringify(manifest.short_name)}`);
if (!String(manifest.description || "").includes("VOTONOBAI")) manifestErrors.push("manifest.description must identify VOTONOBAI");
if (/Votonobay|Там\s*Дешевле|Тамдешевле/u.test(JSON.stringify(manifest))) {
  manifestErrors.push("manifest.json contains a superseded public brand token");
}

const index = fs.readFileSync(entry, "utf8");
const publicFiles = new Set(required);
for (const match of index.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
  const src = match[1].split("?")[0].split("#")[0];
  if (!src || /^(?:https?:)?\/\//i.test(src) || src.startsWith("/") || src.includes("..")) continue;
  if (fs.existsSync(src) && fs.statSync(src).isFile()) publicFiles.add(src);
}

const partnershipPatterns = [
  /official\s+partner/giu,
  /in\s+partnership\s+with/giu,
  /официальн\w*\s+партн[её]р\w*/giu,
  /наш\w*\s+(?:официальн\w*\s+)?партн[её]р\w*/giu,
  /партн[её]р\w*\s+с\s+(?:пят[её]рочк\w*|магнит\w*|перекр[её]стк\w*|лент\w*|ашан\w*|вкусвилл\w*|metro|метро\w*)/giu
];

const brandTokens = [
  ["Votonobay", /\bVotonobay\b/g],
  ["VOTONOBAI", /\bVOTONOBAI\b/g],
  ["Вотонобай", /Вотонобай/g],
  ["Тамдешевле", /Тамдешевле/g],
  ["Там Дешевле", /Там\s+Дешевле/g]
];

const violations = [];
const inventory = new Map(brandTokens.map(([name]) => [name, new Set()]));

for (const file of publicFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of partnershipPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 12), match.index).toLowerCase();
      if (/\bне\s*$/.test(before) || /\bnot\s+$/.test(before)) continue;
      violations.push(`${file}: ${match[0]}`);
    }
  }
  for (const [name, pattern] of brandTokens) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) inventory.get(name).add(file);
  }
}

const foundBrands = [...inventory.entries()].filter(([, files]) => files.size > 0);
if (!foundBrands.length) throw new Error("No known public brand token found on browser-loaded surfaces");

console.log(`Scanned ${publicFiles.size} browser-loaded public files.`);
for (const [name, files] of foundBrands) {
  console.log(`Brand token ${name}: ${[...files].sort().join(", ")}`);
}

if (manifestErrors.length) {
  console.error("PWA manifest violates BRAND_CANON.md:");
  for (const violation of manifestErrors) console.error(`- ${violation}`);
  process.exit(1);
}

if (violations.length) {
  console.error("Public copy may imply an official retailer partnership:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("PASS: PWA manifest uses canonical VOTONOBAI branding.");
console.log("PASS: no positive official-retailer partnership claim detected on browser-loaded public surfaces.");
console.log("NOTE: legacy brand-token inventory outside manifest remains migration evidence until browser normalization is complete.");
