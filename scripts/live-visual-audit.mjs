import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE = "https://eneonstudio-dev.github.io/tamdeshevle/";
const OUT = "audit-shots";
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

async function openPage(name, viewport, action) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(`pageerror: ${err.message}`));
  page.on("console", msg => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });
  const url = `${BASE}?visual_audit=${Date.now()}-${name}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".v2-hero", { timeout: 30000 });
  await page.waitForTimeout(3500);
  if (action) await action(page);
  await page.waitForTimeout(1200);
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    bodyScrollWidth: document.body.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
    hero: document.querySelector(".v2-hero")?.getBoundingClientRect().toJSON?.() || null,
    header: document.querySelector(".v2-header")?.getBoundingClientRect().toJSON?.() || null,
    bottomNav: document.querySelector(".v2-bottom-nav")?.getBoundingClientRect().toJSON?.() || null,
    assistant: document.querySelector(".td-ai")?.getBoundingClientRect().toJSON?.() || null,
    background: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.body).color,
    overflowX: getComputedStyle(document.documentElement).overflowX,
  }));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  report.push({ name, viewport, metrics, errors: errors.slice(0, 25) });
  await context.close();
}

const desktop = { width: 1440, height: 1050 };
const mobile = { width: 390, height: 844 };

await openPage("desktop-home", desktop);
await openPage("mobile-home", mobile);
await openPage("desktop-bay-open", desktop, async page => {
  await page.locator(".v2-bay-primary").click();
  await page.waitForSelector(".td-ai", { state: "visible", timeout: 15000 }).catch(() => {});
});
await openPage("mobile-bay-open", mobile, async page => {
  await page.locator(".v2-bay-primary").click();
  await page.waitForSelector(".td-ai", { state: "visible", timeout: 15000 }).catch(() => {});
});
await openPage("desktop-catalog", desktop, async page => {
  await page.evaluate(() => window.go?.("catalog"));
  await page.waitForTimeout(1600);
});
await openPage("mobile-catalog", mobile, async page => {
  await page.evaluate(() => window.go?.("catalog"));
  await page.waitForTimeout(1600);
});
await openPage("mobile-cart", mobile, async page => {
  await page.evaluate(() => window.go?.("cart"));
  await page.waitForTimeout(1600);
});

await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
