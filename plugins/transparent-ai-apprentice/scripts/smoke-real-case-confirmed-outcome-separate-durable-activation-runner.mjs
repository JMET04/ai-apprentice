#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const gateSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-durable-activation-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-separate-durable-activation-runner");
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  files.sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
  return files[files.length - 1];
}

function baseManifest({ gate, gatePath, extra = {} }) {
  return {
    format: "transparent_ai_real_case_confirmed_outcome_durable_activation_manifest_v1",
    sourceGateId: gate.gateId,
    sourceGatePath: gatePath,
    sourceGateHash: hashText(JSON.stringify(gate)),
    teacherReviewed: true,
    activationMode: "candidate_ledger_only",
    requestedOperations: ["write_candidate_ledger"],
    productionMemoryWrite: false,
    productionRuleEnable: false,
    ragAuthority: false,
    teacherNotes: "Teacher reviewed this manifest: write only durable candidate ledger files.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const gateSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-durable-activation-gate.mjs"]).stdout
);
const approvedGatePath = latestFile(join(gateSmokeRoot, "approved-gate"), "real-case-confirmed-outcome-durable-activation-gate.json");
const approvedGate = readJson(approvedGatePath);
const rollbackPoint = writeJson(join(smokeRoot, "fresh-rollback-point", "ROLLBACK_POINT.json"), {
  format: "transparent_ai_test_fresh_rollback_point_v1",
  createdFor: "separate durable activation runner smoke"
});

const manifestPath = writeJson(
  join(smokeRoot, "teacher-reviewed-durable-activation-manifest.json"),
  baseManifest({ gate: approvedGate, gatePath: approvedGatePath })
);
const approvedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
    "--activation-gate",
    approvedGatePath,
    "--activation-manifest",
    manifestPath,
    "--fresh-rollback-point",
    dirname(rollbackPoint),
    "--teacher-confirmation",
    "teacher confirmed separate durable activation runner",
    "--execute-durable-activation-runner",
    "--out-dir",
    join(smokeRoot, "approved-runner")
  ]).stdout
);
const approvedLedger = readJson(approvedResult.ledgerPath);
const approvedMemoryCandidate = readJson(approvedResult.memoryCandidatePath);
const approvedRuleActivationCandidate = readJson(approvedResult.ruleActivationCandidatePath);
check(
  "Separate durable activation runner writes only candidate ledger files after final teacher confirmation",
  approvedResult.status ===
    "real_case_confirmed_outcome_separate_durable_activation_runner_completed_waiting_for_lifecycle_review" &&
    approvedResult.format === "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_result_v1" &&
    approvedResult.confirmedOutcomeBranch === true &&
    approvedResult.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.sourceConfirmedOutcomeReviewId === approvedGate.sourceConfirmedOutcomeReviewId &&
    approvedResult.sourceConfirmedOutcomeSourceRunId === approvedGate.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.sourceRunId === approvedGate.sourceRunId &&
    approvedResult.candidateLedgerWritten === true &&
    approvedResult.memoryCandidateWritten === true &&
    approvedResult.ruleActivationCandidateWritten === true &&
    existsSync(approvedResult.ledgerPath) &&
    existsSync(approvedResult.memoryCandidatePath) &&
    existsSync(approvedResult.ruleActivationCandidatePath) &&
    approvedLedger.confirmedOutcomeBranch === true &&
    approvedLedger.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedLedger.sourceConfirmedOutcomeReviewId === approvedGate.sourceConfirmedOutcomeReviewId &&
    approvedLedger.sourceConfirmedOutcomeSourceRunId === approvedGate.sourceConfirmedOutcomeSourceRunId &&
    approvedLedger.sourceRunId === approvedGate.sourceRunId &&
    approvedMemoryCandidate.confirmedOutcomeBranch === true &&
    approvedMemoryCandidate.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedMemoryCandidate.sourceConfirmedOutcomeReviewId === approvedGate.sourceConfirmedOutcomeReviewId &&
    approvedMemoryCandidate.sourceConfirmedOutcomeSourceRunId === approvedGate.sourceConfirmedOutcomeSourceRunId &&
    approvedMemoryCandidate.sourceRunId === approvedGate.sourceRunId &&
    approvedRuleActivationCandidate.confirmedOutcomeBranch === true &&
    approvedRuleActivationCandidate.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedRuleActivationCandidate.sourceConfirmedOutcomeReviewId === approvedGate.sourceConfirmedOutcomeReviewId &&
    approvedRuleActivationCandidate.sourceConfirmedOutcomeSourceRunId === approvedGate.sourceConfirmedOutcomeSourceRunId &&
    approvedRuleActivationCandidate.sourceRunId === approvedGate.sourceRunId &&
    approvedResult.productionMemoryWritten === false &&
    approvedResult.productionRuleRegistryMutated === false &&
    approvedResult.memoryWritten === false &&
    approvedResult.ruleEnabled === false &&
    approvedResult.ragFetched === false &&
    approvedResult.packagingUnlocked === false &&
    approvedResult.goalComplete === false,
  JSON.stringify({ ledgerPath: approvedResult.ledgerPath })
);

