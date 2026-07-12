#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-action-logic-source-contract")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-action-logic-source-contract"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
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
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    contractPackageDoesNotExecuteSoftware: true,
    contractPackageDoesNotInvokeRunner: true,
    contractPackageDoesNotEnableRules: true,
    contractPackageDoesNotWriteMemory: true,
    contractPackageDoesNotTreatRagAsAuthority: true,
    contractPackageDoesNotAllowMediumRuntime: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function rowSourceRows(input) {
  if (!input) return [];
  if (Array.isArray(input.rows)) return input.rows;
  if (Array.isArray(input.evidenceChainLedger)) return input.evidenceChainLedger;
  if (Array.isArray(input.rowResults)) return input.rowResults;
  if (Array.isArray(input.nextReviewQueue)) return input.nextReviewQueue;
  return [];
}

function shortEvidenceSummary(row) {
  const evidencePath = row.readinessEvidencePath || row.evidencePath || row.controlRouteEvidence || "";
  const status = String(row.actionLogicSourceStatus || row.status || "action_logic_source_missing");
  const lane = String(row.nextActionLane || row.lane || row.nextLane || "action_logic_source_review");
  const blockedBeforeRunner = status.includes("blocked_before_adapter_runner");
  return {
    status,
    lane,
    evidencePath,
    evidenceKind: blockedBeforeRunner
      ? "blocked_dry_run_or_pilot_receipt"
      : evidencePath
        ? "reviewable_evidence_path"
        : "no_direct_evidence_path",
    evidenceConfidence: blockedBeforeRunner || !evidencePath ? "low_requires_teacher_confirmation" : "medium_requires_teacher_confirmation",
    knownFromEvidence: [
      `software=${row.software || row.name || "selected software"}`,
      `status=${status}`,
      `lane=${lane}`,
      evidencePath ? `evidencePath=${evidencePath}` : "evidencePath=missing",
      blockedBeforeRunner ? "pilot/dry-run stopped before adapter runner; no target software action is proven" : "no execution is proven by this package"
    ],
    stillUnknown: [
      "teacher intended action",
      "exact route or numbered target",
      "data/state values that should drive the action",
      "geometry, angle, position, or depth relationships if visual/spatial",
      "post-action verifier and rollback evidence"
    ]
  };
}

function evidenceDraftContract(row, software, existingContract) {
  const summary = shortEvidenceSummary(row);
  const routeEvidence = existingContract.controlRouteEvidence || row.readinessEvidencePath || row.evidencePath || "";
  return {
    actionIntent:
      existingContract.actionIntent ||
      `Teacher must confirm the intended action for ${software}; current evidence only shows ${summary.status} in lane ${summary.lane}.`,
    targetBinding:
      existingContract.targetBinding ||
      row.pilotRouteMode ||
      `Bind ${software} only to a teacher-confirmed exact route or one numbered target; block if no target or route is confirmed.`,
    dataToActionLogic:
      existingContract.dataToActionLogic ||
      `Use reviewed low-token/control evidence to decide whether the teacher-confirmed action is applicable for ${software}; block until the teacher supplies the state-to-action mapping.`,
    dataRelationshipMap:
      existingContract.dataRelationshipMap ||
      "Teacher must map each source datum, observed state, or retrieved evidence field to the output/action parameter it controls; no implicit visual similarity is allowed.",
    geometryRelationshipLogic:
      existingContract.geometryRelationshipLogic ||
      "If the action is visual or spatial, teacher must confirm 2D position, perspective, angle, relative anchor, and 3D/depth relationships; otherwise mark geometry not applicable and block spatial execution.",
    targetSelectionLogic:
      existingContract.targetSelectionLogic ||
      "Select exactly one teacher-confirmed numbered target or exact structured route; stop for correction if multiple targets, no target, or uncertain coordinates/routes remain.",
    uncertaintyAndBlockers:
      existingContract.uncertaintyAndBlockers ||
      "block execution if any required data relationship, geometry relationship, target binding, route evidence, rollback point, or verifier is unknown",
    controlRouteEvidence: routeEvidence,
    rollbackPolicy: existingContract.rollbackPolicy || "retained rollback point required before any execution-capable runner",
    outcomeVerifier: existingContract.outcomeVerifier || "post-action evidence checkpoint required before learning or memory",
    validationEvidencePlan:
      existingContract.validationEvidencePlan ||
      "compare deterministic output fields or reviewed post-action evidence before learning, memory, packaging, or completion",
    ragEvidenceRole: existingContract.ragEvidenceRole || "evidence_only_not_authority",
    reasoningTierBoundary:
      existingContract.reasoningTierBoundary ||
      "highest reasoning compiles or repairs this contract; medium reasoning may only execute after teacher validation and execution gate approval",
    mediumRuntimeReuseConditions:
      existingContract.mediumRuntimeReuseConditions ||
      "allowed only after matrix patch, teacher execution gate, retained rollback point, and verifier plan are all present",
    providerRoleUsePlanTrace:
      existingContract.providerRoleUsePlanTrace ||
      row.providerRoleUsePlanTrace ||
      "highest-reasoning draft from evidence; medium-runtime reuse blocked until teacher validation, matrix patch, execution gate, and rollback"
  };
}

