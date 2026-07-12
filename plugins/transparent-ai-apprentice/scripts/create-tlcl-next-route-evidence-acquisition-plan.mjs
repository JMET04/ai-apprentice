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
    String(value || "tlcl-next-route-evidence-acquisition-plan")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-acquisition-plan"
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
    evidenceAcquisitionPlanOnly: true,
    commandTemplateOnly: true,
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

function actionForMissing(id, contractInput, contract) {
  const directionConsolePath = contract.directionConsolePath || "<tlcl-direction-operational-console.json>";
  const artifact = (contract.requiredArtifacts || []).find((item) => item.id === id) || {};

  if (id === "reviewed_tlcl_rag_evidence_attachment") {
    return {
      missingInputId: id,
      label: artifact.label || "Reviewed TLCL RAG evidence attachment",
      purpose:
        "Create a reviewed, evidence-only RAG attachment before preparing high-reasoning contract repair.",
      requiredEvidence: [
        "current TLCL packet path and hash",
        "reviewed RAG retrieval-draft review validation with approved disabled draft refs",
        "teacher confirmation that RAG is evidence only and not authority",
        "retained rollback point for the upcoming contract-repair lane"
      ],
      existingToolsToReuse: [
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
        "create-tlcl-rag-evidence-attachment.mjs",
        "create-tlcl-next-route-input-contract.mjs"
      ],
      orderedTeacherSteps: [
        "Locate or create the current TLCL packet from the reviewed TLCL status/route evidence.",
        "Locate the reviewed RAG validation result; if absent, continue through the existing RAG review-only Rule DSL validation chain.",
        "Ask the teacher to confirm that retrieved knowledge is evidence only and cannot execute, enable rules, or write memory.",
        "Run the attachment command manually only after the teacher supplies the TLCL packet and reviewed RAG validation paths.",
        "Regenerate the next-route input contract with the attachment path and retained rollback point."
      ],
      commandTemplates: [
        commandLine("create-tlcl-rag-evidence-attachment.mjs", [
          ["--tlcl-packet", "<tlcl-packet.json>"],
          ["--rag-validation", "<reviewed-rag-validation.json>"]
        ]),
        commandLine("create-tlcl-next-route-input-contract.mjs", [
          ["--direction-console", directionConsolePath],
          ["--attachment", "<tlcl-rag-evidence-attachment.json>"],
          ["--rollback-point", "<retained-rollback-point-dir-or-manifest>"]
        ])
      ],
      stopConditions: [
        "RAG validation is not review-only or not evidence-only.",
        "No approved disabled draft refs are present.",
        "Teacher refuses evidence-only confirmation.",
        "Rollback point is missing before contract repair."
      ]
    };
  }

  if (id === "rollback_point_retained") {
    return {
      missingInputId: id,
      label: artifact.label || "Retained rollback point",
      purpose: "Preserve a known recovery point before contract repair, medium runtime preparation, or manual next-route use.",
      requiredEvidence: [
        "rollback point directory or manifest path",
        "teacher note that the rollback point must be retained until the direction is confirmed"
      ],
      existingToolsToReuse: ["create-rollback-point.mjs", "confirm-rollback-point.mjs"],
      orderedTeacherSteps: [
        "Create or identify a rollback point before any next-route preparation changes state.",
        "Do not delete it during this review pass.",
        "Use the rollback path when regenerating the input contract or preparing the manual next-route handoff."
      ],
      commandTemplates: [
        commandLine("create-rollback-point.mjs", [["--reason", "before TLCL next-route evidence acquisition"]]),
        commandLine("create-tlcl-next-route-input-contract.mjs", [
          ["--direction-console", directionConsolePath],
          ["--rollback-point", "<retained-rollback-point-dir-or-manifest>"]
        ])
      ],
      stopConditions: ["Rollback point cannot be found or created.", "Teacher asks to delete the rollback point before confirmation."]
    };
  }

  if (id === "tlcl_packet_path") {
    return {
      missingInputId: id,
      label: artifact.label || "Current TLCL packet path",
      purpose: "Provide the contract or status packet that RAG evidence will be attached to.",
      requiredEvidence: ["reviewed TLCL status refresh, direction console, launcher, runtime gate, or route packet path"],
      existingToolsToReuse: ["create-tlcl-status-refresh.mjs", "create-tlcl-direction-operational-console.mjs"],
      orderedTeacherSteps: [
        "Open the latest TLCL status refresh or direction console.",
        "Choose the packet that represents the contract/workflow to be repaired or compiled.",
        "Use that path as --tlcl-packet when creating the RAG evidence attachment."
      ],
      commandTemplates: [
        commandLine("create-tlcl-status-refresh.mjs", [["--goal", "refresh current TLCL packet evidence"]])
      ],
      stopConditions: ["No current TLCL packet exists.", "Teacher says the available packet is stale."]
    };
  }

  if (id === "reviewed_rag_validation_path") {
    return {
      missingInputId: id,
      label: artifact.label || "Reviewed RAG validation result path",
      purpose: "Make retrieved knowledge review-only and validator-checked before it can inform a TLCL contract repair.",
      requiredEvidence: [
        "source registry or local ingest evidence",
        "retrieval draft with source ids and locators",
        "teacher-reviewed retrieval draft receipt validation",
        "approved disabled Rule Card drafts"
      ],
      existingToolsToReuse: [
        "knowledge/create-rag-confirmed-source-registry-package.mjs",
        "knowledge/run-rag-confirmed-local-ingest.mjs",
        "knowledge/run-rag-confirmed-retrieval-draft.mjs",
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs"
      ],
      orderedTeacherSteps: [
        "Register or confirm the knowledge source before ingest.",
        "Run local ingest and retrieval draft only through the existing reviewed RAG lane.",
        "Review retrieved chunks and disabled drafts.",
        "Use the resulting reviewed RAG validation path as --rag-validation."
      ],
      commandTemplates: [
        "node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation \"<retrieval-draft-review-validation.json>\""
      ],
      stopConditions: ["Sources are unconfirmed.", "Retrieved chunks do not support the logic hint.", "Teacher requests primary-source verification first."]
    };
  }

  if (id === "teacher_confirmation") {
    return {
      missingInputId: id,
      label: artifact.label || "Teacher confirmation",
      purpose: "Capture the teacher's explicit boundary confirmation before regenerating the route input contract.",
      requiredEvidence: ["teacher says RAG is evidence only, or selects the route, or approves manual next-route use"],
      existingToolsToReuse: [
        "create-tlcl-next-route-input-contract-receipt-builder.mjs",
        "validate-tlcl-next-route-input-contract-receipt.mjs"
      ],
      orderedTeacherSteps: [
        "Build the receipt from the current input contract.",
        "Teacher fills the confirmation and blocked-shortcut review rows.",
        "Validate the receipt to produce only a manual regeneration or next-route handoff."
      ],
      commandTemplates: [
        commandLine("create-tlcl-next-route-input-contract-receipt-builder.mjs", [
          ["--input-contract", contractInput.path || "<tlcl-next-route-input-contract.json>"]
        ])
      ],
      stopConditions: ["Teacher confirmation is ambiguous.", "Receipt contains an execute-now or accepted shortcut."]
    };
  }

  if (id === "reasoning_budget_review") {
    return {
      missingInputId: id,
      label: artifact.label || "Reasoning budget review",
      purpose: "Prove medium-runtime reuse is cheaper without bypassing validator and escalation boundaries.",
      requiredEvidence: [
        "reviewed reasoning-tier boundary",
        "correction/unknown/error escalation policy",
        "teacher-reviewed budget receipt"
      ],
      existingToolsToReuse: [
        "create-tlcl-reasoning-budget-governor.mjs",
        "validate-tlcl-reasoning-budget-governor-review-receipt.mjs"
      ],
      orderedTeacherSteps: [
        "Create the reasoning-budget governor packet.",
        "Teacher reviews which work belongs to senior compiler, medium runtime, and low reasoning/tool layer.",
        "Validate the review receipt before allowing medium-runtime preparation."
      ],
      commandTemplates: [
        commandLine("create-tlcl-reasoning-budget-governor.mjs", [["--goal", "review medium-runtime reuse readiness"]])
      ],
      stopConditions: ["Medium runtime is asked to change rules.", "Unknown/fail/error would not escalate to senior compile."]
    };
  }

  if (id === "reusable_workflow_activation") {
    return {
      missingInputId: id,
      label: artifact.label || "Reusable workflow activation",
      purpose: "Require reusable workflow evidence before medium-runtime invocation.",
      requiredEvidence: [
        "reviewed workflow fingerprint",
        "deterministic validation package",
        "activation/reuse receipt validation",
        "rollback point retained"
      ],
      existingToolsToReuse: [
        "create-tlcl-medium-runtime-reusable-workflow-activation.mjs",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs"
      ],
      orderedTeacherSteps: [
        "Activate only reviewed reusable workflow evidence.",
        "Prepare invocation as dry-run/review-only first.",
        "Return correction or mismatch to high-reasoning repair."
      ],
      commandTemplates: [
        commandLine("create-tlcl-medium-runtime-reusable-workflow-activation.mjs", [
          ["--goal", "activate reviewed TLCL reusable workflow"]
        ])
      ],
      stopConditions: ["Workflow fingerprint is missing.", "Teacher correction has not returned to high-reasoning repair."]
    };
  }

  return {
    missingInputId: id,
    label: artifact.label || id,
    purpose: "Collect the missing required artifact before using the selected route.",
    requiredEvidence: [artifact.expectedFormat || "teacher-reviewed evidence path"],
    existingToolsToReuse: ["create-tlcl-next-route-input-contract-receipt-builder.mjs"],
    orderedTeacherSteps: [
      "Ask the teacher or next agent to identify the missing evidence.",
      "Record the path in the next-route input contract receipt.",
      "Regenerate or revalidate the input contract before using the next route."
    ],
    commandTemplates: [
      commandLine("create-tlcl-next-route-input-contract-receipt-builder.mjs", [
        ["--input-contract", contractInput.path || "<tlcl-next-route-input-contract.json>"]
      ])
    ],
    stopConditions: ["The evidence path is unknown.", "The evidence is not teacher-reviewed."]
  };
}

