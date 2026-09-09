import fs from "node:fs";
import path from "node:path";
import { collectMagnitSnapshot } from "../retailers/magnit-collector.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const configPath = process.argv[2] || "data/retailers/magnit.collector.json";
const snapshotPath = process.argv[3] || "data/retailers/magnit.sample.json";
const overlayPath = process.argv[4] || "data/retailers/magnit.overlay.json";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const snapshot = await collectMagnitSnapshot(config);
const overlay = buildOverlayFromSnapshot(snapshot);

for (const file of [snapshotPath, overlayPath]) fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n");

console.log(`Magnit collector: ${snapshot.collector.accepted}/${snapshot.collector.discovered} pages accepted; ${overlay.matched.length} basket SKUs matched.`);
if (snapshot.collector.errors.length) {
  console.warn(`Magnit collector skipped ${snapshot.collector.errors.length} pages.`);
  for (const item of snapshot.collector.errors.slice(0, 10)) console.warn(`- ${item.url}: ${item.error}`);
}
