#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function values(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

function argValue(name, fallback = "") {
  const found = values(name);
  return found.length ? found[found.length - 1] : fallback;
}

function slug(value) {
  return (
    String(value || "real-case-pilot-intake")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-pilot-intake"
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function locks() {
  return {
    reviewOnly: true,
    intakeOnly: true,
    intakeDoesNotRunNextTool: true,
    intakeDoesNotInvokeModel: true,
    intakeDoesNotFetchRag: true,
    intakeDoesNotExecuteSoftware: true,
    intakeDoesNotCaptureScreenshot: true,
    intakeDoesNotWriteMemory: true,
    intakeDoesNotEnableRule: true,
    intakeDoesNotUnlockPackaging: true,
    nextToolExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  };
}

function normalizeCaseType(value) {
  const text = String(value || "engineering_software_case").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["packaging", "box", "packaging_box", "paper_box", "dieline"].includes(text)) return "packaging_box";
  if (["cad", "drawing", "engineering_drawing", "cad_drawing"].includes(text)) return "cad_drawing";
  if (["software", "engineering", "engineering_software", "engineering_software_case"].includes(text)) {
    return "engineering_software_case";
  }
  return text || "engineering_software_case";
}

function recommendedRoutes(caseType) {
  const shared = [
    {
      route: "start_with_tlcl_launcher",
      label: "Start TLCL apprentice session",
      nextTool: "create_tlcl_apprentice_session_launcher",
      reason: "Creates the teacher-facing session shell before any specialized case work.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-apprentice-session-launcher.mjs --goal "<case-goal>" --software "<software>" --rollback-point "<rollback-point>"',
      executeNow: false,
      reviewOnly: true
    },
    {
      route: "prepare_rag_evidence",
      label: "Prepare knowledge evidence",
      nextTool: "knowledge_rag_source_intake_or_tlcl_rag_evidence_attachment",
      reason: "Turns manuals, standards, prior drawings, or teacher notes into evidence only, not authority.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-rag-evidence-attachment.mjs --query "<case-query>"',
      executeNow: false,
      reviewOnly: true
    },
    {
      route: "prepare_universal_detail_logic",
      label: "Teach strict detail logic",
      nextTool: "create_parametric_drawing_logic_learning_kit",
      reason: "Captures dimensions, angles, folds, offsets, constraints, and data-to-output relationships before generation.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-parametric-drawing-logic-learning-kit.mjs --goal "<logic-goal>"',
      executeNow: false,
      reviewOnly: true
    },
    {
      route: "prepare_voice_numbered_confirmation",
      label: "Prepare voice/text numbered confirmation",
      nextTool: "create_visual_engineering_target_confirmation_kit",
      reason: "Lets non-expert commands become numbered visual targets before any software action.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-visual-engineering-target-confirmation-kit.mjs --goal "<case-goal>"',
      executeNow: false,
      reviewOnly: true
    },
    {
      route: "request_more_case_evidence",
      label: "Request more case evidence",
      nextTool: "manual_case_evidence_collection",
      reason: "Stops the pilot when essential drawings, dimensions, knowledge sources, or rollback evidence are missing.",
      commandTemplate: "",
      executeNow: false,
      reviewOnly: true
    },
    {
      route: "correction_to_high_reasoning_repair",
      label: "Escalate to high reasoning repair",
      nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
      reason: "Use the expensive reasoning layer when the case exposes a logic-contract problem.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-rag-informed-high-reasoning-repair-intake.mjs --teacher-correction "<teacher-notes>"',
      executeNow: false,
      reviewOnly: true
    }
  ];
  if (caseType === "packaging_box") {
    return shared.map((route) =>
      route.route === "prepare_universal_detail_logic"
        ? {
            ...route,
            reason:
              "Captures dieline, fold, glue flap, bleed, slot, angle, material thickness, and dimension relationships before similar packaging output."
          }
        : route
    );
  }
  if (caseType === "cad_drawing") {
    return shared.map((route) =>
      route.route === "prepare_universal_detail_logic"
        ? {
            ...route,
            reason:
              "Captures CAD geometry constraints, angles, offsets, dimensions, and parametric relationships before any draw or modify route."
          }
        : route
    );
  }
  return shared;
}

const goal = argValue("--goal", argValue("--teacher-goal", "Prepare a real case pilot for Transparent AI Apprentice."));
const caseType = normalizeCaseType(argValue("--case-type", argValue("--case", "")));
const software = argValue("--software", argValue("--app", ""));
const teacherCommand = argValue("--teacher-command", argValue("--command", ""));
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const artifacts = [...values("--artifact"), ...values("--source-artifact")].map((item) => String(item).trim()).filter(Boolean);
const knowledgeSources = [...values("--knowledge-source"), ...values("--source")].map((item) => String(item).trim()).filter(Boolean);
const constraints = values("--constraint").map((item) => String(item).trim()).filter(Boolean);
const outputRoot = resolve(argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-pilot-intakes")));

const intakeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(caseType || goal)}`;
const intakeDir = join(outputRoot, intakeId);
const intakePath = join(intakeDir, "real-case-pilot-intake.json");
const receiptTemplatePath = join(intakeDir, "real-case-pilot-intake-receipt-template.json");
const readmePath = join(intakeDir, "REAL_CASE_PILOT_INTAKE_START_HERE.md");
const htmlPath = join(intakeDir, "real-case-pilot-intake.html");
const intakeLocks = locks();

const evidenceRows = [
  {
    id: "case_goal",
    label: "Case goal",
    required: true,
    present: Boolean(goal.trim()),
    value: goal,
    teacherReviewRequired: true
  },
  {
    id: "source_artifacts",
    label: "Source drawings, screenshots, CAD files, tables, or examples",
    required: true,
    present: artifacts.length > 0,
    value: artifacts,
    teacherReviewRequired: true
  },
  {
    id: "logic_constraints",
    label: "Known dimensions, angles, tolerances, folds, offsets, or data relationships",
    required: true,
    present: constraints.length > 0,
    value: constraints,
    teacherReviewRequired: true
  },
  {
    id: "knowledge_sources",
    label: "Manuals, standards, prior notes, or domain references for RAG evidence",
    required: false,
    present: knowledgeSources.length > 0,
    value: knowledgeSources,
    teacherReviewRequired: true
  },
  {
    id: "target_software",
    label: "Target software or existing tool to reuse",
    required: false,
    present: Boolean(software.trim()),
    value: software,
    teacherReviewRequired: true
  },
  {
    id: "rollback_point",
    label: "Retained rollback point before real-case actions",
    required: true,
    present: Boolean(rollbackPoint.trim()),
    value: rollbackPoint,
    teacherReviewRequired: true
  }
];
const missingRequiredEvidence = evidenceRows.filter((row) => row.required && !row.present).map((row) => row.id);
const routes = recommendedRoutes(caseType);
const status =
  missingRequiredEvidence.length === 0
    ? "real_case_pilot_intake_waiting_for_teacher_route_choice"
    : "real_case_pilot_intake_waiting_for_required_evidence";

const receiptTemplate = {
  format: "transparent_ai_real_case_pilot_intake_receipt_v1",
  sourceIntakeId: intakeId,
  sourceIntakePath: intakePath,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "pilot_route_selected_for_manual_preparation",
    "provide_missing_case_evidence",
    "correction_to_high_reasoning_repair",
    "blocked",
    "needs_teacher_review"
  ],
  forbiddenTeacherDecisions: [
    "execute_now",
    "accepted",
    "run_next_tool",
    "invoke_model",
    "fetch_rag",
    "enable_rule",
    "write_memory",
    "unlock_packaging",
    "claim_complete"
  ],
  selectedRoute: "",
  allowedRoutes: routes.map((route) => route.route),
  reviewedEvidenceRows: evidenceRows.map((row) => ({
    id: row.id,
    present: row.present,
    teacherReviewed: false,
    suppliedValue: row.value,
    reviewerNote: ""
  })),
  selectedRouteReviewed: false,
  rollbackRetained: Boolean(rollbackPoint.trim()),
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: true,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: intakeLocks
};

const intake = {
  ok: true,
  format: "transparent_ai_real_case_pilot_intake_v1",
  intakeId,
  createdAt: new Date().toISOString(),
  goal,
  caseType,
  software,
  teacherCommand,
  artifacts,
  knowledgeSources,
  constraints,
  rollbackPoint,
  status,
  missingRequiredEvidence,
  evidenceRows,
  recommendedRoutes: routes,
  receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-pilot-intake-receipt.mjs --intake "' +
    intakePath +
    '" --receipt "<teacher-filled-real-case-pilot-intake-receipt.json>"',
  blockedActions: [
    "run_next_tool_from_real_case_intake",
    "invoke_model_from_real_case_intake",
    "fetch_rag_from_real_case_intake",
    "execute_software_from_real_case_intake",
    "capture_screenshot_from_real_case_intake",
    "write_memory_from_real_case_intake",
    "enable_rule_from_real_case_intake",
    "unlock_packaging_from_real_case_intake",
    "claim_completion_from_real_case_intake"
  ],
  locks: intakeLocks,
  paths: {
    intake: intakePath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(intakePath, intake);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real Case Pilot Intake",
    "",
    `Status: ${status}`,
    `Case type: ${caseType}`,
    `Goal: ${goal}`,
    `Missing required evidence: ${missingRequiredEvidence.join(", ") || "none"}`,
    "",
    "This intake converts a real packaging/CAD/engineering-software case into a TLCL review package. It does not run tools, invoke models, fetch RAG, execute software, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Next validation command",
    "```powershell",
    intake.nextValidationCommand,
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
  <title>Real Case Pilot Intake</title>
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
    <h1>Real Case Pilot Intake</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>Case type: <code>${htmlEscape(caseType)}</code></p>
    <p>This page creates a teacher receipt only. It does not run tools, call models, fetch RAG, execute software, or write memory.</p>
    <section>
      <p>Intake: <a href="${htmlEscape(pathToFileURL(intakePath).href)}">${htmlEscape(intakePath)}</a></p>
      <p>Validation command: <code>${htmlEscape(intake.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="pilot_route_selected_for_manual_preparation">pilot_route_selected_for_manual_preparation</option>
          <option value="provide_missing_case_evidence">provide_missing_case_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
          <option value="blocked">blocked</option>
        </select>
      </label>
      <label>Selected route
        <select id="route">
          <option value="">needs_teacher_review</option>
          ${routes.map((route) => `<option value="${htmlEscape(route.route)}">${htmlEscape(route.route)}</option>`).join("\n          ")}
        </select>
      </label>
      <label><input id="routeReviewed" type="checkbox"> Selected route reviewed</label>
      <label><input id="rollback" type="checkbox"> Rollback retained</label>
      <label><input id="noExecution" type="checkbox"> Confirm no execution now</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Recommended Routes</h2>
      <textarea id="routeJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const intake = ${jsonForScript(intake)};
    const receiptEl = document.getElementById("receiptJson");
    document.getElementById("routeJson").value = JSON.stringify(intake.recommendedRoutes, null, 2);
    function buildReceipt() {
      return {
        ...intake.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        selectedRoute: document.getElementById("route").value,
        selectedRouteReviewed: document.getElementById("routeReviewed").checked,
        rollbackRetained: document.getElementById("rollback").checked,
        teacherConfirmedNoExecution: document.getElementById("noExecution").checked,
        reviewedEvidenceRows: intake.receiptTemplate.reviewedEvidenceRows.map((row) => ({ ...row, teacherReviewed: row.present })),
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
      ok: true,
      format: "transparent_ai_real_case_pilot_intake_result_v1",
      status,
      intakeId,
      caseType,
      missingRequiredEvidence,
      recommendedRoutes: routes,
      intakePath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      locks: intakeLocks
    },
    null,
    2
  )
);
