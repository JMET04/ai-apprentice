#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startMaskCorrectionService } from "./mask-correction-service.mjs";
import { captureNativeSelection } from "./native-selection-store.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".ta-smoke", "native-selection-workbench-v2", String(Date.now()));
const outputDir = join(root, "workbenches");
const screenshotDir = join(root, "screenshots");
const storePath = join(root, "selection-store.json");
const correctionStorePath = join(root, "correction-store.json");
mkdirSync(screenshotDir, { recursive: true });
const service = startMaskCorrectionService({ host: "127.0.0.1", port: 0, storePath: correctionStorePath });
await new Promise(resolveReady => service.once("listening", resolveReady));
const submitEndpoint = `http://127.0.0.1:${service.address().port}/api/mask-corrections`;

const boundary = { mode: "host_agent_plugin", reasoningOwner: "host_agent", modelApiRequired: false, apiKeyRequired: false, companionRole: "capture_and_handoff_only" };
const locks = { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true };
const office = captureNativeSelection({
  storePath,
  selection: {
    format: "ai_apprentice_native_selection_v1",
    surfaceKind: "office_native_text",
    host: { application: "Microsoft Word", documentName: "项目复盘报告.docx", documentPath: "D:/cases/项目复盘报告.docx", sessionId: "word-smoke" },
    selection: { nativeKind: "word_range", nativeLocator: "paragraph:12/range:18-42", text: "保留单层防潮袋，并完成下一轮高湿测试", range: { start: 18, end: 42 }, properties: { style: "正文", fontName: "宋体", fontSize: 11 } },
    capture: { trigger: "test_fixture", adapter: "word_com_selection_bridge_v1", capturedAt: new Date().toISOString() },
    interactionPreference: { backgroundPreparation: true, allowScreenControl: false, keepHostDocumentOpen: true },
    executionBoundary: boundary,
    ...locks
  }
});
const engineering = captureNativeSelection({
  storePath,
  selection: {
    format: "ai_apprentice_native_selection_v1",
    surfaceKind: "engineering_native_object",
    host: { application: "AutoCAD 2025", documentName: "运输外箱.dwg", documentPath: "D:/cases/运输外箱.dwg", sessionId: "autocad-smoke" },
    selection: { nativeKind: "autocad_face", nativeLocator: "handle:4A2/subentity:face:7", objectId: "D04", objectType: "Face", properties: { subentityIndex: 7, value: 420, unit: "mm" }, relationships: ["topology:E06", "topology:E14"], protectedObjectIds: ["D08", "D10"] },
    capture: { trigger: "test_fixture", adapter: "autocad_managed_full_subentity_bridge_v1", capturedAt: new Date().toISOString() },
    interactionPreference: { backgroundPreparation: true, allowScreenControl: false, keepHostDocumentOpen: true },
    executionBoundary: boundary,
    ...locks
  }
});

