#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getMaskCorrection, recordMaskCorrectionResult } from "./mask-correction-store.mjs";
import { getNativeSelection } from "./native-selection-store.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const action = argValue("--action", "verify");
const correctionId = argValue("--correction-id");
const correctionStorePath = argValue("--correction-store");
const selectionStorePath = argValue("--selection-store");
const outputDir = resolve(argValue("--output-dir", ".transparent-apprentice/autocad-native-selection-edits"));
if (!new Set(["verify", "apply"]).has(action)) throw new Error(`Unsupported action: ${action}`);
if (!correctionId) throw new Error("--correction-id is required.");

const correction = getMaskCorrection({ id: correctionId, storePath: correctionStorePath });
if (!correction) throw new Error(`Mask correction not found: ${correctionId}`);
if (correction.surfaceKind !== "engineering_native_object") throw new Error("Correction is not an engineering native-object task.");
if (correction.status !== "reviewed_ready_for_separate_execution") {
  throw new Error(`Correction must be teacher-reviewed before live AutoCAD execution: ${correction.status}`);
}
const selectionId = correction.metadata?.selectionId || correction.packet?.target?.selectionId;
if (!selectionId) throw new Error("Reviewed correction is missing its native selection id.");
const selection = getNativeSelection({ id: selectionId, storePath: selectionStorePath });
if (!selection) throw new Error(`Native selection not found: ${selectionId}`);
if (selection.snapshot.surfaceKind !== "engineering_native_object") throw new Error("Native selection is not an engineering object.");

mkdirSync(outputDir, { recursive: true });
const requestPath = join(outputDir, `${correctionId}-autocad-native-request.json`);
const receiptPath = join(outputDir, `${correctionId}-autocad-native-result.json`);
writeFileSync(requestPath, `${JSON.stringify({
  format: "ai_apprentice_autocad_native_selection_request_v1",
  action,
  correctionId,
  receiptPath,
  correction,
  selection,
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
}, null, 2)}\n`, "utf8");

const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scriptPath = join(pluginRoot, "host-bridges", "aicad-managed", "apply-autocad-selection.ps1");
const executed = spawnSync("powershell", [
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
  "-RequestPath", requestPath, "-Action", action
], { cwd: process.cwd(), encoding: "utf8", timeout: 45_000 });
if (executed.status !== 0) throw new Error(executed.stderr || executed.stdout || "AutoCAD native selection adapter failed.");
const result = JSON.parse(readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, ""));
if (result.status === "blocked") throw new Error(`AutoCAD blocked the native edit: ${result.error || "unknown reason"}`);

let updatedCorrection = correction;
if (action === "apply") {
  if (result.status !== "applied_pending_teacher_verification") {
    throw new Error(`Unexpected AutoCAD live result: ${result.status}`);
  }
  updatedCorrection = recordMaskCorrectionResult({
    id: correctionId,
    status: "succeeded",
    evidence: {
      adapter: "autocad_managed_live_selection_adapter_v1",
      nativeSelectionId: selectionId,
      requestPath,
      receiptPath,
      operation: result.operation,
      exactCapturedEntityMatched: result.exactCapturedEntityMatched,
      documentSavedAutomatically: result.documentSavedAutomatically,
      screenControlUsed: false
    },
    note: "Live AutoCAD entity changed in one native transaction without saving or closing the drawing; teacher verification remains required.",
    storePath: correctionStorePath
  });
}

console.log(JSON.stringify({
  format: "ai_apprentice_autocad_native_selection_adapter_result_v1",
  status: result.status,
  action,
  correctionId,
  selectionId,
  requestPath,
  receiptPath,
  result,
  correction: updatedCorrection,
  ownApiUsed: false,
  screenControlUsed: false
}, null, 2));