const sourceTamperedGatePath = writeJson(join(smokeRoot, "source-tampered-durable-activation-gate.json"), {
  ...approvedGate,
  sourceConfirmedOutcomeReviewId: "tampered-source-review-id",
  sourceRunId: "tampered-source-run-id"
});
const sourceTamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      sourceTamperedGatePath,
      "--activation-manifest",
      manifestPath,
      "--fresh-rollback-point",
      dirname(rollbackPoint),
      "--teacher-confirmation",
      "teacher confirmed separate durable activation runner",
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "source-tampered-runner")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks lost confirmed-outcome source continuity",
  sourceTamperedResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    sourceTamperedResult.blockers.some((row) => row.code === "source_gate_confirmed_outcome_ids_mismatch") &&
    sourceTamperedResult.candidateLedgerWritten === false &&
    sourceTamperedResult.memoryWritten === false &&
    sourceTamperedResult.ruleEnabled === false,
  JSON.stringify({ blockers: sourceTamperedResult.blockers })
);

const missingCurrentSourceRunGatePath = writeJson(join(smokeRoot, "missing-current-source-run-durable-activation-gate.json"), {
  ...approvedGate,
  durableActivationRequest: {
    ...approvedGate.durableActivationRequest,
    sourceRunId: ""
  }
});
const missingCurrentSourceRunResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      missingCurrentSourceRunGatePath,
      "--activation-manifest",
      manifestPath,
      "--fresh-rollback-point",
      dirname(rollbackPoint),
      "--teacher-confirmation",
      "teacher confirmed separate durable activation runner",
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "missing-current-source-run-runner")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks missing request sourceRunId before candidate writes",
  missingCurrentSourceRunResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    missingCurrentSourceRunResult.blockers.some((row) => row.code === "confirmed_outcome_source_run_id_missing") &&
    missingCurrentSourceRunResult.candidateLedgerWritten === false &&
    missingCurrentSourceRunResult.memoryWritten === false &&
    missingCurrentSourceRunResult.ruleEnabled === false,
  JSON.stringify({ blockers: missingCurrentSourceRunResult.blockers })
);

const missingConfirmationResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      approvedGatePath,
      "--activation-manifest",
      manifestPath,
      "--fresh-rollback-point",
      dirname(rollbackPoint),
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "missing-confirmation")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks missing final teacher confirmation",
  missingConfirmationResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    missingConfirmationResult.blockers.some((row) => row.code === "missing_final_teacher_activation_confirmation") &&
    missingConfirmationResult.candidateLedgerWritten === false,
  JSON.stringify({ blockers: missingConfirmationResult.blockers })
);

const tamperedManifestPath = writeJson(
  join(smokeRoot, "tampered-source-gate-hash-manifest.json"),
  baseManifest({ gate: approvedGate, gatePath: approvedGatePath, extra: { sourceGateHash: "0".repeat(64) } })
);
const tamperedManifestResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      approvedGatePath,
      "--activation-manifest",
      tamperedManifestPath,
      "--fresh-rollback-point",
      dirname(rollbackPoint),
      "--teacher-confirmation",
      "teacher confirmed separate durable activation runner",
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "tampered-manifest")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks source gate hash mismatch",
  tamperedManifestResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    tamperedManifestResult.blockers.some((row) => row.code === "source_gate_hash_mismatch"),
  JSON.stringify({ blockers: tamperedManifestResult.blockers })
);

const forbiddenManifestPath = writeJson(
  join(smokeRoot, "forbidden-production-write-manifest.json"),
  baseManifest({
    gate: approvedGate,
    gatePath: approvedGatePath,
    extra: { requestedOperations: ["write_memory", "enable_rule"], productionMemoryWrite: true, productionRuleEnable: true }
  })
);
const forbiddenManifestResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      approvedGatePath,
      "--activation-manifest",
      forbiddenManifestPath,
      "--fresh-rollback-point",
      dirname(rollbackPoint),
      "--teacher-confirmation",
      "teacher confirmed separate durable activation runner",
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "forbidden-manifest")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks direct production memory write or rule enablement",
  forbiddenManifestResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    forbiddenManifestResult.blockers.some((row) => row.code === "forbidden_activation_operation") &&
    forbiddenManifestResult.blockers.some((row) => row.code === "production_memory_write_forbidden") &&
    forbiddenManifestResult.blockers.some((row) => row.code === "production_rule_enable_forbidden") &&
    forbiddenManifestResult.memoryWritten === false &&
    forbiddenManifestResult.ruleEnabled === false,
  JSON.stringify({ blockers: forbiddenManifestResult.blockers })
);

const missingRollbackResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs",
      "--activation-gate",
      approvedGatePath,
      "--activation-manifest",
      manifestPath,
      "--fresh-rollback-point",
      join(smokeRoot, "missing-rollback-point"),
      "--teacher-confirmation",
      "teacher confirmed separate durable activation runner",
      "--execute-durable-activation-runner",
      "--out-dir",
      join(smokeRoot, "missing-rollback")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Separate durable activation runner blocks missing fresh rollback point",
  missingRollbackResult.status === "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner" &&
    missingRollbackResult.blockers.some((row) => row.code === "fresh_rollback_point_not_found") &&
    missingRollbackResult.candidateLedgerWritten === false,
  JSON.stringify({ blockers: missingRollbackResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  gateSmokeStatus: gateSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
