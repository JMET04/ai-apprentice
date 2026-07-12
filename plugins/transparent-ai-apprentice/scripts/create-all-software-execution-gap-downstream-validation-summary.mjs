#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-gap-downstream-validation-summary")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-downstream-validation-summary"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormats = []) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormats.length && !expectedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of ${expectedFormats.join(", ")}`);
  }
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function downstreamValidationFromRun(runInput) {
  const run = runInput.value || {};
  const fromEmbedded = run.generatedEvidence?.downstreamValidationResult;
  const fromPath = run.generatedEvidence?.downstreamValidationPath;
  if (fromEmbedded?.format) return { value: fromEmbedded, path: fromPath || "" };
  if (fromPath && existsSync(fromPath)) return { value: readJson(fromPath), path: resolve(fromPath) };
  return { value: null, path: "" };
}

function pickValidation(kind, directInput, runInput) {
  if (directInput.value) return directInput;
  const fromRun = downstreamValidationFromRun(runInput);
  if (fromRun.value) return fromRun;
  return { value: null, path: "" };
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    summaryDoesNotRunValidators: true,
    summaryDoesNotRunProbe: true,
    summaryDoesNotCreateProfile: true,
    summaryDoesNotPatchMatrix: true,
    summaryDoesNotExecuteTargetSoftware: true,
    summaryDoesNotWriteMemory: true,
    summaryDoesNotEnableRules: true,
    summaryDoesNotAllowMediumRuntime: true,
    validatorsRunBySummary: false,
    probeRan: false,
    controlProfileCreated: false,
    matrixPatched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function controlLane(validation, path) {
  if (!validation) {
    return {
      kind: "control_channel",
      status: "missing_control_channel_validation",
      ready: false,
      readyCount: 0,
      nextReviewCommands: 0,
      evidencePath: "",
      remainingBlocker: "control_channel_downstream_validation_missing"
    };
  }
  const readyCount = Number(validation.readyRowCount || 0);
  const nextReviewCommands = Array.isArray(validation.nextReviewCommands) ? validation.nextReviewCommands.length : 0;
  return {
    kind: "control_channel",
    status: validation.status || "",
    validationDecision: validation.validationDecision || "",
    ready: readyCount > 0,
    readyCount,
    nextReviewCommands,
    evidencePath: path,
    remainingBlocker:
      readyCount > 0
        ? "control_channel_review_ready_but_profile_or_probe_review_still_required_before_execution"
        : "control_channel_review_not_ready",
    canCloseOriginalGapNow: false,
    whyNotClosed:
      readyCount > 0
        ? "This validation prepares the next control-channel review command; it does not run probes, create profiles, or prove native control."
        : "No reviewed control-channel validation rows are ready yet."
  };
}

function actionLogicLane(validation, path) {
  if (!validation) {
    return {
      kind: "action_logic",
      status: "missing_action_logic_validation",
      ready: false,
      readyPatchRows: 0,
      matrixPatchPath: "",
      evidencePath: "",
      remainingBlocker: "action_logic_downstream_validation_missing"
    };
  }
  const readyPatchRows = Number(validation.readyPatchRowCount || 0);
  return {
    kind: "action_logic",
    status: validation.status || "",
    validationDecision: validation.validationDecision || "",
    ready: readyPatchRows > 0,
    readyPatchRows,
    matrixPatchPath: validation.paths?.matrixPatch || "",
    evidencePath: path,
    remainingBlocker:
      readyPatchRows > 0
        ? "matrix_patch_ready_but_not_applied_and_execution_gate_still_required"
        : "action_logic_contract_patch_not_ready",
    canCloseOriginalGapNow: false,
    whyNotClosed:
      readyPatchRows > 0
        ? "The logic-source matrix patch is prepared but this summary does not apply it, enable rules, or authorize medium runtime."
        : "No reviewed action-logic patch rows are ready yet."
  };
}

function writeReadme(path, summary) {
  const lines = [
    "# Execution Gap Downstream Validation Summary",
    "",
    `Status: ${summary.status}`,
    `Decision: ${summary.summaryDecision}`,
    "",
    "This package summarizes the downstream control-channel and action-logic validation results after an execution-gap handoff.",
    "",
    `- Control lane: ${summary.lanes.control.status}; ready rows=${summary.lanes.control.readyCount}`,
    `- Action-logic lane: ${summary.lanes.actionLogic.status}; ready patch rows=${summary.lanes.actionLogic.readyPatchRows}`,
    "",
    "Safety boundary:",
    "- This script does not run validators.",
    "- It does not run probes, create profiles, patch the execution matrix, execute target software, write memory, enable rules, allow medium runtime, or claim completion.",
    "- A later teacher-reviewed matrix patch and execution gate are still required."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, summary) {
  const laneRows = [summary.lanes.control, summary.lanes.actionLogic]
    .map((lane) => {
      const evidenceLink = lane.evidencePath ? `<a href="${htmlEscape(fileHref(lane.evidencePath))}">${htmlEscape(basename(lane.evidencePath))}</a>` : "";
      const patchLink = lane.matrixPatchPath ? `<a href="${htmlEscape(fileHref(lane.matrixPatchPath))}">${htmlEscape(basename(lane.matrixPatchPath))}</a>` : "";
      return `<tr>
        <td>${htmlEscape(lane.kind)}</td>
        <td>${htmlEscape(lane.status)}</td>
        <td>${htmlEscape(lane.remainingBlocker)}</td>
        <td>${evidenceLink}</td>
        <td>${patchLink}</td>
      </tr>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Gap Downstream Validation Summary</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Downstream Validation Summary</h1>
    <p><strong>Status:</strong> ${htmlEscape(summary.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(summary.summaryDecision)}</p>
    <p class="lock">Summary only. It does not run validators, probes, profiles, matrix patches, target software, memory writes, rules, medium runtime, or completion.</p>
    <table>
      <thead><tr><th>Lane</th><th>Status</th><th>Remaining blocker</th><th>Evidence</th><th>Patch</th></tr></thead>
      <tbody>${laneRows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Summarize downstream execution-gap validation results.");
const controlRunInput = readJsonInput(
  argValue("--control-item-run", ""),
  "--control-item-run",
  ["transparent_ai_original_goal_review_handoff_queue_item_run_v1"]
);
const actionRunInput = readJsonInput(
  argValue("--action-logic-item-run", ""),
  "--action-logic-item-run",
  ["transparent_ai_original_goal_review_handoff_queue_item_run_v1"]
);
const controlValidationInput = readJsonInput(
  argValue("--control-validation", ""),
  "--control-validation",
  ["transparent_ai_all_software_control_channel_repair_receipt_validation_v1"]
);
const actionValidationInput = readJsonInput(
  argValue("--action-logic-validation", ""),
  "--action-logic-validation",
  ["transparent_ai_all_software_action_logic_source_contract_validation_v1"]
);

const controlValidation = pickValidation("control", controlValidationInput, controlRunInput);
const actionValidation = pickValidation("action", actionValidationInput, actionRunInput);

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-downstream-validation-summaries"))
);
mkdirSync(outputRoot, { recursive: true });
const summaryId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const summaryDir = join(outputRoot, summaryId);
mkdirSync(summaryDir, { recursive: true });
const summaryPath = join(summaryDir, "all-software-execution-gap-downstream-validation-summary.json");
const htmlPath = join(summaryDir, "all-software-execution-gap-downstream-validation-summary.html");
const readmePath = join(summaryDir, "ALL_SOFTWARE_EXECUTION_GAP_DOWNSTREAM_VALIDATION_SUMMARY_START_HERE.md");

const control = controlLane(controlValidation.value, controlValidation.path);
const actionLogic = actionLogicLane(actionValidation.value, actionValidation.path);
const lockState = locks();
const bothInputsPresent = Boolean(controlValidation.value && actionValidation.value);
const summaryDecision = !bothInputsPresent
  ? "waiting_for_both_downstream_validations"
  : control.ready && actionLogic.ready
    ? "downstream_validations_ready_for_teacher_matrix_reconciliation"
    : "downstream_validations_still_have_review_gaps";
const status = !bothInputsPresent
  ? "waiting_for_downstream_validation_inputs"
  : control.ready && actionLogic.ready
    ? "validated_downstream_results_summarized_execution_still_blocked"
    : "summarized_with_remaining_downstream_review_gaps";
const summary = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_downstream_validation_summary_v1",
  summaryId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  summaryDecision,
  lanes: {
    control,
    actionLogic
  },
  counts: {
    downstreamValidationsPresent: [controlValidation.value, actionValidation.value].filter(Boolean).length,
    controlReadyRows: control.readyCount || 0,
    actionLogicReadyPatchRows: actionLogic.readyPatchRows || 0,
    remainingExecutionBlockers: [
      control.remainingBlocker,
      actionLogic.remainingBlocker,
      "teacher_matrix_reconciliation_required",
      "execution_approval_gate_required",
      "rollback_point_required_before_any_execution"
    ].filter(Boolean).length
  },
  nextSafeActions: [
    control.ready
      ? "Use the reviewed control-channel validation output only as evidence for the next profile/probe review."
      : "Run or review the control-channel downstream validation before claiming route evidence.",
    actionLogic.ready
      ? "Route the action-logic matrix patch through a teacher-reviewed matrix reconciliation gate."
      : "Run or review the action-logic downstream validation before patching the execution matrix.",
    "Keep target software execution blocked until matrix reconciliation and execution approval gates pass with a retained rollback point."
  ],
  blockedTransitions: [
    "run_validators_from_summary",
    "run_probe_from_summary",
    "create_profile_from_summary",
    "patch_matrix_from_summary",
    "execute_target_software_from_summary",
    "write_memory_from_summary",
    "enable_rule_from_summary",
    "allow_medium_runtime_from_summary",
    "claim_goal_complete_from_summary"
  ],
  sourceEvidence: {
    controlItemRun: controlRunInput.path,
    actionLogicItemRun: actionRunInput.path,
    controlValidation: controlValidation.path,
    actionLogicValidation: actionValidation.path
  },
  locks: lockState,
  paths: {
    summary: summaryPath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeReadme(readmePath, summary);
writeHtml(htmlPath, summary);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_downstream_validation_summary_result_v1",
      summaryPath,
      htmlPath,
      readmePath,
      status,
      summaryDecision,
      controlReadyRows: control.readyCount || 0,
      actionLogicReadyPatchRows: actionLogic.readyPatchRows || 0,
      locks: lockState
    },
    null,
    2
  )
);
