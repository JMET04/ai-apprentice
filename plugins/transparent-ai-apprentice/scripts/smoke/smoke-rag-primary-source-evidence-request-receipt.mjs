#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-evidence-request-receipt");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args, expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function runKnowledge(script, args, expectOk = true) {
  return runScript(join(pluginRoot, "scripts", "knowledge", script), args, expectOk);
}

const planningSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-selected-follow-up-planning-packet.mjs"), []);
const planningSmokeResult = JSON.parse(planningSmoke.stdout);
const planningPacketPath = planningSmokeResult.packetPath;

const builderRun = runKnowledge("create-rag-primary-source-evidence-request-receipt-builder.mjs", [
  "--planning-packet",
  planningPacketPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);
const teacherSourcePath = join(root, "teacher-primary-source-note.md");
writeFileSync(
  teacherSourcePath,
  ["# Teacher Primary Source Note", "", "Line relationships must be derived from named dimensions and angles, not visual similarity."].join("\n"),
  "utf8"
);

receipt.decision = "teacher_provided_primary_sources";
receipt.providedSources = [
  {
    sourceId: "teacher_primary_source_logic_note",
    title: "Teacher primary source logic note",
    uri: teacherSourcePath,
    sourceType: "teacher_note",
    domain: "engineering_logic_learning",
    trustLevelAfterReview: "teacher_supplied",
    permissionStatus: "teacher_supplied",
    evidenceReviewed: true,
    reviewOnlyBoundaryReviewed: true,
    logicExtractionHint: "Extract strict data-to-geometry relationships, including dimensions, lines, and angles.",
    reviewerNote: "Teacher supplied this source to guide logic-grounded RAG follow-up."
  }
];
const receiptPath = join(root, "teacher-primary-source-evidence-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-primary-source-evidence-request-receipt.mjs", [
  "--planning-packet",
  planningPacketPath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const validation = readJson(validationResult.validationPath);

if (validation.format !== "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1") {
  throw new Error("Primary-source evidence receipt should write the validation format.");
}
if (validation.status !== "ready_for_review_only_primary_source_registry_follow_up") {
  throw new Error("Primary-source evidence receipt should become ready only for source registry follow-up.");
}
if (validation.confirmedSources.length !== 1) {
  throw new Error("Primary-source evidence receipt should confirm exactly one teacher source.");
}
if (validation.confirmedSources[0].review.logic_extraction_hint === "") {
  throw new Error("Primary-source evidence receipt should preserve the logic extraction hint.");
}
if (
  validation.locks.externalFetchPerformed !== false ||
  validation.locks.softwareActionsExecuted !== false ||
  validation.locks.ruleEnabled !== false ||
  validation.locks.packagingUnlocked !== false ||
  validation.nextReview.mayFetchExternalSources !== false ||
  validation.nextReview.mayExecuteSoftware !== false ||
  validation.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Primary-source evidence receipt must not fetch, execute, enable rules, package, or claim completion.");
}

const forbiddenReceipt = structuredClone(receipt);
forbiddenReceipt.decision = "accepted";
const forbiddenReceiptPath = join(root, "forbidden-accepted-primary-source-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runKnowledge(
  "validate-rag-primary-source-evidence-request-receipt.mjs",
  ["--planning-packet", planningPacketPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-validation")],
  false
);
if (
  !forbiddenRun.stdout.includes("PRIMARY_SOURCE_TOP_LEVEL_DECISION_NOT_ALLOWED") &&
  !forbiddenRun.stdout.includes("PRIMARY_SOURCE_FORBIDDEN_TOP_LEVEL_DECISION")
) {
  throw new Error("Primary-source evidence receipt must reject acceptance.");
}

const missingLogicReceipt = structuredClone(receipt);
missingLogicReceipt.providedSources[0].logicExtractionHint = "";
const missingLogicReceiptPath = join(root, "missing-logic-primary-source-receipt.json");
writeJson(missingLogicReceiptPath, missingLogicReceipt);
const missingLogicRun = runKnowledge(
  "validate-rag-primary-source-evidence-request-receipt.mjs",
  ["--planning-packet", planningPacketPath, "--receipt", missingLogicReceiptPath, "--out-dir", join(root, "missing-logic-validation")],
  false
);
if (!missingLogicRun.stdout.includes("PRIMARY_SOURCE_ROW_REQUIRES_LOGIC_EXTRACTION_HINT")) {
  throw new Error("Primary-source evidence receipt must require logic extraction hints.");
}

const unlockedPacket = structuredClone(readJson(planningPacketPath));
unlockedPacket.locks.packagingUnlocked = true;
const unlockedPacketPath = join(root, "unlocked-planning-packet.json");
writeJson(unlockedPacketPath, unlockedPacket);
const unlockedBuilderRun = runKnowledge(
  "create-rag-primary-source-evidence-request-receipt-builder.mjs",
  ["--planning-packet", unlockedPacketPath, "--out-dir", join(root, "unlocked-builder")],
  false
);
if (!unlockedBuilderRun.stderr.includes("RAG_PRIMARY_SOURCE_EVIDENCE_RECEIPT_REQUIRES_LOCKED_PRIMARY_SOURCE_PLANNING_PACKET")) {
  throw new Error("Primary-source evidence receipt builder must require locked planning packet.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_evidence_request_receipt_smoke_v1",
      planningPacketPath,
      templatePath: builder.templatePath,
      validationPath: validationResult.validationPath,
      confirmedSourceCount: validation.confirmedSources.length,
      rejectedAcceptance: true,
      rejectedMissingLogicExtractionHint: true,
      rejectedUnlockedPlanningPacket: true,
      locks: validation.locks
    },
    null,
    2
  )
);
