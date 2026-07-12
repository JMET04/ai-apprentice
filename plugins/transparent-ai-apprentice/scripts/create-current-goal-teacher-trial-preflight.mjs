#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function loadRequired(path, label) {
  if (!path || !existsSync(path)) throw new Error(`Missing ${label}: ${path || "<empty>"}`);
  return readJson(path);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function checkFile(path, label, required = true) {
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    label,
    path: path || "",
    required,
    exists: Boolean(path && existsSync(path)),
    status: path && existsSync(path) ? "ready" : required ? "missing_required_evidence" : "optional_missing"
  };
}

function lockedState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    preflightDoesNotReadLogs: true,
    preflightDoesNotReadFullLogs: true,
    preflightDoesNotCaptureScreenshots: true,
    preflightDoesNotRecordScreen: true,
    preflightDoesNotRegisterMonitor: true,
    preflightDoesNotLaunchRunner: true,
    preflightDoesNotExecuteTargetSoftware: true,
    preflightDoesNotWriteMemory: true,
    preflightDoesNotEnableRules: true,
    preflightDoesNotDowngradeRuntime: true,
    preflightDoesNotDeleteRollbackPoints: true,
    softwareActionsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  };
}

function nextManualCommandFor(decision) {
  if (decision === "ready_for_low_token_route_selection") return "validate_low_token_route_receipt_first";
  if (decision === "ready_for_overlay_packet_validation") return "validate_teacher_overlay_packet_first";
  if (decision === "ready_for_method_contract_review") return "create_method_contract_after_teacher_review";
  if (decision === "ready_for_execution_gate_prep") return "prepare_separate_execution_approval_gate_after_all_evidence";
  return "open_teacher_trial_workbench_and_collect_missing_evidence";
}

function inspectReceipt(receiptPath) {
  if (!receiptPath) {
    return {
      provided: false,
      ok: false,
      status: "missing_teacher_trial_receipt",
      receipt: null,
      blockers: ["teacher_trial_receipt_missing"]
    };
  }
  if (!existsSync(receiptPath)) {
    return {
      provided: true,
      ok: false,
      status: "teacher_trial_receipt_file_missing",
      receipt: null,
      blockers: ["teacher_trial_receipt_file_missing"]
    };
  }
  const receipt = readJson(receiptPath);
  const blockers = [];
  const forbidden = new Set(["accepted", "execute_now", "enable_rule_now", "write_memory_now", "downgrade_to_medium_now", "delete_rollback_points"]);
  if (forbidden.has(receipt.teacherDecision)) blockers.push(`forbidden_teacher_decision:${receipt.teacherDecision}`);
  if (receipt.locks?.softwareActionsExecuted === true) blockers.push("receipt_claims_software_execution");
  if (receipt.locks?.memoryWritten === true) blockers.push("receipt_claims_memory_write");
  if (receipt.locks?.goalComplete === true) blockers.push("receipt_claims_goal_complete");
  return {
    provided: true,
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "teacher_trial_receipt_shape_reviewable" : "blocked_for_forbidden_receipt_claims",
    receipt,
    blockers
  };
}

