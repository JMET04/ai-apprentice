#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function slug(value) {
  return (
    String(value || "tlcl-dry-run-only-runner")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-dry-run-only-runner"
  );
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromValidation(validation) {
  const trace = validation?.sourceEvidence?.providerRoleUsePlanTrace || {};
  return {
    inheritedFromRouteReviewValidation: Boolean(trace.providerRoleUsePlanHash),
    requiredForScopedProvider: trace.requiredForScopedProvider === true,
    accepted: trace.accepted === true,
    providerRole: trace.providerRole || "",
    providerRoleUsePlanPath: trace.providerRoleUsePlanPath || "",
    providerRoleUsePlanHash: trace.providerRoleUsePlanHash || "",
    nextGateSatisfied: trace.nextGateSatisfied !== false
  };
}

function commandHasUnsafeMarker(commandLine) {
  const lower = String(commandLine || "").toLowerCase();
  return [
    "--execute",
    "execute_now",
    "run_execute_mode",
    "capture_screenshot",
    "capture-screenshot",
    "write_memory",
    "unlock_packaging",
    "claim_complete",
    "native_universal_execution"
  ].filter((marker) => lower.includes(marker));
}

function locks() {
  return {
    dryRunOnly: true,
    reviewOnly: true,
    runnerExecuted: true,
    adapterInvoked: false,
    doesNotInvokeAdapter: true,
    doesNotExecuteTargetSoftware: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Run a TLCL medium-runtime dry-run-only runner without invoking target software.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--route-review-validation", "")),
  "--validation",
  "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_v1"
);
const outRoot = resolve(argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-only-runs")));
const validation = validationInput.value;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidation(validation);
const handoff = validation.dryRunOnlyRunnerHandoff || null;
const unsafeMarkers = commandHasUnsafeMarker(handoff?.commandTemplate || "");
const hasDryRunOnlyMode =
  handoff?.arguments?.mode === "dry_run_only" || String(handoff?.commandTemplate || "").includes('"mode":"dry_run_only"');
const blockers = [];

if (validation.status !== "ready_for_separate_dry_run_only_runner") blockers.push("route_review_validation_not_ready");
if (validation.readyForDryRunOnlyRunner !== true) blockers.push("route_review_not_marked_ready_for_runner");
if (!handoff) blockers.push("dry_run_only_runner_handoff_missing");
if (handoff?.executesNow !== false) blockers.push("handoff_executes_now_not_false");
if (!hasDryRunOnlyMode) blockers.push("handoff_mode_not_dry_run_only");
if (unsafeMarkers.length) blockers.push("handoff_command_contains_unsafe_marker");

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const runDir = join(outRoot, runId);
const runPath = join(runDir, "tlcl-medium-runtime-dry-run-only-run.json");
const receiptPath = join(runDir, "tlcl-medium-runtime-dry-run-only-run-receipt.json");
const readmePath = join(runDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_ONLY_RUN_START_HERE.md");
const status = blockers.length ? "blocked_before_dry_run_only_runner" : "dry_run_only_runner_completed_waiting_for_teacher_review";
const simulatedDryRunEvidence = blockers.length
  ? null
  : {
      kind: "simulated_dry_run_only_evidence",
      routeIndex: handoff.routeIndex,
      handoffItemId: handoff.handoffItemId,
      tool: handoff.tool || "",
      arguments: handoff.arguments || {},
      commandTemplate: handoff.commandTemplate || "",
      adapterInvoked: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      providerRoleUsePlanTrace,
      result: "command_template_shape_checked_without_target_software_execution",
      notes: [
        "This runner records dry-run-only evidence for teacher review.",
        "It does not spawn the adapter command, call target software, send UI events, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion."
      ]
    };
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  sourceEvidence: {
    routeReviewValidationPath: validationInput.path,
    routeReviewValidationHash: sha256Object(validation),
    providerRoleUsePlanTrace
  },
  selectedRunnerHandoff: handoff,
  simulatedDryRunEvidence,
  nextTeacherActions:
    status === "dry_run_only_runner_completed_waiting_for_teacher_review"
      ? [
          "Review the dry-run-only run receipt.",
          "Confirm whether the command template, selected route, rollback boundary, and no-execution locks match the intended workflow.",
          "If correct, validate the post-run receipt before any later execution approval gate.",
          "If wrong, correct back to senior_reasoning_compile."
        ]
      : ["Resolve blockers before any dry-run-only runner review."],
  blockedTransitions: [
    "invoke_adapter_from_tlcl_dry_run_only_runner",
    "execute_target_software_from_tlcl_dry_run_only_runner",
    "send_ui_events_from_tlcl_dry_run_only_runner",
    "capture_screenshot_from_tlcl_dry_run_only_runner",
    "read_full_logs_from_tlcl_dry_run_only_runner",
    "enable_rule_from_tlcl_dry_run_only_runner",
    "write_memory_from_tlcl_dry_run_only_runner",
    "unlock_packaging_from_tlcl_dry_run_only_runner",
    "claim_completion_from_tlcl_dry_run_only_runner"
  ],
  paths: { run: runPath, receipt: receiptPath, readme: readmePath },
  locks: locks()
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_run_receipt_v1",
  runId,
  status,
  blockers,
  evidenceReviewed: false,
  commandTemplateChecked: Boolean(simulatedDryRunEvidence),
  adapterInvoked: false,
  dryRunExecuted: status === "dry_run_only_runner_completed_waiting_for_teacher_review",
  runnerExecuted: status === "dry_run_only_runner_completed_waiting_for_teacher_review",
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullLogsRead: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeJson(runPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run-Only Runner",
    "",
    `Status: ${status}`,
    "",
    "This runner records dry-run-only evidence for teacher review.",
    "It does not invoke adapters, execute target software, send UI events, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_dry_run_only_runner_result_v1",
      runId,
      status,
      blockers,
      runPath,
      receiptPath,
      readmePath,
      adapterInvoked: false,
      dryRunExecuted: status === "dry_run_only_runner_completed_waiting_for_teacher_review",
      runnerExecuted: status === "dry_run_only_runner_completed_waiting_for_teacher_review",
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
