#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-selected-follow-up-planning-packet");
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

const selectionSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-follow-up-queue-selection-receipt.mjs"), []);
const selectionSmokeResult = JSON.parse(selectionSmoke.stdout);
const selectionValidationPath = selectionSmokeResult.validationPath;

const rollbackRun = runScript(join(pluginRoot, "scripts", "create-rollback-point.mjs"), [
  "--label",
  "smoke-rag-primary-source-selected-follow-up-planning-packet",
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

if (packet.format !== "transparent_ai_rag_selected_follow_up_planning_packet_v1") {
  throw new Error("Primary-source selected follow-up planning should write the planning packet format.");
}
if (!packet.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selected follow-up planning should preserve logic extraction hints.");
}
if (packet.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source selected follow-up planning should preserve confirmed logic evidence review.");
}
if (packet.nextReview.logicEvidenceReviews?.[0]?.logicFitDecisionConfirmed !== true) {
  throw new Error("Primary-source selected follow-up planning should preserve logic-fit confirmation.");
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
  throw new Error("Primary-source selected follow-up planning must not execute, fetch, package, accept, or claim completion.");
}

const validation = readJson(selectionValidationPath);
const unconfirmed = structuredClone(validation);
unconfirmed.nextReview.logicEvidenceReviews = unconfirmed.nextReview.logicEvidenceReviews.map((row) => ({
  ...row,
  decision: "needs_teacher_review",
  logicEvidenceReviewed: false
}));
unconfirmed.selectedFollowUp.logicEvidenceReviews = unconfirmed.nextReview.logicEvidenceReviews;
const unconfirmedPath = join(root, "unconfirmed-logic-selection-validation.json");
writeJson(unconfirmedPath, unconfirmed);
const unconfirmedRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  ["--selection-validation", unconfirmedPath, "--rollback-point", rollback.rollbackDir, "--out-dir", join(root, "unconfirmed")],
  false
);
if (!unconfirmedRun.stderr.includes("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_CONFIRMED_LOGIC_EVIDENCE")) {
  throw new Error("Primary-source selected follow-up planning must reject unconfirmed logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_selected_follow_up_planning_packet_smoke_v1",
      selectionValidationPath,
      rollbackDir: rollback.rollbackDir,
      packetPath: planning.packetPath,
      preservedLogicExtractionHint: true,
      preservedLogicEvidenceReview: true,
      rejectedUnconfirmedLogicEvidence: true,
      locks: packet.locks
    },
    null,
    2
  )
);
