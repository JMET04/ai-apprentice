#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
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
    String(value || "tlcl-next-route-evidence-plan-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["provide_evidence_for_input_contract_regeneration", "provide_evidence", "ready_for_regeneration"].includes(decision)) {
    return "provide_evidence_for_input_contract_regeneration";
  }
  if (["acknowledge_no_missing_inputs", "no_missing_inputs"].includes(decision)) return "acknowledge_no_missing_inputs";
  if (["blocked", "needs_teacher_review", "correction_to_high_reasoning_repair"].includes(decision)) return decision;
  if (
    [
      "accepted",
      "execute_now",
      "run_next_tool",
      "regenerate_input_contract",
      "fetch_rag",
      "invoke_model",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "claim_complete"
    ].includes(decision)
  ) {
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

function commandForRegeneration(plan, receipt) {
  const parts = [
    "node",
    "plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs",
    "--direction-console",
    `"${plan.regenerationCommandTemplate?.match(/--direction-console \"([^\"]+)\"/)?.[1] || "<tlcl-direction-operational-console.json>"}"`
  ];
  for (const row of receipt.evidenceRows || []) {
    const value = String(row.suppliedValueForInputContract || "").trim();
    if (!value) continue;
    if (row.missingInputId === "reviewed_tlcl_rag_evidence_attachment") parts.push("--attachment", `"${value}"`);
    if (row.missingInputId === "rollback_point_retained") parts.push("--rollback-point", `"${value}"`);
    if (row.missingInputId === "tlcl_packet_path") parts.push("--tlcl-packet", `"${value}"`);
    if (row.missingInputId === "reviewed_rag_validation_path") parts.push("--rag-validation", `"${value}"`);
    if (row.missingInputId === "teacher_confirmation" || row.missingInputId === "teacher_route_choice") {
      parts.push("--teacher-confirmation", `"${value}"`);
    }
    if (row.missingInputId === "reasoning_budget_review") parts.push("--reasoning-budget-review", `"${value}"`);
    if (row.missingInputId === "reusable_workflow_activation") parts.push("--activation-validation", `"${value}"`);
  }
  return parts.join(" ");
}

const goal = argValue("--goal", "Validate a teacher receipt for a TLCL next-route evidence acquisition plan.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--evidence-plan", "")),
  "--plan",
  "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-receipt-validations"))
);
const plan = planInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "execute_now",
  "run_next_tool",
  "regenerate_input_contract",
  "fetch_rag",
  "invoke_model",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
const planRowIds = new Set((plan.actionRows || []).map((row) => row.missingInputId));
const receiptRows = Array.isArray(receipt.evidenceRows) ? receipt.evidenceRows : [];
const receiptRowById = new Map(receiptRows.map((row) => [row.missingInputId, row]));
const needsRagEvidenceOnlyConfirmation = [...planRowIds].some((id) =>
  ["reviewed_tlcl_rag_evidence_attachment", "reviewed_rag_validation_path", "tlcl_packet_path", "teacher_confirmation"].includes(id)
);
const needsRollback = [...planRowIds].some((id) => id === "rollback_point_retained");

