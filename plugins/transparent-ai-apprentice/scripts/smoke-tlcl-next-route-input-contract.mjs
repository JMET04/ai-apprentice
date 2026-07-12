#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-input-contract");
mkdirSync(smokeRoot, { recursive: true });

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence: String(evidence || "") });
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function runConsole(args = []) {
  return runNode("create-tlcl-direction-operational-console.mjs", [
    "--out-dir",
    join(smokeRoot, "consoles"),
    ...args
  ]);
}

function runContract(args = []) {
  return runNode("create-tlcl-next-route-input-contract.mjs", [
    "--out-dir",
    join(smokeRoot, "contracts"),
    ...args
  ]);
}

const defaultConsole = runConsole(["--goal", "Start the TLCL direction from a route chooser."]);
const ragConsole = runConsole([
  "--goal",
  "Use RAG standards and manuals as evidence before contract compile.",
  "--teacher-command",
  "Read the manual and keep RAG evidence non-authoritative."
]);
const correctionConsole = runConsole([
  "--goal",
  "Repair a workflow after a teacher correction.",
  "--teacher-command",
  "wrong angle relationship; repair before reuse"
]);
const runtimeConsole = runConsole([
  "--goal",
  "Reuse a confirmed workflow in medium runtime.",
  "--teacher-command",
  "execute the reviewed reusable workflow after validation"
]);

const fakeAttachmentPath = writeJson(join(smokeRoot, "ready-tlcl-rag-attachment.json"), {
  format: "transparent_ai_tlcl_rag_evidence_attachment_v1",
  status: "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review",
  approvedDraftRefs: [
    {
      sourceId: "manual.packaging.angle",
      retrievalPath: join(smokeRoot, "retrieval-evidence.json"),
      rulePath: join(smokeRoot, "draft-rule-card.json"),
      ruleLifecycle: "draft_disabled",
      logicExtractionHint: "Angle A must equal source datum alpha plus tolerance delta.",
      logicFitDecision: "needs_high_reasoning_repair",
      evidenceRefs: ["retrieval://manual.packaging.angle/chunk.001"],
      reviewerNote: "Use as evidence only."
    }
  ],
  approvedDisabledDraftCount: 1,
  sourceEvidence: {
    tlclPacketPath: join(smokeRoot, "tlcl-packet.json"),
    tlclPacketHash: "sha256:tlcl",
    ragValidationPath: join(smokeRoot, "rag-validation.json"),
    ragValidationHash: "sha256:rag"
  },
  highReasoningReviewHandoff: {
    mediumRuntimeContinuationAllowed: false
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    attachmentOnly: true,
    tlclStateUnmodified: true,
    ragDoesNotAuthorizeExecution: true,
    ragDoesNotEnableRules: true,
    ragDoesNotWriteMemory: true,
    ragDoesNotUnlockPackaging: true,
    doesNotExecuteTargetSoftware: true,
    ruleEnabled: false,
    memoryWritten: false,
    packagingUnlocked: false,
    goalComplete: false
  }
});

const defaultMissing = runContract(["--direction-console", defaultConsole.packetPath]);
const ragMissing = runContract(["--direction-console", ragConsole.packetPath]);
const correctionMissing = runContract(["--direction-console", correctionConsole.packetPath]);
const correctionReady = runContract([
  "--direction-console",
  correctionConsole.packetPath,
  "--attachment",
  fakeAttachmentPath,
  "--rollback-point",
  join(repoRoot, ".rollback-points", "smoke-retained-rollback")
]);
const runtimeMissing = runContract(["--direction-console", runtimeConsole.packetPath]);

const defaultPacket = JSON.parse(readFileSync(defaultMissing.contractPath, "utf8"));
const ragPacket = JSON.parse(readFileSync(ragMissing.contractPath, "utf8"));
const correctionMissingPacket = JSON.parse(readFileSync(correctionMissing.contractPath, "utf8"));
const correctionReadyPacket = JSON.parse(readFileSync(correctionReady.contractPath, "utf8"));
const runtimePacket = JSON.parse(readFileSync(runtimeMissing.contractPath, "utf8"));

