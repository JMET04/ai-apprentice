#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-input-contract-receipt");
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

function runNode(script, args = [], allowFailure = false) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${script} failed:\n${result.stdout}\n${result.stderr}`);
  }
  const parsed = result.stdout.trim() ? JSON.parse(result.stdout) : {};
  return { statusCode: result.status, parsed, stdout: result.stdout, stderr: result.stderr };
}

function runConsole() {
  return runNode("create-tlcl-direction-operational-console.mjs", [
    "--goal",
    "Repair after teacher correction.",
    "--teacher-command",
    "wrong angle relationship; repair before reuse",
    "--out-dir",
    join(smokeRoot, "consoles")
  ]).parsed;
}

function runContract(args = []) {
  return runNode("create-tlcl-next-route-input-contract.mjs", [
    "--out-dir",
    join(smokeRoot, "contracts"),
    ...args
  ]).parsed;
}

const directionConsole = runConsole();
const fakeAttachmentPath = writeJson(join(smokeRoot, "ready-attachment.json"), {
  format: "transparent_ai_tlcl_rag_evidence_attachment_v1",
  status: "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review",
  approvedDraftRefs: [{ sourceId: "manual.angle", logicExtractionHint: "Angle follows datum alpha.", evidenceRefs: ["retrieval://angle"] }],
  approvedDisabledDraftCount: 1,
  sourceEvidence: {
    tlclPacketPath: join(smokeRoot, "tlcl.json"),
    tlclPacketHash: "sha256:tlcl",
    ragValidationPath: join(smokeRoot, "rag.json"),
    ragValidationHash: "sha256:rag"
  },
  highReasoningReviewHandoff: { mediumRuntimeContinuationAllowed: false },
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
const missingContract = runContract(["--direction-console", directionConsole.packetPath]);
const readyContract = runContract([
  "--direction-console",
  directionConsole.packetPath,
  "--attachment",
  fakeAttachmentPath,
  "--rollback-point",
  join(repoRoot, ".rollback-points", "smoke-retained")
]);

const builder = runNode("create-tlcl-next-route-input-contract-receipt-builder.mjs", [
  "--input-contract",
  missingContract.contractPath,
  "--out-dir",
  join(smokeRoot, "builders")
]).parsed;
const builderPacket = JSON.parse(readFileSync(builder.builderPath, "utf8"));
const missingTemplate = JSON.parse(readFileSync(builder.receiptTemplatePath, "utf8"));

const approveMissingReceiptPath = writeJson(join(smokeRoot, "approve-missing-receipt.json"), {
  ...missingTemplate,
  teacherDecision: "approve_manual_next_route_use",
  blockedShortcutsReviewed: true,
  rollbackRetained: true,
  artifactRows: missingTemplate.artifactRows.map((row) => ({ ...row, teacherReviewed: true }))
});
const approveMissing = runNode("validate-tlcl-next-route-input-contract-receipt.mjs", [
  "--input-contract",
  missingContract.contractPath,
  "--receipt",
  approveMissingReceiptPath,
  "--out-dir",
  join(smokeRoot, "validations")
]).parsed;

const regenReceiptPath = writeJson(join(smokeRoot, "regenerate-receipt.json"), {
  ...missingTemplate,
  teacherDecision: "provide_missing_inputs_for_regeneration",
  blockedShortcutsReviewed: true,
  rollbackRetained: true,
  artifactRows: missingTemplate.artifactRows.map((row) => ({
    ...row,
    teacherReviewed: true,
    proposedValueForRegeneration:
      row.id === "reviewed_tlcl_rag_evidence_attachment"
        ? fakeAttachmentPath
        : row.id === "rollback_point_retained"
          ? join(repoRoot, ".rollback-points", "smoke-retained")
          : ""
  }))
});
const regenReady = runNode("validate-tlcl-next-route-input-contract-receipt.mjs", [
  "--input-contract",
  missingContract.contractPath,
  "--receipt",
  regenReceiptPath,
  "--out-dir",
  join(smokeRoot, "validations")
]).parsed;

const readyBuilder = runNode("create-tlcl-next-route-input-contract-receipt-builder.mjs", [
  "--input-contract",
  readyContract.contractPath,
  "--out-dir",
  join(smokeRoot, "builders-ready")
]).parsed;
const readyTemplate = JSON.parse(readFileSync(readyBuilder.receiptTemplatePath, "utf8"));
const approveReadyReceiptPath = writeJson(join(smokeRoot, "approve-ready-receipt.json"), {
  ...readyTemplate,
  teacherDecision: "approve_manual_next_route_use",
  blockedShortcutsReviewed: true,
  rollbackRetained: true,
  artifactRows: readyTemplate.artifactRows.map((row) => ({ ...row, teacherReviewed: true }))
});
const approveReady = runNode("validate-tlcl-next-route-input-contract-receipt.mjs", [
  "--input-contract",
  readyContract.contractPath,
  "--receipt",
  approveReadyReceiptPath,
  "--out-dir",
  join(smokeRoot, "validations")
]).parsed;

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...readyTemplate,
  teacherDecision: "execute_now",
  blockedShortcutsReviewed: true,
  rollbackRetained: true,
  artifactRows: readyTemplate.artifactRows.map((row) => ({ ...row, teacherReviewed: true }))
});
const forbidden = runNode(
  "validate-tlcl-next-route-input-contract-receipt.mjs",
  ["--input-contract", readyContract.contractPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "validations")],
  true
);

check(
  "Receipt builder writes template and review-only artifacts",
  builder.format === "transparent_ai_tlcl_next_route_input_contract_receipt_builder_result_v1" &&
    existsSync(builder.receiptTemplatePath) &&
    existsSync(builder.readmePath) &&
    existsSync(builder.htmlPath) &&
    builderPacket.locks.doesNotRunNextTool === true &&
    builderPacket.locks.modelInvoked === false,
  builder.receiptTemplatePath
);

check(
  "Validator blocks manual next-route approval while input contract is still missing evidence",
  approveMissing.status === "input_contract_receipt_needs_teacher_review_or_more_evidence" &&
    approveMissing.blockers.includes("contract_not_ready_for_manual_next_route_use") &&
    approveMissing.blockers.includes("contract_still_has_missing_inputs"),
  approveMissing.blockers.join(",")
);

check(
  "Validator can prepare input-contract regeneration handoff from supplied missing inputs",
  regenReady.status === "input_contract_receipt_ready_for_input_contract_regeneration" &&
    regenReady.readyForRegeneration === true &&
    regenReady.inputContractRegenerationHandoff?.executeNow === false &&
    regenReady.inputContractRegenerationHandoff?.suggestedRegenerationCommand.includes("--attachment") &&
    regenReady.inputContractRegenerationHandoff?.suggestedRegenerationCommand.includes("--rollback-point"),
  regenReady.inputContractRegenerationHandoff?.suggestedRegenerationCommand || ""
);

check(
  "Validator approves ready input contract only as manual next-route handoff",
  approveReady.status === "input_contract_receipt_ready_for_manual_next_route_use" &&
    approveReady.readyForManualNextRoute === true &&
    approveReady.manualNextRouteHandoff?.executeNow === false &&
    approveReady.manualNextRouteHandoff?.nextTool === "create_tlcl_rag_informed_high_reasoning_repair_intake",
  approveReady.manualNextRouteHandoff?.suggestedNextCommand || ""
);

check(
  "Validator fails closed on forbidden execute decisions",
  forbidden.statusCode !== 0 &&
    forbidden.parsed.status === "blocked_for_forbidden_decision" &&
    forbidden.parsed.forbiddenDecisionUsed === true &&
    forbidden.parsed.blockers.includes("forbidden_teacher_decision"),
  forbidden.parsed.status || ""
);

check(
  "Receipt validation remains no-op locked",
  [approveMissing, regenReady, approveReady, forbidden.parsed].every(
    (packet) =>
      packet.locks?.reviewOnly === true &&
      packet.locks?.doesNotRunNextTool === true &&
      packet.locks?.doesNotRegenerateInputContract === true &&
      packet.locks?.modelInvoked === false &&
      packet.locks?.ragFetched === false &&
      packet.locks?.targetSoftwareCommandsExecuted === false &&
      packet.locks?.memoryWritten === false &&
      packet.locks?.ruleEnabled === false &&
      packet.locks?.packagingUnlocked === false &&
      packet.locks?.goalComplete === false
  ),
  "next-tool/regeneration/model/RAG/software/memory/rule/packaging/completion locked"
);

const passed = checks.filter((item) => item.pass).length;
const status = passed === checks.length ? "passed" : "failed";
console.log(
  JSON.stringify(
    {
      status,
      smoke: "transparent_ai_tlcl_next_route_input_contract_receipt_smoke_v1",
      passed,
      total: checks.length,
      checks
    },
    null,
    2
  )
);
if (status !== "passed") process.exit(1);
