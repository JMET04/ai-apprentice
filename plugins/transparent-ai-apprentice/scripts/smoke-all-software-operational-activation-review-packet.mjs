#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-all-software-operational-activation-review-packet.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "activation review packet script failed");
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
    : join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-packet-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const blockedGatePath = writeJson(join(smokeRoot, "blocked-gate", "all-software-operational-learning-activation-gate.json"), {
  format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
  status: "waiting_for_teacher_confirmation_scope_or_rollback_review",
  readyForTeacherRegistrationReview: false,
  confirmations: {
    teacherConfirmationMatched: false,
    scopeConfirmationMatched: false,
    registrationConfirmationMatched: false,
    rollbackPointCreated: true
  },
  blockers: [
    "missing_explicit_teacher_recurring_monitor_confirmation",
    "missing_reviewed_monitor_scope_confirmation",
    "approval_gate_not_ready_for_registration_request",
    "missing_generated_registration_request",
    "missing_explicit_teacher_registration_confirmation"
  ],
  paths: {
    activationGate: "D:\\example\\blocked\\all-software-operational-learning-activation-gate.json",
    sourceTrial: "D:\\example\\trial\\all-software-operational-learning-trial.json",
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
  },
  lowTokenSourceRouteEvidence: {
    ledgerReady: true,
    reviewOnly: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md",
    counts: {
      logSourceDiscoveryRows: 3,
      logSourceDiscoveryMissingRows: 0,
      directLogCandidatesReadyForMetadataGate: 2,
      lowTokenFallbackRoutesReadyForReview: 1
    }
  },
  locks: {
    activationGateDoesNotRegisterTask: true,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const readyGatePath = writeJson(join(smokeRoot, "ready-gate", "all-software-operational-learning-activation-gate.json"), {
  format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
  status: "ready_for_teacher_registration_review",
  readyForTeacherRegistrationReview: true,
  confirmations: {
    teacherConfirmationMatched: true,
    scopeConfirmationMatched: true,
    registrationConfirmationMatched: true,
    rollbackPointCreated: true
  },
  blockers: [],
  paths: {
    activationGate: "D:\\example\\ready\\all-software-operational-learning-activation-gate.json",
    sourceTrial: "D:\\example\\trial\\all-software-operational-learning-trial.json",
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
  },
  lowTokenSourceRouteEvidence: {
    ledgerReady: true,
    reviewOnly: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md",
    counts: {
      logSourceDiscoveryRows: 3,
      logSourceDiscoveryMissingRows: 0,
      directLogCandidatesReadyForMetadataGate: 2,
      lowTokenFallbackRoutesReadyForReview: 1
    }
  },
  locks: {
    activationGateDoesNotRegisterTask: true,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const blockedResult = runScript([
  "--goal",
  "smoke activation review packet blocked confirmations",
  "--activation-gate",
  blockedGatePath,
  "--output-dir",
  join(smokeRoot, "blocked-output")
]);
const blockedPacket = readJson(blockedResult.reviewPacketPath);
const blockedReceipt = readJson(blockedResult.receiptTemplatePath);
const blockedReadme = readFileSync(blockedResult.readmePath, "utf8");
const blockedHtml = readFileSync(blockedResult.htmlPath, "utf8");

const readyResult = runScript([
  "--goal",
  "smoke activation review packet ready confirmations",
  "--activation-gate",
  readyGatePath,
  "--output-dir",
  join(smokeRoot, "ready-output")
]);
const readyPacket = readJson(readyResult.reviewPacketPath);

const checks = [
  check(
    "Activation review packet translates activation blockers into teacher confirmation rows",
    blockedPacket.status === "waiting_for_teacher_activation_confirmations" &&
      blockedPacket.missingConfirmationCount === 4 &&
      blockedPacket.confirmationRows.some(
        (row) =>
          row.id === "recurring_monitor_teacher_confirmation" &&
          row.current === "missing" &&
          row.requiredPhrase === "teacher_confirmed_recurring_low_token_monitor_review"
      ) &&
      blockedPacket.confirmationRows.some(
        (row) =>
          row.id === "low_token_source_route_ledger_reviewed" &&
          row.current === "ready_for_teacher_review" &&
          row.requiredPhrase === "teacher_reviewed_low_token_source_route_ledger"
      ) &&
      blockedPacket.confirmationRows.some(
        (row) => row.id === "rollback_point_retained" && row.current === "confirmed"
      ),
    blockedResult.reviewPacketPath
  ),
  check(
    "Activation review receipt keeps acceptance, registration, execution, memory, and packaging blocked",
    blockedReceipt.defaultDecision === "needs_teacher_review" &&
      blockedReceipt.allowedDecisions.includes("ready_to_rerun_activation_gate") &&
      blockedReceipt.blockedDecisions.includes("register_task") &&
      blockedReceipt.locks.packetDoesNotRegisterTask === true &&
      blockedReceipt.locks.scheduledTaskRegistered === false &&
      blockedReceipt.locks.targetSoftwareCommandsExecuted === false &&
      blockedReceipt.locks.longTermMemoryWritten === false,
    blockedResult.receiptTemplatePath
  ),
  check(
    "Activation review packet gives safe next commands without execute flags",
    blockedPacket.nextSafeCommands.some((item) => item.command.includes("create-all-software-operational-learning-activation-gate.mjs")) &&
      blockedPacket.nextSafeCommands.some((item) =>
        item.command.includes("run-all-software-operational-learning-activation-dry-run-rehearsal.mjs")
      ) &&
      blockedPacket.nextSafeCommands.every((item) => !item.command.includes("-Execute")) &&
      blockedPacket.blockedActions.includes("execute_activation_wrapper_with_execute_flag_from_review_packet"),
    blockedResult.reviewPacketPath
  ),
  check(
    "Activation review packet writes a local teacher-facing HTML and start-here guide",
    blockedHtml.includes("Activation Review Packet") &&
      blockedHtml.includes("Copy Receipt Template") &&
      blockedReadme.includes("Confirmation rows:") &&
      blockedReadme.includes("Blocked actions:"),
    blockedResult.htmlPath
  ),
  check(
    "Activation review packet carries source-route evidence but still requires teacher review before dry-run",
    readyPacket.status === "waiting_for_teacher_activation_confirmations" &&
      readyPacket.missingConfirmationCount === 1 &&
      readyPacket.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedger &&
      readyPacket.lowTokenSourceRouteEvidence?.counts?.logSourceDiscoveryRows === 3 &&
      readyPacket.locks.packetDoesNotRegisterTask === true &&
      readyPacket.locks.packetDoesNotExecuteWrapper === true &&
      readyPacket.locks.scheduledTaskRegistered === false,
    readyResult.reviewPacketPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_activation_review_packet_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
