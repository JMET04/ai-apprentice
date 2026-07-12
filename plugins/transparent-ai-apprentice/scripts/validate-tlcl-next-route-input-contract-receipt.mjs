#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-input-contract-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-input-contract-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["provide_missing_inputs_for_regeneration", "provide_inputs", "regenerate_input_contract"].includes(decision)) {
    return "provide_missing_inputs_for_regeneration";
  }
  if (["approve_manual_next_route_use", "ready_for_manual_next_route", "approve_next_route"].includes(decision)) {
    return "approve_manual_next_route_use";
  }
  if (["blocked", "needs_teacher_review", "correction_to_high_reasoning_repair"].includes(decision)) return decision;
  if (["accepted", "execute_now", "run_next_tool", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    doesNotRegenerateInputContract: true,
    doesNotRunNextTool: true,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  };
}

function commandForRegeneration(contract, receipt) {
  const parts = [
    "node",
    "plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs",
    "--direction-console",
    `"${contract.directionConsolePath || "<direction-console.json>"}"`
  ];
  for (const row of receipt.artifactRows || []) {
    const value = String(row.proposedValueForRegeneration || row.suppliedEvidencePath || "").trim();
    if (!value) continue;
    if (row.id === "reviewed_tlcl_rag_evidence_attachment") parts.push("--attachment", `"${value}"`);
    if (row.id === "rollback_point_retained") parts.push("--rollback-point", `"${value}"`);
    if (row.id === "tlcl_packet_path") parts.push("--tlcl-packet", `"${value}"`);
    if (row.id === "reviewed_rag_validation_path") parts.push("--rag-validation", `"${value}"`);
    if (row.id === "teacher_confirmation" || row.id === "teacher_route_choice") parts.push("--teacher-confirmation", `"${value}"`);
    if (row.id === "reasoning_budget_review") parts.push("--reasoning-budget-review", `"${value}"`);
    if (row.id === "reusable_workflow_activation") parts.push("--activation-validation", `"${value}"`);
  }
  return parts.join(" ");
}