if (receipt.planId !== plan.planId) blockers.push("receipt_plan_id_mismatch");
if (receipt.routeId !== plan.routeId) blockers.push("receipt_route_id_mismatch");
if (receipt.nextTool !== plan.nextTool) blockers.push("receipt_next_tool_mismatch");
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (receipt.blockedShortcutsReviewed !== true) blockers.push("blocked_shortcuts_not_reviewed");
for (const id of planRowIds) {
  const row = receiptRowById.get(id);
  if (!row) {
    blockers.push(`missing_receipt_evidence_row:${id}`);
    continue;
  }
  if (decision === "provide_evidence_for_input_contract_regeneration") {
    if (row.teacherReviewed !== true) blockers.push(`evidence_row_not_teacher_reviewed:${id}`);
    if (row.boundaryReviewed !== true) blockers.push(`evidence_boundary_not_reviewed:${id}`);
    if (!String(row.suppliedValueForInputContract || "").trim()) blockers.push(`evidence_value_missing:${id}`);
  }
}
if (needsRagEvidenceOnlyConfirmation && receipt.ragEvidenceOnlyConfirmed !== true) {
  blockers.push("rag_evidence_only_not_confirmed");
}
if (needsRollback && receipt.rollbackRetained !== true) {
  blockers.push("rollback_not_retained");
}
if (decision === "provide_evidence_for_input_contract_regeneration" && planRowIds.size === 0) {
  blockers.push("plan_has_no_missing_evidence_rows_for_regeneration");
}
if (decision === "acknowledge_no_missing_inputs" && planRowIds.size !== 0) {
  blockers.push("cannot_acknowledge_no_missing_inputs_while_plan_has_action_rows");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherNote || "").trim()) {
  blockers.push("teacher_correction_note_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForInputContractRegeneration =
  decision === "provide_evidence_for_input_contract_regeneration" && blockers.length === 0;
const acknowledgedNoMissingInputs = decision === "acknowledge_no_missing_inputs" && blockers.length === 0;
const correctionToHighReasoning = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyForInputContractRegeneration
    ? "evidence_plan_receipt_ready_for_input_contract_regeneration"
    : acknowledgedNoMissingInputs
      ? "evidence_plan_receipt_acknowledges_no_missing_inputs"
      : correctionToHighReasoning
        ? "evidence_plan_receipt_routes_to_high_reasoning_correction"
        : "evidence_plan_receipt_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(plan.routeId || goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-next-route-evidence-plan-receipt-validation.json");
const readmePath = join(validationDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_RECEIPT_VALIDATION_START_HERE.md");
const regenerationHandoff = readyForInputContractRegeneration
  ? {
      format: "transparent_ai_tlcl_next_route_evidence_plan_input_contract_regeneration_handoff_v1",
      routeId: plan.routeId || "",
      nextTool: "create_tlcl_next_route_input_contract",
      executeNow: false,
      suggestedRegenerationCommand: commandForRegeneration(plan, receipt),
      evidenceRowsUsed: receiptRows.map((row) => ({
        missingInputId: row.missingInputId,
        suppliedValueForInputContract: row.suppliedValueForInputContract || "",
        teacherReviewed: Boolean(row.teacherReviewed),
        boundaryReviewed: Boolean(row.boundaryReviewed)
      }))
    }
  : null;
const validation = {
  format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForInputContractRegeneration,
  acknowledgedNoMissingInputs,
  correctionToHighReasoning,
  forbiddenDecisionUsed,
  blockers,
  regenerationHandoff,
  highReasoningCorrectionHandoff: correctionToHighReasoning
    ? {
        format: "transparent_ai_tlcl_next_route_evidence_plan_high_reasoning_correction_handoff_v1",
        routeId: plan.routeId || "",
        teacherCorrection: receipt.teacherNote || "",
        executeNow: false
      }
    : null,
  blockedTransitions: [
    "regenerate_input_contract_from_evidence_plan_receipt_validation",
    "run_next_tool_from_evidence_plan_receipt_validation",
    "fetch_rag_from_evidence_plan_receipt_validation",
    "invoke_model_from_evidence_plan_receipt_validation",
    "execute_target_software_from_evidence_plan_receipt_validation",
    "treat_rag_as_authority_from_evidence_plan_receipt_validation",
    "enable_rule_from_evidence_plan_receipt_validation",
    "write_memory_from_evidence_plan_receipt_validation",
    "unlock_packaging_from_evidence_plan_receipt_validation",
    "claim_completion_from_evidence_plan_receipt_validation"
  ],
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourcePlan: planInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};

writeJson(validationPath, validation);
writeFileSync(
  readmePath,
  [
    "# TLCL Next-Route Evidence Plan Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation prepares only a manual input-contract regeneration handoff or a blocker report.",
    "It does not regenerate the input contract, run the next tool, invoke models, fetch RAG, execute software, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_result_v1",
      status,
      decision,
      readyForInputContractRegeneration,
      acknowledgedNoMissingInputs,
      correctionToHighReasoning,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      readmePath,
      regenerationHandoff,
      executeNow: false,
      locks: validation.locks
    },
    null,
    2
  )
);
