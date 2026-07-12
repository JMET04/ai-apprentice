#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".ta-smoke", "independent-mask-workbenches", String(Date.now()));
const screenshots = join(root, "screenshots");
mkdirSync(screenshots, { recursive: true });
process.env.TEMP = root;
process.env.TMP = root;

function runGenerator(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

const textGenerated = runGenerator("create-office-text-mask-workbench.mjs", [
  "--goal", "只把 Word 第 2 段的周五改成周一",
  "--software", "Microsoft Word",
  "--demo-preset", "office_text_replace",
  "--output-dir", join(root, "text")
]);
const engineeringGenerated = runGenerator("create-engineering-software-mask-workbench.mjs", [
  "--goal", "只修改工程软件对象 D04",
  "--software", "AICAD / AutoCAD",
  "--demo-preset", "engineering_dimension_change",
  "--backdrop", join(pluginRoot, "assets", "examples", "engineering-object-index.png"),
  "--output-dir", join(root, "engineering")
]);

const textHtml = readFileSync(textGenerated.browserOverlay, "utf8");
const engineeringHtml = readFileSync(engineeringGenerated.browserOverlay, "utf8");
const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

check(
  "Text and engineering software workbenches are separate generated artifacts",
  textGenerated.format === "mingtu_office_text_mask_workbench_result_v1" &&
    engineeringGenerated.format === "mingtu_engineering_software_mask_workbench_result_v1" &&
    textGenerated.browserOverlay !== engineeringGenerated.browserOverlay,
  JSON.stringify({ text: textGenerated.browserOverlay, engineering: engineeringGenerated.browserOverlay })
);
check(
  "Office workbench has no content-type switch or engineering fields",
  textHtml.includes("文字修改蒙版") &&
    textHtml.includes('id="nativeLocator"') &&
    !textHtml.includes("data-content-type=") &&
    !textHtml.includes('id="objectId"'),
  textGenerated.browserOverlay
);
check(
  "Engineering software workbench has no content-type switch or Office fields",
  engineeringHtml.includes("工程软件对象修改蒙版") &&
    engineeringHtml.includes('id="objectId"') &&
    !engineeringHtml.includes("data-content-type=") &&
    !engineeringHtml.includes('id="nativeLocator"'),
  engineeringGenerated.browserOverlay
);

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"], ...(executablePath ? { executablePath } : {}) });

async function inspectWorkbench(generated, screenshotName) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(generated.browserOverlay).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.MingTuOverlay));
  const canvas = await page.locator("#overlayCanvas").boundingBox();
  if (!canvas) throw new Error("Overlay canvas is not visible");
  for (const [index, zone] of ["modify", "protect", "reference"].entries()) {
    await page.click(`[data-zone="${zone}"]`);
    const startX = canvas.x + canvas.width * (0.24 + index * 0.18);
    const startY = canvas.y + canvas.height * (0.32 + index * 0.12);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + canvas.width * 0.1, startY + canvas.height * 0.08, { steps: 5 });
    await page.mouse.up();
  }
  const result = await page.evaluate(() => ({
    packet: globalThis.MingTuOverlay.packet(),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    title: document.title,
    switches: document.querySelectorAll("[data-content-type]").length,
    officeFields: document.querySelectorAll("#officeType, #nativeLocator, #originalText, #replacementText").length,
    engineeringFields: document.querySelectorAll("#objectType, #objectId, #targetValue, #unit").length
  }));
  const screenshot = join(screenshots, screenshotName);
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.close();
  return { ...result, errors, screenshot };
}

try {
  const text = await inspectWorkbench(textGenerated, "office-text-mask.png");
  check(
    "Office workbench exports one exact paragraph edit without whole-document regeneration",
    text.switches === 0 &&
      text.bodyWidth <= text.viewportWidth + 1 &&
      text.officeFields === 4 &&
      text.engineeringFields === 0 &&
      text.packet.format === "mingtu_multimodal_surgical_mask_correction_v1" &&
      text.packet.surfaceKind === "office_native_text" &&
      text.packet.source.nativeLocator === "paragraph:2" &&
      text.packet.correction.originalText === "周五" &&
      text.packet.correction.replacementText === "周一" &&
      text.packet.maskSemantics.modify.length === 1 &&
      text.packet.maskSemantics.protect.length === 1 &&
      text.packet.maskSemantics.reference.length === 1 &&
      text.packet.invariants.preserveFormulasStylesStructure === true &&
      text.packet.reviewOnly === true && text.packet.accepted === false && text.packet.ruleEnabled === false && text.packet.packagingGated === true,
    JSON.stringify({ screenshot: text.screenshot, packet: text.packet })
  );
  check("Office workbench has no browser errors", text.errors.length === 0, text.errors.join(" | ") || "none");

  const engineering = await inspectWorkbench(engineeringGenerated, "engineering-software-mask.png");
  check(
    "Engineering software workbench exports D04 change protection and reference evidence",
    engineering.switches === 0 &&
      engineering.bodyWidth <= engineering.viewportWidth + 1 &&
      engineering.officeFields === 0 &&
      engineering.engineeringFields === 4 &&
      engineering.packet.format === "mingtu_multimodal_surgical_mask_correction_v1" &&
      engineering.packet.surfaceKind === "engineering_native_object" &&
      engineering.packet.target.objectId === "D04" &&
      engineering.packet.target.targetValue === 450 &&
      engineering.packet.target.unit === "mm" &&
      engineering.packet.invariants.protectObjectIds.includes("D08") &&
      engineering.packet.invariants.protectObjectIds.includes("D10") &&
      engineering.packet.maskSemantics.modify.length === 1 &&
      engineering.packet.maskSemantics.protect.length === 1 &&
      engineering.packet.maskSemantics.reference.length === 1 &&
      engineering.packet.execution.nativeExecutionImplemented === false &&
      engineering.packet.reviewOnly === true && engineering.packet.accepted === false && engineering.packet.ruleEnabled === false && engineering.packet.packagingGated === true,
    JSON.stringify({ screenshot: engineering.screenshot, packet: engineering.packet })
  );
  check("Engineering software workbench has no browser errors", engineering.errors.length === 0, engineering.errors.join(" | ") || "none");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobile.goto(pathToFileURL(textGenerated.browserOverlay).href, { waitUntil: "load" });
  await mobile.click("#openInspector");
  await mobile.waitForTimeout(260);
  const mobileResult = await mobile.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    open: document.querySelector("#inspector")?.classList.contains("open"),
    rect: document.querySelector("#inspector")?.getBoundingClientRect().toJSON()
  }));
  check(
    "Standalone Office workbench remains usable on mobile",
    mobileResult.open && mobileResult.bodyWidth <= mobileResult.viewportWidth + 1 && mobileResult.rect.left >= 0 && mobileResult.rect.right <= mobileResult.viewportWidth + 1,
    JSON.stringify(mobileResult)
  );
  await mobile.close();
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.pass);
console.log(JSON.stringify({
  format: "mingtu_independent_mask_workbenches_smoke_v1",
  status: failed.length ? "failed" : "passed",
  root,
  passed: checks.length - failed.length,
  total: checks.length,
  textGenerated,
  engineeringGenerated,
  checks
}, null, 2));
if (failed.length) process.exit(1);
