#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startMaskCorrectionService } from "./mask-correction-service.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = join(repoRoot, ".ta-smoke", "mask-workbench-submission-browser");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
process.env.TEMP = root;
process.env.TMP = root;

const service = startMaskCorrectionService({ host: "127.0.0.1", port: 0, storePath: join(root, "store.json") });
await new Promise(resolveReady => service.once("listening", resolveReady));
const endpoint = `http://127.0.0.1:${service.address().port}/api/mask-corrections`;

function generate(script, args, output, apiEndpoint = endpoint) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args, "--api-endpoint", apiEndpoint, "--output-dir", output], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const office = generate("create-office-text-mask-workbench.mjs", [
  "--goal", "只修改 Word 第 2 段",
  "--software", "Microsoft Word",
  "--demo-preset", "office_text_replace"
], join(root, "office"));
const engineering = generate("create-engineering-software-mask-workbench.mjs", [
  "--goal", "只修改 D04",
  "--software", "AICAD",
  "--demo-preset", "engineering_dimension_change"
], join(root, "engineering"));
const offline = generate("create-office-text-mask-workbench.mjs", [
  "--goal", "离线提交测试",
  "--software", "Microsoft Word",
  "--demo-preset", "office_text_replace"
], join(root, "offline"), "http://127.0.0.1:9/api/mask-corrections");

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].find(candidate => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

async function drawAndSubmit(generated) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(pathToFileURL(generated.browserOverlay).href, { waitUntil: "load" });
  const canvas = await page.locator("#overlayCanvas").boundingBox();
  await page.mouse.move(canvas.x + 100, canvas.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 220, canvas.y + 170, { steps: 6 });
  await page.mouse.up();
  await page.click("#submitButton");
  await page.waitForFunction(() => document.querySelector("#submitState")?.textContent.includes("纠错任务已保存"));
  const result = await page.evaluate(() => ({
    state: document.querySelector("#submitState")?.textContent,
    last: JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-last-v1") || "null"),
    queue: JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-retry-queue-v1") || "[]")
  }));
  await page.close();
  return { ...result, errors };
}

try {
  const officeResult = await drawAndSubmit(office);
  check("Office submit button persists a real correction record", Boolean(officeResult.last?.id), officeResult.state);
  check("Office successful submit clears retry queue", officeResult.queue.length === 0);
  const officeRecord = await fetch(`${endpoint}/${officeResult.last.id}`).then(response => response.json());
  check("Office persisted packet keeps exact native target", officeRecord.packet.source.nativeLocator === "paragraph:2");
  check("Office page has no runtime errors", officeResult.errors.length === 0, officeResult.errors.join(" | "));

  const engineeringResult = await drawAndSubmit(engineering);
  check("Engineering submit button persists a real correction record", Boolean(engineeringResult.last?.id), engineeringResult.state);
  const engineeringRecord = await fetch(`${endpoint}/${engineeringResult.last.id}`).then(response => response.json());
  check("Engineering persisted packet keeps D04 and 450 mm", engineeringRecord.packet.target.objectId === "D04" && engineeringRecord.packet.target.targetValue === 450);
  check("Engineering page has no runtime errors", engineeringResult.errors.length === 0, engineeringResult.errors.join(" | "));

  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(pathToFileURL(offline.browserOverlay).href, { waitUntil: "load" });
  const canvas = await page.locator("#overlayCanvas").boundingBox();
  await page.mouse.move(canvas.x + 100, canvas.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 180, canvas.y + 160);
  await page.mouse.up();
  await page.click("#submitButton");
  await page.waitForFunction(() => document.querySelector("#submitState")?.textContent.includes("待重试队列"));
  const failure = await page.evaluate(() => ({
    state: document.querySelector("#submitState")?.textContent,
    queue: JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-retry-queue-v1") || "[]")
  }));
  check("Offline submit reports failure instead of claiming saved", failure.state.includes("提交失败") && !failure.state.includes("纠错任务已保存"), failure.state);
  check("Offline submit enters durable browser retry queue", failure.queue.length === 1 && failure.queue[0].attempts === 1);
  await page.close();
} finally {
  await browser.close();
  service.closeAllConnections?.();
  await new Promise(resolveClose => service.close(resolveClose));
}

const persisted = JSON.parse(readFileSync(join(root, "store.json"), "utf8"));
check("Store contains both successfully submitted workbench records", persisted.records.length === 2);
const failed = checks.filter(item => !item.pass);
console.log(JSON.stringify({
  format: "ai_apprentice_mask_workbench_submission_browser_smoke_v1",
  status: failed.length ? "failed" : "passed",
  endpoint,
  passed: checks.length - failed.length,
  total: checks.length,
  checks
}, null, 2));
if (failed.length) process.exit(1);
