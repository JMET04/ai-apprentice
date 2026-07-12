#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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
const outputDir = resolve(argValue("--output-dir", ".transparent-apprentice/word-native-selection-edits"));
if (!new Set(["verify", "apply"]).has(action)) throw new Error(`Unsupported action: ${action}`);
if (!correctionId) throw new Error("--correction-id is required.");

const correction = getMaskCorrection({ id: correctionId, storePath: correctionStorePath });
if (!correction) throw new Error(`Mask correction not found: ${correctionId}`);
if (correction.surfaceKind !== "office_native_text") throw new Error("Correction is not an Office native text task.");
if (correction.status !== "reviewed_ready_for_separate_execution") {
  throw new Error(`Correction must be teacher-reviewed before live Word execution: ${correction.status}`);
}
const selectionId = correction.metadata?.selectionId || correction.packet?.source?.selectionId;
if (!selectionId) throw new Error("Reviewed correction is missing its native selection id.");
const selection = getNativeSelection({ id: selectionId, storePath: selectionStorePath });
if (!selection) throw new Error(`Native selection not found: ${selectionId}`);

mkdirSync(outputDir, { recursive: true });
const requestPath = join(outputDir, `${correctionId}-word-native-request.json`);
writeFileSync(requestPath, `${JSON.stringify({
  format: "ai_apprentice_word_native_selection_request_v1",
  action,
  correction,
  selection,
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
}, null, 2)}\n`, "utf8");

const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scriptPath = join(pluginRoot, "host-bridges", "word", "apply-word-selection.ps1");
const executed = spawnSync("powershell", [
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", scriptPath,
  "-RequestPath", requestPath,
  "-Action", action
], { cwd: process.cwd(), encoding: "utf8" });
if (executed.status !== 0) throw new Error(executed.stderr || executed.stdout || "Word native selection adapter failed.");
const result = JSON.parse(executed.stdout.replace(/^\uFEFF/, ""));
const receiptPath = join(outputDir, `${correctionId}-word-native-result.json`);
writeFileSync(receiptPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

let updatedCorrection = correction;
if (action === "apply") {
  updatedCorrection = recordMaskCorrectionResult({
    id: correctionId,
    status: "succeeded",
    evidence: {
      adapter: "word_com_live_selection_adapter_v1",
      nativeSelectionId: selectionId,
      requestPath,
      receiptPath,
      exactCapturedRangeMatched: result.exactCapturedRangeMatched,
      undoRecordCreated: result.undoRecordCreated,
      screenControlUsed: false
    },
    note: "Live Word range changed without saving or closing the document; teacher verification remains required.",
    storePath: correctionStorePath
  });
}

console.log(JSON.stringify({
  format: "ai_apprentice_word_native_selection_adapter_result_v1",
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