const goal = argValue("--goal", "Plan missing evidence acquisition for the current TLCL next route.");
const contractInput = readJsonInput(
  argValue("--input-contract", argValue("--contract", "")),
  "--input-contract",
  "transparent_ai_tlcl_next_route_input_contract_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-acquisition-plans"))
);
const contract = contractInput.value;
const routeId = contract.route?.id || "";
const planId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(routeId || goal)}`;
const planDir = join(outRoot, planId);
const planPath = join(planDir, "tlcl-next-route-evidence-acquisition-plan.json");
const readmePath = join(planDir, "TLCL_NEXT_ROUTE_EVIDENCE_ACQUISITION_PLAN_START_HERE.md");
const htmlPath = join(planDir, "tlcl-next-route-evidence-acquisition-plan.html");
const missingInputs = Array.isArray(contract.missingInputs)
  ? contract.missingInputs
  : (contract.requiredArtifacts || []).filter((item) => item.required && !item.satisfied).map((item) => item.id);
const actionRows = missingInputs.map((id) => actionForMissing(id, contractInput, contract));
const regenerationCommandTemplate = commandLine("create-tlcl-next-route-input-contract.mjs", [
  ["--direction-console", contract.directionConsolePath || "<tlcl-direction-operational-console.json>"],
  ["--attachment", "<tlcl-rag-evidence-attachment.json>"],
  ["--rollback-point", "<retained-rollback-point-dir-or-manifest>"]
]);
const status =
  actionRows.length > 0
    ? "evidence_acquisition_plan_ready_for_teacher_review"
    : "no_missing_evidence_inputs_waiting_for_manual_next_route_receipt";
const plan = {
  format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1",
  planId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceContractPath: contractInput.path,
  contractId: contract.contractId || "",
  contractStatus: contract.status || "",
  routeId,
  routeLabel: contract.route?.label || "",
  nextTool: contract.nextTool || "",
  readyForNextToolAccordingToContract: Boolean(contract.readyForNextTool),
  missingInputs,
  missingEvidenceMap: Object.fromEntries(actionRows.map((row) => [row.missingInputId, row.requiredEvidence])),
  actionRows,
  suggestedManualCommands: actionRows.flatMap((row) => row.commandTemplates || []),
  regenerationCommandTemplate,
  blockedShortcuts: [
    "Do not execute the selected next-route tool from this plan.",
    "Do not fetch RAG or invoke a model from this plan.",
    "Do not treat RAG evidence as authority.",
    "Do not enable rules, write memory, unlock packaging, execute target software, or claim completion.",
    "Do not delete rollback points before teacher confirmation."
  ],
  nextReviewHandoff: {
    executeNow: false,
    instruction:
      actionRows.length > 0
        ? "Teacher or next agent should collect these evidence paths, then regenerate or validate the TLCL next-route input contract."
        : "Contract reports no missing inputs; use the existing receipt builder/validator before any manual next-route handoff.",
    recommendedTool:
      actionRows.length > 0
        ? "create_tlcl_next_route_input_contract_receipt_builder"
        : "validate_tlcl_next_route_input_contract_receipt",
    commandTemplate:
      actionRows.length > 0
        ? commandLine("create-tlcl-next-route-input-contract-receipt-builder.mjs", [
            ["--input-contract", contractInput.path || "<tlcl-next-route-input-contract.json>"]
          ])
        : contract.suggestedNextCommand || "<manual next-route command from input contract>"
  },
  paths: {
    plan: planPath,
    readme: readmePath,
    html: htmlPath,
    sourceContract: contractInput.path
  },
  locks: locks()
};

writeJson(planPath, plan);
writeFileSync(
  readmePath,
  [
    "# TLCL Next-Route Evidence Acquisition Plan",
    "",
    `Status: ${status}`,
    `Route: ${routeId || "<none>"}`,
    `Next tool: ${plan.nextTool || "<none>"}`,
    `Source contract: ${contractInput.path || "<inline>"}`,
    "",
    "This plan describes how to collect missing evidence for the selected TLCL route.",
    "It does not invoke models, fetch RAG, run the next tool, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Missing Inputs",
    ...(missingInputs.length ? missingInputs.map((id) => `- ${id}`) : ["- none"]),
    "",
    "## Manual Command Templates",
    ...(plan.suggestedManualCommands.length ? plan.suggestedManualCommands.map((cmd) => `- ${cmd}`) : ["- none"]),
    "",
    "## Regeneration Command Template",
    "",
    regenerationCommandTemplate
  ].join("\n"),
  "utf8"
);

const actionRowsHtml = actionRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.missingInputId)}</td><td>${htmlEscape(row.purpose)}</td><td><ul>${row.existingToolsToReuse
        .map((tool) => `<li>${htmlEscape(tool)}</li>`)
        .join("")}</ul></td><td><ol>${row.orderedTeacherSteps
        .map((step) => `<li>${htmlEscape(step)}</li>`)
        .join("")}</ol></td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL Evidence Acquisition Plan</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>TLCL Next-Route Evidence Acquisition Plan</h1><p>Status: <code>${htmlEscape(status)}</code></p><p>Route: <code>${htmlEscape(routeId)}</code></p><p>Next tool: <code>${htmlEscape(plan.nextTool)}</code></p><table><thead><tr><th>Missing input</th><th>Purpose</th><th>Existing tools</th><th>Teacher steps</th></tr></thead><tbody>${actionRowsHtml || "<tr><td colspan=\"4\">No missing evidence inputs.</td></tr>"}</tbody></table><h2>Command Templates</h2><pre>${htmlEscape(plan.suggestedManualCommands.join("\n\n") || "none")}</pre><h2>Locks</h2><pre>${htmlEscape(JSON.stringify(plan.locks, null, 2))}</pre></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_result_v1",
      status,
      planId,
      routeId,
      nextTool: plan.nextTool,
      missingInputCount: missingInputs.length,
      actionRowCount: actionRows.length,
      planPath,
      readmePath,
      htmlPath,
      executeNow: false,
      locks: plan.locks
    },
    null,
    2
  )
);
