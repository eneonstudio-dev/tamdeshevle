import fs from "node:fs";
import path from "node:path";
import { collectPyatSnapshot } from "../retailers/pyat-collector.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const configPath = process.argv[2] || "data/retailers/pyat.collector.json";
const snapshotPath = process.argv[3] || "data/retailers/pyat.sample.json";
const overlayPath = process.argv[4] || "data/retailers/pyat.overlay.json";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
let snapshot;
try { snapshot = await collectPyatSnapshot(config); }
catch (error) {
  const code=String(error?.code||"PYAT_COLLECTOR_FAILED"),status=error?.status==null?"":String(error.status),retryable=error?.retryable===true?"true":"false";
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`error_code=${code}\nhttp_status=${status}\nretryable=${retryable}\n`);
  console.error(`[${code}] ${error?.message||error}`);
  process.exit(1);
}
const overlay = buildOverlayFromSnapshot(snapshot);

for (const file of [snapshotPath, overlayPath]) fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n");

console.log(`Pyaterochka store verified: ${snapshot.store_context.sap_code} · ${snapshot.store_context.address}`);
console.log(`Collected ${snapshot.rows.length} products; overlay matched ${overlay.matched.length}.`);
