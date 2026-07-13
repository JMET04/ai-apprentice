#!/usr/bin/env node
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { reviewMaskCorrection, submitMaskCorrection } from "./mask-correction-store.mjs";
import { startMaskCorrectionService } from "./mask-correction-service.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".ta-smoke", "product-performance");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
process.env.TEMP = root;
process.env.TMP = root;
const now = () => Number(process.hrtime.bigint()) / 1e6;
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];

function mcpRound() {
  return new Promise((resolveRound, rejectRound) => {
    const started = now();
    const child = spawn(process.execPath, [join(__dirname, "mcp-server.mjs")], {
      cwd: repoRoot,
      env: { ...process.env, TRANSPARENT_AI_APPRENTICE_TOOL_MODE: "advanced" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let buffer = "";
    let stderr = "";
    const timeout = setTimeout(() => { child.kill(); rejectRound(new Error("MCP cold start timed out.")); }, 10000);
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.stdout.on("data", chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
        } else if (message.id === 2) {
          clearTimeout(timeout);
          const elapsedMs = now() - started;
          const payloadBytes = Buffer.byteLength(JSON.stringify(message.result));
          child.kill();
          resolveRound({ elapsedMs, payloadBytes, toolCount: message.result.tools.length, mode: message.result.mode });
        }
      }
    });
    child.on("error", error => { clearTimeout(timeout); rejectRound(error); });
    child.on("exit", code => {
      if (code && code !== 0 && stderr) rejectRound(new Error(stderr));
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  });
}

function runGenerator(script, args, outputDir) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args, "--output-dir", outputDir], {
    cwd: repoRoot, encoding: "utf8", timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function officePacket(locator, sourceText, replacementText) {
  const target = {
    id: "performance-office-target", contentType: "text", role: "change",
    editIntent: { kind: "text_edit", documentType: "word_docx", locator, operation: "replace", sourceText, replacementText, sourceTextConfirmedByTeacher: true, requiresExactTextMatch: true },
    completeness: { complete: true }, preserveOutsideThisMask: true, teacherReviewRequired: true
  };
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    modificationFormat: "transparent_ai_apprentice_multimodal_surgical_mask_correction_v1",
    changeTargets: [target],
    surgicalEditContract: { changeOnlyInsideSelectedTargets: true }
  };
}

function correctionPacket(index, surfaceKind = "office_native_text") {
  return {
    format: "transparent_ai_apprentice_multimodal_surgical_mask_correction_v1",
    surfaceKind,
    source: surfaceKind === "office_native_text" ? { nativeLocator: `paragraph:${index + 1}` } : undefined,
    correction: surfaceKind === "office_native_text" ? { operation: "replace_text", originalText: `old-${index}`, replacementText: `new-${index}` } : undefined,
    target: surfaceKind === "engineering_native_object" ? { objectId: "D04", action: "set_dimension", targetValue: 460 + index, unit: "mm" } : undefined,
    maskSemantics: { modify: [{ id: `m-${index}` }], protect: [], reference: [] },
    invariants: surfaceKind === "engineering_native_object" ? { protectObjectIds: ["D08", "D10"] } : {},
    reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true
  };
}

const thresholds = {
  mcpColdStartP95Ms: 5000,
  advancedToolCountMax: 30,
  maskPageReadyP95Ms: 3000,
  largeOfficeEditMs: 10000,
  concurrentSubmitMs: 5000,
  longSequenceMs: 15000,
  serviceMemoryGrowthMb: 128,
  aicadCompileMs: 10000
};
const mcpRounds = [];
for (let index = 0; index < 5; index += 1) mcpRounds.push(await mcpRound());

const service = startMaskCorrectionService({ host: "127.0.0.1", port: 0, storePath: join(root, "service-store.json") });
await new Promise(resolveReady => service.once("listening", resolveReady));
const endpoint = `http://127.0.0.1:${service.address().port}/api/mask-corrections`;
const officePage = runGenerator("create-office-text-mask-workbench.mjs", ["--demo-preset", "office_text_replace", "--api-endpoint", endpoint], join(root, "office-page"));
const engineeringPage = runGenerator("create-engineering-software-mask-workbench.mjs", ["--demo-preset", "engineering_dimension_change", "--api-endpoint", endpoint], join(root, "engineering-page"));
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(candidate => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const pageReadyMs = [];
for (const generated of [officePage, engineeringPage]) {
  for (let round = 0; round < 3; round += 1) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const started = now();
    await page.goto(pathToFileURL(generated.browserOverlay).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.AIApprenticeOverlay?.packet));
    pageReadyMs.push(now() - started);
    await page.close();
  }
}
await browser.close();

