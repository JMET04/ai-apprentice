#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function boolArg(name) {
  return ["true", "1", "yes"].includes(String(argValue(name, "")).trim().toLowerCase());
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "original-goal-low-token-evidence-return-cockpit-receipt-validation-run")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-evidence-return-cockpit-receipt-validation-run"
  );
}

function locks() {
  return {
    reviewOnly: true,
    validationRunnerOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    runnerDoesNotRunMetadataGate: true,
    runnerDoesNotReadLogs: true,
    runnerDoesNotReadFullLogs: true,
    runnerDoesNotCaptureScreenshots: true,
    runnerDoesNotExecuteTargetSoftware: true,
    runnerDoesNotRegisterSchedule: true,
    runnerDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function runCockpitReceiptValidator(cockpitPath, receiptPath, validationOutDir) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        join(pluginRoot, "scripts", "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"),
        "--cockpit",
        cockpitPath,
        "--receipt",
        receiptPath,
        "--output-dir",
        validationOutDir
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        shell: false
      }
    );
    return {
      ok: true,
      result: JSON.parse(stdout),
      stdout
    };
  } catch (error) {
    const stdout = String(error.stdout || "");
    return {
      ok: false,
      result: stdout.trim() ? JSON.parse(stdout) : null,
      stdout,
      errorMessage: String(error.message || "")
    };
  }
}

const goal = argValue("--goal", "Run teacher-reviewed evidence return cockpit receipt validation.");
const builderPathInput = argValue("--builder", "");
if (!builderPathInput) throw new Error("--builder is required");
const builderPath = resolve(builderPathInput);
const builder = readJson(builderPath);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-evidence-return-cockpit-receipt-validation-runs")
    )
  )
);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const runDir = join(outputRoot, runId);
const runPath = join(runDir, "original-goal-low-token-evidence-return-cockpit-receipt-validation-run.json");
const htmlPath = join(runDir, "original-goal-low-token-evidence-return-cockpit-receipt-validation-run.html");
const readmePath = join(runDir, "ORIGINAL_GOAL_LOW_TOKEN_EVIDENCE_RETURN_COCKPIT_RECEIPT_VALIDATION_RUN_START_HERE.md");
const validationOutDir = join(runDir, "waiting-row-cockpit-receipt-validation");
const teacherReviewedDraft = boolArg("--teacher-reviewed-draft");
const rollbackRetained = boolArg("--rollback-retained") || boolArg("--rollback-point-created");
const teacherConfirmation = argValue("--teacher-confirmation", "");
const lockState = locks();
const blockers = [];
if (builder.format !== "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_v1") {
  blockers.push("builder_format_mismatch");
}
if (builder.ok !== true || builder.status !== "return_cockpit_receipt_draft_ready_for_teacher_review") {
  blockers.push("builder_not_ready_for_teacher_reviewed_validation");
}
if (!builder.receiptDraftPath || !existsSync(builder.receiptDraftPath)) blockers.push("receipt_draft_missing");
if (!builder.sourceEvidence?.cockpit || !existsSync(builder.sourceEvidence.cockpit)) blockers.push("source_cockpit_missing");
if (teacherReviewedDraft !== true) blockers.push("teacher_reviewed_draft_confirmation_missing");
if (rollbackRetained !== true) blockers.push("rollback_not_retained");
if (!String(teacherConfirmation || "").trim()) blockers.push("teacher_confirmation_text_missing");

let validationCall = null;
if (blockers.length === 0) {
  validationCall = runCockpitReceiptValidator(builder.sourceEvidence.cockpit, builder.receiptDraftPath, validationOutDir);
}
const validationResult = validationCall?.result || null;
const validationJson = validationResult?.validationPath && existsSync(validationResult.validationPath) ? readJson(validationResult.validationPath) : null;
const status =
  blockers.length > 0
    ? "blocked_before_cockpit_receipt_validation"
    : validationCall?.ok === true && validationJson?.ok === true
      ? "cockpit_receipt_validation_ready_for_metadata_preflight_receipt_review"
      : "cockpit_receipt_validation_failed_closed";