function generate(surface, selectionId = "") {
  const args = [join(pluginRoot, "scripts", "create-native-selection-workbench-v2.mjs"), "--surface", surface, "--output-dir", outputDir, "--submit-endpoint", submitEndpoint];
  if (selectionId) args.push("--selection-id", selectionId, "--selection-store", storePath);
  const run = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

const generated = [generate("packaging"), generate("office", office.id), generate("engineering", engineering.id)];
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find(candidate => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"], ...(executablePath ? { executablePath } : {}) });
const checks = [];
const submitted = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

try {
  for (const result of generated) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(pathToFileURL(result.outputPath).href, { waitUntil: "load" });
      await page.waitForFunction(() => Boolean(globalThis.MingTuOverlay?.packet));
      if (result.surface !== "packaging") {
        await page.locator("#selectionSurface").dispatchEvent("contextmenu", { clientX: 120, clientY: 160, button: 2 });
      }
      const inspected = await page.evaluate(() => {
        const packet = globalThis.MingTuOverlay.packet();
        const beacon = document.querySelector("#aiBeacon")?.getBoundingClientRect();
        const menu = document.querySelector("#contextMenu");
        return {
          packet,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          beaconInside: !beacon || (beacon.left >= 0 && beacon.top >= 0 && beacon.right <= innerWidth && beacon.bottom <= innerHeight),
          contextMenuVisible: !menu || !menu.hidden
        };
      });
      if (result.surface !== "packaging" && viewport.name === "mobile") {
        await page.locator("#openAction").evaluate(button => button.click());
        await page.waitForTimeout(250);
        const panel = result.surface === "office" ? "#actionSheet" : "#propertySheet";
        const panelVisible = await page.locator(panel).evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 && bounds.top < innerHeight && bounds.bottom > 0;
        });
        check(`${result.surface} mobile action sheet opens and remains reachable`, panelVisible, panel);
      }
      const screenshot = join(screenshotDir, `${result.surface}-${viewport.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      check(`${result.surface} ${viewport.name} renders without console errors or overflow`, errors.length === 0 && !inspected.overflow && inspected.beaconInside, `${screenshot}; errors=${errors.join(" | ") || "none"}`);
      if (result.surface !== "packaging") check(`${result.surface} ${viewport.name} native right-click surface opens`, inspected.contextMenuVisible, screenshot);
      if (result.surface === "office") {
        check("Generated Office packet preserves the formal native selection and context action contracts", inspected.packet.surfaceKind === "office_native_text" && inspected.packet.nativeSelection.format === "ai_apprentice_native_selection_v1" && inspected.packet.contextAction.format === "ai_apprentice_context_action_v1" && inspected.packet.executionBoundary.reasoningOwner === "host_agent" && inspected.packet.source.nativeLocator.includes("paragraph:12"), JSON.stringify(inspected.packet.executionBoundary));
      }
      if (result.surface === "engineering") {
        check("Generated engineering packet maps an exact face to the native face-offset operation", inspected.packet.surfaceKind === "engineering_native_object" && inspected.packet.target.nativeLocator === "handle:4A2/subentity:face:7" && inspected.packet.target.action === "offset_face" && inspected.packet.invariants.protectObjectIds.join(",") === "D08,D10" && inspected.packet.executionBoundary.apiKeyRequired === false, `${inspected.packet.target.nativeLocator}; action=${inspected.packet.target.action}`);
      }
      if (result.surface === "packaging") check("Generated packaging workbench keeps review locks and host-Agent boundary", inspected.packet.reviewOnly === true && inspected.packet.accepted === false && inspected.packet.packagingGated === true && inspected.packet.executionBoundary.mode === "host_agent_plugin", JSON.stringify(inspected.packet.executionBoundary));
      if (viewport.name === "desktop") {
        await page.evaluate(() => {
          localStorage.removeItem("ai-apprentice-mask-correction-last-v1");
          localStorage.removeItem("ai-apprentice-mask-correction-retry-queue-v1");
        });
        if (result.surface === "packaging") {
          check("Packaging blocks submission until a real mask mark exists", await page.locator("#submitReview").isDisabled(), "submitReview disabled before drawing");
          await page.click('.stepper button[data-panel="comment"]');
          await page.fill("#teacherNote", "Only modify the marked area and preserve every other dieline.");
          const mask = await page.locator("#maskCanvas").boundingBox();
          if (!mask) throw new Error("Packaging mask canvas is not visible");
          await page.mouse.move(mask.x + mask.width * 0.58, mask.y + mask.height * 0.43);
          await page.mouse.down();
          await page.mouse.move(mask.x + mask.width * 0.64, mask.y + mask.height * 0.47, { steps: 8 });
          await page.mouse.up();
          check("Packaging enables submission after mask and teacher note are present", !(await page.locator("#submitReview").isDisabled()), "one real pointer stroke");
        } else {
          await page.click("#generatePreview");
          const submitSelector = result.surface === "office" ? "#submitOffice" : "#submitEngineering";
          check(`${result.surface} requires the review step after preview`, await page.locator(submitSelector).isDisabled(), "submit remains disabled in preview step");
          await page.click("#toReview");
          check(`${result.surface} enables submission only after review entry`, !(await page.locator(submitSelector).isDisabled()), "submit enabled in review step");
          await page.click('.flow button[data-step="request"]');
          if (result.surface === "office") await page.fill("#instruction", "Use the revised cautious recommendation and preserve the selected paragraph style.");
          else await page.fill("#targetValue", "455");
          const stale = await page.evaluate(() => ({ disabled: document.querySelector('[id^="submit"]').disabled, previewReady: globalThis.MingTuOverlay.packet().previewReady }));
          check(`${result.surface} invalidates a stale preview when inputs change`, stale.disabled && !stale.previewReady, JSON.stringify(stale));
          await page.click("#generatePreview");
          await page.click("#toReview");
        }
        const button = result.surface === "packaging" ? "#submitReview" : result.surface === "office" ? "#submitOffice" : "#submitEngineering";
        if (result.surface === "packaging") {
          await page.route(submitEndpoint, route => route.abort("connectionrefused"));
          await page.click(button);
          await page.locator(".retry-button").waitFor({ state: "visible" });
          const queued = await page.evaluate(() => ({
            count: JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-retry-queue-v1") || "[]").length,
            state: document.querySelector("#saveState").className
          }));
          check("Offline submission exposes a visible local retry action", queued.count === 1 && queued.state.includes("offline"), JSON.stringify(queued));
          await page.unroute(submitEndpoint);
          await page.click(".retry-button");
        } else {
          await page.click(button);
        }
        await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-last-v1") || "null")?.id));
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ai-apprentice-mask-correction-last-v1") || "null"));
        submitted.push({ surface: result.surface, ...saved });
        check(`${result.surface} uses the configured submission endpoint`, saved.endpoint === submitEndpoint, saved.endpoint);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  service.closeAllConnections?.();
  await new Promise(resolveClose => service.close(resolveClose));
}

const persisted = JSON.parse(await (await import("node:fs/promises")).readFile(correctionStorePath, "utf8"));
check("All three v2 workbenches persist real correction records", persisted.records.length === 3, persisted.records.map(item => item.surfaceKind).join(","));
check("Packaging submission is persisted instead of reporting a simulated success", persisted.records.some(item => item.surfaceKind === "packaging_image_mask" && item.packet.teacherNote), submitted.find(item => item.surface === "packaging")?.id || "missing");

const passed = checks.filter(item => item.pass).length;
const report = { format: "ai_apprentice_native_selection_workbench_v2_smoke_v1", status: passed === checks.length ? "passed" : "failed", passed, total: checks.length, root, generated, checks };
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