const editor = join(__dirname, "surgical-office-text-edit.py");
const largeDocx = join(root, "large-5000.docx");
let processResult = spawnSync("python", ["-B", editor, "--create-large-test-fixture", largeDocx, "--paragraph-count", "5000"], { cwd: repoRoot, encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1", TEMP: root, TMP: root } });
if (processResult.status !== 0) throw new Error(processResult.stderr || processResult.stdout);
const largeFixture = JSON.parse(processResult.stdout);
const officeRequestPath = join(root, "large-office-request.json");
writeFileSync(officeRequestPath, JSON.stringify(officePacket(largeFixture.targetLocator, largeFixture.sourceText, largeFixture.replacementText), null, 2), "utf8");
const largeOfficeStarted = now();
processResult = spawnSync("python", ["-B", editor, "--request", officeRequestPath, "--input", largeDocx, "--output", join(root, "large-edited.docx")], { cwd: repoRoot, encoding: "utf8", timeout: 120000, env: { ...process.env, PYTHONUTF8: "1", TEMP: root, TMP: root } });
const largeOfficeEditMs = now() - largeOfficeStarted;
if (processResult.status !== 0) throw new Error(processResult.stderr || processResult.stdout);
const largeOfficeResult = JSON.parse(processResult.stdout);

const concurrentStarted = now();
const concurrentResponses = await Promise.all(Array.from({ length: 25 }, (_, index) => fetch(endpoint, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packet: correctionPacket(index) })
}).then(async response => ({ ok: response.ok, body: await response.json() }))));
const concurrentSubmitMs = now() - concurrentStarted;

const memoryBefore = process.memoryUsage().rss;
const longStarted = now();
for (let index = 25; index < 125; index += 1) {
  const record = submitMaskCorrection({ packet: correctionPacket(index), storePath: join(root, "service-store.json") });
  if (index % 10 === 0) reviewMaskCorrection({ id: record.id, decision: "blocked", note: "benchmark review event", storePath: join(root, "service-store.json") });
}
const longSequenceMs = now() - longStarted;
const memoryAfter = process.memoryUsage().rss;
const serviceMemoryGrowthMb = Math.max(0, memoryAfter - memoryBefore) / 1024 / 1024;

const cadRecord = submitMaskCorrection({ packet: correctionPacket(0, "engineering_native_object"), storePath: join(root, "cad-store.json") });
reviewMaskCorrection({ id: cadRecord.id, decision: "approved_for_separate_execution", storePath: join(root, "cad-store.json") });
const aicadStarted = now();
processResult = spawnSync(process.execPath, [join(__dirname, "aicad-object-mask-adapter.mjs"), "--action", "apply", "--correction-id", cadRecord.id, "--store", join(root, "cad-store.json"), "--source-plan", join(pluginRoot, "assets", "examples", "aicad-object-mask-source.plan.json"), "--output-dir", join(root, "aicad")], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
const aicadCompileMs = now() - aicadStarted;
if (processResult.status !== 0) throw new Error(processResult.stderr || processResult.stdout);

service.closeAllConnections?.();
await new Promise(resolveClose => service.close(resolveClose));

const metrics = {
  mcpColdStartMs: mcpRounds.map(item => Number(item.elapsedMs.toFixed(2))),
  mcpColdStartP95Ms: Number(percentile(mcpRounds.map(item => item.elapsedMs), 0.95).toFixed(2)),
  advancedToolCount: mcpRounds[0].toolCount,
  advancedToolListPayloadBytes: mcpRounds[0].payloadBytes,
  maskPageReadyMs: pageReadyMs.map(value => Number(value.toFixed(2))),
  maskPageReadyP95Ms: Number(percentile(pageReadyMs, 0.95).toFixed(2)),
  largeOfficeParagraphs: largeFixture.paragraphCount,
  largeOfficeFileBytes: largeFixture.fileBytes,
  largeOfficeEditMs: Number(largeOfficeEditMs.toFixed(2)),
  largeOfficeOnlyExpectedPartChanged: largeOfficeResult.verification.onlyExpectedNativePartChanged,
  concurrentSubmissions: concurrentResponses.length,
  concurrentSubmitMs: Number(concurrentSubmitMs.toFixed(2)),
  concurrentSubmitSuccesses: concurrentResponses.filter(item => item.ok).length,
  longSequenceOperations: 100,
  longSequenceMs: Number(longSequenceMs.toFixed(2)),
  serviceMemoryGrowthMb: Number(serviceMemoryGrowthMb.toFixed(2)),
  aicadCompileMs: Number(aicadCompileMs.toFixed(2))
};
const checks = {
  mcpColdStart: metrics.mcpColdStartP95Ms <= thresholds.mcpColdStartP95Ms,
  advancedToolSurfaceBounded: metrics.advancedToolCount <= thresholds.advancedToolCountMax,
  maskPageReady: metrics.maskPageReadyP95Ms <= thresholds.maskPageReadyP95Ms,
  largeOfficeEdit: metrics.largeOfficeEditMs <= thresholds.largeOfficeEditMs && metrics.largeOfficeOnlyExpectedPartChanged,
  concurrentSubmissions: metrics.concurrentSubmitMs <= thresholds.concurrentSubmitMs && metrics.concurrentSubmitSuccesses === metrics.concurrentSubmissions,
  longSequenceStability: metrics.longSequenceMs <= thresholds.longSequenceMs,
  serviceMemoryGrowth: metrics.serviceMemoryGrowthMb <= thresholds.serviceMemoryGrowthMb,
  aicadCompile: metrics.aicadCompileMs <= thresholds.aicadCompileMs
};
const report = {
  format: "ai_apprentice_product_performance_baseline_v1",
  status: Object.values(checks).every(Boolean) ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version, cpus: os.cpus().length, totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024) },
  thresholds,
  metrics,
  checks
};
writeFileSync(join(root, "performance-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
