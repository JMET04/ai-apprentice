#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const validationSmokeRoot = join(root, ".ta-smoke", "real-case-active-package-validation-report");
const smokeRoot = join(root, ".ta-smoke", "real-case-active-validation-report-delivery-gate");
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
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const validationSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-package-validation-report.mjs"]).stdout
);
const validPacketPath = latestFile(join(validationSmokeRoot, "valid-report"), "real-case-active-package-validation-report-packet.json");
const invalidWarningPacketPath = latestFile(
  join(validationSmokeRoot, "invalid-report"),
  "real-case-active-package-validation-report-packet.json"
);
const blockingPacketPath = latestFile(join(validationSmokeRoot, "blocking-report"), "real-case-active-package-validation-report-packet.json");
const validPacket = readJson(validPacketPath);
const invalidWarningPacket = readJson(invalidWarningPacketPath);
const blockingPacket = readJson(blockingPacketPath);

const validResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-validation-report-delivery-gate.mjs",
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
  "Real-case active delivery gate closes valid active Validation Report without execution",
  validResult.format === "transparent_ai_real_case_active_validation_report_delivery_gate_result_v1" &&
    validResult.status === "active_delivery_gate_closed_ready_for_teacher_execution_gate_review" &&
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
    validGate.nextReview?.requiresSeparateExecutionGate === true,
  JSON.stringify({ gatePath: validResult.gatePath })
);

const warningResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-validation-report-delivery-gate.mjs",
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
  "Real-case active delivery gate records warning failures as evidence only",
  warningResult.status === "active_delivery_gate_closed_ready_for_teacher_execution_gate_review" &&
    warningGate.summary?.warningFailRows >= 1 &&
    warningGate.summary?.blockingRowCount === 0 &&
    warningGate.decision?.deliveryAllowedOnlyMeansActiveBlockingRulesDidNotBlock === true &&
    warningGate.locks?.deliveryGateOpen === false &&
    warningGate.locks?.targetSoftwareCommandsExecuted === false &&
    warningGate.locks?.ruleEnabled === false,
  JSON.stringify({ warningFailRows: warningGate.summary?.warningFailRows })
);

const blocking = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-validation-report-delivery-gate.mjs",
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
  "Real-case active delivery gate rejects blocking active Validation Reports",
  blocking.stderr.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET") ||
    blocking.stdout.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET"),
  blocking.stderr || blocking.stdout
);

const noTeacher = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-validation-report-delivery-gate.mjs",
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
  "Real-case active delivery gate requires teacher-reviewed flag",
  noTeacher.stderr.includes("REAL_CASE_ACTIVE_VALIDATION_REPORT_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG") ||
    noTeacher.stdout.includes("REAL_CASE_ACTIVE_VALIDATION_REPORT_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG"),
  noTeacher.stderr || noTeacher.stdout
);

const tamperedPacketPath = writeJson(join(smokeRoot, "tampered-opened-delivery-packet.json"), {
  ...validPacket,
  locks: { ...validPacket.locks, deliveryGateOpened: true }
});
const tampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-validation-report-delivery-gate.mjs",
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
  "Real-case active delivery gate rejects packets with opened delivery locks",
  tampered.stderr.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET") ||
    tampered.stdout.includes("REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET"),
  tampered.stderr || tampered.stdout
);

const summary = {
  format: "transparent_ai_real_case_active_validation_report_delivery_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  validationSmokeStatus: validationSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
