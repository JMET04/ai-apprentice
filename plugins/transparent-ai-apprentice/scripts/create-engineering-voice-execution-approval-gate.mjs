#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "engineering-voice-execution-approval-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "engineering-voice-execution-approval-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed engineering voice execution",
    "teacher confirmed voice command execution",
    "approve engineering voice execution",
    "allow controlled engineering voice execution",
    "i confirm engineering voice command execution",
    "i approve controlled engineering voice execution",
    "\u786e\u8ba4\u6267\u884c\u8bed\u97f3\u5de5\u7a0b\u547d\u4ee4",
    "\u786e\u8ba4\u5de5\u7a0b\u8f6f\u4ef6\u8bed\u97f3\u6267\u884c",
    "\u5141\u8bb8\u53d7\u63a7\u6267\u884c\u8bed\u97f3\u5de5\u7a0b\u547d\u4ee4"
  ].some((marker) => text.includes(marker));
}

function findRunnerEntry(executionPackage, adapterId) {
  const entries = Array.isArray(executionPackage?.runnerEntries) ? executionPackage.runnerEntries : [];
  return entries.find((entry) => entry.adapterId === adapterId) || entries[0] || null;
}

function isPlainFileName(value) {
  return Boolean(value) && String(value) === String(value).replace(/[\\/]/g, "");
}

function commandManifestStatus(path) {
  if (!path) return { kind: "reviewedCommand", path: "", valid: false, blocker: "missing_reviewed_command_manifest" };
  if (!existsSync(path)) return { kind: "reviewedCommand", path, valid: false, blocker: "reviewed_command_manifest_path_not_found" };
  const manifest = readJson(path);
  const scriptPath = manifest.scriptSourceFile || manifest.scriptPath || "";
  const scriptExists = Boolean(scriptPath && existsSync(scriptPath));
  const actual = scriptExists ? sha256(scriptPath) : "";
  const expected = String(manifest.expectedScriptSha256 || "").toLowerCase();
  const targetOutputFileName = String(manifest.targetOutputFileName || "");
  const valid =
    manifest.teacherReviewed === true &&
    manifest.commandKind === "node-script" &&
    scriptExists &&
    Boolean(expected) &&
    actual === expected &&
    isPlainFileName(targetOutputFileName);
  return {
    kind: "reviewedCommand",
    path: resolve(path),
    valid,
    blocker: valid ? "" : "reviewed_command_manifest_incomplete_or_hash_mismatch",
    manifestSummary: {
      format: manifest.format || "",
      teacherReviewed: Boolean(manifest.teacherReviewed),
      commandKind: manifest.commandKind || "",
      scriptSourceFile: scriptPath,
      scriptExists,
      expectedScriptSha256: expected,
      actualScriptSha256: actual,
      hashMatches: Boolean(expected && actual === expected),
      targetOutputFileName
    }
  };
}

