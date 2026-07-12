#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "real-local-execution-approval-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "real-local-execution-approval-gate"
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
    "teacher confirmed all-software execution pilot",
    "teacher confirmed execution pilot",
    "approve controlled execution pilot",
    "allow controlled execution pilot",
    "i confirm all-software execution pilot",
    "i approve controlled execution pilot",
    "确认执行试点",
    "允许受控执行试点",
    "确认全软件执行试点"
  ].some((marker) => text.includes(marker));
}

function findCandidate(selector, selectedNumber, selectedPilotId) {
  const candidates = Array.isArray(selector?.numberedCandidates) ? selector.numberedCandidates : [];
  if (selectedPilotId) return candidates.find((candidate) => candidate.pilotId === selectedPilotId) || null;
  if (selectedNumber) return candidates.find((candidate) => Number(candidate.number) === Number(selectedNumber)) || null;
  return selector?.selectedCandidate || candidates[0] || null;
}

function findPilot(queue, candidate) {
  if (!queue || !candidate) return null;
  return (Array.isArray(queue.pilots) ? queue.pilots : []).find((pilot) => pilot.pilotId === candidate.pilotId) || null;
}

function runnerEntryFor(pilot, adapterId) {
  if (!pilot?.adapterPackagePath || !existsSync(pilot.adapterPackagePath)) return null;
  const executionPackage = readJson(pilot.adapterPackagePath);
  const entries = Array.isArray(executionPackage.runnerEntries) ? executionPackage.runnerEntries : [];
  return entries.find((entry) => entry.adapterId === adapterId) || entries[0] || null;
}

function commandManifestStatus(path) {
  if (!path) {
    return {
      kind: "reviewedCommand",
      path: "",
      present: false,
      valid: false,
      blocker: "missing_reviewed_command_manifest"
    };
  }
  if (!existsSync(path)) {
    return {
      kind: "reviewedCommand",
      path,
      present: false,
      valid: false,
      blocker: "reviewed_command_manifest_path_not_found"
    };
  }
  const manifest = readJson(path);
  const scriptPath = manifest.scriptSourceFile || manifest.scriptPath || "";
  const scriptExists = Boolean(scriptPath && existsSync(scriptPath));
  const expected = manifest.expectedScriptSha256 || "";
  const actual = scriptExists ? sha256(scriptPath) : "";
  const hashMatches = Boolean(expected && actual && expected === actual);
  const valid =
    manifest.teacherReviewed === true &&
    manifest.commandKind === "node-script" &&
    scriptExists &&
    hashMatches &&
    Boolean(manifest.targetOutputFileName);
  return {
    kind: "reviewedCommand",
    path: resolve(path),
    present: true,
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
      hashMatches,
      targetOutputFileName: manifest.targetOutputFileName || ""
    }
  };
}

function apiManifestStatus(path) {
  if (!path) return { kind: "reviewedApiRequest", path: "", present: false, valid: false, blocker: "missing_reviewed_api_request" };
  if (!existsSync(path)) return { kind: "reviewedApiRequest", path, present: false, valid: false, blocker: "reviewed_api_request_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.method) && Boolean(manifest.url || manifest.localEndpoint);
  return { kind: "reviewedApiRequest", path: resolve(path), present: true, valid, blocker: valid ? "" : "reviewed_api_request_incomplete" };
}

function mappingStatus(path) {
  if (!path) return { kind: "reviewedMapping", path: "", present: false, valid: false, blocker: "missing_reviewed_file_mapping" };
  if (!existsSync(path)) return { kind: "reviewedMapping", path, present: false, valid: false, blocker: "reviewed_file_mapping_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.source || manifest.input || manifest.mapping);
  return { kind: "reviewedMapping", path: resolve(path), present: true, valid, blocker: valid ? "" : "reviewed_file_mapping_incomplete" };
}

function browserTargetStatus(path) {
  if (!path) return { kind: "reviewedBrowserTarget", path: "", present: false, valid: false, blocker: "missing_reviewed_browser_target" };
  if (!existsSync(path)) return { kind: "reviewedBrowserTarget", path, present: false, valid: false, blocker: "reviewed_browser_target_path_not_found" };
  const manifest = readJson(path);
  const valid = manifest.teacherReviewed === true && Boolean(manifest.url || manifest.cdpEndpoint || manifest.webSocketDebuggerUrl);
  return { kind: "reviewedBrowserTarget", path: resolve(path), present: true, valid, blocker: valid ? "" : "reviewed_browser_target_incomplete" };
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
      present: Boolean(targetWindowTitle),
      valid: Boolean(targetWindowTitle),
      blocker: targetWindowTitle ? "" : "missing_target_window_title"
    }
  ];
}

function writeReadme(path, packet) {
  const lines = [
    "# Real-Local Execution Approval Gate",
    "",
    `Goal: ${packet.goal}`,
    `Software: ${packet.selected?.software || ""}`,
    `Pilot: ${packet.selected?.pilotId || ""}`,
    `Adapter: ${packet.selected?.adapterId || ""}`,
    `Status: ${packet.status}`,
    "",
    "This packet is the final review gate before a selected real-local pilot may request execute mode.",
    "",
    "Review order:",
    "1. Confirm this is the intended numbered software candidate.",
    "2. Check every required route evidence item.",
    "3. Confirm rollback/checkpoint material exists.",
    "4. Only then use the generated runner arguments in a supervised execute attempt.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: this approval gate does not execute software, does not send UI events, does not capture screenshots, does not write memory, does not enable rules, and does not prove universal native execution."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Prepare one real-local execution pilot for teacher approval."));
const selectorInput = readJsonInput(argValue("--selector", argValue("--selector-path", "")), "--selector");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const selectedNumber = argValue("--selected-number", argValue("--number", ""));
const selectedPilotId = argValue("--selected-pilot-id", argValue("--pilot-id", ""));
const adapterOverride = argValue("--adapter-id", "");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const targetWindowTitle = argValue("--target-window-title", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "real-local-execution-approval-gates")));
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

