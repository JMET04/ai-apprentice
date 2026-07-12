#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return (
    String(value || "teacher-method-execution-learning-contract-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "teacher-method-execution-learning-contract-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_method_contract_confirmed", "confirmed", "approve_contract"].includes(decision)) {
    return "teacher_method_contract_confirmed";
  }
  if (["request_contract_repair", "repair", "correction"].includes(decision)) return "request_contract_repair";
  if (["blocked", "needs_teacher_review"].includes(decision)) return decision;
  if (["accepted", "execute_now", "run_now", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) parts.push(flag);
    else parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

const goal = argValue("--goal", "Validate teacher method execution learning contract receipt.");
const contractInput = readJsonInput(
  argValue("--contract", argValue("--teacher-method-contract", "")),
  "--contract",
  "transparent_ai_teacher_method_execution_learning_contract_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_teacher_method_execution_learning_contract_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "teacher-method-execution-learning-contract-receipt-validations")
  )
);
const contract = contractInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "execute_now",
  "run_now",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const routeById = new Map((Array.isArray(contract.routeContracts) ? contract.routeContracts : []).map((route) => [route.id, route]));
const receiptRows = Array.isArray(receipt.routeRows) ? receipt.routeRows : [];
const receiptRowsById = new Map(receiptRows.map((row) => [row.routeId, row]));
const blockers = [];

if (receipt.contractId !== contract.contractId) blockers.push("receipt_contract_id_mismatch");
if (receipt.profilePath && contract.profilePath && receipt.profilePath !== contract.profilePath) {
  blockers.push("receipt_profile_path_mismatch");
}
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (!receiptRows.length) blockers.push("receipt_has_no_route_rows");
for (const routeId of routeById.keys()) {
  const row = receiptRowsById.get(routeId);
  if (!row) {
    blockers.push(`missing_route_receipt_row:${routeId}`);
    continue;
  }
  if (decision === "teacher_method_contract_confirmed") {
    if (row.teacherReviewed !== true) blockers.push(`route_not_teacher_reviewed:${routeId}`);
    if (row.matchesTeacherMethod !== true) blockers.push(`route_not_confirmed_matching_teacher_method:${routeId}`);
  }
}
if (decision === "teacher_method_contract_confirmed") {
  if (!String(receipt.teacherConfirmationText || "").trim()) blockers.push("teacher_confirmation_text_missing");
  if (receipt.rollbackPointRetained !== true) blockers.push("rollback_point_not_retained");
  if (contract.locks?.reviewOnly !== true || contract.locks?.goalComplete !== false) {
    blockers.push("source_contract_locks_not_closed");
  }
}
if (decision === "request_contract_repair") {
  const hasRepairDetail = receiptRows.some((row) =>
    String(row.missingOrWrongLogic || row.boundaryExample || row.counterexample || row.teacherNotes || "").trim()
  );
  if (!hasRepairDetail && !String(receipt.teacherConfirmationText || "").trim()) {
    blockers.push("repair_request_missing_teacher_detail");
  }
}

const readyForReuseResultProof = decision === "teacher_method_contract_confirmed" && blockers.length === 0;
const repairRequested = decision === "request_contract_repair" && !forbiddenDecisions.has(decision);
const status = forbiddenDecisions.has(decision)
  ? "blocked_for_forbidden_teacher_method_decision"
  : readyForReuseResultProof
    ? "teacher_method_contract_confirmed_waiting_for_reuse_result_proof"
    : repairRequested
      ? "teacher_method_contract_repair_requested"
      : "teacher_method_contract_receipt_needs_teacher_review";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(contract.contractId || goal)}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "teacher-method-execution-learning-contract-receipt-validation.json");
const readmePath = join(validationDir, "TEACHER_METHOD_EXECUTION_LEARNING_CONTRACT_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const validation = {
  ok: !forbiddenDecisions.has(decision),
  format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForReuseResultProof,
  repairRequested,
  blockers,
  sourceEvidence: {
    contract: contractInput.path,
    receipt: receiptInput.path,
    profile: contract.profilePath || "",
    rollbackPoint: contract.rollbackPoint || ""
  },
  counts: {
    contractRouteRows: routeById.size,
    receiptRouteRows: receiptRows.length,
    confirmedMatchingRows: receiptRows.filter((row) => row.teacherReviewed === true && row.matchesTeacherMethod === true).length,
    blockers: blockers.length
  },
  nextReuseResultProof: readyForReuseResultProof
    ? {
        status: "waiting_for_teacher_reuse_result_evidence",
        requiredEvidence:
          "Provide one reviewed before/after reuse result proving the confirmed teacher method improved the next run or reduced ambiguity.",
        suggestedReceiptFields: [
          "previousRunEvidencePath",
          "reuseRunEvidencePath",
          "teacherObservedImprovement",
          "remainingMismatchOrCorrection",
          "rollbackPoint"
        ],
        commandTemplate: commandLine("create-teacher-method-low-token-workflow-gate-package.mjs", [
          ["--refresh", "<original-goal-current-status-refresh.json>"],
          ["--contract", contractInput.path],
          ["--output-dir", join(validationDir, "teacher-method-low-token-workflow-gate-package")]
        ])
      }
    : null,
  repairHandoff: repairRequested
    ? {
        status: "route_to_high_reasoning_contract_repair",
        teacherNotes: receipt.teacherConfirmationText || "",
        routeRowsNeedingRepair: receiptRows.filter((row) =>
          String(row.missingOrWrongLogic || row.boundaryExample || row.counterexample || row.teacherNotes || "").trim()
        )
      }
    : null,
  completionBoundary: {
    completionAllowed: false,
    reason:
      "Teacher method contract confirmation is only one proof gate. A reviewed reuse result is still required before this original-goal requirement can be treated as proven."
  },
  blockedTransitions: [
    "execute_software_from_teacher_method_receipt_validation",
    "write_memory_from_teacher_method_receipt_validation",
    "enable_rule_from_teacher_method_receipt_validation",
    "downgrade_to_medium_runtime_without_reuse_result",
    "claim_goal_complete_from_teacher_method_receipt_validation"
  ],
  locks: lockState,
  paths: {
    validation: validationPath,
    readme: readmePath
  }
};

writeJson(validationPath, validation);
writeFileSync(
  readmePath,
  [
    "# Teacher Method Execution Learning Contract Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Ready for reuse result proof: ${readyForReuseResultProof}`,
    "",
    "This validator only checks the teacher's contract receipt. It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

if (forbiddenDecisions.has(decision)) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_result_v1",
        status,
        validationPath,
        readmePath,
        blockers,
        locks: lockState
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_result_v1",
      status,
      validationPath,
      readmePath,
      readyForReuseResultProof,
      repairRequested,
      blockers,
      locks: lockState
    },
    null,
    2
  )
);
