#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "mingtu-mask-workbench-smoke", String(Date.now()));
const outputRoot = join(smokeRoot, "kit");
const engineeringOutputRoot = join(smokeRoot, "engineering-kit");
const screenshotRoot = join(smokeRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });

const fixture = join(
  pluginRoot,
  "integrations",
  "aicad-agent-v1",
  "plugin",
  "aicad-agent",
  "tests",
  "fixtures",
  "packaging",
  "preview.png"
);
if (!existsSync(fixture)) throw new Error(`Packaging preview fixture is missing: ${fixture}`);

const generator = spawnSync(process.execPath, [
  join(__dirname, "create-transparent-sketch-overlay-kit.mjs"),
  "--goal", "包装样图老师蒙版纠错浏览器验证",
  "--software", "Image2 / AICAD",
  "--backdrop", fixture,
  "--output-dir", outputRoot
], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
if (generator.status !== 0) throw new Error(generator.stderr || generator.stdout || "Mask workbench generation failed");
const generated = JSON.parse(generator.stdout);
const html = readFileSync(generated.browserOverlay, "utf8");
const textFixture = join(smokeRoot, "office-note.md");
writeFileSync(textFixture, "# 项目周报\n\n本方案将在周五提交审核。\n\n其他段落保持不变。\n", "utf8");
const engineeringFixture = join(repoRoot, "docs", "assets", "packaging-engineering-index.png");
const engineeringGenerator = spawnSync(process.execPath, [
  join(__dirname, "create-transparent-sketch-overlay-kit.mjs"),
  "--goal", "只修改工程对象 D04，不重画其他内容",
  "--software", "AICAD / AutoCAD 工程图审校",
  "--content-type", "engineering",
  "--demo-preset", "engineering_dimension_change",
  "--backdrop", engineeringFixture,
  "--output-dir", engineeringOutputRoot
], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
if (engineeringGenerator.status !== 0) throw new Error(engineeringGenerator.stderr || engineeringGenerator.stdout || "Engineering mask demo generation failed");
const engineeringGenerated = JSON.parse(engineeringGenerator.stdout);

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const checks = [];

function addCheck(name, pass, evidence) {
  checks.push({ name, pass: Boolean(pass), evidence });
}

async function draw(page, tool, from, to) {
  await page.click(`[data-tool="${tool}"]`);
  const box = await page.locator("#maskCanvas").boundingBox();
  if (!box) throw new Error("Mask canvas has no browser bounding box");
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 7 });
  await page.mouse.up();
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const desktopErrors = [];
  desktop.on("console", (message) => { if (message.type() === "error") desktopErrors.push(message.text()); });
  desktop.on("pageerror", (error) => desktopErrors.push(error.message));
  await desktop.goto(pathToFileURL(generated.browserOverlay).href, { waitUntil: "load" });
  await desktop.waitForFunction(() => Boolean(globalThis.MingTuOverlay));

  await draw(desktop, "brush", [0.16, 0.72], [0.43, 0.45]);
  await draw(desktop, "ellipse", [0.42, 0.23], [0.65, 0.47]);
  await draw(desktop, "rect", [0.58, 0.4], [0.79, 0.68]);
  await draw(desktop, "arrow", [0.28, 0.72], [0.62, 0.36]);
  await desktop.click('[data-tool="text"]');
  const canvasBox = await desktop.locator("#maskCanvas").boundingBox();
  await desktop.mouse.click(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.2);
  await desktop.click("#undoButton");
  await desktop.click("#redoButton");
  await desktop.click("#readonlyToggle");
  await desktop.click("#playbackNext");
  await desktop.click("#readonlyToggle");
  await desktop.click("#failureDemo");
  const failureText = await desktop.locator("#submitStatus").textContent();
  await desktop.click("#submitButton");
  await desktop.waitForTimeout(450);

  const desktopResult = await desktop.evaluate(() => ({
    packet: globalThis.packet(),
    state: globalThis.MingTuOverlay.getState(),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    status: document.querySelector("#submitStatus")?.textContent,
    draft: Object.keys(localStorage).some((key) => key.startsWith("mingtu-overlay-draft:")),
    controls: document.querySelectorAll("[data-tool]").length
  }));
  const desktopScreenshot = join(screenshotRoot, "desktop.png");
  await desktop.screenshot({ path: desktopScreenshot, fullPage: true });
  addCheck(
    "Desktop workbench supports five annotation tools and stable layout",
    desktopResult.controls === 5 && desktopResult.packet.annotations.length === 5 && desktopResult.bodyWidth <= desktopResult.viewportWidth + 1,
    desktopScreenshot
  );
  addCheck(
    "Undo redo readonly playback draft and submit states are functional",
    desktopResult.state.annotations.length === 5 && desktopResult.draft && failureText?.includes("提交失败") && desktopResult.status?.includes("图片局部修改包已导出"),
    JSON.stringify({
      annotations: desktopResult.state.annotations.length,
      readonly: desktopResult.state.readonly,
      redoDepth: desktopResult.state.redoStack.length,
      draft: desktopResult.draft,
      failureText,
      submitStatus: desktopResult.status
    })
  );
  addCheck(
    "Export keeps visual correction review-only and preserves unmarked regions",
    desktopResult.packet.workbenchFormat === "mingtu_teacher_mask_correction_v1" &&
      desktopResult.packet.modificationFormat === "mingtu_multimodal_surgical_mask_correction_v1" &&
      desktopResult.packet.teacherCorrection.preserveUnmarkedRegions === true &&
      desktopResult.packet.surgicalEditContract.changeOnlyInsideSelectedTargets === true &&
      desktopResult.packet.surgicalEditContract.fullRegenerationAllowed === false &&
      desktopResult.packet.locks.accepted === false &&
      desktopResult.packet.locks.ruleEnabled === false &&
      desktopResult.packet.locks.packagingGated === true,
    JSON.stringify(desktopResult.packet.locks)
  );
  addCheck(
    "Image mask exports exact targets and outside-mask zero-change validation",
    desktopResult.packet.changeTargets.length === 5 &&
      desktopResult.packet.changeTargets.every((target) => target.contentType === "image" && target.preserveOutsideThisMask === true) &&
      desktopResult.packet.surgicalEditContract.validation.rejectIfUnmarkedContentChanged === true,
    JSON.stringify({ changeTargets: desktopResult.packet.changeTargets.length, contract: desktopResult.packet.surgicalEditContract })
  );

  await desktop.evaluate(() => globalThis.MingTuOverlay.importAnnotations([]));
  await desktop.setInputFiles("#imageUpload", textFixture);
  await desktop.waitForTimeout(180);
  await desktop.click('[data-content-type="text"]');
  await desktop.selectOption("#textDocumentType", "word_docx");
  await desktop.fill("#textLocator", "paragraph:2");
  await desktop.fill("#sourceText", "周五");
  await desktop.fill("#replacementText", "周一");
  await draw(desktop, "rect", [0.16, 0.24], [0.56, 0.33]);
  const textResult = await desktop.evaluate(() => ({ packet: globalThis.packet(), state: globalThis.MingTuOverlay.getState() }));
  addCheck(
    "Text mask renders a real text document and binds Word native locator",
    textResult.state.backdropKind === "text_document" &&
      textResult.packet.activeContentType === "text" &&
      textResult.packet.changeTargets.length === 1 &&
      textResult.packet.changeTargets[0].editIntent.documentType === "word_docx" &&
      textResult.packet.changeTargets[0].editIntent.locator === "paragraph:2" &&
      textResult.packet.changeTargets[0].editIntent.sourceText === "周五" &&
      textResult.packet.changeTargets[0].editIntent.replacementText === "周一",
    JSON.stringify(textResult.packet.changeTargets[0]?.editIntent)
  );
  addCheck("Desktop browser has no console or runtime errors", desktopErrors.length === 0, desktopErrors.join(" | ") || "none");
  await desktop.close();

  const engineering = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const engineeringErrors = [];
  engineering.on("console", (message) => { if (message.type() === "error") engineeringErrors.push(message.text()); });
  engineering.on("pageerror", (error) => engineeringErrors.push(error.message));
  await engineering.goto(pathToFileURL(engineeringGenerated.browserOverlay).href, { waitUntil: "load" });
  await engineering.waitForFunction(() => Boolean(globalThis.MingTuOverlay));
  const engineeringResult = await engineering.evaluate(() => ({
    packet: globalThis.packet(),
    state: globalThis.MingTuOverlay.getState(),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    contentLabel: document.querySelector("#contentBadgeLabel")?.textContent
  }));
  const engineeringScreenshot = join(screenshotRoot, "engineering-software-mask.png");
  await engineering.screenshot({ path: engineeringScreenshot, fullPage: true });
  addCheck(
    "Engineering software mask demonstrates one D04 change target plus protected and reference regions",
    engineeringResult.bodyWidth <= engineeringResult.viewportWidth + 1 &&
      engineeringResult.contentLabel === "工程对象修改" &&
      engineeringResult.packet.changeTargets.length === 1 &&
      engineeringResult.packet.changeTargets[0].editIntent.objectId === "D04" &&
      engineeringResult.packet.changeTargets[0].editIntent.expectedValue === "450" &&
      engineeringResult.packet.preservationRegions.length === 1 &&
      engineeringResult.packet.referenceRelations.length === 1,
    JSON.stringify({ screenshot: engineeringScreenshot, changeTargets: engineeringResult.packet.changeTargets, protection: engineeringResult.packet.preservationRegions.length, references: engineeringResult.packet.referenceRelations.length })
  );
  addCheck(
    "Engineering mask blocks full redraw and all software side effects",
    engineeringResult.packet.surgicalEditContract.fullRegenerationAllowed === false &&
      engineeringResult.packet.teacherCorrection.rejectWholeArtifactReplacementForLocalIssue === true &&
      engineeringResult.packet.locks.softwareActionsExecuted === false &&
      engineeringResult.packet.locks.targetSoftwareCommandsExecuted === false &&
      engineeringResult.packet.proposedSoftwareAction.fullArtifactReplacementPrepared === false,
    JSON.stringify(engineeringResult.packet.locks)
  );
  addCheck("Engineering demo browser has no console or runtime errors", engineeringErrors.length === 0, engineeringErrors.join(" | ") || "none");
  await engineering.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on("console", (message) => { if (message.type() === "error") mobileErrors.push(message.text()); });
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  await mobile.goto(pathToFileURL(generated.browserOverlay).href, { waitUntil: "load" });
  await mobile.click("#inspectorToggle");
  await mobile.waitForTimeout(240);
  const mobileResult = await mobile.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: innerHeight,
    inspectorOpen: document.querySelector("#inspector")?.classList.contains("is-open"),
    inspectorRect: document.querySelector("#inspector")?.getBoundingClientRect().toJSON(),
    toolbarScrollable: document.querySelector(".tool-rail")?.scrollWidth >= document.querySelector(".tool-rail")?.clientWidth
  }));
  const mobileScreenshot = join(screenshotRoot, "mobile.png");
  await mobile.screenshot({ path: mobileScreenshot, fullPage: true });
  addCheck(
    "Mobile workbench opens the correction inspector without page overflow",
    mobileResult.inspectorOpen && mobileResult.bodyWidth <= mobileResult.viewportWidth + 1 && mobileResult.bodyHeight <= mobileResult.viewportHeight + 1 && mobileResult.inspectorRect.left >= 0 && mobileResult.inspectorRect.right <= mobileResult.viewportWidth + 1,
    JSON.stringify({ screenshot: mobileScreenshot, ...mobileResult })
  );
  addCheck("Mobile browser has no console or runtime errors", mobileErrors.length === 0, mobileErrors.join(" | ") || "none");
  await mobileContext.close();
} finally {
  await browser.close();
}

addCheck(
  "Generated page is standalone Chinese MingTu UI",
  html.includes("明徒 AI") && html.includes("老师蒙版纠错台") && html.includes("人工审校边界") && !html.includes('__INLINE_STYLES__') && !html.includes('__INLINE_SCRIPT__'),
  generated.browserOverlay
);

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  status: failed.length ? "failed" : "passed",
  smoke: "mingtu_mask_workbench_browser_smoke_v1",
  smokeRoot,
  generated,
  engineeringGenerated,
  checks
}, null, 2));
if (failed.length) process.exit(1);
