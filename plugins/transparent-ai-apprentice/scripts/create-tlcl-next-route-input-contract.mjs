#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

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

function optionalJsonInput(input, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  return readJsonInput(text, "optional input", expectedFormat);
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
    String(value || "tlcl-next-route-input-contract")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-input-contract"
  );
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
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
}

function artifactStatus({ id, label, expectedFormat, parsed, required = true, checks = [] }) {
  const supplied = Boolean(parsed?.value);
  const formatOk = !expectedFormat || parsed?.value?.format === expectedFormat;
  const failedChecks = supplied && formatOk ? checks.filter((item) => !item.pass).map((item) => item.id) : [];
  return {
    id,
    label,
    required,
    expectedFormat,
    supplied,
    path: parsed?.path || "",
    satisfied: supplied && formatOk && failedChecks.length === 0,
    missingReason: supplied ? (formatOk ? failedChecks.join(", ") : "format_mismatch") : "not_supplied",
    checks: checks.map((item) => ({ id: item.id, pass: Boolean(item.pass), evidence: item.evidence || "" }))
  };
}

function buildRequirements(route, inputs) {
  const routeId = route?.id || "";
  const attachment = inputs.attachment.value;
  const reasoningBudget = inputs.reasoningBudgetReview.value;
  const activationValidation = inputs.activationValidation.value;
  const rollbackPoint = inputs.rollbackPoint;
  const teacherConfirmation = inputs.teacherConfirmation;

  if (routeId === "route_to_highest_reasoning_contract_repair") {
    return {
      nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
      readinessMeaning:
        "Only when a reviewed TLCL RAG evidence attachment is supplied may the next human or agent prepare a high-reasoning repair intake.",
      requiredArtifacts: [
        artifactStatus({
          id: "reviewed_tlcl_rag_evidence_attachment",
          label: "Reviewed TLCL RAG evidence attachment",
          expectedFormat: "transparent_ai_tlcl_rag_evidence_attachment_v1",
          parsed: inputs.attachment,
          checks: [
            {
              id: "waiting_for_high_reasoning_review",
              pass: attachment?.status === "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review",
              evidence: attachment?.status || ""
            },
            { id: "review_only", pass: attachment?.locks?.reviewOnly === true },
            { id: "evidence_only", pass: attachment?.locks?.evidenceOnly === true },
            { id: "attachment_only", pass: attachment?.locks?.attachmentOnly === true },
            { id: "rag_not_authority", pass: attachment?.locks?.ragDoesNotAuthorizeExecution === true },
            { id: "rules_not_enabled", pass: attachment?.locks?.ruleEnabled === false },
            { id: "memory_not_written", pass: attachment?.locks?.memoryWritten === false },
            { id: "packaging_locked", pass: attachment?.locks?.packagingUnlocked === false },
            { id: "medium_runtime_blocked", pass: attachment?.highReasoningReviewHandoff?.mediumRuntimeContinuationAllowed === false },
            { id: "reviewed_draft_refs_present", pass: Array.isArray(attachment?.approvedDraftRefs) && attachment.approvedDraftRefs.length > 0 }
          ]
        }),
        {
          id: "rollback_point_retained",
          label: "Retained rollback point before repair work",
          required: true,
          expectedFormat: "filesystem path or rollback manifest path",
          supplied: Boolean(rollbackPoint),
          path: rollbackPoint,
          satisfied: Boolean(rollbackPoint),
          missingReason: rollbackPoint ? "" : "not_supplied",
          checks: [{ id: "rollback_point_declared", pass: Boolean(rollbackPoint), evidence: rollbackPoint }]
        }
      ],
      suggestedNextCommand: commandLine("create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
        ["--attachment", inputs.attachment.path || "<tlcl-rag-evidence-attachment.json>"]
      ])
    };
  }

  if (routeId === "route_to_rag_evidence_then_contract_compile") {
    return {
      nextTool: "create_tlcl_rag_evidence_attachment",
      readinessMeaning:
        "Knowledge sources must first become reviewed evidence and disabled Rule DSL validation results before they can enter high-reasoning compile or repair.",
      requiredArtifacts: [
        {
          id: "tlcl_packet_path",
          label: "Current TLCL packet path",
          required: true,
          expectedFormat: "transparent_ai_tlcl_* packet",
          supplied: Boolean(inputs.tlclPacketPath),
          path: inputs.tlclPacketPath,
          satisfied: Boolean(inputs.tlclPacketPath),
          missingReason: inputs.tlclPacketPath ? "" : "not_supplied",
          checks: [{ id: "tlcl_packet_declared", pass: Boolean(inputs.tlclPacketPath), evidence: inputs.tlclPacketPath }]
        },
        {
          id: "reviewed_rag_validation_path",
          label: "Reviewed RAG validation result path",
          required: true,
          expectedFormat: "ready_for_review_only_rule_dsl_validation result",
          supplied: Boolean(inputs.ragValidationPath),
          path: inputs.ragValidationPath,
          satisfied: Boolean(inputs.ragValidationPath),
          missingReason: inputs.ragValidationPath ? "" : "not_supplied",
          checks: [{ id: "rag_validation_declared", pass: Boolean(inputs.ragValidationPath), evidence: inputs.ragValidationPath }]
        },
        {
          id: "teacher_confirmation",
          label: "Teacher confirmation that RAG is evidence only",
          required: true,
          expectedFormat: "boolean/text confirmation",
          supplied: Boolean(teacherConfirmation),
          path: "",
          satisfied: Boolean(teacherConfirmation),
          missingReason: teacherConfirmation ? "" : "not_supplied",
          checks: [{ id: "teacher_confirmation_declared", pass: Boolean(teacherConfirmation), evidence: teacherConfirmation }]
        }
      ],
      suggestedNextCommand: commandLine("create-tlcl-rag-evidence-attachment.mjs", [
        ["--tlcl-packet", inputs.tlclPacketPath || "<tlcl-packet.json>"],
        ["--rag-validation", inputs.ragValidationPath || "<reviewed-rag-validation.json>"]
      ])
    };
  }

  if (routeId === "route_to_reasoning_budget_governor_before_medium_runtime") {
    return {
      nextTool: "create_tlcl_reasoning_budget_governor",
      readinessMeaning:
        "Medium reasoning may reuse only a reviewed, deterministic, rollback-protected workflow. Corrections or unknowns return to high reasoning.",
      requiredArtifacts: [
        artifactStatus({
          id: "reasoning_budget_review",
          label: "Reasoning budget governor review validation",
          expectedFormat: "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1",
          parsed: inputs.reasoningBudgetReview,
          checks: [
            { id: "review_only", pass: reasoningBudget?.locks?.reviewOnly === true },
            { id: "rag_non_authority", pass: reasoningBudget?.locks?.ragEvidenceTreatedAsAuthority === false || reasoningBudget?.ragEvidenceTreatedAsAuthority === false },
            { id: "goal_not_complete", pass: reasoningBudget?.locks?.goalComplete === false || reasoningBudget?.goalComplete === false }
          ]
        }),
        artifactStatus({
          id: "reusable_workflow_activation",
          label: "Reviewed reusable workflow activation or repaired invocation validation",
          expectedFormat: "",
          parsed: inputs.activationValidation,
          checks: [
            { id: "activation_supplied", pass: Boolean(activationValidation) },
            { id: "rule_not_enabled_by_input_contract", pass: activationValidation?.locks?.ruleEnabled !== true },
            { id: "packaging_not_unlocked_by_input_contract", pass: activationValidation?.locks?.packagingUnlocked !== true }
          ]
        }),
        {
          id: "rollback_point_retained",
          label: "Retained rollback point before any medium-runtime runner",
          required: true,
          expectedFormat: "filesystem path or rollback manifest path",
          supplied: Boolean(rollbackPoint),
          path: rollbackPoint,
          satisfied: Boolean(rollbackPoint),
          missingReason: rollbackPoint ? "" : "not_supplied",
          checks: [{ id: "rollback_point_declared", pass: Boolean(rollbackPoint), evidence: rollbackPoint }]
        }
      ],
      suggestedNextCommand: commandLine("create-tlcl-reasoning-budget-governor.mjs", [
        ["--goal", inputs.goal || route?.label || "Review medium runtime reuse readiness"]
      ])
    };
  }

  return {
    nextTool: "create_tlcl_apprentice_session_launcher",
    readinessMeaning: "No downstream evidence lane is selected yet; start from the teacher route chooser.",
    requiredArtifacts: [
      {
        id: "teacher_route_choice",
        label: "Teacher route choice",
        required: true,
        expectedFormat: "launcher receipt",
        supplied: Boolean(teacherConfirmation),
        path: "",
        satisfied: Boolean(teacherConfirmation),
        missingReason: teacherConfirmation ? "" : "not_supplied",
        checks: [{ id: "teacher_choice_declared", pass: Boolean(teacherConfirmation), evidence: teacherConfirmation }]
      }
    ],
    suggestedNextCommand: commandLine("create-tlcl-apprentice-session-launcher.mjs", [["--goal", inputs.goal || "Start TLCL apprentice session"]])
  };
}