if (!selectorInput.value || selectorInput.value.format !== "transparent_ai_real_local_execution_pilot_selector_v1") {
  throw new Error("--selector must be a transparent_ai_real_local_execution_pilot_selector_v1 path or JSON object string");
}
const selector = selectorInput.value;
const selectedCandidate = findCandidate(selector, selectedNumber, selectedPilotId);
const queuePath = queueInput.path || selector.sourceEvidence?.executionPilotQueuePath || "";
const queue = queueInput.value || (queuePath ? readJson(queuePath) : null);
const pilot = findPilot(queue, selectedCandidate);
const adapterId = adapterOverride || selectedCandidate?.primaryAdapterId || pilot?.primaryAdapterId || "";
const entry = runnerEntryFor(pilot, adapterId);
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
const confirmationMatched = explicitTeacherConfirmation(teacherConfirmation);
const blockers = [];
if (!selectedCandidate) blockers.push("missing_selected_candidate");
if (!queue) blockers.push("missing_execution_pilot_queue");
if (!pilot) blockers.push("selected_candidate_not_found_in_queue");
if (!entry?.runnerPath || !existsSync(entry.runnerPath)) blockers.push("selected_adapter_runner_missing");
if (!confirmationMatched) blockers.push("missing_explicit_teacher_execute_confirmation");
for (const item of evidence) if (!item.valid) blockers.push(item.blocker);
if (!hasFlag("--rollback-point-created")) blockers.push("rollback_point_not_confirmed_for_this_execute_attempt");

const readyForExecuteRequest = blockers.length === 0;
const runnerArgs = readyForExecuteRequest
  ? [
      "--queue",
      queuePath || "<queue-json>",
      "--pilot-id",
      selectedCandidate.pilotId,
      "--adapter-id",
      adapterId,
      "--execute",
      "--teacher-confirmation",
      teacherConfirmation,
      ...(argValue("--reviewed-command", "") ? ["--reviewed-command", resolve(argValue("--reviewed-command", ""))] : []),
      ...(argValue("--reviewed-api-request", "") ? ["--reviewed-api-request", resolve(argValue("--reviewed-api-request", ""))] : []),
      ...(argValue("--reviewed-mapping", "") ? ["--reviewed-mapping", resolve(argValue("--reviewed-mapping", ""))] : []),
      ...(argValue("--reviewed-browser-target", "") ? ["--reviewed-browser-target", resolve(argValue("--reviewed-browser-target", ""))] : []),
      ...(targetWindowTitle ? ["--target-window-title", targetWindowTitle] : [])
    ]
  : [];

const packetPath = join(gateDir, "real-local-execution-approval-gate.json");
const receiptPath = join(gateDir, "real-local-execution-approval-gate-receipt.json");
const readmePath = join(gateDir, "REAL_LOCAL_EXECUTION_APPROVAL_GATE_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  approvalGateDoesNotRunRunner: true
};
const packet = {
  ok: true,
  format: "transparent_ai_real_local_execution_approval_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyForExecuteRequest
    ? "ready_for_teacher_confirmed_execute_runner_request"
    : "blocked_before_execute_runner_request",
  selected: selectedCandidate
    ? {
        number: selectedCandidate.number,
        pilotId: selectedCandidate.pilotId,
        software: selectedCandidate.software,
        adapterId,
        routeMode: selectedCandidate.routeMode || ""
      }
    : null,
  sourceEvidence: {
    selectorPath: selectorInput.path,
    executionPilotQueuePath: queuePath,
    pilotActionPlanPath: pilot?.actionPlanPath || selectedCandidate?.actionPlanPath || "",
    adapterPackagePath: pilot?.adapterPackagePath || selectedCandidate?.adapterPackagePath || "",
    runnerPath: entry?.runnerPath || ""
  },
  evidenceChecks: evidence,
  teacherConfirmationMatched: confirmationMatched,
  rollbackPointCreated: hasFlag("--rollback-point-created"),
  readyForExecuteRequest,
  blockers,
  generatedRunnerRequest: readyForExecuteRequest
    ? {
        tool: "run_all_software_execution_pilot_runner",
        script: "run-all-software-execution-pilot-runner.mjs",
        args: runnerArgs,
        note: "This gate does not execute the runner; a teacher or supervised agent must invoke it deliberately."
      }
    : null,
  nextTeacherActions: readyForExecuteRequest
    ? [
        "Review the exact generated runner request.",
        "Run only one selected pilot under supervision.",
        "Inspect runner receipt, outcome verification, and post-action checkpoint before screenshots or memory."
      ]
    : [
        "Resolve every blocker in this packet.",
        "Use dry-run evidence to confirm the selected route still matches the teacher intent.",
        "Create or confirm a rollback point before requesting execute mode."
      ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason: "This gate authorizes at most one supervised execute request. It does not prove all-software execution."
  },
  locks
};
const receipt = {
  ok: true,
  format: "transparent_ai_real_local_execution_approval_gate_receipt_v1",
  gateId,
  status: packet.status,
  packetPath,
  readyForExecuteRequest,
  blockers,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks
};

writeReadme(readmePath, packet);
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_execution_approval_gate_result_v1",
      status: packet.status,
      gatePath: packetPath,
      receiptPath,
      readmePath,
      readyForExecuteRequest,
      blockers,
      selectedPilotId: selectedCandidate?.pilotId || "",
      selectedSoftware: selectedCandidate?.software || "",
      adapterId,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false
    },
    null,
    2
  )
);