check(
  "Input contract writes JSON Markdown and HTML artifacts",
  defaultMissing.format === "transparent_ai_tlcl_next_route_input_contract_result_v1" &&
    existsSync(defaultMissing.contractPath) &&
    existsSync(defaultMissing.readmePath) &&
    existsSync(defaultMissing.htmlPath),
  defaultMissing.contractPath
);

check(
  "Default launcher route requires teacher route choice before downstream use",
  defaultPacket.route.id === "route_to_tlcl_apprentice_session_launcher" &&
    defaultPacket.nextTool === "create_tlcl_apprentice_session_launcher" &&
    defaultPacket.missingInputs.includes("teacher_route_choice"),
  defaultPacket.status
);

check(
  "RAG evidence route requires TLCL packet, reviewed RAG validation, and teacher confirmation",
  ragPacket.route.id === "route_to_rag_evidence_then_contract_compile" &&
    ragPacket.nextTool === "create_tlcl_rag_evidence_attachment" &&
    ragPacket.missingInputs.includes("tlcl_packet_path") &&
    ragPacket.missingInputs.includes("reviewed_rag_validation_path") &&
    ragPacket.missingInputs.includes("teacher_confirmation"),
  ragPacket.missingInputs.join(",")
);

check(
  "Correction route blocks high-reasoning repair intake until attachment and rollback are present",
  correctionMissingPacket.route.id === "route_to_highest_reasoning_contract_repair" &&
    correctionMissingPacket.nextTool === "create_tlcl_rag_informed_high_reasoning_repair_intake" &&
    correctionMissingPacket.missingInputs.includes("reviewed_tlcl_rag_evidence_attachment") &&
    correctionMissingPacket.missingInputs.includes("rollback_point_retained"),
  correctionMissingPacket.missingInputs.join(",")
);

check(
  "Correction route becomes ready only with reviewed RAG attachment and retained rollback",
  correctionReadyPacket.status === "next_route_inputs_ready_for_teacher_reviewed_manual_use" &&
    correctionReadyPacket.readyForNextTool === true &&
    correctionReadyPacket.missingInputs.length === 0 &&
    correctionReadyPacket.requiredArtifacts.some((item) => item.id === "reviewed_tlcl_rag_evidence_attachment" && item.satisfied),
  correctionReadyPacket.status
);

check(
  "Medium runtime route requires budget review, activation validation, and rollback",
  runtimePacket.route.id === "route_to_reasoning_budget_governor_before_medium_runtime" &&
    runtimePacket.nextTool === "create_tlcl_reasoning_budget_governor" &&
    runtimePacket.missingInputs.includes("reasoning_budget_review") &&
    runtimePacket.missingInputs.includes("reusable_workflow_activation") &&
    runtimePacket.missingInputs.includes("rollback_point_retained"),
  runtimePacket.missingInputs.join(",")
);

check(
  "Input contract remains no-op locked",
  [defaultPacket, ragPacket, correctionMissingPacket, correctionReadyPacket, runtimePacket].every(
    (packet) =>
      packet.locks.reviewOnly === true &&
      packet.locks.inputContractOnly === true &&
      packet.locks.modelInvoked === false &&
      packet.locks.ragFetched === false &&
      packet.locks.nextToolExecuted === false &&
      packet.locks.targetSoftwareCommandsExecuted === false &&
      packet.locks.memoryWritten === false &&
      packet.locks.ruleEnabled === false &&
      packet.locks.packagingUnlocked === false &&
      packet.locks.goalComplete === false
  ),
  "model/RAG/next-tool/software/memory/rules/packaging/completion locked"
);

const passed = checks.filter((item) => item.pass).length;
const status = passed === checks.length ? "passed" : "failed";
console.log(
  JSON.stringify(
    {
      status,
      smoke: "transparent_ai_tlcl_next_route_input_contract_smoke_v1",
      passed,
      total: checks.length,
      checks
    },
    null,
    2
  )
);
if (status !== "passed") process.exit(1);
