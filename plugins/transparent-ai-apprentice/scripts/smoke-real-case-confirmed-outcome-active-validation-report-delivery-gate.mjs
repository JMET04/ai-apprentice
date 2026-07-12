#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const validationSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-package-validation-report");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-validation-report-delivery-gate");
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
  mkdirSync(dirname(path), { recursive: true });
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
  files.sort((a, b) => {
    const delta = statSync(a).mtimeMs - statSync(b).mtimeMs;
    return delta === 0 ? a.localeCompare(b) : delta;
  });
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const validationSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-package-validation-report.mjs"]).stdout
);
const validPacketPath = latestFile(join(validationSmokeRoot, "valid-report"), "real-case-confirmed-outcome-active-package-validation-report-packet.json");
const invalidWarningPacketPath = latestFile(
  join(validationSmokeRoot, "invalid-report"),
  "real-case-confirmed-outcome-active-package-validation-report-packet.json"
);
const blockingPacketPath = latestFile(join(validationSmokeRoot, "blocking-report"), "real-case-confirmed-outcome-active-package-validation-report-packet.json");
const validPacket = readJson(validPacketPath);
const invalidWarningPacket = readJson(invalidWarningPacketPath);
const blockingPacket = readJson(blockingPacketPath);

const validResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    validPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "valid-gate")
  ]).stdout
);
const validGate = readJson(validResult.gatePath);
check(
  "Real-case confirmed outcome active delivery gate closes valid active Validation Report without execution",
  validResult.format === "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_result_v1" &&
    validResult.status === "confirmed_outcome_active_delivery_gate_closed_ready_for_teacher_execution_gate_review" &&
    validResult.confirmedOutcomeBranch === true &&
    validResult.sourceReviewFormat === expectedSourceReviewFormat &&
    validResult.sourceConfirmedOutcomeReviewId === validPacket.sourceConfirmedOutcomeReviewId &&
    validResult.sourceConfirmedOutcomeSourceRunId === validPacket.sourceConfirmedOutcomeSourceRunId &&
    validResult.sourceRunId === validPacket.sourceRunId &&
    validResult.reportDeliveryAllowed === true &&
    validResult.gateAllowsExecution === false &&
    validResult.gateAllowsPackaging === false &&
    validResult.executeNow === false &&
    validResult.locks?.activeRulePackageCompiled === true &&
    validResult.locks?.deliveryGateOpen === false &&
    validResult.locks?.ruleEnabled === false &&
    validResult.locks?.targetSoftwareCommandsExecuted === false &&
    validResult.locks?.memoryWritten === false &&
    validResult.locks?.ragFetched === false &&
    validResult.locks?.packagingUnlocked === false &&
    validGate.confirmedOutcomeBranch === true &&
    validGate.sourceReviewFormat === expectedSourceReviewFormat &&
    validGate.sourceConfirmedOutcomeReviewId === validPacket.sourceConfirmedOutcomeReviewId &&
    validGate.sourceConfirmedOutcomeSourceRunId === validPacket.sourceConfirmedOutcomeSourceRunId &&
    validGate.sourceRunId === validPacket.sourceRunId &&
    validGate.nextReview?.requiresSeparateExecutionGate === true,
  JSON.stringify({ gatePath: validResult.gatePath })
);

const warningResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    invalidWarningPacketPath,
    "--rollback-point",
    invalidWarningPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "warning-gate")
  ]).stdout
);
const warningGate = readJson(warningResult.gatePath);
check(
  "Real-case confirmed outcome active delivery gate records warning unknown rows as evidence only",
  warningResult.status === "confirmed_outcome_active_delivery_gate_closed_ready_for_teacher_execution_gate_review" &&
    warningGate.summary?.warningUnknownRows >= 1 &&
    warningGate.summary?.blockingRowCount === 0 &&
    warningGate.decision?.deliveryAllowedOnlyMeansActiveBlockingRulesDidNotBlock === true &&
    warningGate.locks?.deliveryGateOpen === false &&
    warningGate.locks?.targetSoftwareCommandsExecuted === false &&
    warningGate.locks?.ruleEnabled === false,
  JSON.stringify({ warningUnknownRows: warningGate.summary?.warningUnknownRows })
);

const sourceTamperedPacketPath = writeJson(join(smokeRoot, "source-tampered-validation-report-packet.json"), {
  ...validPacket,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1"
});
const sourceTampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    sourceTamperedPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate blocks lost confirmed-outcome source continuity",
  sourceTampered.stderr.includes("ACTIVE_DELIVERY_GATE_SOURCE_FORMAT_MISMATCH") ||
    sourceTampered.stdout.includes("ACTIVE_DELIVERY_GATE_SOURCE_FORMAT_MISMATCH"),
  sourceTampered.stderr || sourceTampered.stdout
);

const missingSourceRunPacketPath = writeJson(join(smokeRoot, "missing-source-run-validation-report-packet.json"), {
  ...validPacket,
  sourceConfirmedOutcomeSourceRunId: ""
});
const missingSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    missingSourceRunPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate blocks missing source run continuity",
  missingSourceRun.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_IDS_MISSING") ||
    missingSourceRun.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_IDS_MISSING"),
  missingSourceRun.stderr || missingSourceRun.stdout
);

const missingSourceRunIdPacketPath = writeJson(join(smokeRoot, "missing-source-run-id-validation-report-packet.json"), {
  ...validPacket,
  sourceRunId: ""
});
const missingSourceRunId = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    missingSourceRunIdPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run-id")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate blocks missing sourceRunId",
  missingSourceRunId.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_IDS_MISSING") ||
    missingSourceRunId.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_IDS_MISSING"),
  missingSourceRunId.stderr || missingSourceRunId.stdout
);

const blocking = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    blockingPacketPath,
    "--rollback-point",
    blockingPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "blocking-gate")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate rejects blocking active Validation Reports",
  blocking.stderr.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET") ||
    blocking.stdout.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET"),
  blocking.stderr || blocking.stdout
);

const noTeacher = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    validPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--out-dir",
    join(smokeRoot, "no-teacher")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate requires teacher-reviewed flag",
  noTeacher.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG") ||
    noTeacher.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG"),
  noTeacher.stderr || noTeacher.stdout
);

const tamperedPacketPath = writeJson(join(smokeRoot, "tampered-opened-delivery-packet.json"), {
  ...validPacket,
  locks: { ...validPacket.locks, deliveryGateOpened: true }
});
const tampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs",
    "--validation-report-packet",
    tamperedPacketPath,
    "--rollback-point",
    validPacket.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active delivery gate rejects packets with opened delivery locks",
  tampered.stderr.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET") ||
    tampered.stdout.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET"),
  tampered.stderr || tampered.stdout
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  validationSmokeStatus: validationSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);