const consoleInput = readJsonInput(
  argValue("--direction-console", argValue("--console", "")),
  "--direction-console",
  "transparent_ai_tlcl_direction_operational_console_v1"
);
const attachmentInput = optionalJsonInput(
  argValue("--attachment", argValue("--tlcl-rag-attachment", "")),
  "transparent_ai_tlcl_rag_evidence_attachment_v1"
);
const reasoningBudgetReviewInput = optionalJsonInput(
  argValue("--reasoning-budget-review", argValue("--budget-review", "")),
  "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1"
);
const activationValidationInput = optionalJsonInput(argValue("--activation-validation", argValue("--workflow-validation", "")));
const outputRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-next-route-input-contracts"))
);
const consolePacket = consoleInput.value;
const contractId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(consolePacket.route?.id || consolePacket.goal)}`;
const contractDir = join(outputRoot, contractId);
mkdirSync(contractDir, { recursive: true });
const supportedRouteIds = [
  "route_to_tlcl_apprentice_session_launcher",
  "route_to_rag_evidence_then_contract_compile",
  "route_to_highest_reasoning_contract_repair",
  "route_to_reasoning_budget_governor_before_medium_runtime"
];

const inputs = {
  goal: argValue("--goal", consolePacket.goal || ""),
  attachment: attachmentInput,
  reasoningBudgetReview: reasoningBudgetReviewInput,
  activationValidation: activationValidationInput,
  rollbackPoint: argValue("--rollback-point", argValue("--rollback", "")),
  teacherConfirmation: argValue("--teacher-confirmation", argValue("--confirmation", "")),
  tlclPacketPath: argValue("--tlcl-packet", ""),
  ragValidationPath: argValue("--rag-validation", "")
};
const requirements = buildRequirements(consolePacket.route, inputs);
const requiredArtifacts = requirements.requiredArtifacts;
const missingInputs = requiredArtifacts.filter((item) => item.required && !item.satisfied).map((item) => item.id);
const readyForNextTool = missingInputs.length === 0;
const contractPath = join(contractDir, "tlcl-next-route-input-contract.json");
const readmePath = join(contractDir, "TLCL_NEXT_ROUTE_INPUT_CONTRACT_START_HERE.md");
const htmlPath = join(contractDir, "tlcl-next-route-input-contract.html");
const contract = {
  format: "transparent_ai_tlcl_next_route_input_contract_v1",
  contractId,
  createdAt: new Date().toISOString(),
  status: readyForNextTool ? "next_route_inputs_ready_for_teacher_reviewed_manual_use" : "next_route_inputs_missing_required_evidence",
  readyForNextTool,
  directionConsolePath: consoleInput.path,
  directionConsoleStatus: consolePacket.status || "",
  supportedRouteIds,
  route: consolePacket.route || {},
  nextTool: requirements.nextTool,
  readinessMeaning: requirements.readinessMeaning,
  requiredArtifacts,
  missingInputs,
  suggestedNextCommand: requirements.suggestedNextCommand,
  blockedShortcuts: [
    "Do not run the next tool from this contract automatically.",
    "Do not treat RAG evidence as authority.",
    "Do not continue medium runtime from correction, missing evidence, unknown validation, or missing rollback.",
    "Do not enable rules, write memory, unlock packaging, execute software, or claim completion from route selection."
  ],
  locks: locks()
};
writeJson(contractPath, contract);

const markdown = [
  "# TLCL Next Route Input Contract",
  "",
  `Status: ${contract.status}`,
  `Route: ${contract.route.id || "unknown"}`,
  `Next tool: ${contract.nextTool}`,
  `Ready for next tool: ${contract.readyForNextTool ? "yes" : "no"}`,
  "",
  "## Required Artifacts",
  ...requiredArtifacts.map((item) => `- ${item.id}: ${item.satisfied ? "ready" : `missing (${item.missingReason})`}`),
  "",
  "## Suggested Manual Command",
  "",
  "```powershell",
  contract.suggestedNextCommand,
  "```",
  "",
  "## Locked Shortcuts",
  ...contract.blockedShortcuts.map((item) => `- ${item}`)
].join("\n");
writeFileSync(readmePath, `${markdown}\n`, "utf8");

const rows = requiredArtifacts
  .map(
    (item) =>
      `<tr><td>${htmlEscape(item.id)}</td><td>${htmlEscape(item.expectedFormat)}</td><td>${item.satisfied ? "ready" : "missing"}</td><td>${htmlEscape(item.missingReason)}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Next Route Input Contract</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}code{background:#f5f5f5;padding:2px 4px}</style></head><body><h1>TLCL Next Route Input Contract</h1><p>Status: <code>${htmlEscape(contract.status)}</code></p><p>Route: <code>${htmlEscape(contract.route.id)}</code></p><p>Next tool: <code>${htmlEscape(contract.nextTool)}</code></p><table><thead><tr><th>Artifact</th><th>Expected format</th><th>Status</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table><h2>Suggested Manual Command</h2><pre>${htmlEscape(contract.suggestedNextCommand)}</pre></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_input_contract_result_v1",
      status: contract.status,
      readyForNextTool,
      contractPath,
      readmePath,
      htmlPath,
      routeId: contract.route.id || "",
      nextTool: contract.nextTool,
      missingInputs,
      locks: contract.locks
    },
    null,
    2
  )
);
