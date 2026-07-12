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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-input-contract-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-input-contract-receipt"
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

const goal = argValue("--goal", "Build a teacher receipt for a TLCL next-route input contract.");
const contractInput = readJsonInput(
  argValue("--input-contract", argValue("--contract", "")),
  "--input-contract",
  "transparent_ai_tlcl_next_route_input_contract_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-input-contract-receipt-builders"))
);
const contract = contractInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(contract.route?.id || goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-next-route-input-contract-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-next-route-input-contract-receipt-template.json");
const readmePath = join(builderDir, "TLCL_NEXT_ROUTE_INPUT_CONTRACT_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "tlcl-next-route-input-contract-receipt-builder.html");

const artifactRows = (contract.requiredArtifacts || []).map((artifact) => ({
  id: artifact.id,
  label: artifact.label,
  expectedFormat: artifact.expectedFormat,
  contractSaysSatisfied: Boolean(artifact.satisfied),
  contractPath: artifact.path || "",
  teacherReviewed: false,
  suppliedEvidencePath: artifact.path || "",
  suppliedEvidenceSummary: "",
  proposedValueForRegeneration: "",
  reviewerNote: ""
}));

const receiptTemplate = {
  format: "transparent_ai_tlcl_next_route_input_contract_receipt_v1",
  builderId,
  sourceContractPath: contractInput.path,
  contractId: contract.contractId || "",
  routeId: contract.route?.id || "",
  nextTool: contract.nextTool || "",
  teacherDecision: contract.readyForNextTool ? "needs_teacher_review" : "provide_missing_inputs_for_regeneration",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "provide_missing_inputs_for_regeneration",
    "approve_manual_next_route_use",
    "blocked",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_next_tool",
    "enable_rule",
    "write_memory",
    "unlock_packaging",
    "claim_complete"
  ],
  artifactRows,
  blockedShortcutsReviewed: false,
  rollbackRetained: false,
  teacherNote: "",
  locks: locks()
};

const builder = {
  format: "transparent_ai_tlcl_next_route_input_contract_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "receipt_builder_ready_for_teacher_use",
  sourceContractPath: contractInput.path,
  contractStatus: contract.status || "",
  readyForNextTool: Boolean(contract.readyForNextTool),
  routeId: contract.route?.id || "",
  nextTool: contract.nextTool || "",
  missingInputs: contract.missingInputs || [],
  artifactRows,
  receiptTemplatePath,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-next-route-input-contract-receipt.mjs --input-contract "' +
    (contractInput.path || "<tlcl-next-route-input-contract.json>") +
    '" --receipt "<teacher-filled-tlcl-next-route-input-contract-receipt.json>"',
  blockedActions: [
    "validate_receipt_from_builder",
    "regenerate_input_contract_from_builder",
    "run_next_tool_from_builder",
    "execute_target_software_from_builder",
    "enable_rule_from_builder",
    "write_memory_from_builder",
    "unlock_packaging_from_builder",
    "claim_completion_from_builder"
  ],
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

const md = [
  "# TLCL Next Route Input Contract Receipt Builder",
  "",
  `Status: ${builder.status}`,
  `Route: ${builder.routeId}`,
  `Next tool: ${builder.nextTool}`,
  `Ready for next tool according to contract: ${builder.readyForNextTool ? "yes" : "no"}`,
  "",
  "## Artifact Rows",
  ...artifactRows.map((row) => `- ${row.id}: ${row.contractSaysSatisfied ? "contract-ready" : "needs teacher evidence or regeneration value"}`),
  "",
  "## Next Validation Command",
  "",
  "```powershell",
  builder.nextValidationCommand,
  "```",
  "",
  "This builder does not validate the receipt, regenerate the input contract, run the next tool, execute software, enable rules, write memory, unlock packaging, or claim completion."
].join("\n");
writeFileSync(readmePath, `${md}\n`, "utf8");

const rows = artifactRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.id)}</td><td>${htmlEscape(row.expectedFormat)}</td><td>${row.contractSaysSatisfied ? "ready" : "missing"}</td><td>${htmlEscape(row.contractPath)}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Next Route Receipt Builder</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}code{background:#f5f5f5;padding:2px 4px}</style></head><body><h1>TLCL Next Route Input Contract Receipt Builder</h1><p>Route: <code>${htmlEscape(builder.routeId)}</code></p><p>Next tool: <code>${htmlEscape(builder.nextTool)}</code></p><table><thead><tr><th>Artifact</th><th>Expected</th><th>Contract status</th><th>Path</th></tr></thead><tbody>${rows}</tbody></table><h2>Validation Command</h2><pre>${htmlEscape(builder.nextValidationCommand)}</pre></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_input_contract_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      readyForNextTool: builder.readyForNextTool,
      routeId: builder.routeId,
      nextTool: builder.nextTool,
      artifactRowCount: artifactRows.length,
      locks: builder.locks
    },
    null,
    2
  )
);