function apiManifestStatus(path) {
  if (!path) return { kind: "reviewedApiRequest", path: "", valid: false, blocker: "missing_reviewed_api_request" };
  if (!existsSync(path)) return { kind: "reviewedApiRequest", path, valid: false, blocker: "reviewed_api_request_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.method) && Boolean(manifest.url || manifest.localEndpoint);
  return { kind: "reviewedApiRequest", path: resolve(path), valid, blocker: valid ? "" : "reviewed_api_request_incomplete" };
}

function mappingStatus(path) {
  if (!path) return { kind: "reviewedMapping", path: "", valid: false, blocker: "missing_reviewed_file_mapping" };
  if (!existsSync(path)) return { kind: "reviewedMapping", path, valid: false, blocker: "reviewed_file_mapping_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.source || manifest.input || manifest.mapping);
  return { kind: "reviewedMapping", path: resolve(path), valid, blocker: valid ? "" : "reviewed_file_mapping_incomplete" };
}

function browserTargetStatus(path) {
  if (!path) return { kind: "reviewedBrowserTarget", path: "", valid: false, blocker: "missing_reviewed_browser_target" };
  if (!existsSync(path)) return { kind: "reviewedBrowserTarget", path, valid: false, blocker: "reviewed_browser_target_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.url || manifest.cdpEndpoint || manifest.webSocketDebuggerUrl || manifest.targetHtmlFile);
  return { kind: "reviewedBrowserTarget", path: resolve(path), valid, blocker: valid ? "" : "reviewed_browser_target_incomplete" };
}

function targetConfirmationValidationStatus(path, confirmationPath) {
  if (!path) {
    return {
      kind: "targetConfirmationReceiptValidation",
      path: "",
      valid: false,
      blocker: "missing_target_confirmation_receipt_validation"
    };
  }
  if (!existsSync(path)) {
    return {
      kind: "targetConfirmationReceiptValidation",
      path,
      valid: false,
      blocker: "target_confirmation_receipt_validation_path_not_found"
    };
  }
  const validation = readJson(path);
  const receiptMatches =
    Boolean(validation.receiptPath && confirmationPath) &&
    resolve(validation.receiptPath).toLowerCase() === resolve(confirmationPath).toLowerCase();
  const valid =
    validation.format === "transparent_ai_engineering_command_target_confirmation_receipt_validation_v1" &&
    validation.status === "ready_for_execution_approval_gate_not_execution" &&
    validation.readyForExecutionApprovalGate === true &&
    receiptMatches &&
    validation.locks?.validationDoesNotExecuteTargetSoftware === true &&
    validation.locks?.validationDoesNotSendUiEvents === true &&
    validation.locks?.validationDoesNotCaptureScreenshots === true &&
    validation.locks?.validationDoesNotWriteMemory === true;
  return {
    kind: "targetConfirmationReceiptValidation",
    path: resolve(path),
    valid,
    blocker: valid ? "" : "target_confirmation_receipt_validation_not_ready_or_mismatched",
    validationSummary: {
      format: validation.format || "",
      status: validation.status || "",
      readyForExecutionApprovalGate: validation.readyForExecutionApprovalGate === true,
      receiptMatches,
      selectedCandidateNumber: validation.selectedCandidateNumber ?? null
    }
  };
}

function evidenceForAdapter(adapterId, paths, targetWindowTitle) {
  if (adapterId === "existing-cli-or-script") return [commandManifestStatus(paths.reviewedCommand)];
  if (adapterId === "existing-application-api") return [apiManifestStatus(paths.reviewedApiRequest)];
  if (adapterId === "existing-file-import-export") return [mappingStatus(paths.reviewedMapping)];
  if (adapterId === "existing-browser-automation") return [browserTargetStatus(paths.reviewedBrowserTarget)];
  return [
    {
      kind: "targetWindowTitle",
      path: "",
      valid: Boolean(targetWindowTitle),
      blocker: targetWindowTitle ? "" : "missing_target_window_title"
    }
  ];
}

function runnerArgsFor(entry, options) {
  const isPowerShell = extname(entry.runnerPath || "").toLowerCase() === ".ps1";
  const args = isPowerShell ? ["-TeacherConfirmed", "-Execute"] : ["--teacher-confirmed", "--execute"];
  if (entry.adapterId === "existing-cli-or-script" && options.reviewedCommand) args.push(isPowerShell ? "-ReviewedCommand" : "--reviewed-command", resolve(options.reviewedCommand));
  if (entry.adapterId === "existing-application-api" && options.reviewedApiRequest) args.push("--reviewed-api-request", resolve(options.reviewedApiRequest));
  if (entry.adapterId === "existing-file-import-export" && options.reviewedMapping) args.push("--reviewed-mapping", resolve(options.reviewedMapping));
  if (entry.adapterId === "existing-browser-automation" && options.reviewedBrowserTarget) args.push("--reviewed-browser-target", resolve(options.reviewedBrowserTarget));
  if (entry.adapterId === "existing-windows-ui-automation" && options.targetWindowTitle) args.push(isPowerShell ? "-TargetWindowTitle" : "--target-window-title", options.targetWindowTitle);
  return args;
}

function writeReadme(path, packet) {
  const lines = [
    "# Engineering Voice Execution Approval Gate",
    "",
    `Goal: ${packet.goal}`,
    `Software: ${packet.software}`,
    `Selected number: ${packet.selected?.number ?? ""}`,
    `Adapter: ${packet.adapterId}`,
    `Status: ${packet.status}`,
    "",
    "This is the final review gate after a voice/text engineering command has been narrowed to one numbered target.",
    "",
    "Review order:",
    "1. Confirm the transcript or typed command was understood correctly.",
    "2. Confirm the selected numbered target is the intended visible location.",
    "3. Validate the target confirmation receipt before building execute approval.",
    "4. Confirm the reviewed route evidence and rollback point exist.",
    "5. Only then copy the generated runner request into a supervised execute attempt.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: this approval gate does not execute software, does not send UI events, does not capture screenshots, does not store audio, does not write memory, does not enable rules, and does not prove universal native execution."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Approve one confirmed engineering voice/text command for controlled execution."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const confirmationInput = readJsonInput(argValue("--confirmation", argValue("--confirmed-target", argValue("--confirmed-target-receipt", ""))), "--confirmation");
const executionPackageInput = readJsonInput(argValue("--execution-package", argValue("--execution-package-path", "")), "--execution-package");
const confirmationValidationInput = readJsonInput(
  argValue("--target-confirmation-validation", argValue("--confirmation-validation", "")),
  "--target-confirmation-validation"
);
const adapterOverride = argValue("--adapter-id", "");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--execution-confirmation", ""));
const targetWindowTitle = argValue("--target-window-title", "");
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointPath = rollbackPoint ? resolve(rollbackPoint) : "";
const rollbackPointExists = Boolean(rollbackPointPath && existsSync(rollbackPointPath));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-voice-execution-approval-gates")));

if (!confirmationInput.value || confirmationInput.value.format !== "transparent_ai_engineering_command_target_confirmation_receipt_v1") {
  throw new Error("--confirmation must be a transparent_ai_engineering_command_target_confirmation_receipt_v1 path or JSON object string");
}
if (!executionPackageInput.value || executionPackageInput.value.format !== "transparent_ai_existing_software_execution_package_v1") {
  throw new Error("--execution-package must be a transparent_ai_existing_software_execution_package_v1 path or JSON object string");
}

const receipt = confirmationInput.value;
const executionPackage = executionPackageInput.value;
const adapterId = adapterOverride || executionPackage.runnerEntries?.[0]?.adapterId || "";
const entry = findRunnerEntry(executionPackage, adapterId);
const evidence = evidenceForAdapter(
  adapterId,
  {
    reviewedCommand: argValue("--reviewed-command", ""),
    reviewedApiRequest: argValue("--reviewed-api-request", ""),
    reviewedMapping: argValue("--reviewed-mapping", ""),
    reviewedBrowserTarget: argValue("--reviewed-browser-target", "")
  },
  targetWindowTitle
);
const confirmationValidation = targetConfirmationValidationStatus(confirmationValidationInput.path, confirmationInput.path);
const confirmationMatched = explicitTeacherConfirmation(teacherConfirmation);
const blockers = [];
if (!receipt.evidence?.selectedTargetOnly) blockers.push("confirmed_target_receipt_does_not_narrow_to_one_target");
if (!Number.isInteger(Number(receipt.selectedCandidateNumber)) || Number(receipt.selectedCandidateNumber) < 1) blockers.push("missing_selected_candidate_number");
if (!entry?.runnerPath || !existsSync(entry.runnerPath)) blockers.push("selected_adapter_runner_missing");
if (!confirmationMatched) blockers.push("missing_explicit_teacher_voice_execute_confirmation");
if (!confirmationValidation.valid) blockers.push(confirmationValidation.blocker);
for (const item of evidence) if (!item.valid) blockers.push(item.blocker);
if (!hasFlag("--rollback-point-created")) blockers.push("rollback_point_not_confirmed_for_voice_execute_attempt");
if (!rollbackPointPath) blockers.push("rollback_point_path_missing_for_voice_execute_attempt");
else if (!rollbackPointExists) blockers.push("rollback_point_path_not_found_for_voice_execute_attempt");

const readyForExecuteRequest = blockers.length === 0;
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const packetPath = join(gateDir, "engineering-voice-execution-approval-gate.json");
const receiptPath = join(gateDir, "engineering-voice-execution-approval-gate-receipt.json");
const readmePath = join(gateDir, "ENGINEERING_VOICE_EXECUTION_APPROVAL_GATE_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  storesAudio: false,
  memoryWritten: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  nativeUniversalExecution: false,
  approvalGateDoesNotRunRunner: true,
  teacherNumberConfirmationRequired: true,
  teacherExecutionConfirmationRequired: true,
  rollbackPointRequired: true,
  rollbackPointPathRequired: true
};
const packet = {
  ok: true,
  format: "transparent_ai_engineering_voice_execution_approval_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status: readyForExecuteRequest ? "ready_for_teacher_confirmed_voice_execute_runner_request" : "blocked_before_voice_execute_runner_request",
  selected: {
    number: Number(receipt.selectedCandidateNumber),
    selectedTargetOnly: Boolean(receipt.evidence?.selectedTargetOnly),
    narrowedOverlayAnchorCount: receipt.evidence?.narrowedOverlayAnchorCount ?? null,
    sourceConfirmationPath: confirmationInput.path
  },
  adapterId,
  sourceEvidence: {
    confirmedTargetReceiptPath: confirmationInput.path,
    targetConfirmationValidationPath: confirmationValidationInput.path,
    executionPackagePath: executionPackageInput.path,
    runnerPath: entry?.runnerPath || "",
    adapterReceiptPath: entry?.receiptPath || "",
    rollbackPointPath
  },
  targetConfirmationValidation: confirmationValidation,
  evidenceChecks: evidence,
  teacherConfirmationMatched: confirmationMatched,
  rollbackPointCreated: hasFlag("--rollback-point-created"),
  rollbackPointPath,
  rollbackPointExists,
  rollbackPointRetained: rollbackPointExists,
  readyForExecuteRequest,
  blockers,
  generatedRunnerRequest: readyForExecuteRequest
    ? {
        runnerPath: resolve(entry.runnerPath),
        adapterId: entry.adapterId,
        args: runnerArgsFor(entry, {
          reviewedCommand: argValue("--reviewed-command", ""),
          reviewedApiRequest: argValue("--reviewed-api-request", ""),
          reviewedMapping: argValue("--reviewed-mapping", ""),
          reviewedBrowserTarget: argValue("--reviewed-browser-target", ""),
          targetWindowTitle
        }),
        note: "This gate does not execute the runner. Use this request only in a supervised execute attempt after teacher review."
      }
    : null,
  optimizedTeacherPrompt:
    "Speak or type one engineering command. I will restate it, mark likely targets with numbers, wait for you to confirm exactly one number, then create this approval gate before any controlled execution.",
  nextTeacherActions: readyForExecuteRequest
    ? [
        "Review the generated runner request.",
        "Run only this single selected voice/text command under supervision.",
        "Inspect the adapter receipt, outcome verification, and post-action checkpoint before screenshots or memory."
      ]
    : [
        "Resolve every blocker in this approval gate.",
        "Confirm the numbered target and reviewed route evidence still match the voice/text instruction.",
        "Create or confirm a rollback point before requesting execute mode."
      ],
  completionBoundary: {
    nativeUniversalExecution: false,
    reason: "This approves at most one teacher-confirmed voice/text command route. It is not arbitrary engineering software control."
  },
  locks
};
const gateReceipt = {
  ok: true,
  format: "transparent_ai_engineering_voice_execution_approval_gate_receipt_v1",
  gateId,
  status: packet.status,
  packetPath,
  readyForExecuteRequest,
  blockers,
  selectedCandidateNumber: packet.selected.number,
  adapterId,
  rollbackPointCreated: packet.rollbackPointCreated,
  rollbackPointPath,
  rollbackPointExists,
  rollbackPointRetained: packet.rollbackPointRetained,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  storesAudio: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  locks
};

writeReadme(readmePath, packet);
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(gateReceipt, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_engineering_voice_execution_approval_gate_result_v1",
      status: packet.status,
      gatePath: packetPath,
      receiptPath,
      readmePath,
      readyForExecuteRequest,
      blockers,
      selectedCandidateNumber: packet.selected.number,
      adapterId,
      rollbackPointCreated: packet.rollbackPointCreated,
      rollbackPointPath,
      rollbackPointExists,
      rollbackPointRetained: packet.rollbackPointRetained,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      storesAudio: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false
    },
    null,
    2
  )
);