function normalizeRows(source, maxRows) {
  return rowSourceRows(source)
    .slice(0, maxRows)
    .map((row, index) => {
      const rowId = String(row.rowId || row.id || `logic-row-${String(index + 1).padStart(3, "0")}`);
      const software = String(row.software || row.name || "selected software");
      const existingContract = row.actionLogicSourceContract || {};
      const evidenceSummary = shortEvidenceSummary(row);
      const draftContract = evidenceDraftContract(row, software, existingContract);
      return {
        rowId,
        software,
        processName: String(row.processName || ""),
        windowTitle: String(row.windowTitle || ""),
        lane: String(row.nextActionLane || row.lane || "action_logic_source_review"),
        currentStatus: String(row.actionLogicSourceStatus || row.status || "action_logic_source_missing"),
        evidenceSummary,
        draftPrefillSource: "local_low_token_or_dry_run_evidence_summary_requires_teacher_confirmation",
        teacherMustConfirmOrReplaceDraft: true,
        highReasoningRole: "compile_or_repair_action_logic_contract",
        mediumRuntimeRole: "blocked_until_teacher_confirmed_logic_contract_validation",
        requiredLogicSourceTypes: [
          "teacher_confirmed_action_intent",
          "teacher_confirmed_numbered_target_or_exact_route",
          "reviewed_control_channel_profile_or_visible_window_binding",
          "data_to_action_logic_or_command_mapping",
          "data_relationship_map",
          "geometry_angle_position_relationships",
          "target_selection_and_numbering_logic",
          "uncertainty_blockers",
          "rollback_and_preflight_policy",
          "post_action_outcome_verifier",
          "reasoning_tier_boundary"
        ],
        teacherLogicPrompt:
          "Explain why this action should be done, which data/state/target it depends on, which exact route or numbered target it binds to, which data/geometry/angle/position relationships drive it, what uncertainty blocks execution, and how success will be verified.",
        draftContract,
        defaultDecision: "needs_teacher_review",
        allowedTeacherDecisions: ["needs_teacher_review", "teacher_confirmed_logic_contract", "blocked_needs_more_evidence"],
        blockedTeacherDecisions: [
          "accepted",
          "execute_now",
          "run_execute_mode",
          "memory_enabled",
          "claim_complete",
          "treat_rag_as_authority",
          "allow_medium_runtime_without_contract"
        ],
        accepted: false,
        ruleEnabled: false,
        packagingGated: true
      };
    });
}

