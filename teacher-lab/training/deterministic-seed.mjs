import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildCorpus} from '../corpus-builder.mjs';
import {trainingEligibility,validateExample} from '../firewall.mjs';

const root=new URL('../',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8'));
const SOURCE='votonobay_deterministic_seed_v1';
const ALLOWED=new Set(['add_item','remove_item','replace_item','change_quantity','set_constraint','rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase']);
const QUOTA={build_fuzzy:32,edit_fuzzy:13,multi_turn:15};
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const low=v=>String(v||'').toLowerCase().replace(/ё/g,'е');
const uniq=a=>[...new Set(a.filter(Boolean))];
const action=(type,payload={})=>({type,payload});

function hardConstraints(task){
  const c=task.session_context||{},e=task.expected||{},h={};
  const all=[...(c.constraints||[]),...(e.new_hard||[]),...(e.must_retain||[])];
  if(Number(c.budget)>0)h.budget_max=Number(c.budget);
  if(Number(c.people)>0)h.people_count=Number(c.people);
  if(Number(e.duration||c.days)>0)h.duration_days=Number(e.duration||c.days);
  const brands=[],tags=[];
  for(const raw of all){
    let m;if((m=String(raw).match(/^budget<=(\d+)$/)))h.budget_max=Number(m[1]);
    else if((m=String(raw).match(/^exclude_brand:(.+)$/)))brands.push(m[1]);
    else if((m=String(raw).match(/^exclude_tag:(.+)$/)))tags.push(m[1]);
    else if(raw==='mode:one'){h.store_mode='one';h.store_limit=1}
    else if((m=String(raw).match(/^cooking:(.+)$/)))h.cooking=m[1];
  }
  const text=low(task.user_request),budget=text.match(/до\s+(\d[\d\s]{2,})/);
  if(budget)h.budget_max=Number(budget[1].replace(/\s/g,''));
  if(/на\s+недел/.test(text))h.duration_days=7;
  if(/без\s+мираторг/.test(text))brands.push('Мираторг');
  if(/одн.*магаз|в одном месте|таскаться/.test(text)){h.store_mode='one';h.store_limit=1}
  if(/пп/.test(text))h.healthy=true;
  if(/фрукт/.test(text)&&/(больше|побольше|еще|маловато|добав)/.test(text))h.required_categories=['fruit'];
  if(/убер.*ветчин|без\s+ветчин/.test(text))h.excluded_products=['ham'];
  if(brands.length)h.excluded_brands=uniq(brands);if(tags.length)h.excluded_tags=uniq(tags);return h;
}

function preferences(task){
  const t=low(task.user_request),p={price:'balanced'};
  if(/дешевле|подешевле|эконом/.test(t))p.price='economy';
  if(/не\s+(самое|самый|настолько)\s+деш|не\s+дешман/.test(t))p.avoid_cheapest=true;
  if(/мяс.*(получше|хорош|классом выше|не эконом)/.test(t))p.protein_tier='higher';
  if(/фрукт/.test(t))p.fruit='more';if(/перекус/.test(t))p.snacks='more';if(/пп/.test(t))p.healthy=true;return p;
}

function actionsFor(task,h,p){
  const t=low(task.user_request),out=[],add=(type,payload={})=>{const k=JSON.stringify([type,payload]);if(!out.some(x=>JSON.stringify([x.type,x.payload])===k))out.push(action(type,payload))};
  if((task.expected?.intent_family||'build_basket')==='build_basket'){
    if(h.budget_max)add('set_constraint',{key:'budget',value:h.budget_max});if(h.people_count)add('set_constraint',{key:'people_count',value:h.people_count});if(h.duration_days)add('set_constraint',{key:'duration_days',value:h.duration_days});
    for(const b of h.excluded_brands||[])add('set_constraint',{key:'excluded_brand',value:b});if(h.store_mode==='one'){add('set_constraint',{key:'store_mode',value:'one'});add('set_constraint',{key:'store_limit',value:1})}add('rebuild_basket',{reset:false});return out;
  }
  if(h.store_mode==='one'&&/(одн.*магаз|в одном месте|таскаться)/.test(t)){add('set_constraint',{key:'store_mode',value:'one'});add('set_constraint',{key:'store_limit',value:1})}
  if((h.required_categories||[]).includes('fruit'))add('set_constraint',{key:'required_category',value:'fruit'});
  if(p.protein_tier==='higher')add('set_constraint',{key:'preference',value:'protein_tier:higher'});if(p.price==='economy')add('set_constraint',{key:'preference',value:'price:economy'});if(p.avoid_cheapest)add('set_constraint',{key:'preference',value:'avoid_cheapest:true'});
  if(h.healthy)add('set_constraint',{key:'healthy',value:true});if(/перекус/.test(t))add('set_constraint',{key:'required_category',value:'snacks'});
  if(/убер.*ветчин/.test(t)&&(task.session_context?.basket||[]).includes('ham'))add('remove_item',{product_id:'ham'});
  if(/замен/.test(t))add('set_constraint',{key:'user_note',value:'replace_with_verified_similar'});if(/верни\s+как\s+было/.test(t))add('set_constraint',{key:'user_note',value:'restore_previous_safe_state'});
  if(!out.some(x=>x.type==='remove_item'))add('optimize_basket',{});return out;
}

export function makeSeedRow(task){
  const intent=task.expected?.intent_family||'build_basket',hard=hardConstraints(task),soft=preferences(task),actions=actionsFor(task,hard,soft);for(const a of actions)if(!ALLOWED.has(a.type))throw Error(`bad action ${a.type}`);
  const row={id:`seed_${task.id}`,schema_version:'1.0',language:'ru',user_request:task.user_request,session_context:task.session_context||{},guards:task.guards||{},target:{intent,hard_constraints:hard,soft_preferences:soft,shopping_plan:{mode:intent==='build_basket'?'build':'edit',requires_live_catalog:true,allowed_replacements:{}},actions,retained_constraints:[...(task.session_context?.constraints||[])],critic:{pass:true,issues:[]},confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}},provenance:{sources:[{source_id:SOURCE,generator:'deterministic-seed-v1',task_id:task.id}]},review:{status:'approved',method:'deterministic_generator_v1',human_reviewed:false},privacy:{sanitized:true,contains_personal_data:false}};
  validateExample(row,registry);const gate=trainingEligibility(row,registry);if(!gate.eligible)throw Error(`${row.id}: ${gate.reasons.join(',')}`);return row;
}

