#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-all-software-operational-activation-receipt-builder.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "activation receipt builder script failed");
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-receipt-builder-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const packetPath = writeJson(join(smokeRoot, "packet", "all-software-operational-activation-review-packet.json"), {
  format: "transparent_ai_all_software_operational_activation_review_packet_v1",
  status: "waiting_for_teacher_activation_confirmations",
  missingConfirmationCount: 4,
  operationalScope: {
    scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
    sourceTrialPath: "D:\\example\\trial.json",
    sourceSchedulePath: "D:\\example\\schedule.json",
    teacherReviewedScope: true
  },
  lowTokenSourceRouteEvidence: {
    ledgerReady: true,
    reviewOnly: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    counts: {
      logSourceDiscoveryRows: 3,
      logSourceDiscoveryMissingRows: 0
    }
  },
  confirmationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      label: "Teacher confirms recurring low-token monitoring may be reviewed",
      current: "missing",
      requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      label: "Teacher reviewed the monitored software scope",
      current: "missing",
      requiredPhrase: "teacher_reviewed_monitor_scope"
    },
    {
      id: "registration_review_confirmation",
      label: "Teacher confirms registration may proceed only to dry-run review",
      current: "missing",
      requiredPhrase: "teacher_confirmed_registration_dry_run_review_only"
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      label: "Teacher reviewed knowledge-augmented RAG and low-token source-route ledger evidence",
      current: "ready_for_teacher_review",
      requiredPhrase: "teacher_reviewed_low_token_source_route_ledger"
    },
    {
      id: "rollback_point_retained",
      label: "Rollback point exists and remains retained",
      current: "confirmed",
      requiredPhrase: "rollback_point_created_and_retained"
    }
  ],
  paths: {
    sourceReviewPacket: "D:\\example\\packet.json",
    sourceActivationGate: "D:\\example\\activation.json",
    sourceTrial: "D:\\example\\trial.json",
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json"
  },
  locks: {
    packetDoesNotRegisterTask: true,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const result = runScript([
  "--goal",
  "smoke activation receipt builder",
  "--review-packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "builder-output")
]);
const builder = readJson(result.builderPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [
  check(
    "Activation receipt builder writes a review-only builder packet",
      builder.format === "transparent_ai_all_software_operational_activation_receipt_builder_v1" &&
      builder.status === "receipt_builder_ready_for_teacher_use" &&
      builder.missingConfirmationCount === 4 &&
      builder.confirmationRows.length === 5 &&
      builder.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedger &&
      builder.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      builder.nextValidationCommand.includes("validate-all-software-operational-activation-review-receipt.mjs"),
    result.builderPath
  ),
  check(
    "Activation receipt builder HTML gives teacher checkboxes and JSON generation",
    html.includes("Activation Receipt Builder") &&
      html.includes("Generate Receipt JSON") &&
      html.includes("data-row-id") &&
      html.includes("navigator.clipboard.writeText") &&
      html.includes("ready_to_rerun_activation_gate"),
    result.htmlPath
  ),
  check(
    "Activation receipt builder keeps validation and system-change locks closed",
    builder.locks.builderDoesNotWriteReceipt === true &&
      builder.locks.builderDoesNotValidateReceipt === true &&
      builder.locks.builderDoesNotRegisterTask === true &&
      builder.locks.builderDoesNotExecuteWrapper === true &&
      builder.locks.scheduledTaskRegistered === false &&
      builder.locks.targetSoftwareCommandsExecuted === false &&
      builder.locks.longTermMemoryWritten === false &&
      builder.locks.goalComplete === false,
    result.builderPath
  ),
  check(
    "Activation receipt builder documents that generated JSON still needs validation",
    readme.includes("does not validate the receipt") &&
      readme.includes("does not register scheduled tasks") &&
      readme.includes("Builder HTML:"),
    result.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_activation_receipt_builder_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
