#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const compilationSmokeRoot = join(root, ".ta-smoke", "real-case-active-rule-package-compilation-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-active-package-validation-report");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
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
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const compilationSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-rule-package-compilation-gate.mjs"]).stdout
);
const compilationPath = latestFile(
  join(compilationSmokeRoot, "compilation"),
  "real-case-active-rule-package-compilation.json"
);
const compilation = readJson(compilationPath);
const artifactsDir = join(smokeRoot, "artifacts");
const validArtifact = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/artifacts/create-packaging-dieline-artifact.mjs",
    "--variant",
    "valid",
    "--out-dir",
    artifactsDir
  ]).stdout
);
const invalidArtifact = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/artifacts/create-packaging-dieline-artifact.mjs",
    "--variant",
    "invalid",
    "--out-dir",
    artifactsDir
  ]).stdout
);

const validResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    validArtifact.artifactPath,
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
  "Real-case active package Validation Report allows valid artifact only as evidence",
  validResult.format === "transparent_ai_real_case_active_package_validation_report_result_v1" &&
    validResult.status === "ready_for_teacher_active_validation_report_delivery_gate_review" &&
    validResult.deliveryAllowed === true &&
    validReport.delivery_allowed === true &&
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
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    invalidArtifact.artifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "invalid-report")
  ]).stdout
);
const invalidReport = readJson(invalidResult.validationReportPath);
const invalidGlue = invalidReport.results.find((row) => row.status === "fail");
check(
  "Real-case active package Validation Report records invalid warning without opening delivery gate",
  invalidResult.status === "ready_for_teacher_active_validation_report_delivery_gate_review" &&
    invalidResult.deliveryAllowed === true &&
    invalidResult.reportStatus === "fail" &&
    invalidResult.blockingRowCount === 0 &&
    invalidReport.delivery_allowed === true &&
    invalidGlue?.status === "fail" &&
    invalidGlue?.observed?.failing_tabs?.[0]?.object_id === "tab.glue.1" &&
    invalidResult.locks?.deliveryGateOpened === false &&
    invalidResult.locks?.ruleEnabled === false,
  JSON.stringify({ blockingRowCount: invalidResult.blockingRowCount, observed: invalidGlue?.observed })
);

const activeRulePackage = readJson(compilation.compiledActiveRulePackagePath);
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
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-package-validation-report.mjs",
    "--active-compilation",
    blockingCompilationPath,
    "--artifact",
    invalidArtifact.artifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "blocking-report")
  ]).stdout
);
const blockingReport = readJson(blockingResult.validationReportPath);
const blockingGlue = blockingReport.results.find((row) => row.status === "fail" && row.severity === "blocking");
check(
  "Real-case active package Validation Report blocks active blocking failures",
  blockingResult.status === "active_validation_report_blocks_delivery_pending_teacher_repair_review" &&
    blockingResult.deliveryAllowed === false &&
    blockingResult.blockingRowCount >= 1 &&
    blockingReport.delivery_allowed === false &&
    blockingGlue?.observed?.failing_tabs?.[0]?.object_id === "tab.glue.1" &&
    blockingResult.locks?.deliveryGateOpened === false &&
    blockingResult.locks?.ruleEnabled === false,
  JSON.stringify({ blockingRowCount: blockingResult.blockingRowCount, observed: blockingGlue?.observed })
);

const noTeacher = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-package-validation-report.mjs",
    "--active-compilation",
    compilationPath,
    "--artifact",
    validArtifact.artifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--out-dir",
    join(smokeRoot, "no-teacher")
  ],
  { expectOk: false }
);
check(
  "Real-case active package Validation Report requires teacher-reviewed flag",
  noTeacher.stderr.includes("REAL_CASE_ACTIVE_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG") ||
    noTeacher.stdout.includes("REAL_CASE_ACTIVE_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG"),
  noTeacher.stderr || noTeacher.stdout
);

const nonReadyCompilationPath = writeJson(join(smokeRoot, "non-ready-active-compilation.json"), {
  ...compilation,
  status: "blocked_real_case_active_rule_package_compilation",
  locks: { ...compilation.locks, activeRulePackageCompiled: false }
});
const nonReady = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-package-validation-report.mjs",
    "--active-compilation",
    nonReadyCompilationPath,
    "--artifact",
    validArtifact.artifactPath,
    "--rollback-point",
    compilation.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "non-ready")
  ],
  { expectOk: false }
);
check(
  "Real-case active package Validation Report rejects non-ready active compilation packet",
  nonReady.stderr.includes("locked handoff for active Validation Report") ||
    nonReady.stdout.includes("locked handoff for active Validation Report"),
  nonReady.stderr || nonReady.stdout
);

const summary = {
  format: "transparent_ai_real_case_active_package_validation_report_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  compilationSmokeStatus: compilationSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
