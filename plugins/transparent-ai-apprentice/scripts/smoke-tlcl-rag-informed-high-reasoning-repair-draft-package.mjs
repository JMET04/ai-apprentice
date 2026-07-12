#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-rag-informed-high-reasoning-repair-draft-package-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const tlclPacketPath = writeJson(join(smokeRoot, "tlcl-repair-packet.json"), {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
  status: "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair",
  decision: "correction_to_high_reasoning_repair",
  mediumRuntimeWorkflowEnabled: false,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const planningLogicEvidence = {
  query: "packaging dieline fold allowance rule",
  logicExtractionHint: "fold allowance depends on material thickness, print-side orientation, and scored fold angle"
};
const readyRagValidationPath = writeJson(join(smokeRoot, "ready-rag-validation.json"), {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  status: "ready_for_review_only_rule_dsl_validation",
  planningLogicEvidence,
  planningLogicEvidenceHash: sha256Object(planningLogicEvidence),
  approvedDisabledDrafts: [
    {
      sourceId: "manual.packaging.001",
      retrievalPath: join(smokeRoot, "retrieval-evidence-packet.json"),
      rulePath: join(smokeRoot, "draft-disabled-rule-card.json"),
      ruleLifecycle: "draft_disabled",
      logicExtractionHint: planningLogicEvidence.logicExtractionHint,
      logicFitDecision: "matches_intended_logic",
      evidenceRefs: ["retrieval://manual.packaging.001/chunk.001"],
      reviewerNote: "Use as evidence for high-reasoning contract repair only."
    }
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
});

const attachment = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  readyRagValidationPath,
  "--out-dir",
  join(smokeRoot, "attachment")
]);
const intake = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
  "--attachment",
  attachment.attachmentPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const blockedIntakePath = writeJson(join(smokeRoot, "blocked-intake.json"), {
  ...readJson(intake.intakePath),
  status: "blocked_before_tlcl_rag_informed_high_reasoning_repair_intake",
  readyForTeacherReview: false
});
const unsafeIntakePath = writeJson(join(smokeRoot, "unsafe-intake.json"), {
  ...readJson(intake.intakePath),
  readyForMediumRuntime: true,
  locks: {
    ...readJson(intake.intakePath).locks,
    ruleEnabled: true
  }
});

const ready = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  intake.intakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const blocked = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  blockedIntakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const unsafe = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  unsafeIntakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const readyPackage = readJson(ready.draftPackagePath);
const compiledPackage = readJson(ready.compiledRulePackagePath);

const checks = [
  check(
    "RAG-informed repair draft package compiles only draft_disabled evidence-bound rules",
    ready.status === "tlcl_rag_informed_high_reasoning_repair_draft_package_ready_for_teacher_review" &&
      ready.draftDisabledRuleCount === 1 &&
      compiledPackage.rules.length === 1 &&
      compiledPackage.rules.every((rule) => rule.lifecycle === "draft_disabled") &&
      readyPackage.draftDisabledRules[0].evidenceRefs.some((ref) => ref.includes("retrieval://manual.packaging.001")),
    ready.compiledRulePackagePath
  ),
  check(
    "RAG-informed repair draft package preserves teacher questions and validator expectations",
    ready.teacherQuestionCount >= 3 &&
      readyPackage.teacherQuestionHandoff.length >= 3 &&
      readyPackage.deterministicValidationPlan.validatorExpectations.some((item) =>
        item.includes("Every repair clause cites at least one reviewed RAG evidence row")
      ),
    JSON.stringify(readyPackage.deterministicValidationPlan)
  ),
  check(
    "RAG-informed repair draft package blocks unready intake",
    blocked.status === "blocked_before_tlcl_rag_informed_high_reasoning_repair_draft_package" &&
      blocked.draftDisabledRuleCount === 0 &&
      blocked.targetSoftwareCommandsExecuted === false &&
      blocked.ruleEnabled === false,
    blocked.draftPackagePath
  ),
  check(
    "RAG-informed repair draft package blocks medium-runtime or rule-enabled unsafe intake",
    unsafe.status === "blocked_before_tlcl_rag_informed_high_reasoning_repair_draft_package" &&
      unsafe.readyForMediumRuntime === false &&
      unsafe.mediumRuntimeContinued === false &&
      unsafe.memoryWritten === false &&
      unsafe.packagingUnlocked === false,
    unsafe.draftPackagePath
  ),
  check(
    "RAG-informed repair draft package keeps RAG evidence non-authoritative",
    ready.activeRulePackageCompiled === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.mediumRuntimeContinued === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false &&
      readyPackage.forbiddenTransitions.includes("treat_rag_as_authority_from_draft_package") &&
      readyPackage.locks.mediumRuntimeContinuationBlocked === true,
    JSON.stringify(readyPackage.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyDraftPackagePath: ready.draftPackagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
