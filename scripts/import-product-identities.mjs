import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { normalizeBarcode, isValidGtin } from '../retailers/product-identity.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg, i, all) => {
  if (!arg.startsWith('--')) return [arg, true];
  const key = arg.slice(2);
  const next = all[i + 1];
  return [key, next && !next.startsWith('--') ? next : true];
}));

const input = args.input;
const output = args.output || 'data/product-identity/index';
const source = args.source || 'open_food_facts';
const format = args.format || (String(input || '').endsWith('.jsonl') ? 'jsonl' : 'csv');
const delimiter = args.delimiter === 'tab' ? '\t' : (args.delimiter || ',');

if (!input) {
  console.error('Usage: node scripts/import-product-identities.mjs --input FILE --source open_food_facts [--output DIR] [--format csv|jsonl]');
  process.exit(2);
}

function splitCsv(line, sep) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      cells.push(value);
      value = '';
    } else value += ch;
  }
  cells.push(value);
  return cells;
}

function normalizeKeys(row) {
  const pick = (...keys) => {
    for (const key of keys) if (row[key] != null && String(row[key]).trim()) return row[key];
    return null;
  };
  return {
    barcode: pick('barcode', 'code', 'gtin', 'ean', 'upc'),
    product_name: pick('product_name', 'product_name_ru', 'name', 'canonical_name'),
    brand: pick('brand', 'brands'),
    category: pick('category', 'categories', 'categories_tags'),
    quantity: pick('quantity', 'pack', 'package_size'),
    manufacturer: pick('manufacturer', 'producer'),
    source_ref: pick('source_ref', 'url', 'id'),
    last_verified: pick('last_verified', 'updated_at', 'checked_at', 'last_modified_t')
  };
}

function compactRecord(row) {
  const normalized = normalizeKeys(row);
  const barcode = normalizeBarcode(normalized.barcode);
  if (!barcode || !isValidGtin(barcode)) return null;
  return {
    barcode,
    product_name: normalized.product_name ? String(normalized.product_name).trim() : null,
    brand: normalized.brand ? String(normalized.brand).trim() : null,
    category: normalized.category ? String(normalized.category).trim() : null,
    quantity: normalized.quantity ? String(normalized.quantity).trim() : null,
    manufacturer: normalized.manufacturer ? String(normalized.manufacturer).trim() : null,
    source_ref: normalized.source_ref ? String(normalized.source_ref).trim() : null,
    last_verified: normalized.last_verified ? String(normalized.last_verified).trim() : null
  };
}

const shards = new Map();
let seen = 0;
let accepted = 0;
let invalid = 0;
let header = null;

function add(row) {
  seen += 1;
  const record = compactRecord(row);
  if (!record) { invalid += 1; return; }
  const shard = record.barcode.slice(0, 3).padEnd(3, '_');
  const bucket = shards.get(shard) || new Map();
  if (!bucket.has(record.barcode)) accepted += 1;
  bucket.set(record.barcode, record);
  shards.set(shard, bucket);
}

const stream = fs.createReadStream(input, { encoding: 'utf8' });
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
for await (const rawLine of lines) {
  const line = rawLine.replace(/^\uFEFF/, '').trim();
  if (!line) continue;
  if (format === 'jsonl') {
    try { add(JSON.parse(line)); } catch { invalid += 1; }
    continue;
  }
  const cells = splitCsv(line, delimiter);
  if (!header) {
    header = cells.map(value => value.trim().toLowerCase());
    continue;
  }
  const row = {};
  header.forEach((key, index) => { row[key] = cells[index] ?? ''; });
  add(row);
}

fs.mkdirSync(output, { recursive: true });
const manifest = {
  schema: 'votonobay.product_identity_shards.v1',
  source,
  generated_at: new Date().toISOString(),
  input_rows: seen,
  accepted_unique_gtins: accepted,
  rejected_rows: invalid,
  shard_count: shards.size,
  shard_key: 'first_3_gtin_digits',
  safety: {
    identity_only: true,
    verifies_price: false,
    verifies_stock: false,
    verifies_store_scope: false
  },
  shards: []
};

for (const [key, bucket] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const filename = `${key}.json`;
  const records = [...bucket.values()].sort((a, b) => a.barcode.localeCompare(b.barcode));
  fs.writeFileSync(path.join(output, filename), JSON.stringify({ source, records }));
  manifest.shards.push({ key, file: filename, count: records.length });
}

fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
