#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slug(value) {
  return (
    String(value || "tlcl-provider-qualification-no-action-run")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-provider-qualification-no-action-run"
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

const goal = argValue("--goal", "tlcl-capability-provider-qualification-no-action-runner");
const planPathArg = argValue("--plan", argValue("--qualification-plan", ""));
const teacherReviewNote = argValue("--teacher-review-note", "");
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-qualification-runs"))
);

const blockers = [];
const evidence = {
  planPath: planPathArg ? resolve(planPathArg) : "",
  hashes: {}
};

let plan = null;
if (!planPathArg || !existsSync(resolve(planPathArg))) {
  addBlocker(blockers, "missing_qualification_plan");
} else {
  plan = readJson(planPathArg);
  evidence.hashes.planHash = sha256Object(plan);
  if (plan.format !== "transparent_ai_tlcl_capability_provider_qualification_plan_v1") {
    addBlocker(blockers, "invalid_qualification_plan_format");
  }
  if (plan.status !== "tlcl_capability_provider_qualification_plan_waiting_for_test_review") {
    addBlocker(blockers, "qualification_plan_not_waiting_for_test_review");
  }
  if (plan.locks?.providerEnabled !== false || plan.locks?.targetSoftwareCommandsExecuted !== false) {
    addBlocker(blockers, "qualification_plan_locks_not_preserved");
  }
}

if (!hasFlag("--teacher-reviewed-test-plan")) addBlocker(blockers, "missing_teacher_reviewed_test_plan_flag");
if (!teacherReviewNote.trim()) addBlocker(blockers, "missing_teacher_review_note");

const provider = plan?.provider || {};
const testCases = Array.isArray(plan?.qualificationPlan?.testCases) ? plan.qualificationPlan.testCases : [];
if (!testCases.length && blockers.length === 0) addBlocker(blockers, "qualification_plan_has_no_test_cases");

const runDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(provider.name || goal)}`);
const runPath = join(runDir, "tlcl-capability-provider-qualification-no-action-run.json");
const resultTemplatePath = join(runDir, "tlcl-capability-provider-qualification-result-template.json");

const status = blockers.length
  ? "blocked_before_tlcl_capability_provider_qualification_no_action_run"
  : "tlcl_capability_provider_qualification_no_action_run_waiting_for_result_receipts";

const rows = blockers.length
  ? []
  : testCases.map((testCase, index) => ({
      rowId: `qualification-test-${String(index + 1).padStart(2, "0")}`,
      testCaseId: testCase.id,
      purpose: testCase.purpose,
      providerRole: provider.requestedRole,
      requiredEvidence: testCase.requiredEvidence || [],
      expectedArtifact: testCase.expectedArtifact,
      forbiddenOutcome: testCase.forbiddenOutcome,
      providerInvocationStatus: "not_invoked",
      resultStatus: "not_run_yet",
      allowedResultStatuses: ["not_run_yet", "matched_expected", "mismatch_blocked", "unknown_blocked"],
      blockedTransitions: ["accepted", "enabled", "execute_target_software", "write_memory", "unlock_packaging"]
    }));

const runPacket = {
  format: "transparent_ai_tlcl_capability_provider_qualification_no_action_run_v1",
  runId: `tlcl-capability-provider-qualification-no-action-run.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  goal,
  createdAt: new Date().toISOString(),
  status,
  provider,
  teacherReview: {
    reviewedTestPlan: hasFlag("--teacher-reviewed-test-plan"),
    teacherReviewNote,
    accepted: false,
    enabled: false
  },
  blockers,
  qualificationRows: rows,
  resultTemplatePath,
  nextActions:
    blockers.length === 0
      ? [
          "Teacher or verifier records observed output for each row in the result template.",
          "A later receipt validator must classify every row as matched_expected, mismatch_blocked, or unknown_blocked.",
          "Do not enable the provider, execute target software, write memory, unlock packaging, or claim acceptance from this no-action run."
        ]
      : [
          "Do not prepare result receipts until the qualification plan and teacher review evidence are fixed.",
          "Do not invoke the provider or execute target software.",
          "Keep the provider disabled."
        ],
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
    run: runPath,
    resultTemplate: resultTemplatePath
  }
};

const resultTemplate = {
  format: "transparent_ai_tlcl_capability_provider_qualification_result_template_v1",
  sourceRunPath: runPath,
  sourceRunHash: sha256Object(runPacket),
  provider,
  defaultDecision: "needs_result_review",
  allowedOverallDecisions: ["needs_result_review", "ready_for_validator_review", "blocked"],
  forbiddenOverallDecisions: ["accepted", "enabled", "execute_target_software", "write_memory", "unlock_packaging"],
  rows: rows.map((row) => ({
    rowId: row.rowId,
    testCaseId: row.testCaseId,
    observedEvidencePath: "",
    observedSummary: "",
    resultStatus: "not_run_yet",
    teacherOrVerifierNote: "",
    allowedResultStatuses: row.allowedResultStatuses,
    blockedTransitions: row.blockedTransitions
  })),
  locks: runPacket.locks
};

writeJson(runPath, runPacket);
writeJson(resultTemplatePath, resultTemplate);

console.log(
  JSON.stringify(
    {
      status,
      runPath,
      resultTemplatePath,
      blockers,
      rowCount: rows.length
    },
    null,
    2
  )
);
