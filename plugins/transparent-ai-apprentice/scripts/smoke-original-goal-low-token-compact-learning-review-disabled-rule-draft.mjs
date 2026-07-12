#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args, expectOk = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 120000 });
  if (expectOk && result.status !== 0) {
    throw new Error(`command failed\nargs=${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`command unexpectedly passed\nargs=${args.join(" ")}\nstdout=${result.stdout}`);
  }
  return result;
}

function runJson(args, expectOk = true) {
  const result = run(args, expectOk);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-compact-learning-review-draft-"));
const rollbackPoint = join(root, "rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-compact-learning-review-draft",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const handoffPath = join(root, "handoff.json");
const compactEventsPath = join(root, "compact-learning-events.json");
const defaultReceiptPath = join(root, "default-receipt.json");
const reviewedReceiptPath = join(root, "reviewed-receipt.json");

const reviewRows = [
  {
    rowId: "row-event",
    software: "EventApp",
    evidenceMode: "windows_event_metadata_only",
    compactEvidenceHash: "eventhash",
    teacherDecision: "needs_teacher_review",
    allowedTeacherLabels: [
      "success_or_completion",
      "failure_or_blocker",
      "warning",
      "normal_state_change",
      "irrelevant_background_noise",
      "needs_counterexample",
      "correction_to_high_reasoning_repair"
    ],
    selectedTeacherLabel: "",
    reviewedLearningEvent: false,
    ruleBoundaryNote: "",
    counterexampleNote: ""
  },
  {
    rowId: "row-process",
    software: "ProcessApp",
    evidenceMode: "process_window_metadata_only",
    compactEvidenceHash: "processhash",
    teacherDecision: "needs_teacher_review",
    allowedTeacherLabels: [
      "success_or_completion",
      "failure_or_blocker",
      "warning",
      "normal_state_change",
      "irrelevant_background_noise",
      "needs_counterexample",
      "correction_to_high_reasoning_repair"
    ],
    selectedTeacherLabel: "",
    reviewedLearningEvent: false,
    ruleBoundaryNote: "",
    counterexampleNote: ""
  }
];

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  memoryWritten: false,
  targetSoftwareCommandsExecuted: false,
  goalComplete: false
};

writeJson(compactEventsPath, {
  format: "transparent_ai_compact_learning_events_from_universal_observation_v1",
  status: "waiting_for_teacher_review",
  compactLearningEvents: [
    { eventId: "event-1", sourceRowId: "row-event" },
    { eventId: "event-2", sourceRowId: "row-process" }
  ]
});

writeJson(handoffPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1",
  handoffId: "smoke-compact-learning-handoff",
  createdAt: "2026-06-19T00:00:00.000Z",
  status: "waiting_for_teacher_learning_event_review",
  counts: { evidenceRows: 2, compactLearningEvents: 2, reviewRows: 2 },
  paths: {
    handoff: handoffPath,
    compactLearningEvents: compactEventsPath,
    reviewReceiptTemplate: defaultReceiptPath
  },
  learningEventReviewReceiptTemplate: {
    format: "transparent_ai_original_goal_low_token_compact_evidence_learning_event_review_receipt_v1",
    sourceHandoffPath: handoffPath,
    sourceCompactLearningEventsPath: compactEventsPath,
    teacherDecision: "needs_teacher_review",
    rollbackRetained: false,
    reviewRows,
    locks
  },
  locks: {
    ...locks,
    handoffDoesNotReadLogs: true,
    handoffDoesNotExecuteTargetSoftware: true
  },
  goalComplete: false
});
writeJson(defaultReceiptPath, readJson(handoffPath).learningEventReviewReceiptTemplate);

const defaultValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-learning-review-receipt.mjs",
  "--handoff",
  handoffPath,
  "--receipt",
  defaultReceiptPath,
  "--rollback-point",
  rollbackPoint,
  "--output-dir",
  join(root, "default-validation")
]);
const defaultValidationPacket = readJson(defaultValidation.validationPath);
if (
  defaultValidationPacket.status === "validated_for_disabled_rule_draft_or_high_reasoning_repair" ||
  defaultValidationPacket.readyForDisabledRuleDraft !== false
) {
  throw new Error("Default receipt must fail closed and wait for teacher review.");
}

const reviewedReceipt = readJson(defaultReceiptPath);
reviewedReceipt.teacherDecision = "learning_events_reviewed_return_to_high_reasoning_rule_draft";
reviewedReceipt.rollbackRetained = true;
reviewedReceipt.reviewRows = [
  {
    ...reviewRows[0],
    teacherDecision: "learning_events_reviewed_return_to_high_reasoning_rule_draft",
    selectedTeacherLabel: "failure_or_blocker",
    reviewedLearningEvent: true,
    ruleBoundaryNote: "Only treat event metadata provider count plus matching event id histogram as a blocker signal for EventApp launch diagnosis.",
    counterexampleNote: "Do not treat unrelated provider discovery with no matching event id histogram as a blocker."
  },
  {
    ...reviewRows[1],
    teacherDecision: "learning_events_reviewed_return_to_high_reasoning_rule_draft",
    selectedTeacherLabel: "normal_state_change",
    reviewedLearningEvent: true,
    ruleBoundaryNote: "Only treat process window metadata as a normal state change when the process count is one and screenshot capture remains false.",
    counterexampleNote: "Do not infer successful task execution from a process count alone."
  }
];
writeJson(reviewedReceiptPath, reviewedReceipt);

const reviewedValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-learning-review-receipt.mjs",
  "--handoff",
  handoffPath,
  "--receipt",
  reviewedReceiptPath,
  "--rollback-point",
  rollbackPoint,
  "--output-dir",
  join(root, "reviewed-validation")
]);
const reviewedValidationPacket = readJson(reviewedValidation.validationPath);
if (
  reviewedValidationPacket.status !== "validated_for_disabled_rule_draft_or_high_reasoning_repair" ||
  reviewedValidationPacket.readyForDisabledRuleDraft !== true ||
  reviewedValidationPacket.counts.readyRuleDraftRows !== 2
) {
  throw new Error("Reviewed receipt should validate for disabled rule draft generation.");
}

const draftResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-compact-learning-disabled-rule-draft.mjs",
  "--validation",
  reviewedValidation.validationPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-learning-events",
  "--output-dir",
  join(root, "drafts")
]);
const draft = readJson(draftResult.packagePath);
const compiled = readJson(draft.compiledRulePackagePath);

const checks = [
  {
    name: "Default learning review receipt fails closed",
    pass:
      defaultValidationPacket.status !== "validated_for_disabled_rule_draft_or_high_reasoning_repair" &&
      defaultValidationPacket.readyForDisabledRuleDraft === false
  },
  {
    name: "Reviewed receipt validates only after teacher labels boundaries and counterexamples",
    pass:
      reviewedValidationPacket.status === "validated_for_disabled_rule_draft_or_high_reasoning_repair" &&
      reviewedValidationPacket.counts.readyRuleDraftRows === 2 &&
      reviewedValidationPacket.locks.ruleEnabled === false
  },
  {
    name: "Disabled rule draft package compiles only draft_disabled rules",
    pass:
      draft.status === "ready_for_teacher_disabled_rule_draft_review" &&
      draft.disabledRuleCount === 2 &&
      compiled.rules.length === 2 &&
      compiled.rules.every((rule) => rule.lifecycle === "draft_disabled")
  },
  {
    name: "Locks forbid activation memory software scheduling packaging and completion",
    pass:
      draft.locks.ruleEnabled === false &&
      draft.locks.memoryEnabled === false &&
      draft.locks.softwareActionsExecuted === false &&
      draft.locks.scheduledTaskInstalled === false &&
      draft.locks.packagingUnlocked === false &&
      draft.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_original_goal_low_token_compact_learning_review_disabled_rule_draft_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        defaultValidation: defaultValidation.validationPath,
        reviewedValidation: reviewedValidation.validationPath,
        disabledRuleDraft: draftResult.packagePath,
        compiledRulePackage: draft.compiledRulePackagePath
      },
      locks: draft.locks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
