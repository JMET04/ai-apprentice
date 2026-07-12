#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-activation-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-activation-review-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function receiptRows(receipt) {
  if (Array.isArray(receipt.confirmationRows)) return receipt.confirmationRows;
  if (receipt.confirmations && typeof receipt.confirmations === "object") {
    return Object.entries(receipt.confirmations).map(([id, value]) => ({
      id,
      teacherDecision: value === true ? "confirmed" : String(value || "needs_teacher_review"),
      teacherObservedEvidence: String(value || "")
    }));
  }
  return [];
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["confirmed", "already_confirmed", "ready", "ready_for_follow_up", "ready_to_rerun_activation_gate"].includes(text)) {
    return "confirmed";
  }
  if (["blocked", "mismatch_blocked"].includes(text)) return "blocked";
  return "needs_teacher_review";
}

function rowSatisfied(packetRow, receiptRow) {
  if (packetRow.current === "confirmed") return true;
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  const evidence = String(receiptRow?.teacherObservedEvidence || receiptRow?.observedEvidence || "");
  return decision === "confirmed" || evidence.includes(packetRow.requiredPhrase);
}

function writeReadme(path, replay) {
  const lines = [
    "# All-Software Operational Activation Review Receipt Validation",
    "",
    `Status: ${replay.status}`,
    `Decision: ${replay.validationDecision}`,
    `Operational scope: ${replay.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "Validation rows:",
    ...replay.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next safe commands:",
    ...replay.nextSafeCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`),
    "",
    "Blocked transitions:",
    ...replay.blockedTransitions.map((transition) => `- ${transition}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate all-software operational activation review receipt before dry-run.");
const packetInput = readJsonInput(
  argValue("--review-packet", argValue("--packet", "")),
  "--review-packet",
  "transparent_ai_all_software_operational_activation_review_packet_v1"
);
if (!packetInput.value) throw new Error("--review-packet is required");

const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });

const packet = packetInput.value;
const receipt = receiptInput.value;
const operationalScope = packet.operationalScope || null;
const lowTokenSourceRouteEvidence = packet.lowTokenSourceRouteEvidence || receipt.lowTokenSourceRouteEvidence || null;
const receiptOperationalScope = receipt.operationalScope || null;
const receiptDecision = String(receipt.decision || receipt.defaultDecision || "needs_teacher_review");
const blockedDecisionValues = new Set(packet.blockedActions || []);
const explicitBlockedDecisions = new Set([
  ...(packet.blockedDecisions || []),
  ...(receipt.blockedDecisions || []),
  "accepted",
  "register_task",
  "start_runner",
  "execute_target_software",
  "write_memory",
  "unlock_packaging",
  "execute_now"
]);
const receiptRowMap = new Map(receiptRows(receipt).map((row) => [row.id, row]));
const validationRows = (packet.confirmationRows || []).map((row) => {
  const receiptRow = receiptRowMap.get(row.id);
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  const satisfied = rowSatisfied(row, receiptRow);
  return {
    id: row.id,
    requiredPhrase: row.requiredPhrase,
    sourceStatus: row.current,
    receiptDecision: receiptRow?.teacherDecision || "",
    status: satisfied ? "matched_expected_confirmation" : decision === "blocked" ? "blocked_by_teacher" : "missing_teacher_confirmation",
    canAdvance: satisfied
  };
});
const operationalScopeVerified =
  !operationalScope ||
  (receiptOperationalScope &&
    String(receiptOperationalScope.scopeKind || "") === String(operationalScope.scopeKind || "") &&
    String(receiptOperationalScope.sourceTrialPath || "") === String(operationalScope.sourceTrialPath || "") &&
    String(receiptOperationalScope.sourceSchedulePath || "") === String(operationalScope.sourceSchedulePath || "") &&
    receiptOperationalScope.teacherReviewedScope === true);
if (operationalScope) {
  validationRows.push({
    id: "operational_scope_verified",
    requiredPhrase: "teacher_reviewed_monitor_scope",
    sourceStatus: operationalScope.teacherReviewedScope === true ? "confirmed" : "missing",
    receiptDecision: receiptOperationalScope?.teacherReviewedScope === true ? "confirmed" : "",
    status: operationalScopeVerified ? "matched_expected_scope" : "missing_or_mismatched_operational_scope",
    canAdvance: operationalScopeVerified
  });
}

const blockedTransitions = [
  "register_scheduled_task_from_receipt_validation",
  "start_recurring_runner_from_receipt_validation",
  "execute_activation_wrapper_with_execute_flag_from_receipt_validation",
  "execute_target_software_from_receipt_validation",
  "write_long_term_memory_from_receipt_validation",
  "claim_goal_complete_from_receipt_validation"
];
const forbiddenDecisionUsed =
  explicitBlockedDecisions.has(receiptDecision) ||
  Array.from(blockedDecisionValues).some((value) => String(receiptDecision).includes(String(value)));
const missingRows = validationRows.filter((row) => !row.canAdvance);
const readyToRerunActivationGate = !forbiddenDecisionUsed && missingRows.length === 0 && operationalScopeVerified;
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyToRerunActivationGate
    ? "ready_to_rerun_activation_gate_review_only"
    : "needs_teacher_review";
const status = readyToRerunActivationGate
  ? "receipt_validated_ready_to_rerun_activation_gate"
  : "receipt_validation_waiting_for_teacher_confirmation";

const replayId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const replayDir = join(outputRoot, replayId);
mkdirSync(replayDir, { recursive: true });
const replayPath = join(replayDir, "all-software-operational-activation-review-receipt-validation.json");
const receiptPath = join(replayDir, "all-software-operational-activation-review-receipt-validation-receipt.json");
const readmePath = join(replayDir, "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const rerunCommand = commandLine("create-all-software-operational-learning-activation-gate.mjs", [
  ["--trial", packet.paths?.sourceTrial],
  ["--goal", goal],
  ["--teacher-confirmation", "teacher_confirmed_recurring_low_token_monitor_review"],
  ["--scope-confirmation", "teacher_reviewed_monitor_scope"],
  ["--registration-confirmation", "teacher_confirmed_registration_dry_run_review_only"],
  ["--teacher-reviewed-scope", true],
  ["--rollback-point-created", true]
]);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotRegisterTask: true,
  validationDoesNotLaunchRunner: true,
  validationDoesNotExecuteWrapper: true,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  teacherConfirmationRequiredBeforeSystemChange: true
};
const replay = {
  ok: true,
  format: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
  replayId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  operationalScope,
  lowTokenSourceRouteEvidence,
  operationalScopeVerified,
  readyToRerunActivationGate,
  forbiddenDecisionUsed,
  missingConfirmationCount: missingRows.length,
  validationRows,
  nextSafeCommands: [
    {
      id: "rerun_activation_gate_after_validated_receipt",
      label: "Rerun activation gate with validated teacher confirmations",
      command: rerunCommand,
      enabled: readyToRerunActivationGate
    }
  ],
  blockedTransitions,
  paths: {
    validation: replayPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceReviewPacket: packetInput.path,
    sourceReceipt: receiptInput.path,
    sourceActivationGate: packet.paths?.sourceActivationGate || "",
    sourceTrial: packet.paths?.sourceTrial || "",
    sourceLogSourceDiscoveryLedger: packet.paths?.sourceLogSourceDiscoveryLedger || "",
    sourceLogSourceDiscoveryLedgerReadme: packet.paths?.sourceLogSourceDiscoveryLedgerReadme || ""
  },
  locks
};
const receiptOut = {
  format: "transparent_ai_all_software_operational_activation_review_receipt_validation_receipt_v1",
  replayId,
  status,
  validationDecision,
  operationalScope,
  lowTokenSourceRouteEvidence,
  operationalScopeVerified,
  readyToRerunActivationGate,
  forbiddenDecisionUsed,
  missingConfirmationCount: missingRows.length,
  scheduledTaskRegistered: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(replayPath, `${JSON.stringify(replay, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receiptOut, null, 2)}\n`, "utf8");
writeReadme(readmePath, replay);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_activation_review_receipt_validation_result_v1",
      replayId,
      status,
      validationDecision,
      operationalScope,
      operationalScopeVerified,
      readyToRerunActivationGate,
      validationPath: replayPath,
      receiptPath,
      readmePath,
      missingConfirmationCount: missingRows.length,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
