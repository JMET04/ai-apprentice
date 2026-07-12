#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { hashText, readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-evidence-request-logic-context");
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

const planningLogicEvidence = {
  logicExtractionHints: [
    {
      logicExtractionHint:
        "Preserve the teacher-confirmed data-to-geometry relationship before requesting more primary sources.",
      sourceKind: "teacher_confirmed_planning_logic"
    }
  ],
  logicEvidenceReviews: [
    {
      itemId: "review_primary_source_logic_evidence",
      decision: "logic_evidence_confirmed",
      logicEvidenceReviewed: true,
      logicFitDecisionConfirmed: true,
      reviewerNote: "Teacher confirmed that new sources must preserve the data-to-geometry planning logic."
    }
  ]
};
const planningLogicEvidenceHash = hashText(JSON.stringify(planningLogicEvidence));
const planningPacketPath = join(root, "fixture-selected-follow-up-planning-packet-with-logic-context.json");
const planningPacket = {
  format: "transparent_ai_rag_selected_follow_up_planning_packet_v1",
  planningId: "rag_selected_follow_up_planning_packet.fixture.primary_source_logic_context",
  status: "selected_follow_up_planning_ready_for_teacher_review",
  selectedFollowUpDecision: "request_more_primary_sources",
  selectedFollowUp: {
    itemId: "choose_next_review_only_rag_step",
    selectedFollowUpDecision: "request_more_primary_sources",
    reviewerNote: "Teacher selected primary-source follow-up after confirming planning logic."
  },
  logicExtractionHints: planningLogicEvidence.logicExtractionHints,
  logicEvidenceReviews: planningLogicEvidence.logicEvidenceReviews,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  plannedItems: [
    {
      itemId: "prepare_primary_source_evidence_request",
      kind: "teacher_evidence_request",
      instruction: "Ask the teacher for primary sources that support the confirmed data-to-geometry logic.",
      expectedTeacherInput: "Local source paths or pasted source excerpts.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    }
  ],
  nextReview: {
    mayFetchExternalSources: false,
    mayExecuteSoftware: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false,
    planningLogicEvidence: structuredClone(planningLogicEvidence),
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    deliveryGateOpen: false,
    rollbackRetained: true
  }
};
writeJson(planningPacketPath, planningPacket);

const builderRun = runKnowledge("create-rag-primary-source-evidence-request-receipt-builder.mjs", [
  "--planning-packet",
  planningPacketPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!receipt.requestContext.planningLogicEvidence.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source evidence request should expose upstream planning logic hints.");
}
if (receipt.requestContext.planningLogicEvidence.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source evidence request should expose confirmed upstream logic evidence reviews.");
}
if (!receipt.planningLogicEvidenceHash || receipt.planningLogicEvidenceHash !== receipt.requestContext.planningLogicEvidenceHash) {
  throw new Error("Primary-source evidence request should carry a stable planning logic evidence hash.");
}
if (receipt.planningLogicEvidenceHash !== planningPacket.planningLogicEvidenceHash) {
  throw new Error("Primary-source evidence request should preserve the upstream planning packet logic hash.");
}

const teacherSourcePath = join(root, "teacher-primary-source-logic-context-note.md");
writeFileSync(
  teacherSourcePath,
  [
    "# Teacher Primary Source Logic Context",
    "",
    "New sources should preserve the confirmed data-to-output relationship from the planning packet."
  ].join("\n"),
  "utf8"
);

receipt.decision = "teacher_provided_primary_sources";
receipt.providedSources = [
  {
    sourceId: "teacher_primary_source_logic_context_note",
    title: "Teacher primary source logic context note",
    uri: teacherSourcePath,
    sourceType: "teacher_note",
    domain: "engineering_logic_learning",
    trustLevelAfterReview: "teacher_supplied",
    permissionStatus: "teacher_supplied",
    evidenceReviewed: true,
    reviewOnlyBoundaryReviewed: true,
    logicExtractionHint: "Extend the confirmed data-to-geometry logic with source-backed dimensions and angles.",
    reviewerNote: "Teacher supplied an additional source that must stay aligned to the confirmed planning logic evidence."
  }
];
const receiptPath = join(root, "teacher-primary-source-logic-context-receipt.json");
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

if (!validation.planningLogicEvidence.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source evidence validation should preserve planning logic evidence hints.");
}
if (validation.nextReview.planningLogicEvidence.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source evidence validation should carry confirmed planning logic reviews forward.");
}
if (validation.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source evidence validation should preserve the planning logic evidence hash.");
}

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.requestContext.planningLogicEvidence.logicExtractionHints = [];
const tamperedReceiptPath = join(root, "tampered-planning-logic-evidence-receipt.json");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tamperedRun = runKnowledge(
  "validate-rag-primary-source-evidence-request-receipt.mjs",
  ["--planning-packet", planningPacketPath, "--receipt", tamperedReceiptPath, "--out-dir", join(root, "tampered-validation")],
  false
);
if (!tamperedRun.stdout.includes("PRIMARY_SOURCE_REQUEST_CONTEXT_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source evidence validation must reject tampered planning logic evidence context.");
}

const tamperedPlanningPacket = structuredClone(planningPacket);
tamperedPlanningPacket.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedPlanningPacketPath = join(root, "tampered-planning-packet-logic-context.json");
writeJson(tamperedPlanningPacketPath, tamperedPlanningPacket);
const tamperedPlanningRun = runKnowledge(
  "create-rag-primary-source-evidence-request-receipt-builder.mjs",
  ["--planning-packet", tamperedPlanningPacketPath, "--out-dir", join(root, "tampered-planning-builder")],
  false
);
const tamperedPlanningOutput = `${tamperedPlanningRun.stdout}\n${tamperedPlanningRun.stderr}`;
if (
  !tamperedPlanningOutput.includes("RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH")
) {
  throw new Error("Primary-source evidence request builder must reject tampered planning packet next-review logic evidence.");
}

const tamperedPlanningPacketHash = structuredClone(planningPacket);
tamperedPlanningPacketHash.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedPlanningPacketHashPath = join(root, "tampered-planning-packet-logic-context-hash.json");
writeJson(tamperedPlanningPacketHashPath, tamperedPlanningPacketHash);
const tamperedPlanningHashRun = runKnowledge(
  "create-rag-primary-source-evidence-request-receipt-builder.mjs",
  ["--planning-packet", tamperedPlanningPacketHashPath, "--out-dir", join(root, "tampered-planning-builder-hash")],
  false
);
const tamperedPlanningHashOutput = `${tamperedPlanningHashRun.stdout}\n${tamperedPlanningHashRun.stderr}`;
if (
  !tamperedPlanningHashOutput.includes("RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH")
) {
  throw new Error("Primary-source evidence request builder must reject tampered planning packet next-review logic evidence hash.");
}

const tamperedValidationPlanningPacket = structuredClone(planningPacket);
tamperedValidationPlanningPacket.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedValidationPlanningPacketPath = join(root, "tampered-validation-planning-packet-next-review-logic-context.json");
writeJson(tamperedValidationPlanningPacketPath, tamperedValidationPlanningPacket);
const tamperedValidationPlanningRun = runKnowledge(
  "validate-rag-primary-source-evidence-request-receipt.mjs",
  [
    "--planning-packet",
    tamperedValidationPlanningPacketPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-validation-planning-packet")
  ],
  false
);
if (
  !`${tamperedValidationPlanningRun.stdout}\n${tamperedValidationPlanningRun.stderr}`.includes(
    "PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source evidence validation must reject tampered planning packet next-review logic evidence.");
}

const tamperedValidationPlanningPacketHash = structuredClone(planningPacket);
tamperedValidationPlanningPacketHash.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedValidationPlanningPacketHashPath = join(
  root,
  "tampered-validation-planning-packet-next-review-logic-context-hash.json"
);
writeJson(tamperedValidationPlanningPacketHashPath, tamperedValidationPlanningPacketHash);
const tamperedValidationPlanningHashRun = runKnowledge(
  "validate-rag-primary-source-evidence-request-receipt.mjs",
  [
    "--planning-packet",
    tamperedValidationPlanningPacketHashPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-validation-planning-packet-hash")
  ],
  false
);
if (
  !`${tamperedValidationPlanningHashRun.stdout}\n${tamperedValidationPlanningHashRun.stderr}`.includes(
    "PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source evidence validation must reject tampered planning packet next-review logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_evidence_request_logic_context_smoke_v1",
      planningPacketPath,
      templatePath: builder.templatePath,
      validationPath: validationResult.validationPath,
      preservedPlanningLogicEvidence: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedPlanningPacketNextReviewLogicEvidence: true,
      rejectedTamperedPlanningPacketNextReviewLogicEvidenceHash: true,
      rejectedTamperedValidationPlanningPacketNextReviewLogicEvidence: true,
      rejectedTamperedValidationPlanningPacketNextReviewLogicEvidenceHash: true,
      locks: validation.locks
    },
    null,
    2
  )
);
