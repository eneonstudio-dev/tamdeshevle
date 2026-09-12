import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-import-'));
const input = path.join(dir, 'off.csv');
const output = path.join(dir, 'index');
fs.writeFileSync(input, [
  'code,product_name,brands,quantity,categories',
  '4601234567893,Тестовый продукт,Бренд,1 л,Напитки',
  '4006381333931,Valid EAN,Brand X,100 г,Food',
  '12345,Invalid,Nope,1,Test'
].join('\n'));

const run = spawnSync(process.execPath, [
  'scripts/import-product-identities.mjs',
  '--input', input,
  '--output', output,
  '--source', 'open_food_facts'
], { cwd: process.cwd(), encoding: 'utf8' });

if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'importer failed');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
if (manifest.accepted_unique_gtins !== 1) throw new Error(`expected 1 valid GTIN, got ${manifest.accepted_unique_gtins}`);
if (manifest.rejected_rows !== 2) throw new Error(`expected 2 rejected rows, got ${manifest.rejected_rows}`);
if (manifest.safety.verifies_price !== false) throw new Error('identity import must never verify price');
const shard = JSON.parse(fs.readFileSync(path.join(output, '400.json'), 'utf8'));
if (shard.records[0].barcode !== '4006381333931') throw new Error('expected exact barcode in shard');
if (shard.records[0].product_name !== 'Valid EAN') throw new Error('expected product name mapping');
console.log('product identity importer: ok');