const run = {
  ok: status === "cockpit_receipt_validation_ready_for_metadata_preflight_receipt_review",
  format: "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    builder: builderPath,
    receiptDraft: builder.receiptDraftPath || "",
    cockpit: builder.sourceEvidence?.cockpit || "",
    evidencePlanReceiptValidation: builder.sourceEvidence?.validation || ""
  },
  teacherReviewGate: {
    teacherReviewedDraft,
    rollbackRetained,
    teacherConfirmationProvided: Boolean(String(teacherConfirmation || "").trim())
  },
  blockers,
  cockpitReceiptValidation: validationJson
    ? {
        ok: validationJson.ok === true,
        status: validationJson.status,
        validationDecision: validationJson.validationDecision,
        validationPath: validationJson.paths?.validation || validationResult.validationPath || "",
        readyRows: validationJson.counts?.readyRows || 0,
        blockedRows: validationJson.counts?.blockedRows || 0,
        invalidRows: validationJson.counts?.invalidRows || 0,
        nextSafeCommand: validationJson.nextSafeCommand || null
      }
    : null,
  validationRunnerCall: validationCall
    ? {
        invoked: true,
        ok: validationCall.ok,
        result: validationCall.result,
        errorMessage: validationCall.errorMessage || ""
      }
    : {
        invoked: false,
        ok: false,
        result: null,
        errorMessage: ""
      },
  nextSafeCommand:
    validationJson?.ok === true && validationJson.nextSafeCommand
      ? {
          ...validationJson.nextSafeCommand,
          executesNow: false,
          executeNow: false,
          blockedUntil: "teacher fills and validates the separate metadata-gate preflight receipt"
        }
      : null,
  blockedTransitions: [
    "auto_accept_teacher_reviewed_cockpit_receipt_draft",
    "run_metadata_gate_from_evidence_return_cockpit_validation_run",
    "read_logs_from_evidence_return_cockpit_validation_run",
    "read_full_logs_from_evidence_return_cockpit_validation_run",
    "capture_screenshot_from_evidence_return_cockpit_validation_run",
    "execute_target_software_from_evidence_return_cockpit_validation_run",
    "register_schedule_from_evidence_return_cockpit_validation_run",
    "write_memory_from_evidence_return_cockpit_validation_run",
    "claim_all_software_coverage_complete_from_evidence_return_cockpit_validation_run",
    "claim_original_goal_complete_from_evidence_return_cockpit_validation_run"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "This runner only invokes the existing waiting-row cockpit receipt validator after teacher review and retained rollback. It never runs metadata gates or target software."
  },
  paths: {
    run: runPath,
    html: htmlPath,
    readme: readmePath,
    validation: validationJson?.paths?.validation || validationResult?.validationPath || ""
  },
  locks: lockState
};
writeJson(runPath, run);
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Evidence Return Cockpit Receipt Validation Run</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}code{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px}</style></head><body><h1>Evidence Return Cockpit Receipt Validation Run</h1><p>Status: <code>${htmlEscape(status)}</code></p><p>Validation: <code>${htmlEscape(run.paths.validation)}</code></p><p>Next safe command: <code>${htmlEscape(run.nextSafeCommand?.commandLine || "")}</code></p><pre>${htmlEscape(JSON.stringify(run.cockpitReceiptValidation || run.blockers, null, 2))}</pre></body></html>\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Evidence Return Cockpit Receipt Validation Run",
    "",
    `Status: ${status}`,
    `Cockpit receipt validation: ${run.paths.validation || "- none"}`,
    "",
    "This run only validates a teacher-reviewed cockpit receipt draft through the existing receipt validator.",
    "It does not run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Next safe command:",
    run.nextSafeCommand?.commandLine || "- none"
  ].join("\n"),
  "utf8"
);
console.log(
  JSON.stringify(
    {
      ok: run.ok,
      format: "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_run_result_v1",
      status,
      runPath,
      htmlPath,
      readmePath,
      validationPath: run.paths.validation,
      nextSafeCommand: run.nextSafeCommand,
      executeNow: false,
      locks: lockState
    },
    null,
    2
  )
);
if (!run.ok) process.exit(1);
