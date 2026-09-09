import fs from "node:fs";
import path from "node:path";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/build-retailer-overlay.mjs <snapshot.json> <overlay.json>");
  process.exit(2);
}

const snapshot = JSON.parse(fs.readFileSync(input, "utf8"));
const overlay = buildOverlayFromSnapshot(snapshot);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(overlay, null, 2) + "\n");

console.log(`Retailer overlay built: ${overlay.retailer}/${overlay.city}, ${overlay.matched.length} matched of ${overlay.normalized_count}.`);
