#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const allowedResultStatuses = new Set(["not_run_yet", "matched_expected", "mismatch_blocked", "unknown_blocked"]);
const allowedOverallDecisions = new Set(["needs_result_review", "ready_for_validator_review", "blocked"]);
const forbiddenOverallDecisions = new Set([
  "accepted",
  "enabled",
  "execute_target_software",
  "write_memory",
  "unlock_packaging"
]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-provider-qualification-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-provider-qualification-result-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function addBlocker(blockers, blocker) {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function lockedDecision() {
  return {
    accepted: false,
    providerEnabled: false,
    mayEnableProvider: false,
    mayUseProvider: false,
    mayExecuteTargetSoftware: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    nextGateRequired: true
  };
}

const goal = argValue("--goal", "tlcl-capability-provider-qualification-result-receipt-validation");
const runPathArg = argValue("--run", argValue("--qualification-run", ""));
const receiptPathArg = argValue("--receipt", argValue("--result-receipt", ""));
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-qualification-results"))
);

const blockers = [];
const evidence = {
  runPath: runPathArg ? resolve(runPathArg) : "",
  receiptPath: receiptPathArg ? resolve(receiptPathArg) : "",
  hashes: {}
};

let runPacket = null;
let receipt = null;

if (!runPathArg || !existsSync(resolve(runPathArg))) {
  addBlocker(blockers, "missing_qualification_no_action_run");
} else {
  runPacket = readJson(runPathArg);
  evidence.hashes.runHash = sha256Object(runPacket);
  if (runPacket.format !== "transparent_ai_tlcl_capability_provider_qualification_no_action_run_v1") {
    addBlocker(blockers, "invalid_qualification_no_action_run_format");
  }
  if (runPacket.status !== "tlcl_capability_provider_qualification_no_action_run_waiting_for_result_receipts") {
    addBlocker(blockers, "qualification_no_action_run_not_waiting_for_result_receipts");
  }
  if (
    runPacket.locks?.providerInvoked !== false ||
    runPacket.locks?.providerEnabled !== false ||
    runPacket.locks?.targetSoftwareCommandsExecuted !== false ||
    runPacket.locks?.memoryWritten !== false ||
    runPacket.locks?.packagingGated !== true
  ) {
    addBlocker(blockers, "qualification_no_action_run_locks_not_preserved");
  }
}

if (!receiptPathArg || !existsSync(resolve(receiptPathArg))) {
  addBlocker(blockers, "missing_qualification_result_receipt");
} else {
  receipt = readJson(receiptPathArg);
  evidence.hashes.receiptHash = sha256Object(receipt);
  if (receipt.format !== "transparent_ai_tlcl_capability_provider_qualification_result_template_v1") {
    addBlocker(blockers, "invalid_qualification_result_receipt_format");
  }
}

if (runPacket && receipt) {
  const expectedRunHash = sha256Object(runPacket);
  if (receipt.sourceRunHash !== expectedRunHash) addBlocker(blockers, "receipt_source_run_hash_mismatch");
  if (receipt.sourceRunPath && resolve(receipt.sourceRunPath) !== resolve(runPathArg)) {
    addBlocker(blockers, "receipt_source_run_path_mismatch");
  }

  const overallDecision = receipt.overallDecision || receipt.defaultDecision || "needs_result_review";
  if (forbiddenOverallDecisions.has(overallDecision)) addBlocker(blockers, "forbidden_overall_decision");
  if (!allowedOverallDecisions.has(overallDecision) && !forbiddenOverallDecisions.has(overallDecision)) {
    addBlocker(blockers, "unknown_overall_decision");
  }

  if (receipt.locks?.providerEnabled !== false || receipt.locks?.targetSoftwareCommandsExecuted !== false) {
    addBlocker(blockers, "receipt_locks_not_preserved");
  }
}

const runRows = Array.isArray(runPacket?.qualificationRows) ? runPacket.qualificationRows : [];
const receiptRows = Array.isArray(receipt?.rows) ? receipt.rows : [];
const receiptRowsById = new Map(receiptRows.map((row) => [row.rowId, row]));

if (runPacket && receipt && runRows.length !== receiptRows.length) {
  addBlocker(blockers, "receipt_row_count_mismatch");
}

const rowResults = runRows.map((runRow) => {
  const receiptRow = receiptRowsById.get(runRow.rowId);
  const resultStatus = receiptRow?.resultStatus || "missing";
  const rowBlockers = [];

  if (!receiptRow) rowBlockers.push("missing_receipt_row");
  if (receiptRow && receiptRow.testCaseId !== runRow.testCaseId) rowBlockers.push("receipt_test_case_id_mismatch");
  if (receiptRow && !allowedResultStatuses.has(resultStatus)) rowBlockers.push("invalid_result_status");
  if (receiptRow?.blockedTransitions?.some((transition) => forbiddenOverallDecisions.has(transition)) !== true) {
    rowBlockers.push("missing_blocked_transitions");
  }

  for (const blocker of rowBlockers) addBlocker(blockers, blocker);

  return {
    rowId: runRow.rowId,
    testCaseId: runRow.testCaseId,
    resultStatus,
    observedEvidencePath: receiptRow?.observedEvidencePath || "",
    observedSummary: receiptRow?.observedSummary || "",
    rowBlockers
  };
});

for (const receiptRow of receiptRows) {
  if (!runRows.some((runRow) => runRow.rowId === receiptRow.rowId)) addBlocker(blockers, "receipt_extra_row");
}

const counts = {
  totalRows: rowResults.length,
  matchedExpected: rowResults.filter((row) => row.resultStatus === "matched_expected").length,
  mismatchBlocked: rowResults.filter((row) => row.resultStatus === "mismatch_blocked").length,
  unknownBlocked: rowResults.filter((row) => row.resultStatus === "unknown_blocked").length,
  notRunYet: rowResults.filter((row) => row.resultStatus === "not_run_yet").length,
  invalidOrMissing: rowResults.filter((row) => !allowedResultStatuses.has(row.resultStatus)).length
};

let status = "blocked_before_tlcl_capability_provider_qualification_result_validation";
let nextActions = [
  "Do not enable the provider.",
  "Fix missing or tampered qualification run or receipt evidence.",
  "Keep target software execution, memory writes, and packaging unlock blocked."
];

if (blockers.length === 0 && counts.totalRows > 0) {
  if (counts.mismatchBlocked > 0 || counts.unknownBlocked > 0) {
    status = "tlcl_capability_provider_qualification_results_blocked_before_provider_enablement";
    nextActions = [
      "Return the mismatch or unknown evidence to the teacher and senior compile layer.",
      "Repair provider assumptions, qualification tests, or TLCL contract logic before any retry.",
      "Keep the provider disabled and do not execute target software."
    ];
  } else if (counts.notRunYet > 0) {
    status = "tlcl_capability_provider_qualification_results_waiting_for_more_evidence";
    nextActions = [
      "Collect result evidence for every not_run_yet row.",
      "Do not enable or use the provider from partial receipt evidence.",
      "Run this validator again after the teacher or verifier completes the receipt."
    ];
  } else if (counts.matchedExpected === counts.totalRows) {
    status = "tlcl_capability_provider_qualification_results_ready_for_validator_review";
    nextActions = [
      "Create a later validator-review or teacher-approval gate before any provider enablement.",
      "Keep this as evidence that the no-action qualification receipt matched expected results only.",
      "Do not execute target software, write memory, unlock packaging, or claim acceptance from this validation."
    ];
  }
}

const validationDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`);
const validationPath = join(validationDir, "tlcl-capability-provider-qualification-result-validation.json");

const validation = {
  format: "transparent_ai_tlcl_capability_provider_qualification_result_validation_v1",
  validationId: `tlcl-capability-provider-qualification-result-validation.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  goal,
  createdAt: new Date().toISOString(),
  status,
  provider: runPacket?.provider || receipt?.provider || {},
  blockers,
  counts,
  rowResults,
  decision: lockedDecision(),
  nextActions,
  evidence,
  locks: {
    reviewOnly: true,
    providerInvoked: false,
    providerEnabled: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    accepted: false,
    packagingGated: true,
    packagingUnlocked: false,
    completionClaim: false
  },
  paths: {
    validation: validationPath
  }
};

writeJson(validationPath, validation);

console.log(
  JSON.stringify(
    {
      status,
      validationPath,
      blockers,
      counts
    },
    null,
    2
  )
);
