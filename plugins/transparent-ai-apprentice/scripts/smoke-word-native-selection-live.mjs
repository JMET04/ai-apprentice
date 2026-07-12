#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contextActionToMaskPacket,
  createNativeContextAction,
  ingestLatestNativeSelection
} from "./native-selection-store.mjs";
import {
  reviewMaskCorrection,
  submitMaskCorrection
} from "./mask-correction-store.mjs";

const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "word-native-selection-live");
const stateDir = join(root, "host-state");
const inbox = join(root, "inbox");
const selectionStore = join(root, "native-store.json");
const correctionStore = join(root, "correction-store.json");
const adapterOutput = join(root, "adapter-output");
rmSync(root, { recursive: true, force: true });
mkdirSync(stateDir, { recursive: true });
mkdirSync(inbox, { recursive: true });

const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });
const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
async function waitFor(path, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

const runningWord = spawnSync("powershell", ["-NoProfile", "-Command", "@(Get-Process WINWORD -ErrorAction SilentlyContinue).Count"], { encoding: "utf8" });
if (Number(runningWord.stdout.trim()) > 0) {
  console.log(JSON.stringify({
    format: "ai_apprentice_word_native_selection_live_smoke_v1",
    status: "skipped_existing_word_session",
    reason: "Live smoke refuses to attach when a user Word session already exists."
  }, null, 2));
  process.exit(0);
}

const host = spawn("powershell", [
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
  join(pluginRoot, "scripts", "smoke-word-native-selection-host.ps1"),
  "-StateDirectory", stateDir
], { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let hostError = "";
host.stderr.on("data", chunk => { hostError += chunk.toString("utf8"); });
try {
  await waitFor(join(stateDir, "ready.json"));
  const ready = JSON.parse(readFileSync(join(stateDir, "ready.json"), "utf8"));
  check("Dedicated Word host selects exact live text", ready.selection === "周五" && ready.start < ready.end, JSON.stringify(ready));

  const capture = spawnSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    join(pluginRoot, "host-bridges", "word", "capture-word-selection.ps1"),
    "-Trigger", "test_fixture",
    "-InboxPath", inbox,
    "-NoOpenCodex"
  ], { cwd: repoRoot, encoding: "utf8" });
  if (capture.status !== 0) throw new Error(capture.stderr || capture.stdout);
  const captured = JSON.parse(capture.stdout.replace(/^\uFEFF/, ""));
  check("Word bridge reads the real active COM Selection", captured.selectedText === "周五", captured.selectionPath);

  const selection = ingestLatestNativeSelection({ inboxPath: inbox, storePath: selectionStore });
  const action = createNativeContextAction({
    selectionId: selection.id,
    instruction: "只把周五改成周一，保持 Word 打开，不改变其他内容。",
    requestedChange: { operation: "replace_text", replacementText: "周一" },
    storePath: selectionStore
  });
  const packet = contextActionToMaskPacket({ action, selection });
  let correction = submitMaskCorrection({
    packet,
    metadata: { source: "live_word_smoke", selectionId: selection.id, contextActionId: action.id },
    storePath: correctionStore
  });
  correction = reviewMaskCorrection({
    id: correction.id,
    decision: "approved_for_separate_execution",
    reviewer: "live-smoke-teacher",
    note: "Exact temporary Word range verified.",
    storePath: correctionStore
  });
  check("Live Word edit requires explicit teacher review", correction.status === "reviewed_ready_for_separate_execution");

  const adapter = spawnSync(process.execPath, [
    join(pluginRoot, "scripts", "word-native-selection-adapter.mjs"),
    "--action", "apply",
    "--correction-id", correction.id,
    "--correction-store", correctionStore,
    "--selection-store", selectionStore,
    "--output-dir", adapterOutput
  ], { cwd: repoRoot, encoding: "utf8" });
  if (adapter.status !== 0) throw new Error(adapter.stderr || adapter.stdout);
  const applied = JSON.parse(adapter.stdout);
  check("Reviewed Agent plugin edit changes only the live COM range", applied.result.before === "周五" && applied.result.after === "周一");
  check("Live adapter leaves Word open and never uses screen control", applied.result.documentLeftOpen === true && applied.screenControlUsed === false);
  check("Live adapter creates a Word undo record", applied.result.undoRecordCreated === true);
  check("Live adapter returns result to teacher verification", applied.correction.status === "result_succeeded_pending_teacher_verification");

  writeFileSync(join(stateDir, "stop"), "stop\n", "utf8");
  await waitFor(join(stateDir, "result.json"));
  const finalHost = JSON.parse(readFileSync(join(stateDir, "result.json"), "utf8"));
  check("Temporary Word document contains the exact reviewed change", finalHost.text.includes("周一") && !finalHost.text.includes("周五"), finalHost.text);
} finally {
  if (!existsSync(join(stateDir, "stop"))) writeFileSync(join(stateDir, "stop"), "stop\n", "utf8");
  await Promise.race([new Promise(resolvePromise => host.once("exit", resolvePromise)), sleep(5000)]);
  if (host.exitCode === null) host.kill();
}

const passed = checks.filter(item => item.pass).length;
const result = {
  format: "ai_apprentice_word_native_selection_live_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  root,
  hostError,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
