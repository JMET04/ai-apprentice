#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function latestResultPath(stdout, key) {
  const parsed = JSON.parse(stdout);
  return parsed[key];
}

const root = mkdtempSync(join(tmpdir(), "ta-compact-evidence-request-receipt-builder-"));
const requestPackPath = join(root, "request-pack.json");
const requestPack = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1",
  packId: "smoke-compact-evidence-request-pack",
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_compact_evidence_request_review",
  counts: {
    sourceRows: 2,
    eligibleRows: 2,
    blockedRows: 0
  },
  requestRows: [
    {
      rowId: "row-001",
      ledgerNumber: 1,
      software: "Example Tool",
      routeId: "windows_event_metadata",
      routeKind: "windows_event_log_metadata",
      evidenceMode: "windows_event_metadata_only",
      compactFields: ["provider names", "event id histogram"],
      forbiddenFields: ["full event message body", "screenshots"],
      collectionBoundary: "Use metadata only.",
      readyForTeacherConfirmedCompactEvidenceRequest: true,
      blockers: []
    },
    {
      rowId: "row-002",
      ledgerNumber: 2,
      software: "Example Runtime",
      routeId: "runtime_install_metadata",
      routeKind: "installed_runtime_metadata",
      evidenceMode: "runtime_install_metadata_only",
      compactFields: ["version", "install path hash"],
      forbiddenFields: ["file contents", "software execution"],
      collectionBoundary: "Use install metadata only.",
      readyForTeacherConfirmedCompactEvidenceRequest: true,
      blockers: []
    }
  ],
  locks: {
    reviewOnly: true,
    requestDoesNotReadLogs: true,
    requestDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  },
  executeNow: false,
  goalComplete: false
};
writeJson(requestPackPath, requestPack);

const builderResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-compact-evidence-request-receipt-builder.mjs",
  "--request-pack",
  requestPackPath,
  "--output-dir",
  join(root, "builder")
]);
const builderPath = latestResultPath(builderResult.stdout, "builderPath");
const htmlPath = latestResultPath(builderResult.stdout, "htmlPath");
const receiptTemplatePath = latestResultPath(builderResult.stdout, "receiptTemplatePath");
const builder = readJson(builderPath);
const receiptTemplate = readJson(receiptTemplatePath);
const html = readFileSync(htmlPath, "utf8");

const defaultValidationResult = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-request-receipt.mjs",
    "--request-pack",
    requestPackPath,
    "--receipt",
    receiptTemplatePath,
    "--output-dir",
    join(root, "default-validation")
  ],
  { allowFailure: true }
);

const confirmedReceipt = {
  ...receiptTemplate,
  teacherDecision: "compact_metadata_request_confirmed",
  rollbackRetained: true,
  teacherNote: "Smoke confirms only metadata request review.",
  requestRows: receiptTemplate.requestRows.map((row) => ({
    ...row,
    teacherDecision: "compact_metadata_request_confirmed",
    reviewedCompactEvidenceRequest: true,
    compactEvidenceCollected: false,
    teacherNote: "Reviewed for smoke."
  }))
};
const confirmedReceiptPath = join(root, "confirmed-receipt.json");
writeJson(confirmedReceiptPath, confirmedReceipt);
const confirmedValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-request-receipt.mjs",
  "--request-pack",
  requestPackPath,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(root, "confirmed-validation")
]);

const defaultValidationResultJson = JSON.parse(defaultValidationResult.stdout);
const confirmedValidationResultJson = JSON.parse(confirmedValidationResult.stdout);
const defaultValidation = readJson(defaultValidationResultJson.validationPath);
const confirmedValidation = readJson(confirmedValidationResultJson.validationPath);
const checks = [
  {
    name: "Builder creates teacher-facing receipt packet and HTML",
    pass:
      builder.format === "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_builder_v1" &&
      builder.counts.reviewRows === 2 &&
      builder.counts.eligibleRows === 2 &&
      receiptTemplate.format === "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1"
  },
  {
    name: "Builder page uses safe text rendering and browser-only copy/download controls",
    pass:
      html.includes("appendText") &&
      html.includes("textContent") &&
      !html.includes("innerHTML") &&
      html.includes("Download JSON") &&
      html.includes("Copy JSON")
  },
  {
    name: "Default receipt fails closed before teacher confirmation",
    pass:
      defaultValidationResult.status !== 0 &&
      defaultValidation.status === "blocked_for_invalid_or_forbidden_compact_evidence_request_receipt" &&
      defaultValidation.counts.readyRows === 0
  },
  {
    name: "Teacher-confirmed receipt validates without executing metadata collection",
    pass:
      confirmedValidation.status === "validated_with_prepared_compact_metadata_collection_command" &&
      confirmedValidation.counts.readyRows === 2 &&
      confirmedValidation.nextPreparedCommand?.executesNow === false &&
      confirmedValidation.locks?.validationDoesNotRunMetadataCollection === true
  },
  {
    name: "Builder locks keep collection, logs, screenshots, execution, memory, and completion closed",
    pass:
      builder.locks?.builderDoesNotRunMetadataCollection === true &&
      builder.locks?.builderDoesNotReadLogs === true &&
      builder.locks?.builderDoesNotCaptureScreenshots === true &&
      builder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks?.builderDoesNotWriteMemory === true &&
      builder.locks?.goalComplete === false
  }
];

const status = checks.every((check) => check.pass) ? "passed" : "failed";
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_builder_smoke_v1",
      status,
      root,
      artifacts: {
        builder: builderPath,
        html: htmlPath,
        receiptTemplate: receiptTemplatePath,
        confirmedReceipt: confirmedReceiptPath
      },
      checks
    },
    null,
    2
  )
);
if (status !== "passed") process.exit(1);
