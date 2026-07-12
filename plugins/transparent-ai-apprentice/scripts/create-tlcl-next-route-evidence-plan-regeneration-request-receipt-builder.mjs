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
    parsed.value?.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_result_v1" &&
    parsed.value?.builderPath &&
    existsSync(parsed.value.builderPath)
  ) {
    return { value: readJson(resolve(parsed.value.builderPath)), path: resolve(parsed.value.builderPath) };
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
    String(value || "tlcl-next-route-evidence-plan-regeneration-request-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-regeneration-request-receipt-builder"
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

const goal = argValue("--goal", "Build a teacher receipt for a TLCL evidence-plan regeneration request.");
const builderInput = readJsonInput(argValue("--builder", argValue("--command-builder", "")), "--builder");
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-regeneration-request-receipt-builders"))
);
const builder = builderInput.value;
const request = builder.request || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (builder.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1") {
  block("builder_format_invalid", "Builder must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1.");
}
if (builder.ok !== true) block("builder_not_ok", "Builder must be ok=true.");
if (builder.status !== "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy") {
  block("builder_status_not_ready", "Builder must be waiting for teacher copy.");
}
if (!request || request.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1") {
  block("regeneration_request_missing_or_invalid", "Builder must contain transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1.");
}
if (request?.executeNow !== false || request?.copyOnly !== true || request?.reviewOnly !== true) {
  block("request_copy_only_locks_missing", "Regeneration request must keep executeNow=false, copyOnly=true, and reviewOnly=true.");
}
if (builder.locks?.builderDoesNotRunCommand !== true || builder.locks?.builderDoesNotRegenerateInputContract !== true) {
  block("source_builder_locks_missing", "Source builder must prove it did not run the command or regenerate the input contract.");
}

const receiptBuilderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(request?.routeId || goal)}`;
const builderDir = join(outRoot, receiptBuilderId);
const receiptBuilderPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-request-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-request-receipt-template.json");
const readmePath = join(builderDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_REGENERATION_REQUEST_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-request-receipt-builder.html");
const ok = blockers.length === 0;
const status = ok
  ? "evidence_plan_regeneration_request_receipt_builder_waiting_for_teacher_review"
  : "blocked_before_evidence_plan_regeneration_request_receipt_builder";
const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_v1",
      sourceBuilderId: builder.builderId,
      sourceBuilderPath: builderInput.path || "<inline-builder>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "teacher_reviewed_regeneration_request_ready_for_manual_use",
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
      reviewedRouteId: request.routeId || "",
      reviewedNextTool: request.nextTool || "",
      reviewedSuggestedRegenerationCommand: request.suggestedRegenerationCommand || "",
      reviewedEvidenceRowsUsed: request.evidenceRowsUsed || [],
      reviewedNoOpLocks: builder.locks || {},
      confirmedRetainedRollbackPoint: "",
      regenerationRequestReviewed: false,
      commandReviewed: false,
      evidenceRowsReviewed: false,
      noOpLocksReviewed: false,
      separateManualStepConfirmed: false,
      blockedActionsConfirmed: true,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true,
      teacherNotes: "",
      locks: locks()
    }
  : null;

const receiptBuilder = {
  ok,
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_builder_v1",
  receiptBuilderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceBuilderPath: builderInput.path,
  sourceBuilderId: builder.builderId || "",
  request,
  receiptTemplate,
  blockers,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs --builder "' +
    (builderInput.path || "<tlcl-next-route-evidence-plan-regeneration-command-builder.json>") +
    '" --receipt "<teacher-filled-regeneration-request-receipt.json>"',
  blockedActions: [
    "validate_receipt_from_builder",
    "execute_regeneration_command_from_receipt_builder",
    "regenerate_input_contract_from_receipt_builder",
    "run_next_tool_from_receipt_builder",
    "invoke_model_from_receipt_builder",
    "fetch_rag_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "enable_rule_from_receipt_builder",
    "unlock_packaging_from_receipt_builder",
    "claim_completion_from_receipt_builder"
  ],
  paths: {
    receiptBuilder: receiptBuilderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath,
    sourceBuilder: builderInput.path
  },
  locks: locks()
};

writeJson(receiptBuilderPath, receiptBuilder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Evidence Plan Regeneration Request Receipt Builder",
    "",
    `Status: ${status}`,
    `Source builder: ${builderInput.path || "<inline builder>"}`,
    `Next tool: ${request?.nextTool || "<blocked>"}`,
    "Execute now: false",
    "",
    "This builder creates a teacher receipt template only. It does not validate the receipt, regenerate the input contract, run commands, run next tools, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Next Validation Command",
    "",
    receiptBuilder.nextValidationCommand
  ].join("\n"),
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Regeneration Request Receipt Builder</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}section{border:1px solid #d8e0ec;border-radius:8px;padding:14px;margin-top:12px}textarea,input,select{width:100%;box-sizing:border-box;margin-top:6px;padding:8px}textarea{min-height:190px;font:13px Consolas,monospace}button{padding:8px 12px;margin-top:8px;background:#174d89;color:#fff;border:0;border-radius:6px}code,a{word-break:break-all}</style></head><body><h1>TLCL Regeneration Request Receipt Builder</h1><p>Status: <code>${htmlEscape(status)}</code></p><p>This page creates a teacher receipt. It does not execute anything.</p><section><p>Receipt template: <a href="${htmlEscape(pathToFileURL(receiptTemplatePath).href)}">${htmlEscape(receiptTemplatePath)}</a></p><p>Builder: <a href="${htmlEscape(pathToFileURL(receiptBuilderPath).href)}">${htmlEscape(receiptBuilderPath)}</a></p></section><section><label>Decision<select id="decision"><option value="teacher_reviewed_regeneration_request_ready_for_manual_use">ready for separate manual use</option><option value="needs_more_evidence">needs more evidence</option><option value="correction_to_high_reasoning_repair">correction to high reasoning repair</option></select></label><label>Retained rollback point<input id="rollback" placeholder="retained rollback point id or path"></label><label>Teacher notes<input id="notes" placeholder="teacher notes"></label><textarea id="receiptJson" spellcheck="false"></textarea><button id="build">Build receipt JSON</button><button id="copy">Copy receipt JSON</button></section><script>const template=${jsonForScript(receiptTemplate)};const area=document.getElementById("receiptJson");function build(){const r={...template,teacherDecision:document.getElementById("decision").value,confirmedRetainedRollbackPoint:document.getElementById("rollback").value.trim(),regenerationRequestReviewed:true,commandReviewed:true,evidenceRowsReviewed:true,noOpLocksReviewed:true,separateManualStepConfirmed:true,blockedActionsConfirmed:true,teacherNotes:document.getElementById("notes").value.trim()};area.value=JSON.stringify(r,null,2)}document.getElementById("build").onclick=build;document.getElementById("copy").onclick=async()=>navigator.clipboard.writeText(area.value);build();</script></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_builder_result_v1",
      status,
      ok,
      receiptBuilderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      executeNow: false,
      locks: receiptBuilder.locks
    },
    null,
    2
  )
);
