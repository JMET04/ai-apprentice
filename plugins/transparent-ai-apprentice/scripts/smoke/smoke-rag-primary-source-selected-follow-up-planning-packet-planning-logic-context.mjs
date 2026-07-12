#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-selected-follow-up-planning-packet-planning-logic-context");
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

const selectionSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context.mjs"),
  []
);
const selectionSmokeResult = JSON.parse(selectionSmoke.stdout);
const selectionValidationPath = selectionSmokeResult.validationPath;
const selectionValidation = readJson(selectionValidationPath);

const rollbackRun = runScript(join(pluginRoot, "scripts", "create-rollback-point.mjs"), [
  "--label",
  "smoke-rag-primary-source-selected-follow-up-planning-packet-planning-logic-context",
  "--path",
  "plugins\\transparent-ai-apprentice\\scripts\\knowledge"
]);
const rollback = JSON.parse(rollbackRun.stdout);

const planningRun = runKnowledge("create-rag-selected-follow-up-planning-packet.mjs", [
  "--selection-validation",
  selectionValidationPath,
  "--rollback-point",
  rollback.rollbackDir,
  "--out-dir",
  join(root, "planning")
]);
const planning = JSON.parse(planningRun.stdout);
const packet = readJson(planning.packetPath);

if (!packet.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selected follow-up planning should preserve upstream planning logic hints.");
}
if (!packet.planningLogicEvidenceHash || packet.planningLogicEvidenceHash !== selectionValidation.planningLogicEvidenceHash) {
  throw new Error("Primary-source selected follow-up planning should preserve upstream planning logic hash.");
}
if (packet.nextReview.planningLogicEvidenceHash !== packet.planningLogicEvidenceHash) {
  throw new Error("Primary-source selected follow-up planning should expose the planning logic hash for next review.");
}
if (
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.packagingUnlocked !== false ||
  packet.locks.accepted !== false ||
  packet.nextReview.mayFetchExternalSources !== false ||
  packet.nextReview.mayExecuteSoftware !== false ||
  packet.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Primary-source selected follow-up planning logic context must remain review-only and locked.");
}

const tamperedSelectionValidation = structuredClone(selectionValidation);
tamperedSelectionValidation.planningLogicEvidence.logicExtractionHints = [];
const tamperedSelectionValidationPath = join(root, "tampered-selection-validation-planning-logic.json");
writeJson(tamperedSelectionValidationPath, tamperedSelectionValidation);
const tamperedRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  [
    "--selection-validation",
    tamperedSelectionValidationPath,
    "--rollback-point",
    rollback.rollbackDir,
    "--out-dir",
    join(root, "tampered")
  ],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RAG_SELECTED_FOLLOW_UP_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source selected follow-up planning must reject tampered planning logic evidence.");
}

const tamperedSelectedValidation = structuredClone(selectionValidation);
tamperedSelectedValidation.selectedFollowUp.planningLogicEvidence.logicExtractionHints = [];
const tamperedSelectedValidationPath = join(root, "tampered-selected-follow-up-planning-logic.json");
writeJson(tamperedSelectedValidationPath, tamperedSelectedValidation);
const tamperedSelectedRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  [
    "--selection-validation",
    tamperedSelectedValidationPath,
    "--rollback-point",
    rollback.rollbackDir,
    "--out-dir",
    join(root, "tampered-selected")
  ],
  false
);
if (
  !`${tamperedSelectedRun.stdout}\n${tamperedSelectedRun.stderr}`.includes(
    "RAG_SELECTED_FOLLOW_UP_PLANNING_SELECTED_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source selected follow-up planning must reject tampered selected-follow-up planning logic evidence.");
}

const tamperedNextReviewValidation = structuredClone(selectionValidation);
tamperedNextReviewValidation.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewValidationPath = join(root, "tampered-next-review-planning-logic.json");
writeJson(tamperedNextReviewValidationPath, tamperedNextReviewValidation);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  [
    "--selection-validation",
    tamperedNextReviewValidationPath,
    "--rollback-point",
    rollback.rollbackDir,
    "--out-dir",
    join(root, "tampered-next-review")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source selected follow-up planning must reject tampered next-review planning logic evidence.");
}

const tamperedNextReviewHashValidation = structuredClone(selectionValidation);
tamperedNextReviewHashValidation.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedNextReviewHashValidationPath = join(root, "tampered-next-review-planning-logic-hash.json");
writeJson(tamperedNextReviewHashValidationPath, tamperedNextReviewHashValidation);
const tamperedNextReviewHashRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  [
    "--selection-validation",
    tamperedNextReviewHashValidationPath,
    "--rollback-point",
    rollback.rollbackDir,
    "--out-dir",
    join(root, "tampered-next-review-hash")
  ],
  false
);
if (
  !`${tamperedNextReviewHashRun.stdout}\n${tamperedNextReviewHashRun.stderr}`.includes(
    "RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source selected follow-up planning must reject tampered next-review planning logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_selected_follow_up_planning_packet_planning_logic_context_smoke_v1",
      selectionValidationPath,
      rollbackDir: rollback.rollbackDir,
      packetPath: planning.packetPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedSelectedFollowUpPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidenceHash: true,
      locks: packet.locks
    },
    null,
    2
  )
);
