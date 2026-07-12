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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-evidence-plan-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-receipt"
  );
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    doesNotValidateReceipt: true,
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

const goal = argValue("--goal", "Build a teacher receipt for a TLCL next-route evidence acquisition plan.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--evidence-plan", "")),
  "--plan",
  "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-receipt-builders"))
);
const plan = planInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(plan.routeId || goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-next-route-evidence-plan-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-next-route-evidence-plan-receipt-template.json");
const readmePath = join(builderDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "tlcl-next-route-evidence-plan-receipt-builder.html");
const evidenceRows = (plan.actionRows || []).map((row) => ({
  missingInputId: row.missingInputId,
  label: row.label || row.missingInputId,
  purpose: row.purpose || "",
  requiredEvidence: row.requiredEvidence || [],
  existingToolsToReuse: row.existingToolsToReuse || [],
  teacherReviewed: false,
  boundaryReviewed: false,
  suppliedValueForInputContract: "",
  suppliedEvidenceSummary: "",
  reviewerNote: ""
}));

const receiptTemplate = {
  format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_v1",
  builderId,
  sourcePlanPath: planInput.path,
  planId: plan.planId || "",
  routeId: plan.routeId || "",
  nextTool: plan.nextTool || "",
  teacherDecision: evidenceRows.length ? "provide_evidence_for_input_contract_regeneration" : "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "provide_evidence_for_input_contract_regeneration",
    "acknowledge_no_missing_inputs",
    "blocked",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
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
  ],
  blockedShortcutsReviewed: false,
  ragEvidenceOnlyConfirmed: false,
  rollbackRetained: false,
  evidenceRows,
  teacherNote: "",
  locks: locks()
};

const builder = {
  format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "evidence_acquisition_plan_receipt_builder_ready_for_teacher_use",
  sourcePlanPath: planInput.path,
  planId: plan.planId || "",
  planStatus: plan.status || "",
  routeId: plan.routeId || "",
  nextTool: plan.nextTool || "",
  actionRowCount: evidenceRows.length,
  receiptTemplatePath,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs --plan "' +
    (planInput.path || "<tlcl-next-route-evidence-acquisition-plan.json>") +
    '" --receipt "<teacher-filled-tlcl-next-route-evidence-plan-receipt.json>"',
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Next-Route Evidence Plan Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Route: ${builder.routeId || "<none>"}`,
    `Action rows: ${builder.actionRowCount}`,
    "",
    "Fill the receipt after the teacher reviews evidence paths for missing next-route inputs.",
    "This builder does not validate the receipt, regenerate the input contract, run the next tool, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Next Validation Command",
    "",
    builder.nextValidationCommand
  ].join("\n"),
  "utf8"
);

const rows = evidenceRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.missingInputId)}</td><td>${htmlEscape(row.purpose)}</td><td>${htmlEscape(
        row.requiredEvidence.join("; ")
      )}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Evidence Plan Receipt Builder</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>TLCL Next-Route Evidence Plan Receipt Builder</h1><p>Route: <code>${htmlEscape(builder.routeId)}</code></p><p>Next tool: <code>${htmlEscape(builder.nextTool)}</code></p><table><thead><tr><th>Missing input</th><th>Purpose</th><th>Required evidence</th></tr></thead><tbody>${rows || "<tr><td colspan=\"3\">No missing evidence inputs.</td></tr>"}</tbody></table><h2>Validation Command</h2><pre>${htmlEscape(builder.nextValidationCommand)}</pre></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      routeId: builder.routeId,
      nextTool: builder.nextTool,
      actionRowCount: evidenceRows.length,
      locks: builder.locks
    },
    null,
    2
  )
);
