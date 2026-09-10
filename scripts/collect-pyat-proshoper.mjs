import fs from "node:fs";
import path from "node:path";
import { collectProshoperRegionalSnapshot } from "../retailers/proshoper-collector.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const configPath = process.argv[2] || "data/retailers/pyat.proshoper.collector.json";
const snapshotPath = process.argv[3] || "data/retailers/pyat.sample.json";
const overlayPath = process.argv[4] || "data/retailers/pyat.overlay.json";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const snapshot = await collectProshoperRegionalSnapshot(config);
const overlay = buildOverlayFromSnapshot(snapshot);

for (const file of [snapshotPath, overlayPath]) fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n");

console.log(`Proshoper/Pyat: ${snapshot.rows.length} regional products; ${overlay.matched.length} basket SKUs matched; scope_verified=${snapshot.scope_verified}.`);