function writeReadme(path, pkg) {
  const lines = [
    "# All-Software Action Logic Source Contract Package",
    "",
    `Status: ${pkg.status}`,
    `Rows: ${pkg.counts.totalRows}`,
    "",
    "This package turns action-level execution candidates into teacher-review-only logic contracts.",
    "",
    "Use it like this:",
    "1. Open the HTML page.",
    "2. For each row, fill or confirm the action intent, target binding, data-to-action logic, route evidence, rollback policy, and outcome verifier.",
    "3. Generate the receipt JSON.",
    "4. Validate the receipt before letting the execution capability matrix treat the row as logic-source ready.",
    "",
    "Safety boundary:",
    "- No target software is executed.",
    "- No runner is invoked.",
    "- No rule is enabled.",
    "- No memory is written.",
    "- RAG evidence remains evidence only.",
    "- Medium-runtime execution remains blocked until validation emits a reviewed matrix patch."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Create teacher-review-only action logic source contracts for execution candidates.");
const matrixInput = readJsonInput(
  argValue("--matrix", argValue("--execution-matrix", "")),
  "--matrix",
  "transparent_ai_all_software_execution_capability_matrix_v1"
);
const batchInput = readJsonInput(
  argValue("--batch", argValue("--follow-up-batch", "")),
  "--batch",
  "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1"
);
if (!matrixInput.value && !batchInput.value) throw new Error("--matrix or --batch is required");

const maxRows = Number(argValue("--max-rows", "12"));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-action-logic-source-contract-packages"))
);
mkdirSync(outputRoot, { recursive: true });
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const rows = normalizeRows(matrixInput.value || batchInput.value, maxRows);
const packagePath = join(packageDir, "all-software-action-logic-source-contract-package.json");
const htmlPath = join(packageDir, "all-software-action-logic-source-contract-package.html");
const receiptTemplatePath = join(packageDir, "teacher-action-logic-source-contract-receipt-template.json");
const readmePath = join(packageDir, "ALL_SOFTWARE_ACTION_LOGIC_SOURCE_CONTRACT_PACKAGE_START_HERE.md");
const lockState = locks();
const pkg = {
  ok: true,
  format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_action_logic_source_review",
  purpose:
    "Make every execution candidate explain the reviewed logic that connects teacher intent, target binding, data/state evidence, control route, rollback, and outcome verification before dry-run or medium-runtime reuse.",
  sourceEvidence: {
    matrixPath: matrixInput.path,
    batchPath: batchInput.path
  },
  counts: {
    totalRows: rows.length,
    rowsNeedingTeacherLogic: rows.filter((row) => row.currentStatus !== "logic_source_contract_ready_for_review").length
  },
  contractRows: rows,
  receiptTemplate: {
    format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
    packageId,
    decision: "needs_teacher_review",
    rowDecisions: rows.map((row) => ({
      rowId: row.rowId,
      software: row.software,
      teacherDecision: "needs_teacher_review",
      evidenceReviewed: false,
      actionIntentReviewed: false,
      targetBindingReviewed: false,
      dataToActionLogicReviewed: false,
      dataRelationshipsReviewed: false,
      geometryRelationshipsReviewed: false,
      targetSelectionLogicReviewed: false,
      uncertaintyBlockersReviewed: false,
      executionBoundaryReviewed: false,
      rollbackPolicyReviewed: false,
      rollbackPointReviewed: false,
      outcomeVerifierReviewed: false,
      validationEvidencePlanReviewed: false,
      ragEvidenceRoleReviewedAsEvidenceOnly: false,
      reasoningTierBoundaryReviewed: false,
      providerRoleUsePlanTraceReviewed: false,
      correctedContract: row.draftContract,
      teacherNote: ""
    })),
    locks: lockState
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-action-logic-source-contract-receipt.mjs --package "' +
    packagePath +
    '" --receipt "<teacher-filled-action-logic-source-contract-receipt.json>"',
  blockedActions: [
    "execute_target_software_from_contract_package",
    "invoke_runner_from_contract_package",
    "enable_rule_from_contract_package",
    "write_memory_from_contract_package",
    "treat_rag_evidence_as_authority",
    "allow_medium_runtime_without_teacher_validated_contract",
    "claim_goal_complete_from_contract_package"
  ],
  locks: lockState,
  paths: {
    package: packagePath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath
  }
};

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(pkg.receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, pkg);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Action Logic Source Contract</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 18px; letter-spacing: 0; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .row { margin-top: 14px; }
    label { display: block; margin: 9px 0 4px; font-size: 13px; color: #34445c; }
    input, textarea, select { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 13px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 70px; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; overflow-wrap: anywhere; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
    .review-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 6px 12px; margin: 10px 0; }
    .review-check { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 6px 8px; border: 1px solid #e0e6ef; border-radius: 6px; color: #26364c; }
    .review-check input { width: auto; margin-top: 2px; }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .preflight { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; margin: 12px 0; }
    .preflight-row { border-top: 1px solid #e7edf5; padding: 8px 0; }
    .preflight-row:first-child { border-top: 0; }
    .preflight-ready { color: #166534; font-weight: 600; }
    .preflight-blocked { color: #9a3412; font-weight: 600; }
    .preflight ul { margin: 6px 0 0 20px; padding: 0; }
    #receipt { min-height: 320px; font-family: Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>Action Logic Source Contract</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Receipt</h2>
      <p>Confirming a row only prepares a validation patch. It does not execute software, enable rules, write memory, or allow medium-runtime execution.</p>
      <p><button id="generate">Generate Receipt JSON</button> <button id="preflight-button" class="secondary">Refresh Local Preflight</button> <button id="copy" class="secondary">Copy JSON</button> <button id="download-receipt" class="secondary">Download Receipt JSON</button></p>
      <div id="preflight" class="preflight"></div>
      <textarea id="receipt" spellcheck="false"></textarea>
      <label>Receipt file path for command preview</label>
      <input id="receipt-path" value="&lt;teacher-filled-action-logic-source-contract-receipt.json&gt;">
      <p class="muted">Next validation command preview: <code id="resolved-command">${htmlEscape(pkg.nextValidationCommand)}</code></p>
      <p class="muted">This page only prepares JSON and command text. It does not run validators or execute target software.</p>
    </section>
    <section id="rows"></section>
  </main>
  <script>
    const pkg = ${jsonForScript(pkg)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    const preflightEl = document.getElementById("preflight");
    const receiptPathEl = document.getElementById("receipt-path");
    const resolvedCommandEl = document.getElementById("resolved-command");
    const reviewChecks = [
      ["evidenceReviewed", "Source evidence reviewed"],
      ["actionIntentReviewed", "Action intent reviewed"],
      ["targetBindingReviewed", "Target binding reviewed"],
      ["dataToActionLogicReviewed", "Data-to-action logic reviewed"],
      ["dataRelationshipsReviewed", "Data relationships reviewed"],
      ["geometryRelationshipsReviewed", "Geometry / angle / position reviewed"],
      ["targetSelectionLogicReviewed", "Target numbering logic reviewed"],
      ["uncertaintyBlockersReviewed", "Uncertainty blockers reviewed"],
      ["executionBoundaryReviewed", "Execution boundary reviewed"],
      ["rollbackPolicyReviewed", "Rollback policy reviewed"],
      ["rollbackPointReviewed", "Rollback point reviewed"],
      ["outcomeVerifierReviewed", "Outcome verifier reviewed"],
      ["validationEvidencePlanReviewed", "Validation evidence plan reviewed"],
      ["ragEvidenceRoleReviewedAsEvidenceOnly", "RAG remains evidence-only"],
      ["reasoningTierBoundaryReviewed", "High/medium reasoning boundary reviewed"],
      ["providerRoleUsePlanTraceReviewed", "Provider role trace reviewed"]
    ];
    function reviewChecklist(rowId) {
      return '<div class="review-grid">' + reviewChecks.map(([field, label]) =>
        '<label class="review-check"><input type="checkbox" data-field="' + field + '" data-row-id="' + rowId + '">' + label + '</label>'
      ).join('') + '</div>';
    }
    for (const row of pkg.contractRows) {
      const article = document.createElement("article");
      article.className = "row";
      article.innerHTML = '<h2>' + row.software + ' <code>' + row.rowId + '</code></h2>' +
        '<p class="muted">Lane: <code>' + row.lane + '</code> Status: <code>' + row.currentStatus + '</code></p>' +
        '<label>Teacher decision</label><select data-field="teacherDecision" data-row-id="' + row.rowId + '">' +
          '<option value="needs_teacher_review">Needs teacher review</option>' +
          '<option value="teacher_confirmed_logic_contract">Teacher confirmed logic contract</option>' +
          '<option value="blocked_needs_more_evidence">Blocked: needs more evidence</option>' +
        '</select>' +
        '<div class="row-actions"><button type="button" class="secondary" data-action="mark-all-reviewed" data-row-id="' + row.rowId + '">Mark All Reviewed</button></div>' +
        reviewChecklist(row.rowId) +
        '<label>Action intent</label><textarea data-field="actionIntent" data-row-id="' + row.rowId + '">' + row.draftContract.actionIntent + '</textarea>' +
        '<label>Target binding</label><textarea data-field="targetBinding" data-row-id="' + row.rowId + '">' + row.draftContract.targetBinding + '</textarea>' +
        '<label>Data-to-action logic</label><textarea data-field="dataToActionLogic" data-row-id="' + row.rowId + '">' + row.draftContract.dataToActionLogic + '</textarea>' +
        '<label>Data relationship map</label><textarea data-field="dataRelationshipMap" data-row-id="' + row.rowId + '">' + row.draftContract.dataRelationshipMap + '</textarea>' +
        '<label>Geometry, angle, and position relationships</label><textarea data-field="geometryRelationshipLogic" data-row-id="' + row.rowId + '">' + row.draftContract.geometryRelationshipLogic + '</textarea>' +
        '<label>Target selection / numbering logic</label><textarea data-field="targetSelectionLogic" data-row-id="' + row.rowId + '">' + row.draftContract.targetSelectionLogic + '</textarea>' +
        '<label>Uncertainty blockers</label><textarea data-field="uncertaintyAndBlockers" data-row-id="' + row.rowId + '">' + row.draftContract.uncertaintyAndBlockers + '</textarea>' +
        '<label>Control route evidence</label><input data-field="controlRouteEvidence" data-row-id="' + row.rowId + '" value="' + row.draftContract.controlRouteEvidence + '">' +
        '<label>Rollback policy</label><textarea data-field="rollbackPolicy" data-row-id="' + row.rowId + '">' + row.draftContract.rollbackPolicy + '</textarea>' +
        '<label>Outcome verifier</label><textarea data-field="outcomeVerifier" data-row-id="' + row.rowId + '">' + row.draftContract.outcomeVerifier + '</textarea>' +
        '<label>Validation evidence plan</label><textarea data-field="validationEvidencePlan" data-row-id="' + row.rowId + '">' + row.draftContract.validationEvidencePlan + '</textarea>' +
        '<label>Reasoning tier boundary</label><textarea data-field="reasoningTierBoundary" data-row-id="' + row.rowId + '">' + row.draftContract.reasoningTierBoundary + '</textarea>' +
        '<label>Medium runtime reuse conditions</label><textarea data-field="mediumRuntimeReuseConditions" data-row-id="' + row.rowId + '">' + row.draftContract.mediumRuntimeReuseConditions + '</textarea>' +
        '<label>Provider role use plan trace</label><input data-field="providerRoleUsePlanTrace" data-row-id="' + row.rowId + '" value="' + row.draftContract.providerRoleUsePlanTrace + '">' +
        '<label>Teacher note</label><textarea data-field="teacherNote" data-row-id="' + row.rowId + '"></textarea>';
      rowsEl.appendChild(article);
    }
    function value(rowId, field) {
      const el = document.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
      return el?.type === 'checkbox' ? el.checked : (el?.value || '');
    }
    function hasText(value) { return String(value || "").trim().length > 0; }
    function textIncludes(value, needles) {
      const lower = String(value || "").toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    }
    document.querySelectorAll('[data-action="mark-all-reviewed"]').forEach((button) => {
      button.addEventListener("click", () => {
        const rowId = button.getAttribute("data-row-id");
        for (const [field] of reviewChecks) {
          const checkbox = document.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
          if (checkbox) checkbox.checked = true;
        }
        const decision = document.querySelector('[data-row-id="' + rowId + '"][data-field="teacherDecision"]');
        if (decision) decision.value = "teacher_confirmed_logic_contract";
        render();
      });
    });
    function buildReceipt() {
      return {
        format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
        packageId: pkg.packageId,
        decision: "needs_teacher_review",
        rowDecisions: pkg.contractRows.map((row) => {
          const decision = value(row.rowId, "teacherDecision") || "needs_teacher_review";
          return {
            rowId: row.rowId,
            software: row.software,
            teacherDecision: decision,
            evidenceReviewed: value(row.rowId, "evidenceReviewed") === true,
            actionIntentReviewed: value(row.rowId, "actionIntentReviewed") === true,
            targetBindingReviewed: value(row.rowId, "targetBindingReviewed") === true,
            dataToActionLogicReviewed: value(row.rowId, "dataToActionLogicReviewed") === true,
            dataRelationshipsReviewed: value(row.rowId, "dataRelationshipsReviewed") === true,
            geometryRelationshipsReviewed: value(row.rowId, "geometryRelationshipsReviewed") === true,
            targetSelectionLogicReviewed: value(row.rowId, "targetSelectionLogicReviewed") === true,
            uncertaintyBlockersReviewed: value(row.rowId, "uncertaintyBlockersReviewed") === true,
            executionBoundaryReviewed: value(row.rowId, "executionBoundaryReviewed") === true,
            rollbackPolicyReviewed: value(row.rowId, "rollbackPolicyReviewed") === true,
            rollbackPointReviewed: value(row.rowId, "rollbackPointReviewed") === true,
            outcomeVerifierReviewed: value(row.rowId, "outcomeVerifierReviewed") === true,
            validationEvidencePlanReviewed: value(row.rowId, "validationEvidencePlanReviewed") === true,
            ragEvidenceRoleReviewedAsEvidenceOnly: value(row.rowId, "ragEvidenceRoleReviewedAsEvidenceOnly") === true,
            reasoningTierBoundaryReviewed: value(row.rowId, "reasoningTierBoundaryReviewed") === true,
            providerRoleUsePlanTraceReviewed: value(row.rowId, "providerRoleUsePlanTraceReviewed") === true,
            correctedContract: {
              actionIntent: value(row.rowId, "actionIntent"),
              targetBinding: value(row.rowId, "targetBinding"),
              dataToActionLogic: value(row.rowId, "dataToActionLogic"),
              dataRelationshipMap: value(row.rowId, "dataRelationshipMap"),
              geometryRelationshipLogic: value(row.rowId, "geometryRelationshipLogic"),
              targetSelectionLogic: value(row.rowId, "targetSelectionLogic"),
              uncertaintyAndBlockers: value(row.rowId, "uncertaintyAndBlockers"),
              controlRouteEvidence: value(row.rowId, "controlRouteEvidence"),
              rollbackPolicy: value(row.rowId, "rollbackPolicy"),
              outcomeVerifier: value(row.rowId, "outcomeVerifier"),
              validationEvidencePlan: value(row.rowId, "validationEvidencePlan"),
              ragEvidenceRole: "evidence_only_not_authority",
              reasoningTierBoundary: value(row.rowId, "reasoningTierBoundary"),
              mediumRuntimeReuseConditions: value(row.rowId, "mediumRuntimeReuseConditions"),
              providerRoleUsePlanTrace: value(row.rowId, "providerRoleUsePlanTrace")
            },
            teacherNote: value(row.rowId, "teacherNote")
          };
        }),
        locks: pkg.locks
      };
    }
    function rowPreflight(rowDecision) {
      const contract = rowDecision.correctedContract || {};
      const missing = [];
      for (const [field, label] of reviewChecks) {
        if (rowDecision[field] !== true) missing.push(label);
      }
      if (!hasText(contract.actionIntent)) missing.push("Action intent text");
      if (!hasText(contract.targetBinding)) missing.push("Target binding text");
      if (!hasText(contract.dataToActionLogic)) missing.push("Data-to-action logic text");
      if (!hasText(contract.dataRelationshipMap)) missing.push("Data relationship map");
      if (!hasText(contract.geometryRelationshipLogic)) missing.push("Geometry / angle / position relationships");
      if (!hasText(contract.targetSelectionLogic)) missing.push("Target selection logic");
      if (!textIncludes(contract.uncertaintyAndBlockers, ["block", "stop", "unknown", "missing"])) {
        missing.push("Uncertainty blockers that stop unknowns");
      }
      if (
        !(
          textIncludes(contract.rollbackPolicy, ["rollback", "restore", "checkpoint"]) &&
          textIncludes(contract.rollbackPolicy, ["retain", "retained", "point", "snapshot"])
        )
      ) {
        missing.push("Retained rollback point policy");
      }
      if (!hasText(contract.outcomeVerifier)) missing.push("Outcome verifier");
      if (!hasText(contract.validationEvidencePlan)) missing.push("Validation evidence plan");
      if (contract.ragEvidenceRole !== "evidence_only_not_authority") missing.push("RAG evidence-only role");
      if (
        !(
          textIncludes(contract.reasoningTierBoundary, ["high", "highest", "repair", "compile"]) &&
          textIncludes(contract.reasoningTierBoundary, ["medium", "execute", "runtime"]) &&
          textIncludes(contract.mediumRuntimeReuseConditions, ["gate", "teacher", "validation", "matrix"])
        )
      ) {
        missing.push("High/medium reasoning boundary");
      }
      const ready = rowDecision.teacherDecision === "teacher_confirmed_logic_contract" && missing.length === 0;
      return { rowId: rowDecision.rowId, software: rowDecision.software, ready, missing };
    }
    function renderPreflight(receipt) {
      const rows = receipt.rowDecisions.map(rowPreflight);
      const readyCount = rows.filter((row) => row.ready).length;
      preflightEl.innerHTML =
        '<p><strong>Local preflight:</strong> ' + readyCount + ' / ' + rows.length + ' rows look ready for validator. This is only a local warning; validator approval is still required.</p>' +
        rows.map((row) =>
          '<div class="preflight-row"><div><strong>' + row.software + ' <code>' + row.rowId + '</code></strong> ' +
          (row.ready ? '<span class="preflight-ready">ready for validator</span>' : '<span class="preflight-blocked">missing logic details</span>') +
          '</div>' +
          (row.missing.length ? '<ul>' + row.missing.map((item) => '<li>' + item + '</li>').join('') + '</ul>' : '') +
          '</div>'
        ).join('');
    }
    function validationCommandPreview() {
      return pkg.nextValidationCommand.replace(
        "<teacher-filled-action-logic-source-contract-receipt.json>",
        receiptPathEl.value || "<teacher-filled-action-logic-source-contract-receipt.json>"
      );
    }
    function render() {
      const receipt = buildReceipt();
      renderPreflight(receipt);
      receiptEl.value = JSON.stringify(receipt, null, 2);
      resolvedCommandEl.textContent = validationCommandPreview();
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("preflight-button").addEventListener("click", render);
    receiptPathEl.addEventListener("input", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    document.getElementById("download-receipt").addEventListener("click", () => {
      render();
      const blob = new Blob([receiptEl.value + "\\n"], { type: "application/json" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "teacher-filled-action-logic-source-contract-receipt.json";
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    });
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
      ok: true,
      format: "transparent_ai_all_software_action_logic_source_contract_package_result_v1",
      packageId,
      status: pkg.status,
      packagePath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      rowCount: rows.length,
      locks: lockState
    },
    null,
    2
  )
);
