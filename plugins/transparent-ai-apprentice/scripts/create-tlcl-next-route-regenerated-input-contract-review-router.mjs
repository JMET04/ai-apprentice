#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (
    parsed.value?.format ===
      "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_result_v1" &&
    parsed.value?.validationPath &&
    existsSync(parsed.value.validationPath)
  ) {
    return { value: readJson(resolve(parsed.value.validationPath)), path: resolve(parsed.value.validationPath) };
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-regenerated-input-contract-review-router")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-regenerated-input-contract-review-router"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    routerOnly: true,
    routerDoesNotValidateTeacherSelection: true,
    routerDoesNotBuildInputContractReceipt: true,
    routerDoesNotRunNextTool: true,
    routerDoesNotRegenerateInputContract: true,
    routerDoesNotInvokeModel: true,
    routerDoesNotFetchRag: true,
    routerDoesNotWriteMemory: true,
    routerDoesNotEnableRule: true,
    routerDoesNotUnlockPackaging: true,
    inputContractReceiptBuilt: false,
    nextToolExecuted: false,
    inputContractRegenerated: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  };
}

function candidateRows(validation) {
  const rows = [];
  if (validation?.readyForNextRouteContractReview === true && validation?.reviewedRegeneratedInputContract) {
    rows.push({
      route: "build_input_contract_receipt_for_regenerated_contract",
      label: "Review regenerated input contract through the normal input-contract receipt gate",
      nextTool: "create_tlcl_next_route_input_contract_receipt_builder",
      reason:
        "The manual regeneration result is ready, but the regenerated input contract still needs the normal teacher receipt gate before any route handoff.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract-receipt-builder.mjs --input-contract "' +
        validation.reviewedRegeneratedInputContract.inputContractPath +
        '"',
      requiredTeacherEvidence: [
        "teacher_selected_this_route",
        "regenerated_input_contract_still_reviewed",
        "no_execution_confirmed",
        "retained_rollback_confirmed"
      ],
      targetReasoningTier: "medium_or_route_specific_after_teacher_contract_receipt",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    });
  }
  if (validation?.correctionToHighReasoningRepair === true || validation?.highReasoningCorrectionHandoff) {
    rows.push({
      route: "send_regeneration_result_to_high_reasoning_contract_repair",
      label: "Escalate regeneration result to high-reasoning contract repair",
      nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
      reason:
        "The regeneration result exposed a logic, evidence, or route problem; the expensive reasoning layer should repair the contract before medium-runtime reuse.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-rag-informed-high-reasoning-repair-intake.mjs --teacher-correction "<teacher-notes>"',
      requiredTeacherEvidence: ["teacher_correction_notes", "source_validation_reviewed", "no_execution_confirmed"],
      targetReasoningTier: "highest_reasoning_contract_repair",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    });
  }
  rows.push({
    route: "needs_more_regeneration_result_evidence",
    label: "Request more regeneration result evidence",
    nextTool: "manual_evidence_collection",
    reason: "Stop and gather stronger result evidence before selecting a next route.",
    commandTemplate: "",
    requiredTeacherEvidence: ["missing_or_weak_result_evidence_explained"],
    targetReasoningTier: "none_until_evidence_review",
    executeNow: false,
    copyOnly: true,
    reviewOnly: true
  });
  return rows;
}

const goal = argValue("--goal", "Route a reviewed regenerated TLCL input contract back into the next teacher gate.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--manual-result-validation", "")),
  "--validation"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-regenerated-input-contract-review-routers"))
);
const validation = validationInput.value;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (validation.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_v1") {
  block(
    "validation_format_invalid",
    "Validation must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_v1."
  );
}
if (
  ![
    "regeneration_manual_result_reviewed_waiting_for_next_route_contract_review",
    "regeneration_manual_result_routes_to_high_reasoning_correction"
  ].includes(validation.status)
) {
  block("validation_status_not_routable", "Validation is not ready for regenerated-contract review routing.");
}
if (validation?.locks?.validatorDoesNotRunNextTool !== true || validation?.locks?.validatorDoesNotRegenerateInputContract !== true) {
  block("source_validation_locks_missing", "Source validation must prove no next tool or regeneration command ran.");
}
if (validation?.readyForNextRouteContractReview === true && !validation?.reviewedRegeneratedInputContract?.inputContractPath) {
  block("reviewed_regenerated_contract_missing", "Ready validation must include reviewedRegeneratedInputContract.inputContractPath.");
}

const routerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(validation?.reviewedRegeneratedInputContract?.routeId || validation?.decision || goal)}`;
const routerDir = join(outRoot, routerId);
const routerPath = join(routerDir, "tlcl-next-route-regenerated-input-contract-review-router.json");
const receiptTemplatePath = join(routerDir, "tlcl-next-route-regenerated-input-contract-review-selection-receipt-template.json");
const readmePath = join(routerDir, "TLCL_NEXT_ROUTE_REGENERATED_INPUT_CONTRACT_REVIEW_ROUTER_START_HERE.md");
const htmlPath = join(routerDir, "tlcl-next-route-regenerated-input-contract-review-router.html");
const routerLocks = locks();
const ok = blockers.length === 0;
const status = ok
  ? "regenerated_input_contract_review_router_waiting_for_teacher_selection"
  : "blocked_before_regenerated_input_contract_review_router";
const candidates = ok ? candidateRows(validation) : [];

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_selection_receipt_v1",
      sourceRouterId: routerId,
      sourceRouterPath: routerPath,
      sourceValidationId: validation.validationId || "",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "route_selected_for_manual_preparation",
        "needs_more_regeneration_result_evidence",
        "correction_to_high_reasoning_repair",
        "needs_teacher_review"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "accepted",
        "run_next_tool",
        "regenerate_input_contract",
        "invoke_model",
        "fetch_rag",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete"
      ],
      selectedRoute: "",
      allowedRoutes: candidates.map((candidate) => candidate.route),
      reviewedRegeneratedInputContract: validation.reviewedRegeneratedInputContract || null,
      highReasoningCorrectionHandoff: validation.highReasoningCorrectionHandoff || null,
      selectedRouteReviewed: false,
      sourceValidationReviewed: false,
      resultEvidenceStillValid: false,
      retainedRollbackStillAvailable: false,
      teacherConfirmedNoExecution: false,
      blockedActionsConfirmed: true,
      teacherNotes: "",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true,
      locks: routerLocks
    }
  : null;

const router = {
  ok,
  format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_v1",
  routerId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceValidationPath: validationInput.path,
  sourceValidationId: validation.validationId || "",
  sourceStatus: validation.status || "",
  reviewedRegeneratedInputContract: validation.reviewedRegeneratedInputContract || null,
  highReasoningCorrectionHandoff: validation.highReasoningCorrectionHandoff || null,
  candidateRoutes: candidates,
  receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs --router "' +
    routerPath +
    '" --receipt "<teacher-filled-regenerated-input-contract-review-selection-receipt.json>"',
  blockers,
  blockedActions: [
    "build_input_contract_receipt_from_router",
    "run_next_tool_from_router",
    "regenerate_input_contract_from_router",
    "invoke_model_from_router",
    "fetch_rag_from_router",
    "write_memory_from_router",
    "enable_rule_from_router",
    "unlock_packaging_from_router",
    "claim_completion_from_router"
  ],
  locks: routerLocks,
  paths: {
    router: routerPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath,
    sourceValidation: validationInput.path
  }
};

writeJson(routerPath, router);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Regenerated Input Contract Review Router",
    "",
    `Status: ${status}`,
    `Source validation: ${validationInput.path || "<inline validation>"}`,
    `Candidate routes: ${candidates.map((candidate) => candidate.route).join(", ") || "<blocked>"}`,
    "",
    "This router brings a reviewed regenerated input contract back to the normal teacher receipt gate. It does not build the receipt, run the next tool, regenerate the contract, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "```powershell",
    router.nextValidationCommand,
    "```"
  ].join("\n") + "\n",
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Regenerated Contract Router</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    label { display: block; margin-top: 10px; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    textarea { min-height: 170px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin-top: 8px; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Regenerated Contract Router</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page creates a teacher selection receipt only. It does not run tools, call models, fetch RAG, or write memory.</p>
    <section>
      <p>Router: <a href="${htmlEscape(pathToFileURL(routerPath).href)}">${htmlEscape(routerPath)}</a></p>
      <p>Validation command: <code>${htmlEscape(router.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="route_selected_for_manual_preparation">route_selected_for_manual_preparation</option>
          <option value="needs_more_regeneration_result_evidence">needs_more_regeneration_result_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
        </select>
      </label>
      <label>Selected route
        <select id="route">
          <option value="">needs_teacher_review</option>
          ${candidates.map((candidate) => `<option value="${htmlEscape(candidate.route)}">${htmlEscape(candidate.route)}</option>`).join("\n          ")}
        </select>
      </label>
      <label><input id="routeReviewed" type="checkbox"> Selected route reviewed</label>
      <label><input id="sourceReviewed" type="checkbox"> Source validation reviewed</label>
      <label><input id="evidenceValid" type="checkbox"> Result evidence still valid</label>
      <label><input id="rollback" type="checkbox"> Retained rollback still available</label>
      <label><input id="noExecution" type="checkbox"> Confirm no execution now</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Candidate Routes</h2>
      <textarea id="candidateJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const router = ${jsonForScript(router)};
    const receiptEl = document.getElementById("receiptJson");
    document.getElementById("candidateJson").value = JSON.stringify(router.candidateRoutes, null, 2);
    function buildReceipt() {
      return {
        ...router.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        selectedRoute: document.getElementById("route").value,
        selectedRouteReviewed: document.getElementById("routeReviewed").checked,
        sourceValidationReviewed: document.getElementById("sourceReviewed").checked,
        resultEvidenceStillValid: document.getElementById("evidenceValid").checked,
        retainedRollbackStillAvailable: document.getElementById("rollback").checked,
        teacherConfirmedNoExecution: document.getElementById("noExecution").checked,
        teacherNotes: document.getElementById("notes").value
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_result_v1",
      status,
      routerId,
      sourceValidationId: validation.validationId || "",
      candidateRoutes: candidates,
      routerPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      locks: routerLocks
    },
    null,
    2
  )
);