export function buildSeed(){
  const tasks=buildCorpus();if(tasks.length!==560)throw Error(`expected 560 tasks, got ${tasks.length}`);const evalIds=new Set();
  for(const [cat,n] of Object.entries(QUOTA))tasks.filter(x=>x.category===cat).sort((a,b)=>hash(`eval:${a.id}`).localeCompare(hash(`eval:${b.id}`))).slice(0,n).forEach(x=>evalIds.add(x.id));
  const train=[],evalRows=[];for(const task of tasks)(evalIds.has(task.id)?evalRows:train).push(makeSeedRow(task));if(train.length!==500||evalRows.length!==60)throw Error(`bad split ${train.length}/${evalRows.length}`);return {train,eval:evalRows};
}

export function writeSeed(outDir){const out=path.resolve(outDir),seed=buildSeed();fs.mkdirSync(out,{recursive:true});const write=(name,rows)=>fs.writeFileSync(path.join(out,name),rows.map(JSON.stringify).join('\n')+'\n');write('gold.jsonl',seed.train);write('eval-gold.jsonl',seed.eval);const manifest={schema_version:'1.0',source_id:SOURCE,approval:'mechanically_derived_not_human_reviewed',teacher_outputs_auto_approved:false,train_examples:500,eval_examples:60,production_actions:[...ALLOWED]};fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest}
if(import.meta.url===`file://${process.argv[1]}`){if(!process.argv[2])throw Error('usage: deterministic-seed OUT_DIR');console.log(JSON.stringify(writeSeed(process.argv[2])))}
