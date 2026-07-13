#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const pagePath = resolve("docs", "index.html");
const output = join(resolve(".ta-smoke"), "ai-apprentice-docs-page-smoke", String(Date.now()));
mkdirSync(output, { recursive: true });
process.env.TEMP = output;
process.env.TMP = output;
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const checks = [];

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(pagePath).href, { waitUntil: "load" });
    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      heroBottom: document.querySelector(".hero")?.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
      parentRelativeLinks: [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")).filter((href) => href?.startsWith("../")),
      h1: document.querySelector("h1")?.textContent?.trim(),
      workflowItems: document.querySelectorAll(".workflow-list li").length,
      capabilityRows: document.querySelectorAll(".capability-table .table-row").length
    }));
    const screenshot = join(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    checks.push({
      name: `${viewport.name} docs page is complete and does not overflow`,
      pass: metrics.bodyWidth <= metrics.viewportWidth + 1 && metrics.heroBottom < metrics.viewportHeight && metrics.brokenImages.length === 0 && metrics.parentRelativeLinks.length === 0 && metrics.h1 === "AI 学徒" && metrics.workflowItems === 8 && metrics.capabilityRows >= 7 && errors.length === 0,
      evidence: { screenshot, metrics, errors }
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({ status: failed.length ? "failed" : "passed", smoke: "transparent_ai_apprentice_docs_page_smoke_v1", output, checks }, null, 2));
if (failed.length) process.exit(1);
