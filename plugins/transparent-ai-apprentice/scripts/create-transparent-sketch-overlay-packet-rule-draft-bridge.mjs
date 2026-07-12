#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashText(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function slugify(value) {
  return (
    String(value || "transparent-sketch-overlay-packet-rule-draft-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "transparent-sketch-overlay-packet-rule-draft-bridge"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    draftRulesEnabled: false,
    memoryWritten: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function runNodeScript(scriptName, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptName} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptName} unexpectedly passed\nSTDOUT:\n${result.stdout}`);
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout.trim() ? JSON.parse(result.stdout) : null
  };
}

const overlayPacketInput = argValue("--overlay-packet", "");
const rollbackPointInput = argValue("--rollback-point", "");
const overlayPacket = overlayPacketInput ? resolve(overlayPacketInput) : "";
const rollbackPoint = rollbackPointInput ? resolve(rollbackPointInput) : "";
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "transparent-sketch-overlay-packet-rule-draft-bridges")
  )
);
const teacherReviewedOverlayPacket = hasFlag("--teacher-reviewed-overlay-packet");
const teacherReviewedSpatialIntent = hasFlag("--teacher-reviewed-spatial-intent");
const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(overlayPacket)}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(bridgeDir, { recursive: true });

const blockers = [];
if (!overlayPacket || !existsSync(overlayPacket)) blockers.push("overlay_packet_not_found");
if (!rollbackPoint || !existsSync(rollbackPoint)) blockers.push("rollback_point_not_found");
if (!teacherReviewedOverlayPacket) blockers.push("teacher_reviewed_overlay_packet_flag_required");
if (!teacherReviewedSpatialIntent) blockers.push("teacher_reviewed_spatial_intent_flag_required");

let overlayValidation = null;
let spatialIntent = null;
let ruleDraft = null;
let status = "blocked_before_transparent_sketch_overlay_packet_rule_draft_bridge";

if (!blockers.length) {
  overlayValidation = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
    "--overlay-packet",
    overlayPacket,
    "--output-dir",
    join(bridgeDir, "overlay-packet-validation")
  ]).json;
  const overlayValidationPacket = readJson(overlayValidation.validationPath);
  if (!overlayValidationPacket.readyForSpatialIntentEvidenceReceipt) {
    blockers.push("overlay_packet_validation_not_ready_for_spatial_intent_evidence_receipt");
    blockers.push(...overlayValidationPacket.blockers.map((blocker) => `overlay_validation:${blocker}`));
  }
}

if (!blockers.length) {
  spatialIntent = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
    "--overlay-packet",
    overlayPacket,
    "--output-dir",
    join(bridgeDir, "spatial-intent")
  ]).json;
  const spatialIntentPacket = readJson(spatialIntent.interpretationPath);
  const contract = spatialIntentPacket.detailLogicContract || {};
  if (contract.format !== "transparent_ai_universal_detail_logic_contract_v1") {
    blockers.push("spatial_intent_missing_universal_detail_logic_contract");
  }
  if (contract.missingLogicSourceBehavior !== "block_execute_and_route_to_teacher_review") {
    blockers.push("spatial_intent_contract_does_not_block_missing_logic_source");
  }
}

if (!blockers.length) {
  ruleDraft = runNodeScript("create-transparent-sketch-logic-contract-rule-draft.mjs", [
    "--spatial-intent",
    spatialIntent.interpretationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed-spatial-intent",
    "--output-dir",
    join(bridgeDir, "logic-contract-rule-draft")
  ]).json;
  status = "ready_for_teacher_transparent_sketch_overlay_packet_rule_draft_review";
}

const bridgePath = join(bridgeDir, "transparent-sketch-overlay-packet-rule-draft-bridge.json");
const result = {
  ok: blockers.length === 0,
  format: "transparent_ai_transparent_sketch_overlay_packet_rule_draft_bridge_v1",
  bridgeId,
  createdAt: new Date().toISOString(),
  status,
  sourceEvidence: {
    overlayPacket,
    overlayPacketHash: existsSync(overlayPacket) ? hashText(readFileSync(overlayPacket, "utf8")) : "",
    rollbackPoint
  },
  teacherReviewedOverlayPacket,
  teacherReviewedSpatialIntent,
  blockers,
  paths: {
    bridge: bridgePath,
    overlayValidation: overlayValidation?.validationPath || "",
    overlayValidationHtml: overlayValidation?.htmlPath || "",
    spatialIntent: spatialIntent?.interpretationPath || "",
    ruleDraftPackage: ruleDraft?.packagePath || "",
    compiledRulePackage: ruleDraft?.compiledRulePackagePath || ""
  },
  nextReview: blockers.length
    ? {
        instruction:
          "Resolve blockers with teacher-reviewed overlay evidence before converting transparent sketch intent into draft_disabled rules.",
        mayExecuteSoftware: false,
        mayWriteMemory: false,
        mayEnableRules: false
      }
    : {
        instruction:
          "Review the generated draft_disabled transparent sketch logic rules. Promote only through the normal teacher review and validation lifecycle.",
        mayExecuteSoftware: false,
        mayWriteMemory: false,
        mayEnableRules: false
      },
  blockedActions: [
    "execute_from_overlay_packet_bridge",
    "enable_rules_from_overlay_packet_bridge",
    "write_memory_from_overlay_packet_bridge",
    "capture_screenshots_from_overlay_packet_bridge",
    "claim_goal_complete_from_overlay_packet_bridge",
    "unlock_packaging"
  ],
  locks: locks(),
  executeNow: false,
  goalComplete: false
};

writeJson(bridgePath, result);
console.log(
  JSON.stringify(
    {
      ok: result.ok,
      status: result.status,
      bridgePath,
      blockers,
      paths: result.paths,
      locks: result.locks,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
if (blockers.length) process.exit(1);