function writeHtml(path, preflight) {
  const rows = preflight.evidenceChecks
    .map(
      (item) => `<tr>
        <td><code>${htmlEscape(item.id)}</code></td>
        <td>${htmlEscape(item.label)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${item.path ? link("open", item.path) : ""}</td>
      </tr>`
    )
    .join("\n");
  const blockers = preflight.blockers.map((item) => `<li>${htmlEscape(item)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Teacher Trial Preflight</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1180px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-top: 1px solid #e5e8ef; padding: 8px; text-align: left; vertical-align: top; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .blocked { color: #8a2f18; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Teacher Trial Preflight</h1>
  <p class="status">${htmlEscape(preflight.status)}</p>
  <section>
    <h2>Boundary</h2>
    <p class="blocked">This preflight only checks whether teacher trial evidence is ready. It does not read logs. It does not capture screenshots. It does not execute software. It does not write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Evidence Checks</h2>
    <table>
      <thead><tr><th>ID</th><th>Evidence</th><th>Status</th><th>Path</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  <section>
    <h2>Blockers</h2>
    <ul>${blockers}</ul>
  </section>
  <section>
    <h2>Next Manual Route</h2>
    <pre>${htmlEscape(preflight.nextManualRoute)}</pre>
    <pre>${htmlEscape(preflight.nextManualCommand || "")}</pre>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, preflight) {
  const lines = [
    "# Current Goal Teacher Trial Preflight",
    "",
    `Status: ${preflight.status}`,
    "",
    "This checks whether the current goal can move from teacher review into the next manual gate. It is intentionally side-effect free.",
    "",
    "## Evidence checks",
    "",
    ...preflight.evidenceChecks.map((item) => `- ${item.label}: ${item.status}${item.path ? ` (${item.path})` : ""}`),
    "",
    "## Blockers",
    "",
    ...preflight.blockers.map((item) => `- ${item}`),
    "",
    "## Next manual route",
    "",
    preflight.nextManualRoute,
    preflight.nextManualCommand || "",
    "",
    "## Locks",
    "",
    "- Does not read logs, capture screenshots, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const launchpadPath = resolve(argValue("--launchpad", join("artifacts", "current-goal-start-here", "current-goal-start-here.json")));
const receiptPath = argValue("--receipt", "");
const allowMissingTeacherEvidence = flag("--allow-missing-teacher-evidence");
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-teacher-trial-preflights")));
mkdirSync(outputRoot, { recursive: true });

const launchpad = loadRequired(launchpadPath, "current goal start-here launchpad");
const receiptInspection = inspectReceipt(receiptPath);
const receipt = receiptInspection.receipt;

const preflightPath = join(outputRoot, "current-goal-teacher-trial-preflight.json");
const htmlPath = join(outputRoot, "current-goal-teacher-trial-preflight.html");
const readmePath = join(outputRoot, "CURRENT_GOAL_TEACHER_TRIAL_PREFLIGHT.md");

const evidenceChecks = [
  checkFile(launchpad.paths?.html, "Start-here launchpad HTML"),
  checkFile(launchpad.paths?.integratedGate, "Integrated evidence gate JSON"),
  checkFile(launchpad.paths?.teacherTrialWorkbench, "Teacher trial workbench JSON"),
  checkFile(launchpad.paths?.lowTokenHandoff, "All-software low-token handoff JSON"),
  checkFile(launchpad.paths?.teacherSpatialDrawingHandoff, "Teacher spatial drawing handoff JSON"),
  checkFile(launchpad.paths?.teacherMethodAdaptationHandoff, "Teacher method adaptation handoff JSON"),
  checkFile(receiptPath, "Teacher-filled trial receipt JSON", false),
  checkFile(receipt?.validatedLowTokenRouteReceiptPath || "", "Validated low-token route receipt", false),
  checkFile(receipt?.teacherOverlayPacketValidationPath || "", "Teacher overlay packet validation", false),
  checkFile(receipt?.teacherReviewedSpatialIntentPath || "", "Teacher-reviewed spatial intent", false),
  checkFile(receipt?.teacherMethodContractPath || "", "Teacher method contract", false),
  checkFile(receipt?.confirmedRollbackPoint || "", "Confirmed retained rollback point", false)
];

const blockers = [];
for (const item of evidenceChecks) {
  if (item.required && !item.exists) blockers.push(`${item.id}:missing_required_file`);
}
blockers.push(...receiptInspection.blockers);

const decision = receipt?.teacherDecision || "needs_teacher_trial";
const nextManualRoute = nextManualCommandFor(decision);
let nextManualCommand = "";
if (nextManualRoute === "validate_low_token_route_receipt_first") {
  nextManualCommand = launchpad.safeNextActions?.find((item) => item.id === "select_low_token_route")?.commandOrPath || "";
} else if (nextManualRoute === "validate_teacher_overlay_packet_first") {
  nextManualCommand = launchpad.safeNextActions?.find((item) => item.id === "validate_teacher_overlay_packet")?.commandOrPath || "";
} else if (nextManualRoute === "create_method_contract_after_teacher_review") {
  nextManualCommand = launchpad.safeNextActions?.find((item) => item.id === "prepare_method_contract_after_review")?.commandOrPath || "";
} else if (nextManualRoute === "prepare_separate_execution_approval_gate_after_all_evidence") {
  const missingForExecution = [
    ["validated_low_token_route_receipt", receipt?.validatedLowTokenRouteReceiptPath],
    ["teacher_overlay_packet_validation", receipt?.teacherOverlayPacketValidationPath],
    ["teacher_reviewed_spatial_intent", receipt?.teacherReviewedSpatialIntentPath],
    ["teacher_method_contract", receipt?.teacherMethodContractPath],
    ["confirmed_rollback_point", receipt?.confirmedRollbackPoint]
  ].filter(([, path]) => !path || !existsSync(path));
  for (const [id] of missingForExecution) blockers.push(`${id}:missing_for_execution_gate_prep`);
  nextManualCommand = launchpad.safeNextActions?.find((item) => item.id === "prepare_execution_approval_gate")?.commandOrPath || "";
}

if (!allowMissingTeacherEvidence && !receiptInspection.ok) {
  // Missing teacher evidence is not a process failure; it is the expected locked state.
}

const readyForNextManualGate = blockers.length === 0;
const preflight = {
  ok: true,
  format: "transparent_ai_current_goal_teacher_trial_preflight_v1",
  createdAt: new Date().toISOString(),
  status: readyForNextManualGate
    ? "ready_for_next_manual_gate_review_only"
    : "blocked_waiting_for_teacher_trial_evidence",
  launchpadPath,
  receiptPath,
  receiptStatus: receiptInspection.status,
  teacherDecision: decision,
  evidenceChecks,
  blockers,
  readyForNextManualGate,
  nextManualRoute,
  nextManualCommand,
  blockedActions: [
    "read_logs_from_preflight",
    "read_full_logs_from_preflight",
    "capture_screenshots_from_preflight",
    "record_screen_from_preflight",
    "register_monitor_from_preflight",
    "launch_runner_from_preflight",
    "execute_target_software_from_preflight",
    "write_memory_from_preflight",
    "enable_rules_from_preflight",
    "downgrade_to_medium_runtime_from_preflight",
    "delete_rollback_points_from_preflight",
    "claim_goal_complete_from_preflight"
  ],
  paths: {
    preflight: preflightPath,
    html: htmlPath,
    readme: readmePath,
    launchpad: launchpadPath
  },
  locks: lockedState(),
  goalComplete: false
};

writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
writeHtml(htmlPath, preflight);
writeReadme(readmePath, preflight);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_teacher_trial_preflight_result_v1",
      status: preflight.status,
      preflightPath,
      htmlPath,
      readmePath,
      blockerCount: blockers.length,
      readyForNextManualGate,
      nextManualRoute,
      goalComplete: false,
      locks: preflight.locks
    },
    null,
    2
  )
);
