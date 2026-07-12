#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-selected-follow-up-planning-packet");
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

const selectionSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-follow-up-queue-selection-receipt.mjs"), []);
const selectionSmokeResult = JSON.parse(selectionSmoke.stdout);
const selectionValidationPath = selectionSmokeResult.validationPath;

const rollbackRun = runScript(join(pluginRoot, "scripts", "create-rollback-point.mjs"), [
  "--label",
  "smoke-rag-selected-follow-up-planning-packet",
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
  throw new Error("Selected follow-up planning should write the planning packet format.");
}
if (packet.status !== "selected_follow_up_planning_ready_for_teacher_review") {
  throw new Error("Selected follow-up planning should be ready only for teacher review.");
}
if (packet.selectedFollowUpDecision !== "request_more_primary_sources") {
  throw new Error("Selected follow-up planning should preserve the selected decision.");
}
if (!packet.plannedItems.some((item) => item.itemId === "prepare_primary_source_evidence_request")) {
  throw new Error("Selected follow-up planning should prepare primary-source evidence review.");
}
if (
  packet.plannedItems.some((item) => item.executesNow || item.externalFetchPerformed || item.softwareActionsExecuted) ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.packagingUnlocked !== false ||
  packet.locks.accepted !== false ||
  packet.nextReview.mayFetchExternalSources !== false ||
  packet.nextReview.mayExecuteSoftware !== false ||
  packet.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Selected follow-up planning must not execute, fetch, package, accept, or claim completion.");
}

const validation = readJson(selectionValidationPath);
const nonReady = { ...validation, status: "waiting_for_teacher_review" };
const nonReadyPath = join(root, "non-ready-selection-validation.json");
writeJson(nonReadyPath, nonReady);
const nonReadyRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  ["--selection-validation", nonReadyPath, "--rollback-point", rollback.rollbackDir, "--out-dir", join(root, "non-ready")],
  false
);
if (!nonReadyRun.stderr.includes("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_READY_SELECTION_VALIDATION")) {
  throw new Error("Selected follow-up planning must reject non-ready selection validation.");
}

const unlocked = structuredClone(validation);
unlocked.locks.packagingUnlocked = true;
const unlockedPath = join(root, "unlocked-selection-validation.json");
writeJson(unlockedPath, unlocked);
const unlockedRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  ["--selection-validation", unlockedPath, "--rollback-point", rollback.rollbackDir, "--out-dir", join(root, "unlocked")],
  false
);
if (!unlockedRun.stderr.includes("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_LOCKED_SELECTION_VALIDATION")) {
  throw new Error("Selected follow-up planning must require locked selection validation.");
}

const missingRollbackRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  [
    "--selection-validation",
    selectionValidationPath,
    "--rollback-point",
    join(root, "missing-rollback"),
    "--out-dir",
    join(root, "missing-rollback-run")
  ],
  false
);
if (!missingRollbackRun.stderr.includes("ROLLBACK_POINT_NOT_FOUND")) {
  throw new Error("Selected follow-up planning must require retained rollback.");
}

const forbidden = structuredClone(validation);
forbidden.selectedFollowUp.selectedFollowUpDecision = "execute_software";
const forbiddenPath = join(root, "forbidden-selection-validation.json");
writeJson(forbiddenPath, forbidden);
const forbiddenRun = runKnowledge(
  "create-rag-selected-follow-up-planning-packet.mjs",
  ["--selection-validation", forbiddenPath, "--rollback-point", rollback.rollbackDir, "--out-dir", join(root, "forbidden")],
  false
);
if (!forbiddenRun.stderr.includes("RAG_SELECTED_FOLLOW_UP_PLANNING_REJECTS_FORBIDDEN_DECISION")) {
  throw new Error("Selected follow-up planning must reject forbidden selected follow-up decisions.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_selected_follow_up_planning_packet_smoke_v1",
      selectionValidationPath,
      rollbackDir: rollback.rollbackDir,
      packetPath: planning.packetPath,
      selectedFollowUpDecision: packet.selectedFollowUpDecision,
      plannedItems: packet.plannedItems.length,
      rejectedNonReadySelectionValidation: true,
      rejectedUnlockedSelectionValidation: true,
      rejectedMissingRollback: true,
      rejectedForbiddenDecision: true,
      locks: packet.locks
    },
    null,
    2
  )
);
