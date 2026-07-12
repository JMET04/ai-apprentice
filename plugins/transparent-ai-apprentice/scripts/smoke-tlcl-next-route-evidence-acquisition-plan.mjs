#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-evidence-acquisition-plan");

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runPlan(contractPath, name) {
  const outDir = join(smokeRoot, name);
  const result = spawnSync(
    process.execPath,
    [
      join(pluginRoot, "scripts", "create-tlcl-next-route-evidence-acquisition-plan.mjs"),
      "--input-contract",
      contractPath,
      "--out-dir",
      outDir
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`plan failed: ${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  return { result: parsed, plan: readJson(parsed.planPath) };
}

const baseLocks = {
  reviewOnly: true,
  inputContractOnly: true,
  modelInvoked: false,
  ragFetched: false,
  nextToolExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  ruleEnabled: false,
  accepted: false,
  packagingUnlocked: false,
  goalComplete: false
};

const repairContractPath = writeJson(join(smokeRoot, "repair-contract.json"), {
  format: "transparent_ai_tlcl_next_route_input_contract_v1",
  contractId: "smoke-repair-contract",
  status: "next_route_inputs_missing_required_evidence",
  readyForNextTool: false,
  directionConsolePath: join(smokeRoot, "direction-console.json"),
  route: {
    id: "route_to_highest_reasoning_contract_repair",
    label: "Return correction to highest-reasoning contract repair",
    nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
    reasoningTier: "senior_reasoning_compile"
  },
  nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
  requiredArtifacts: [
    {
      id: "reviewed_tlcl_rag_evidence_attachment",
      label: "Reviewed TLCL RAG evidence attachment",
      required: true,
      expectedFormat: "transparent_ai_tlcl_rag_evidence_attachment_v1",
      supplied: false,
      path: "",
      satisfied: false,
      missingReason: "not_supplied"
    },
    {
      id: "rollback_point_retained",
      label: "Retained rollback point before repair work",
      required: true,
      expectedFormat: "filesystem path or rollback manifest path",
      supplied: false,
      path: "",
      satisfied: false,
      missingReason: "not_supplied"
    }
  ],
  missingInputs: ["reviewed_tlcl_rag_evidence_attachment", "rollback_point_retained"],
  locks: baseLocks
});

const ragContractPath = writeJson(join(smokeRoot, "rag-route-contract.json"), {
  format: "transparent_ai_tlcl_next_route_input_contract_v1",
  contractId: "smoke-rag-route-contract",
  status: "next_route_inputs_missing_required_evidence",
  readyForNextTool: false,
  directionConsolePath: join(smokeRoot, "direction-console.json"),
  route: {
    id: "route_to_rag_evidence_then_contract_compile",
    label: "Collect RAG evidence before contract compile",
    nextTool: "create_tlcl_rag_evidence_attachment",
    reasoningTier: "senior_reasoning_compile"
  },
  nextTool: "create_tlcl_rag_evidence_attachment",
  requiredArtifacts: [
    { id: "tlcl_packet_path", label: "Current TLCL packet path", required: true, satisfied: false },
    { id: "reviewed_rag_validation_path", label: "Reviewed RAG validation result path", required: true, satisfied: false },
    { id: "teacher_confirmation", label: "Teacher confirmation that RAG is evidence only", required: true, satisfied: false }
  ],
  missingInputs: ["tlcl_packet_path", "reviewed_rag_validation_path", "teacher_confirmation"],
  locks: baseLocks
});

const readyContractPath = writeJson(join(smokeRoot, "ready-contract.json"), {
  format: "transparent_ai_tlcl_next_route_input_contract_v1",
  contractId: "smoke-ready-contract",
  status: "next_route_inputs_ready_for_manual_handoff",
  readyForNextTool: true,
  directionConsolePath: join(smokeRoot, "direction-console.json"),
  route: {
    id: "route_to_highest_reasoning_contract_repair",
    label: "Return correction to highest-reasoning contract repair",
    nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
    reasoningTier: "senior_reasoning_compile"
  },
  nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
  requiredArtifacts: [
    {
      id: "reviewed_tlcl_rag_evidence_attachment",
      label: "Reviewed TLCL RAG evidence attachment",
      required: true,
      supplied: true,
      path: join(smokeRoot, "attachment.json"),
      satisfied: true
    },
    {
      id: "rollback_point_retained",
      label: "Retained rollback point before repair work",
      required: true,
      supplied: true,
      path: join(smokeRoot, "rollback"),
      satisfied: true
    }
  ],
  missingInputs: [],
  suggestedNextCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-rag-informed-high-reasoning-repair-intake.mjs --attachment "<tlcl-rag-evidence-attachment.json>"',
  locks: baseLocks
});

const repair = runPlan(repairContractPath, "repair");
const rag = runPlan(ragContractPath, "rag");
const ready = runPlan(readyContractPath, "ready");
const repairSerialized = JSON.stringify(repair.plan);
const ragSerialized = JSON.stringify(rag.plan);
const readySerialized = JSON.stringify(ready.plan);

const checks = [
  {
    name: "Repair route creates evidence acquisition plan for RAG attachment and rollback",
    pass:
      repair.result.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_result_v1" &&
      repair.plan.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1" &&
      repair.plan.status === "evidence_acquisition_plan_ready_for_teacher_review" &&
      repair.plan.actionRows.some((row) => row.missingInputId === "reviewed_tlcl_rag_evidence_attachment") &&
      repair.plan.actionRows.some((row) => row.missingInputId === "rollback_point_retained") &&
      repairSerialized.includes("create-tlcl-rag-evidence-attachment.mjs") &&
      repairSerialized.includes("create-tlcl-next-route-input-contract.mjs") &&
      repair.plan.locks.modelInvoked === false &&
      repair.plan.locks.ragFetched === false &&
      repair.plan.locks.nextToolExecuted === false &&
      repair.plan.nextReviewHandoff.executeNow === false,
    evidence: repairSerialized.slice(0, 900)
  },
  {
    name: "RAG route reuses reviewed RAG lane without external fetch or authority shortcut",
    pass:
      rag.plan.missingInputs.includes("tlcl_packet_path") &&
      rag.plan.missingInputs.includes("reviewed_rag_validation_path") &&
      rag.plan.missingInputs.includes("teacher_confirmation") &&
      ragSerialized.includes("knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs") &&
      ragSerialized.includes("RAG is evidence only") &&
      rag.plan.locks.ragFetched === false &&
      rag.plan.locks.ruleEnabled === false &&
      rag.plan.locks.packagingUnlocked === false,
    evidence: ragSerialized.slice(0, 900)
  },
  {
    name: "Ready contract produces no acquisition actions and still refuses execution",
    pass:
      ready.plan.status === "no_missing_evidence_inputs_waiting_for_manual_next_route_receipt" &&
      ready.plan.actionRows.length === 0 &&
      ready.plan.nextReviewHandoff.executeNow === false &&
      ready.plan.locks.nextToolExecuted === false &&
      ready.plan.locks.targetSoftwareCommandsExecuted === false &&
      readySerialized.includes("validate_tlcl_next_route_input_contract_receipt"),
    evidence: readySerialized.slice(0, 900)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  checks,
  paths: {
    repair: repair.result.planPath,
    rag: rag.result.planPath,
    ready: ready.result.planPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
