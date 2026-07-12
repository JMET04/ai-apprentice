#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const compilationSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-rule-package-compilation-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-package-validation-report");
mkdirSync(smokeRoot, { recursive: true });
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

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
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
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

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const compilationSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs"]).stdout
);
const compilationPath = latestFile(
  join(compilationSmokeRoot, "compilation"),
  "real-case-confirmed-outcome-active-rule-package-compilation.json"
);
const compilation = readJson(compilationPath);
const artifactsDir = join(smokeRoot, "artifacts");
mkdirSync(artifactsDir, { recursive: true });
const activeRulePackage = readJson(compilation.compiledActiveRulePackagePath);
const activeRule = activeRulePackage.rules.find((rule) => rule.lifecycle === "active");
if (!activeRule) throw new Error("Missing active rule in confirmed-outcome active Rule Package");
const expression = activeRule.constraint?.expr || "";
const expectedControlledOutputSha = expression.match(/controlled_output_sha256\s*==\s*'([^']+)'/)?.[1];
const expectedLifecycleGateId = expression.match(/lifecycle_gate_id\s*==\s*'([^']+)'/)?.[1];
if (!expectedControlledOutputSha || !expectedLifecycleGateId) {
  throw new Error(`Could not extract confirmed-outcome expectations from active rule expression: ${expression}`);
}
const validArtifactPath = writeJson(join(artifactsDir, "valid-confirmed-outcome-artifact.json"), {
  artifact_id: "artifact.confirmed_outcome.valid",
  artifact_type: "confirmed_real_case_outcome",
  schema_version: "0.1",
  units: "n/a",
  created_at: new Date().toISOString(),
  source_refs: activeRule.source?.evidence_refs || ["evidence://confirmed-outcome/smoke"],
  context: {
    teacher_reviewed: true,
    controlled_output_sha256: expectedControlledOutputSha,
    lifecycle_gate_id: expectedLifecycleGateId
  },
  objects: [],
  relations: [],
  topology: { vertices: [], edges: [], faces: [] },
  geometry: { cut_lines: [], fold_lines: [], safe_zones: [] }
});
const invalidArtifactPath = writeJson(join(artifactsDir, "invalid-confirmed-outcome-artifact.json"), {
  artifact_id: "artifact.confirmed_outcome.invalid",
  artifact_type: "confirmed_real_case_outcome",
  schema_version: "0.1",
  units: "n/a",
  created_at: new Date().toISOString(),
  source_refs: activeRule.source?.evidence_refs || ["evidence://confirmed-outcome/smoke"],
  context: {
    teacher_reviewed: true,
    controlled_output_sha256: "mismatched-controlled-output-sha",
    lifecycle_gate_id: expectedLifecycleGateId
  },
  objects: [],
  relations: [],
  topology: { vertices: [], edges: [], faces: [] },
  geometry: { cut_lines: [], fold_lines: [], safe_zones: [] }
});

const validResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "valid-report")
  ]).stdout
);
const validPacket = readJson(validResult.packetPath);
const validReport = readJson(validResult.validationReportPath);
check(
  "Real-case confirmed outcome active package Validation Report allows valid artifact only as evidence",
  validResult.format === "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_result_v1" &&
    validResult.status === "ready_for_teacher_confirmed_outcome_active_validation_report_delivery_gate_review" &&
    validResult.confirmedOutcomeBranch === true &&
    validResult.sourceReviewFormat === expectedSourceReviewFormat &&
    validResult.sourceConfirmedOutcomeReviewId === compilation.sourceConfirmedOutcomeReviewId &&
    validResult.sourceConfirmedOutcomeSourceRunId === compilation.sourceConfirmedOutcomeSourceRunId &&
    validResult.sourceRunId === compilation.sourceRunId &&
    validResult.deliveryAllowed === true &&
    validReport.delivery_allowed === true &&
    validPacket.confirmedOutcomeBranch === true &&
    validPacket.sourceReviewFormat === expectedSourceReviewFormat &&
    validPacket.sourceConfirmedOutcomeReviewId === compilation.sourceConfirmedOutcomeReviewId &&
    validPacket.sourceConfirmedOutcomeSourceRunId === compilation.sourceConfirmedOutcomeSourceRunId &&
    validPacket.sourceRunId === compilation.sourceRunId &&
    validResult.locks?.activeValidationReportEvaluated === true &&
    validResult.locks?.deliveryGateOpened === false &&
    validResult.locks?.ruleEnabled === false &&
    validResult.locks?.targetSoftwareCommandsExecuted === false &&
    validResult.locks?.packagingUnlocked === false &&
    validPacket.nextReview?.requiresSeparateDeliveryGate === true,
  JSON.stringify({ packetPath: validResult.packetPath, validationReportPath: validResult.validationReportPath })
);

const invalidResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    invalidArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "invalid-report")
  ]).stdout
);
const invalidReport = readJson(invalidResult.validationReportPath);
const invalidRow = invalidReport.results.find((row) => row.status === "unknown");
check(
  "Real-case confirmed outcome active package Validation Report records warning unknown without opening delivery gate",
  invalidResult.status === "ready_for_teacher_confirmed_outcome_active_validation_report_delivery_gate_review" &&
    invalidResult.deliveryAllowed === true &&
    invalidResult.reportStatus === "unknown" &&
    invalidResult.blockingRowCount === 0 &&
    invalidReport.delivery_allowed === true &&
    invalidRow?.status === "unknown" &&
    invalidRow?.severity === "warning" &&
    invalidResult.locks?.deliveryGateOpened === false &&
    invalidResult.locks?.ruleEnabled === false,
  JSON.stringify({ blockingRowCount: invalidResult.blockingRowCount, observed: invalidRow?.observed })
);

const sourceTamperedCompilationPath = writeJson(join(smokeRoot, "source-tampered-active-compilation.json"), {
  ...compilation,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1"
});
const sourceTampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    sourceTamperedCompilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active package Validation Report blocks lost confirmed-outcome source continuity",
  sourceTampered.stderr.includes("ACTIVE_VALIDATION_REPORT_SOURCE_FORMAT_MISMATCH") ||
    sourceTampered.stdout.includes("ACTIVE_VALIDATION_REPORT_SOURCE_FORMAT_MISMATCH"),
  sourceTampered.stderr || sourceTampered.stdout
);

const missingSourceRunCompilationPath = writeJson(join(smokeRoot, "missing-source-run-active-compilation.json"), {
  ...compilation,
  sourceConfirmedOutcomeSourceRunId: ""
});
const missingSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    missingSourceRunCompilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active package Validation Report blocks missing source run continuity",
  missingSourceRun.stderr.includes("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_IDS_MISSING") ||
    missingSourceRun.stdout.includes("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_IDS_MISSING"),
  missingSourceRun.stderr || missingSourceRun.stdout
);

const missingSourceRunIdCompilationPath = writeJson(join(smokeRoot, "missing-source-run-id-active-compilation.json"), {
  ...compilation,
  sourceRunId: ""
});
const missingSourceRunId = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    missingSourceRunIdCompilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run-id")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active package Validation Report blocks missing sourceRunId",
  missingSourceRunId.stderr.includes("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_IDS_MISSING") ||
    missingSourceRunId.stdout.includes("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_IDS_MISSING"),
  missingSourceRunId.stderr || missingSourceRunId.stdout
);

const blockingRulePackage = {
  ...activeRulePackage,
  rules: activeRulePackage.rules.map((rule) => ({ ...rule, severity: "blocking" }))
};
const blockingPackagePath = writeJson(join(smokeRoot, "blocking-active-rule-package.json"), blockingRulePackage);
const blockingCompilationPath = writeJson(join(smokeRoot, "blocking-active-compilation.json"), {
  ...compilation,
  compiledActiveRulePackagePath: blockingPackagePath
});
const blockingResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    blockingCompilationPath,
    "--artifact",
    invalidArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "blocking-report")
  ]).stdout
);
const blockingReport = readJson(blockingResult.validationReportPath);
const blockingRow = blockingReport.results.find((row) => row.status === "unknown" && row.severity === "blocking");
check(
  "Real-case confirmed outcome active package Validation Report blocks active blocking unknown rows",
  blockingResult.status === "confirmed_outcome_active_validation_report_blocks_delivery_pending_teacher_repair_review" &&
    blockingResult.deliveryAllowed === false &&
    blockingResult.blockingRowCount >= 1 &&
    blockingReport.delivery_allowed === false &&
    blockingRow?.status === "unknown" &&
    blockingResult.locks?.deliveryGateOpened === false &&
    blockingResult.locks?.ruleEnabled === false,
  JSON.stringify({ blockingRowCount: blockingResult.blockingRowCount, observed: blockingRow?.observed })
);

const noTeacher = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--out-dir",
    join(smokeRoot, "no-teacher")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active package Validation Report requires teacher-reviewed flag",
  noTeacher.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG") ||
    noTeacher.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG"),
  noTeacher.stderr || noTeacher.stdout
);

const nonReadyCompilationPath = writeJson(join(smokeRoot, "non-ready-active-compilation.json"), {
  ...compilation,
  status: "blocked_real_case_confirmed_outcome_active_rule_package_compilation",
  locks: { ...compilation.locks, activeRulePackageCompiled: false }
});
const nonReady = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs",
    "--active-compilation",
    nonReadyCompilationPath,
    "--artifact",
    validArtifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "non-ready")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active package Validation Report rejects non-ready active compilation packet",
  nonReady.stderr.includes("locked handoff for active Validation Report") ||
    nonReady.stdout.includes("locked handoff for active Validation Report"),
  nonReady.stderr || nonReady.stdout
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  compilationSmokeStatus: compilationSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);


