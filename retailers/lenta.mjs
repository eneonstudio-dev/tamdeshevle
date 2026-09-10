function number(value){if(value==null)return null;const n=Number(String(value).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:null;}
function normalizeAvailability(value){const text=String(value||"").toLowerCase();if(/нет в наличии|законч|out.of.stock/.test(text))return"out_of_stock";if(/в корзину|доступ|in.stock/.test(text))return"in_stock";return"unknown";}
export function parseLentaPack(text){const s=String(text||"").toLowerCase().replace(/,/g,".");const rules=[[/([\d.]+)\s*(кг|kg)(?![a-zа-я])/,"g",1000],[/([\d.]+)\s*(г|гр|g)(?![a-zа-я])/,"g",1],[/([\d.]+)\s*(мл|ml)(?![a-zа-я])/,"ml",1],[/([\d.]+)\s*(л|l)(?![a-zа-я])/,"ml",1000],[/([\d.]+)\s*(шт|pcs)(?![a-zа-я])/,"pcs",1]];for(const [re,unit,factor] of rules){const m=s.match(re);if(m){const v=number(m[1]);if(v!=null)return{value:v*factor,unit,source:m[0]};}}return null;}
export function adaptLentaCatalog(rows=[],context={}){
  const store=context.store_context||{};
  if(!store.store_code)throw new Error("Lenta store_context.store_code is required");
  return rows.map(row=>({
    retailer:"lenta",
    retailer_product_id:row.id!=null?String(row.id):null,
    name:String(row.name||"").trim(),
    brand:row.brand||null,
    pack:row.pack||parseLentaPack(row.name),
    price_rub:number(row.price),
    old_price_rub:number(row.old_price),
    promo:Boolean(row.promo||number(row.old_price)>number(row.price)),
    availability:normalizeAvailability(row.availability),
    source_url:row.url||context.source_url||null,
    image_url:row.image_url||null,
    city:context.city||null,
    channel:context.channel||"delivery_catalog",
    checked_at:context.checked_at||null,
    store_context:{store_code:String(store.store_code),address:store.address||null},
    scope_verified:context.scope_verified===true
  }));
}
