import fs from "node:fs";
import path from "node:path";

const [retailer, outcome, ...messageParts] = process.argv.slice(2);
if (!retailer || !outcome) {
  console.error("Usage: node scripts/update-collector-health.mjs <retailer> <success|failure> [message]");
  process.exit(2);
}

const file = path.resolve("data/retailers/collector-health.json");
const now = process.env.TD_HEALTH_NOW || new Date().toISOString();
const message = messageParts.join(" ") || (outcome === "success" ? "Collector and validation succeeded." : "Collector or validation failed.");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (data.schema !== "tamdeshevle.collector-health.v1") throw new Error("Invalid collector health schema");
data.collectors ||= {};
const previous = data.collectors[retailer] || {};
data.collectors[retailer] = {
  status: outcome === "success" ? "healthy" : "error",
  last_attempt_at: now,
  last_success_at: outcome === "success" ? now : previous.last_success_at || null,
  message
};
data.generated_at = now;
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`Collector health updated: ${retailer} -> ${data.collectors[retailer].status}`);
