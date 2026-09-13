import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildCorpus,corpusStats} from './corpus-builder.mjs';
import {validateRegistry} from './firewall.mjs';

const here=new URL('./',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',here),'utf8'));
const deepseek=JSON.parse(fs.readFileSync(new URL('profiles/deepseek-r1-distill-qwen-7b.json',here),'utf8'));
const qwen=JSON.parse(fs.readFileSync(new URL('profiles/qwen3-8b.json',here),'utf8'));
const checked=validateRegistry(registry);
assert.equal(checked.ok,true);

for(const profile of [deepseek,qwen]){
  assert.equal(profile.profile_version,'1.0');
  assert.equal(profile.enabled_by_default,false);
  assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(profile.endpoint),'teacher endpoint must stay loopback-only');
  const source=registry.sources.find(x=>x.id===profile.source_id);
  assert.ok(source,`unknown source ${profile.source_id}`);
  assert.equal(source.status,'training_allowed');
  assert.equal(source.network_data_sent,false);
}

const rows=buildCorpus(),stats=corpusStats(rows);
assert.ok(rows.length>=500,`expected 500+ corpus rows, got ${rows.length}`);
assert.equal(new Set(rows.map(x=>x.id)).size,rows.length,'corpus ids must be unique');
assert.ok(stats.by_category.build_fuzzy>=300);
assert.ok(stats.by_category.edit_fuzzy>=100);
assert.ok(stats.by_category.multi_turn>=100);
assert.ok(stats.multi_turn_scenarios>=20);
for(const row of rows){
  assert.equal(row.language,'ru');
  assert.ok(row.user_request.trim().length>=3);
  assert.ok(Array.isArray(row.guards.forbid_fabrication));
  assert.equal(row.guards.must_keep_hard_constraints,true);
  assert.ok(row.expected?.intent_family);
  if(row.category==='multi_turn'&&row.turn>1)assert.ok(Array.isArray(row.expected.must_retain));
}

const jsonl=rows.map(x=>JSON.stringify(x)).join('\n');
assert.equal(jsonl.split('\n').length,rows.length,'JSONL export must be one task per line');
console.log(`Bai teacher corpus smoke passed: ${stats.total} tasks, ${stats.multi_turn_scenarios} journeys`);
