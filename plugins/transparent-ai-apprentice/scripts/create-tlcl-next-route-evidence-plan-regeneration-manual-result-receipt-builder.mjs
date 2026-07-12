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
    parsed.value?.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_result_v1" &&
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

function slug(value) {
  return (
    String(value || "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder"
  );
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRegenerateInputContract: true,
    builderDoesNotRunCommand: true,
    builderDoesNotRunNextTool: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    accepted: false,
    ruleEnabled: false,
    packagingUnlocked: false,
    inputContractRegenerated: false,
    commandExecuted: false,
    nextToolExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Build a teacher receipt for a manual TLCL input-contract regeneration result.");
const validationInput = readJsonInput(argValue("--validation", argValue("--request-receipt-validation", "")), "--validation");
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builders")
  )
);
const validation = validationInput.value;
const manualRegenerationUse = validation?.manualRegenerationUse || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (validation.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1") {
  block("validation_format_invalid", "Validation must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1.");
}
if (validation.status !== "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use") {
  block("validation_status_not_ready", "Validation must be waiting for separate manual regeneration use.");
}
if (validation.readyForManualRegenerationUse !== true) {
  block("manual_regeneration_use_not_ready", "readyForManualRegenerationUse must be true.");
}
if (!manualRegenerationUse) block("manual_regeneration_use_missing", "Validation must contain manualRegenerationUse.");
if (manualRegenerationUse?.executeNow !== false || manualRegenerationUse?.copyOnly !== true || manualRegenerationUse?.reviewOnly !== true) {
  block("manual_regeneration_use_locks_missing", "manualRegenerationUse must keep executeNow=false, copyOnly=true, and reviewOnly=true.");
}
if (validation?.locks?.validatorDoesNotRegenerateInputContract !== true || validation?.locks?.validatorDoesNotRunCommand !== true) {
  block("source_validation_locks_missing", "Source validation must prove it did not regenerate the input contract or run the command.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(manualRegenerationUse?.routeId || goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-template.json");
const readmePath = join(builderDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_REGENERATION_MANUAL_RESULT_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder.html");
const ok = blockers.length === 0;
const status = ok
  ? "evidence_plan_regeneration_manual_result_receipt_builder_waiting_for_teacher_result_evidence"
  : "blocked_before_evidence_plan_regeneration_manual_result_receipt_builder";
const builderLocks = locks();
const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_v1",
      sourceValidationId: validation.validationId || "",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "manual_regeneration_result_reviewed_ready_for_next_route_contract_review",
        "needs_more_evidence",
        "correction_to_high_reasoning_repair"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "accepted",
        "regenerate_input_contract",
        "run_command",
        "run_next_tool",
        "invoke_model",
        "fetch_rag",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete"
      ],
      reviewedRouteId: manualRegenerationUse.routeId || "",
      reviewedNextTool: manualRegenerationUse.nextTool || "",
      reviewedSuggestedRegenerationCommand: manualRegenerationUse.suggestedRegenerationCommand || "",
      reviewedEvidenceRowsUsed: manualRegenerationUse.evidenceRowsUsed || [],
      confirmedRetainedRollbackPoint: manualRegenerationUse.confirmedRetainedRollbackPoint || "",
      manualRegenerationWasSeparate: false,
      regeneratedInputContractPath: "",
      regeneratedInputContractReviewed: false,
      regeneratedInputContractReadyForNextTool: false,
      resultEvidenceReviewed: false,
      resultEvidencePaths: [],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true,
      blockedActionsConfirmed: true,
      teacherNotes: "",
      locks: builderLocks
    }
  : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceValidationPath: validationInput.path,
  sourceValidationId: validation.validationId || "",
  manualRegenerationUse,
  receiptTemplate,
  blockers,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs --validation "' +
    (validationInput.path || "<tlcl-regeneration-request-receipt-validation.json>") +
    '" --receipt "<teacher-filled-regeneration-manual-result-receipt.json>"',
  blockedActions: [
    "validate_receipt_from_manual_result_receipt_builder",
    "regenerate_input_contract_from_manual_result_receipt_builder",
    "execute_regeneration_command_from_manual_result_receipt_builder",
    "run_next_tool_from_manual_result_receipt_builder",
    "invoke_model_from_manual_result_receipt_builder",
    "fetch_rag_from_manual_result_receipt_builder",
    "write_memory_from_manual_result_receipt_builder",
    "enable_rule_from_manual_result_receipt_builder",
    "unlock_packaging_from_manual_result_receipt_builder",
    "claim_completion_from_manual_result_receipt_builder"
  ],
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath,
    sourceValidation: validationInput.path
  },
  locks: builderLocks
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Next-Route Evidence Plan Regeneration Manual Result Receipt Builder",
    "",
    `Status: ${status}`,
    `Source validation: ${validationInput.path || "<inline validation>"}`,
    `Route: ${manualRegenerationUse?.routeId || "<blocked>"}`,
    `Next tool: ${manualRegenerationUse?.nextTool || "<blocked>"}`,
    "",
    "This builder creates a teacher receipt template for the result of a separate manual input-contract regeneration step. It does not regenerate contracts, run commands, validate the receipt, run next tools, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Next Validation Command",
    "",
    builder.nextValidationCommand
  ].join("\n"),
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Regeneration Manual Result Receipt</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}section{border:1px solid #d8e0ec;border-radius:8px;padding:14px;margin-top:12px}textarea,input,select{width:100%;box-sizing:border-box;margin-top:6px;padding:8px}textarea{min-height:160px;font:13px Consolas,monospace}button{padding:8px 12px;margin-top:8px;background:#174d89;color:#fff;border:0;border-radius:6px}code,a{word-break:break-all}</style></head><body><h1>TLCL Regeneration Manual Result Receipt</h1><p>Status: <code>${htmlEscape(status)}</code></p><p>This page records evidence from a separate manual input-contract regeneration step. It does not execute anything.</p><section><p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p><p>Receipt template: <a href="${htmlEscape(pathToFileURL(receiptTemplatePath).href)}">${htmlEscape(receiptTemplatePath)}</a></p></section><section><label>Decision<select id="decision"><option value="manual_regeneration_result_reviewed_ready_for_next_route_contract_review">ready for next route contract review</option><option value="needs_more_evidence">needs more evidence</option><option value="correction_to_high_reasoning_repair">correction to high reasoning repair</option></select></label><label>Regenerated input contract path<input id="contractPath" placeholder="tlcl-next-route-input-contract.json"></label><label><input id="separate" type="checkbox"> manual regeneration was separate</label><label><input id="contractReviewed" type="checkbox"> regenerated input contract reviewed</label><label><input id="ready" type="checkbox"> regenerated input contract is ready for next tool</label><label><input id="evidenceReviewed" type="checkbox"> result evidence reviewed</label><label>Result evidence paths, one per line<textarea id="evidencePaths" spellcheck="false"></textarea></label><label>Teacher notes<input id="notes"></label><button id="build">Build receipt JSON</button><button id="copy">Copy receipt JSON</button><textarea id="receiptJson" spellcheck="false"></textarea></section><script>const template=${jsonForScript(receiptTemplate)};const area=document.getElementById("receiptJson");function build(){const r={...template,teacherDecision:document.getElementById("decision").value,manualRegenerationWasSeparate:document.getElementById("separate").checked,regeneratedInputContractPath:document.getElementById("contractPath").value.trim(),regeneratedInputContractReviewed:document.getElementById("contractReviewed").checked,regeneratedInputContractReadyForNextTool:document.getElementById("ready").checked,resultEvidenceReviewed:document.getElementById("evidenceReviewed").checked,resultEvidencePaths:document.getElementById("evidencePaths").value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean),blockedActionsConfirmed:true,teacherNotes:document.getElementById("notes").value.trim()};area.value=JSON.stringify(r,null,2)}document.getElementById("build").onclick=build;document.getElementById("copy").onclick=async()=>navigator.clipboard.writeText(area.value);build();</script></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_builder_result_v1",
      status,
      ok,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