const goal = argValue("--goal", "Validate a teacher receipt for a TLCL next-route input contract.");
const contractInput = readJsonInput(
  argValue("--input-contract", argValue("--contract", "")),
  "--input-contract",
  "transparent_ai_tlcl_next_route_input_contract_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_next_route_input_contract_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-input-contract-receipt-validations"))
);
const contract = contractInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set(["accepted", "execute_now", "run_next_tool", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);
const blockers = [];
const contractArtifactIds = new Set((contract.requiredArtifacts || []).map((item) => item.id));
const receiptRows = Array.isArray(receipt.artifactRows) ? receipt.artifactRows : [];
const receiptRowById = new Map(receiptRows.map((row) => [row.id, row]));

if (receipt.contractId !== contract.contractId) blockers.push("receipt_contract_id_mismatch");
if (receipt.routeId !== (contract.route?.id || "")) blockers.push("receipt_route_id_mismatch");
if (receipt.nextTool !== contract.nextTool) blockers.push("receipt_next_tool_mismatch");
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (receipt.blockedShortcutsReviewed !== true) blockers.push("blocked_shortcuts_not_reviewed");
if (!receiptRows.length) blockers.push("receipt_has_no_artifact_rows");
for (const id of contractArtifactIds) {
  if (!receiptRowById.has(id)) blockers.push(`missing_receipt_artifact_row:${id}`);
}

const missingIds = contract.missingInputs || [];
const proposedMissingRows = missingIds.filter((id) => {
  const row = receiptRowById.get(id);
  return row && String(row.proposedValueForRegeneration || row.suppliedEvidencePath || "").trim();
});
const allMissingInputsProposed = missingIds.length > 0 && proposedMissingRows.length === missingIds.length;

if (decision === "provide_missing_inputs_for_regeneration" && !allMissingInputsProposed) {
  blockers.push("not_all_missing_inputs_have_proposed_values");
}

if (decision === "approve_manual_next_route_use") {
  if (contract.readyForNextTool !== true) blockers.push("contract_not_ready_for_manual_next_route_use");
  if ((contract.missingInputs || []).length) blockers.push("contract_still_has_missing_inputs");
  for (const artifact of contract.requiredArtifacts || []) {
    const row = receiptRowById.get(artifact.id);
    if (artifact.required && artifact.satisfied !== true) blockers.push(`contract_required_artifact_not_satisfied:${artifact.id}`);
    if (artifact.required && row?.teacherReviewed !== true) blockers.push(`artifact_not_teacher_reviewed:${artifact.id}`);
  }
  if ((contract.requiredArtifacts || []).some((item) => item.id.includes("rollback")) && receipt.rollbackRetained !== true) {
    blockers.push("rollback_not_retained");
  }
}

if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherNote || "").trim()) {
  blockers.push("teacher_correction_note_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForRegeneration =
  decision === "provide_missing_inputs_for_regeneration" && allMissingInputsProposed && !forbiddenDecisionUsed;
const readyForManualNextRoute = decision === "approve_manual_next_route_use" && blockers.length === 0;
const escalateToHighReasoning = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyForManualNextRoute
    ? "input_contract_receipt_ready_for_manual_next_route_use"
    : readyForRegeneration
      ? "input_contract_receipt_ready_for_input_contract_regeneration"
      : escalateToHighReasoning
        ? "input_contract_receipt_routes_to_high_reasoning_correction"
        : "input_contract_receipt_needs_teacher_review_or_more_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(contract.route?.id || goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-next-route-input-contract-receipt-validation.json");
const readmePath = join(validationDir, "TLCL_NEXT_ROUTE_INPUT_CONTRACT_RECEIPT_VALIDATION_START_HERE.md");
const manualNextRouteHandoff = readyForManualNextRoute
  ? {
      format: "transparent_ai_tlcl_next_route_manual_handoff_v1",
      routeId: contract.route?.id || "",
      nextTool: contract.nextTool,
      executeNow: false,
      suggestedNextCommand: contract.suggestedNextCommand,
      sourceContractPath: contractInput.path,
      sourceReceiptPath: receiptInput.path
    }
  : null;
const inputContractRegenerationHandoff = readyForRegeneration
  ? {
      format: "transparent_ai_tlcl_next_route_input_contract_regeneration_handoff_v1",
      routeId: contract.route?.id || "",
      executeNow: false,
      suggestedRegenerationCommand: commandForRegeneration(contract, receipt),
      missingInputsCovered: proposedMissingRows
    }
  : null;
const highReasoningCorrectionHandoff = escalateToHighReasoning
  ? {
      format: "transparent_ai_tlcl_next_route_high_reasoning_correction_handoff_v1",
      routeId: contract.route?.id || "",
      nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
      teacherCorrection: receipt.teacherNote,
      executeNow: false
    }
  : null;
const validation = {
  format: "transparent_ai_tlcl_next_route_input_contract_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForRegeneration,
  readyForManualNextRoute,
  escalateToHighReasoning,
  forbiddenDecisionUsed,
  blockers,
  manualNextRouteHandoff,
  inputContractRegenerationHandoff,
  highReasoningCorrectionHandoff,
  blockedTransitions: [
    "run_next_tool_from_receipt_validation",
    "regenerate_input_contract_from_receipt_validation",
    "execute_target_software_from_receipt_validation",
    "treat_rag_as_authority_from_receipt_validation",
    "enable_rule_from_receipt_validation",
    "write_memory_from_receipt_validation",
    "unlock_packaging_from_receipt_validation",
    "claim_completion_from_receipt_validation"
  ],
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourceContract: contractInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
writeJson(validationPath, validation);
writeFileSync(
  readmePath,
  [
    "# TLCL Next Route Input Contract Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation does not regenerate the input contract, run the next tool, execute software, treat RAG as authority, enable rules, write memory, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_input_contract_receipt_validation_result_v1",
      status,
      decision,
      readyForRegeneration,
      readyForManualNextRoute,
      escalateToHighReasoning,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      readmePath,
      manualNextRouteHandoff,
      inputContractRegenerationHandoff,
      highReasoningCorrectionHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
