const SKU_RULES = [
  { sku: "milk", any: ["молоко"], none: ["кефир", "коктейл", "топлен", "сгущ", "сливк", "сухое", "соев", "овсян", "миндаль", "кокос", "безлактоз"], percent: 2.5, percentRequired: true, pack: { value: 1000, unit: "ml", tolerance: 0.15 } },
  { sku: "kefir", any: ["кефир"], none: ["коктейл"], percent: 2.5, percentRequired: true, pack: { value: 930, unit: "ml", tolerance: 0.12 } },
  { sku: "smetana", any: ["сметан"], percent: 20, percentRequired: true, pack: { value: 300, unit: "g", tolerance: 0.08 } },
  { sku: "tvorog", any: ["творог"], none: ["запеканк", "сырок"], percent: 5, percentRequired: true, pack: { value: 200, unit: "g", tolerance: 0.12 } },
  { sku: "eggs_c1", any: ["яйц"], all: ["с1"], none: ["с0", "с2"], pack: { value: 10, unit: "pcs", tolerance: 0 } },
  { sku: "eggs_c0", any: ["яйц"], all: ["с0"], none: ["с1", "с2"], pack: { value: 10, unit: "pcs", tolerance: 0 } },
  { sku: "chicken_fil", any: ["филе курин", "филе грудки цыплен", "филе цыпленка-бройлера"], none: ["маринад", "стейк", "кусоч", "бедр", "индей", "наггет", "котлет", "фарш", "копчен", "варен"], pack: { value: 1000, unit: "g", tolerance: 0.25 } },
  { sku: "potato", any: ["картоф"], none: ["батат", "фри", "чипс", "пюре", "готов", "салат", "дольк", "семен"] },
  { sku: "onion", any: ["лук репчат"], none: ["зелён", "зелен", "марин", "жарен", "сушен", "порей", "семен"] },
  { sku: "carrot", any: ["морков"], none: ["по-корей", "готов", "салат", "сок", "пюре", "сушен", "семен"] },
  { sku: "buckwheat", any: ["гречк", "гречнев"], none: ["готов", "каша", "хлоп", "котлет", "куриц", "макарон", "спагет", "вермиш", "мука"], pack: { value: 800, unit: "g", tolerance: 0.25 } },
  { sku: "pasta", any: ["макарон", "спагет", "вермиш"], none: ["по-флотски", "готов", "лапша быстр", "доширак", "гречнев", "рисов", "кукуруз", "безглютен", "бобов", "чечевич"], pack: { value: 450, unit: "g", tolerance: 0.25 } },
  { sku: "oil_sunflower", any: ["масло подсолнеч"], none: ["оливк", "кукуруз", "рапс", "смесь масел"], pack: { value: 1000, unit: "ml", tolerance: 0.2 } },
  { sku: "sugar", any: ["сахар"], none: ["заменител", "пудр", "тростников", "кокосов"], pack: { value: 1000, unit: "g", tolerance: 0.2 } },
  { sku: "bread_dark", any: ["хлеб"], all: ["дарниц"], none: ["сухар", "гренк"], pack: { value: 650, unit: "g", tolerance: 0.3 } },
  { sku: "bread_generic", any: ["хлеб"], none: ["дарниц", "сухар", "гренк", "лаваш", "тостов", "сладк", "булоч", "злаков", "сухофрукт", "сэндвич"], pack: { value: 500, unit: "g", tolerance: 0.2 }, comparisonTolerance: true },
  { sku: "banana", any: ["банан"], namePattern: /^бананы?(?:\s+(?:мини|весовые|свежие|отборные))*?(?:\s+\d+(?:[.,]\d+)?\s*(?:кг|г))?$/ },
  { sku: "tea_black", any: ["чай черн", "черный чай"], none: ["листов", "листовой", "зелён", "зелен", "травян", "холодн", "напиток"], pack: { value: 100, unit: "pcs", tolerance: 0 } }
];
export const PEREKRESTOK_EXACT_SKU=Object.freeze({"2093081":"milk","4121609":"smetana","4121613":"tvorog"});
function normalizeText(value){return String(value||"").toLowerCase().replace(/ё/g,"е").replace(/\bc([012])\b/g,"с$1").replace(/[^a-zа-я0-9%.,-]+/g," ").replace(/\s+/g," ").trim();}
function number(value){if(value==null)return null;const parsed=Number(String(value).replace(",","."));return Number.isFinite(parsed)?parsed:null;}
export function parsePack(text){const source=normalizeText(text);const patterns=[{re:/(\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?![a-zа-я])/i,unit:"g",factor:1000},{re:/(\d+(?:[.,]\d+)?)\s*(?:гр|г|g)(?![a-zа-я])/i,unit:"g",factor:1},{re:/(\d+(?:[.,]\d+)?)\s*(?:мл|ml)(?![a-zа-я])/i,unit:"ml",factor:1},{re:/(\d+(?:[.,]\d+)?)\s*(?:л|l)(?![a-zа-я])/i,unit:"ml",factor:1000},{re:/(\d+(?:[.,]\d+)?)\s*(?:шт|pcs|пак(?:ет(?:ик)?(?:ов|а)?)?)(?![a-zа-я])/i,unit:"pcs",factor:1}];for(const pattern of patterns){const match=source.match(pattern.re);if(!match)continue;const value=number(match[1]);if(value!=null)return{value:value*pattern.factor,unit:pattern.unit};}return null;}
function parsePercent(text){return[...normalizeText(text).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map(match=>number(match[1])).filter(value=>value!=null);}
function includesAll(text,needles){return(needles||[]).every(needle=>text.includes(normalizeText(needle)));}function includesAny(text,needles){return!(needles||[]).length||(needles||[]).some(needle=>text.includes(normalizeText(needle)));}function firstForbidden(text,needles){return(needles||[]).find(needle=>text.includes(normalizeText(needle)))||null;}
function packDistance(actual,expected){if(!expected)return{ok:true,ratio:0};if(!actual)return{ok:false,reason:"pack_missing"};if(actual.unit!==expected.unit)return{ok:false,reason:"pack_unit_mismatch",actual,expected};const ratio=Math.abs(actual.value-expected.value)/expected.value;return ratio<=(expected.tolerance??0)?{ok:true,ratio}:{ok:false,reason:"pack_size_mismatch",ratio,actual,expected};}
function percentDistance(actual,expected,required){if(expected==null)return{ok:true,delta:0};if(!actual.length)return required?{ok:false,reason:"percent_missing"}:{ok:true,delta:.2};const delta=Math.min(...actual.map(value=>Math.abs(value-expected)));return delta<=.11?{ok:true,delta}:{ok:false,reason:"percent_mismatch",delta,actual,expected};}
function brandEvidence(product){const normalized=normalizeText(product&&product.brand);return normalized?{brand:product.brand,normalized}:null;}
function evaluateRule(product,rule){const text=normalizeText(product.name);if(!includesAny(text,rule.any))return{ok:false,reason:"name_mismatch"};if(rule.namePattern&&!rule.namePattern.test(text))return{ok:false,reason:"name_pattern_mismatch"};if(!includesAll(text,rule.all))return{ok:false,reason:"required_term_missing"};const forbidden=firstForbidden(text,rule.none);if(forbidden)return{ok:false,reason:"forbidden_term",detail:forbidden};const actualPack=product.pack&&Number.isFinite(product.pack.value)?{value:Number(product.pack.value),unit:product.pack.unit}:parsePack(product.name);const pack=packDistance(actualPack,rule.pack);if(!pack.ok)return pack;const percent=percentDistance(parsePercent(product.name),rule.percent,rule.percentRequired);if(!percent.ok)return percent;return{ok:true,evidence:{pack:actualPack,pack_distance_ratio:Number((pack.ratio||0).toFixed(4)),percent_delta:Number((percent.delta||0).toFixed(4)),brand:brandEvidence(product)}};}
export function matchRetailerProduct(product,options={}){if(!product||!product.name)return{matched:false,reason:"missing_name"};const retailer=product.retailer||options.retailer||null;const retailerId=product.retailer_product_id!=null?String(product.retailer_product_id):null;if(retailer==="perek"&&retailerId&&PEREKRESTOK_EXACT_SKU[retailerId]) {
  const sku = PEREKRESTOK_EXACT_SKU[retailerId];
  const result = evaluateRule(product, SKU_RULES.find(rule => rule.sku === sku));
  if (!result.ok) return {matched:false, reason:"exact_id_conflict", detail:result.reason};
  return {matched:true, sku, confidence:1, method:"exact_retailer_id", evidence:{...result.evidence, retailer_product_id:retailerId}};
}const passed=[],rejected=[];for(const rule of SKU_RULES){const result=evaluateRule(product,rule);if(result.ok)passed.push({rule,result});else if(result.reason!=="name_mismatch")rejected.push({sku:rule.sku,reason:result.reason,detail:result.detail||null});}if(passed.length!==1)return{matched:false,reason:passed.length?"ambiguous":"no_rule_match",candidates:passed.map(item=>item.rule.sku),rejected};const{rule,result}=passed[0];return{matched:true,sku:rule.sku,confidence:.9,method:"conservative_rule",evidence:result.evidence};}
function betterCandidate(next,current){if(!current)return true;if(next.confidence!==current.confidence)return next.confidence>current.confidence;if(next.price_rub!==current.price_rub)return next.price_rub<current.price_rub;return String(next.name).localeCompare(String(current.name),"ru")<0;}
export function comparisonEligibility(product, result) {
  if (/\d+\s*[xх×*]\s*\d|(?:набор|упаковка)\s+(?:из\s+)?\d/i.test(product.name)) return {eligible:false, reason:"multipack_unconfirmed"};
  const rule = SKU_RULES.find(item => item.sku === result.sku);
  const expected = rule?.pack || {value:1000, unit:"g"};
  const actual = result.evidence?.pack;
  if (!actual || !Number.isFinite(actual.value) || actual.value <= 0) return {eligible:false, reason:"pack_missing"};
  const sameUnit = actual.unit === expected.unit;
  const exactPack = sameUnit && Math.abs(actual.value - expected.value) <= 0.000001;
  const toleratedPack = sameUnit && rule?.comparisonTolerance === true && packDistance(actual, expected).ok;
  if (!exactPack && !toleratedPack) {
    return {eligible:false, reason:"different_pack", source_pack:actual, requested_pack:{value:expected.value, unit:expected.unit}};
  }
  // A unit price on a fixed smaller pack is not a purchasable kilogram.
  if (product.comparison_price_basis === "per_kg" && actual.value !== 1000) return {eligible:false, reason:"unit_price_only"};
  if (product.availability !== "in_stock") return {eligible:false, reason:"availability_unconfirmed"};
  return {eligible:true, source_pack:{value:actual.value, unit:actual.unit}, requested_pack:{value:expected.value, unit:expected.unit}};
}

export function buildPriceOverlay(products, options={}) {
  const retailer=options.retailer||null, city=options.city||"msk", storeId=options.storeId||retailer;
  const selected=new Map(), unmatched=[], alternatives=[];
  for (const product of products||[]) {
    const result=matchRetailerProduct(product,{retailer});
    if (!result.matched) {
      unmatched.push({name:product.name,retailer_product_id:product.retailer_product_id||null,reason:result.reason});
      continue;
    }
    if (!Number.isFinite(product.price_rub) || product.price_rub <= 0 || product.availability === "out_of_stock") continue;
    const eligibility=comparisonEligibility(product,result);
    if (!eligibility.eligible) {
      alternatives.push({sku:result.sku,name:product.name,retailer_product_id:product.retailer_product_id||null,source_url:product.source_url||null,price_rub:product.price_rub,...eligibility});
      continue;
    }
    const candidate={sku:result.sku,name:product.name,retailer_product_id:product.retailer_product_id||null,price_rub:product.price_rub,old_price_rub:Number.isFinite(product.old_price_rub)?product.old_price_rub:null,promo:Boolean(product.promo),source_url:product.source_url||null,...(product.image_url?{image_url:product.image_url}:{}),confidence:result.confidence,method:result.method,comparison_eligible:true,source_pack:eligibility.source_pack,requested_pack:eligibility.requested_pack,availability:product.availability};
    if (product.comparison_price_basis) {
      candidate.comparison_price_basis=product.comparison_price_basis;
      candidate.source_package_price_rub=product.source_package_price_rub;
      candidate.source_unit_price_rub=product.source_unit_price_rub;
    }
    if (betterCandidate(candidate,selected.get(result.sku))) selected.set(result.sku,candidate);
  }
  const matched=[...selected.values()].sort((a,b)=>a.sku.localeCompare(b.sku));
  return {schema:"tamdeshevle.retailer-price-overlay.v1",retailer,store_id:storeId,city,checked_at:options.checked_at||new Date().toISOString(),prices:Object.fromEntries(matched.map(item=>[item.sku,item.price_rub])),matched,unmatched,alternatives};
}
