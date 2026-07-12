#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-execution-approval-gate-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function selectedCandidateFrom(selector, number) {
  return (
    selector.selectedCandidate ||
    (Array.isArray(selector.numberedCandidates)
      ? selector.numberedCandidates.find((candidate) => Number(candidate.number) === Number(number))
      : null)
  );
}

function evidenceBlockerForAdapter(adapterId) {
  if (adapterId === "existing-cli-or-script") return "missing_reviewed_command_manifest";
  if (adapterId === "existing-application-api") return "missing_reviewed_api_request";
  if (adapterId === "existing-file-import-export") return "missing_reviewed_file_mapping";
  if (adapterId === "existing-browser-automation") return "missing_reviewed_browser_target";
  return "missing_target_window_title";
}

function evidenceArgsForAdapter(adapterId, paths) {
  if (adapterId === "existing-cli-or-script") return ["--reviewed-command", paths.reviewedCommandPath];
  if (adapterId === "existing-application-api") return ["--reviewed-api-request", paths.reviewedApiRequestPath];
  if (adapterId === "existing-file-import-export") return ["--reviewed-mapping", paths.reviewedMappingPath];
  if (adapterId === "existing-browser-automation") return ["--reviewed-browser-target", paths.reviewedBrowserTargetPath];
  return ["--target-window-title", "Transparent AI Apprentice Smoke Target"];
}

const selector = runNode("create-real-local-execution-pilot-selector.mjs", [
  "--goal",
  "Smoke a real local approval gate before execute mode.",
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-software",
  "8",
  "--max-pilots",
  "2",
  "--max-candidates",
  "2",
  "--selected-number",
  "1",
  "--output-dir",
  join(smokeRoot, "selector")
]);
const selectorPacket = readJson(selector.selectorPath);
const selectedCandidate = selectedCandidateFrom(selectorPacket, 1);
const selectedAdapterId = selectedCandidate?.primaryAdapterId || "existing-windows-ui-automation";
const expectedMissingEvidenceBlocker = evidenceBlockerForAdapter(selectedAdapterId);

const blocked = runNode("create-real-local-execution-approval-gate.mjs", [
  "--goal",
  "Blocked approval gate smoke.",
  "--selector",
  selector.selectorPath,
  "--selected-number",
  "1",
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);
const blockedPacket = readJson(blocked.gatePath);

const reviewedScriptPath = join(smokeRoot, "teacher-reviewed-approval-gate-command.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'approval gate reviewed command' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const reviewedCommandPath = join(smokeRoot, "reviewed-command-manifest.json");
writeFileSync(
  reviewedCommandPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_reviewed_cli_command_manifest_v1",
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      expectedScriptSha256: sha256(reviewedScriptPath),
      targetOutputFileName: "approval-gate-controlled-output.json"
    },
    null,
    2
  )}\n`,
  "utf8"
);
const reviewedApiRequestPath = join(smokeRoot, "reviewed-api-request.json");
writeFileSync(
  reviewedApiRequestPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_reviewed_api_request_v1",
      teacherReviewed: true,
      method: "POST",
      localEndpoint: "http://127.0.0.1:65535/smoke-only-not-called",
      note: "Smoke evidence only. The approval gate validates shape but does not call this endpoint."
    },
    null,
    2
  )}\n`,
  "utf8"
);
const reviewedMappingPath = join(smokeRoot, "reviewed-file-mapping.json");
writeFileSync(
  reviewedMappingPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_reviewed_file_mapping_v1",
      teacherReviewed: true,
      source: "smoke-input.geometry.json",
      mapping: { target: "smoke-output.geometry.json" },
      note: "Smoke evidence only. The approval gate validates shape but does not import or export files."
    },
    null,
    2
  )}\n`,
  "utf8"
);
const reviewedBrowserTargetPath = join(smokeRoot, "reviewed-browser-target.json");
writeFileSync(
  reviewedBrowserTargetPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_reviewed_browser_target_v1",
      teacherReviewed: true,
      url: "http://127.0.0.1:65535/smoke-only-not-opened",
      note: "Smoke evidence only. The approval gate validates shape but does not open a browser."
    },
    null,
    2
  )}\n`,
  "utf8"
);
const readyEvidenceArgs = evidenceArgsForAdapter(selectedAdapterId, {
  reviewedCommandPath,
  reviewedApiRequestPath,
  reviewedMappingPath,
  reviewedBrowserTargetPath
});

const ready = runNode("create-real-local-execution-approval-gate.mjs", [
  "--goal",
  "Ready approval gate smoke.",
  "--selector",
  selector.selectorPath,
  "--selected-number",
  "1",
  ...readyEvidenceArgs,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);
const readyPacket = readJson(ready.gatePath);
const readyReceipt = readJson(ready.receiptPath);

const checks = [
  {
    name: "Approval gate blocks execute request without route evidence and rollback point",
    pass:
      blocked.status === "blocked_before_execute_runner_request" &&
      blocked.readyForExecuteRequest === false &&
      blockedPacket.blockers.includes("missing_explicit_teacher_execute_confirmation") &&
      blockedPacket.blockers.includes(expectedMissingEvidenceBlocker) &&
      blockedPacket.blockers.includes("rollback_point_not_confirmed_for_this_execute_attempt"),
    evidence: blocked.blockers.join(",")
  },
  {
    name: "Approval gate validates reviewed command evidence and teacher confirmation",
    pass:
      ready.status === "ready_for_teacher_confirmed_execute_runner_request" &&
      ready.readyForExecuteRequest === true &&
      readyPacket.evidenceChecks[0]?.valid === true &&
      readyPacket.teacherConfirmationMatched === true &&
      readyPacket.rollbackPointCreated === true,
    evidence: ready.gatePath
  },
  {
    name: "Approval gate produces runner request but does not execute it",
    pass:
      readyPacket.generatedRunnerRequest?.tool === "run_all_software_execution_pilot_runner" &&
      readyPacket.generatedRunnerRequest.args.includes("--execute") &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.uiEventsSent === false,
    evidence: JSON.stringify(readyPacket.generatedRunnerRequest?.args || [])
  },
  {
    name: "Approval gate keeps screenshots memory rules packaging and universal completion locked",
    pass:
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.fullContinuousRecording === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.accepted === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.packagingGated === true &&
      readyReceipt.nativeUniversalExecution === false &&
      readyReceipt.allSoftwareExecutionComplete === false,
    evidence: JSON.stringify(readyReceipt.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_execution_approval_gate_smoke_v1",
  passed,
  total: checks.length,
  selectorPath: selector.selectorPath,
  blockedGatePath: blocked.gatePath,
  readyGatePath: ready.gatePath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
