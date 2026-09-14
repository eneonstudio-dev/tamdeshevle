const clean=(v:unknown,n=1000)=>String(v??"").replace(/[\u0000-\u001f<>]/g," ").replace(/\s+/g," ").trim().slice(0,n);
const safeIds=(raw:unknown,max=80)=>[...new Set((Array.isArray(raw)?raw:[]).map(x=>clean(x,80)).filter(Boolean))].slice(0,max);

export function safeHistory(raw:unknown){return(Array.isArray(raw)?raw:[]).slice(-8).map((x:any)=>({role:x?.role==="assistant"?"assistant":"user",text:clean(x?.text,500)})).filter(x=>x.text)}
export function cleanMessage(raw:unknown){return clean(raw,1000)}
export function studentContext(payload:any){
  const s=payload?.session&&typeof payload.session==="object"?payload.session:{};
  const c=s.constraints&&typeof s.constraints==="object"?s.constraints:{};
  const stores=s.store_constraints&&typeof s.store_constraints==="object"?s.store_constraints:{};
  const basket=s.basket&&typeof s.basket==="object"?s.basket:{};
  const constraints:string[]=[];
  if(Number(s.budget)>0)constraints.push(`budget<=${Number(s.budget)}`);
  for(const brand of safeIds(c.excluded_brands))constraints.push(`exclude_brand:${brand}`);
  for(const product of safeIds(c.excluded_products))constraints.push(`exclude_product:${product}`);
  if(stores.mode==="one")constraints.push("mode:one");
  if(c.cooking&&c.cooking!=="normal")constraints.push(`cooking:${clean(c.cooking,32)}`);
  return{
    budget:Number(s.budget)>0?Number(s.budget):null,
    people:Math.max(1,Number(c.people_count)||1),
    days:Math.max(1,Number(c.duration_days)||1),
    mode:stores.mode==="one"?"one":"multi",
    constraints,
    basket:safeIds((Array.isArray(basket.items)?basket.items:[]).map((x:any)=>x?.id)),
    healthy:c.healthy===true,
    excluded_products:safeIds(c.excluded_products),
    required_categories:safeIds(c.required_categories),
    preferences:safeIds(s.preferences),
    store_ids:safeIds(stores.store_ids,12)
  };
}
