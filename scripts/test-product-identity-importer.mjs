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

function runImport(source, target) {
  return spawnSync(process.execPath, [
    'scripts/import-product-identities.mjs',
    '--input', input,
    '--output', target,
    '--source', source
  ], { cwd: process.cwd(), encoding: 'utf8' });
}

const run = runImport('open_food_facts', output);
if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'importer failed');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
if (manifest.accepted_unique_gtins !== 2) throw new Error(`expected 2 valid GTINs, got ${manifest.accepted_unique_gtins}`);
if (manifest.rejected_rows !== 1) throw new Error(`expected 1 rejected row, got ${manifest.rejected_rows}`);
if (manifest.safety.verifies_price !== false) throw new Error('identity import must never verify price');
const shard400 = JSON.parse(fs.readFileSync(path.join(output, '400.json'), 'utf8'));
if (shard400.records[0].barcode !== '4006381333931') throw new Error('expected exact barcode in 400 shard');
if (shard400.records[0].product_name !== 'Valid EAN') throw new Error('expected product name mapping');
const shard460 = JSON.parse(fs.readFileSync(path.join(output, '460.json'), 'utf8'));
if (shard460.records[0].barcode !== '4601234567893') throw new Error('expected valid Russian-market EAN in 460 shard');

const blockedOutput = path.join(dir, 'blocked-index');
const blocked = runImport('ru_barcode', blockedOutput);
if (blocked.status !== 3) throw new Error(`expected ru_barcode import exit 3, got ${blocked.status}`);
if (!blocked.stderr.includes('blocked_pending_license_review')) throw new Error('expected explicit ru_barcode block reason');
if (fs.existsSync(path.join(blockedOutput, 'manifest.json'))) throw new Error('blocked source must not produce a manifest');

const unknownOutput = path.join(dir, 'unknown-index');
const unknown = runImport('unregistered_identity_source', unknownOutput);
if (unknown.status !== 3) throw new Error(`expected unregistered source import exit 3, got ${unknown.status}`);
if (!unknown.stderr.includes('source_not_approved_for_identity')) throw new Error('expected explicit unknown-source block reason');
if (fs.existsSync(path.join(unknownOutput, 'manifest.json'))) throw new Error('unregistered source must not produce a manifest');

console.log('product identity importer: ok');
