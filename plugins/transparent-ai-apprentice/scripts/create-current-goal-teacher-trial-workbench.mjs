#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "current-goal-teacher-trial-workbench")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "current-goal-teacher-trial-workbench"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function loadOptional(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return (
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(root, entry.name);
        const file = join(dir, fileName);
        return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time)[0]?.file || ""
  );
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    workbenchDoesNotRunIntegratedGate: true,
    workbenchDoesNotRegisterMonitor: true,
    workbenchDoesNotLaunchRunner: true,
    workbenchDoesNotReadLogs: true,
    workbenchDoesNotReadFullLogs: true,
    workbenchDoesNotCaptureScreenshots: true,
    workbenchDoesNotRecordScreen: true,
    workbenchDoesNotExecuteTargetSoftware: true,
    workbenchDoesNotWriteMemory: true,
    workbenchDoesNotEnableRules: true,
    workbenchDoesNotDowngradeRuntime: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function requirement(gate, id) {
  return Array.isArray(gate?.requirements) ? gate.requirements.find((item) => item.id === id) || null : null;
}

function trialPhases({ gate, lowToken, spatial, method, workbenchPath, receiptTemplatePath }) {
  const lowTokenReq = requirement(gate, "all_software_low_token_log_learning");
  const overlayReq = requirement(gate, "transparent_drawing_mask");
  const spatialReq = requirement(gate, "spatial_perspective_position_understanding");
  const depthReq = requirement(gate, "two_d_three_d_depth_sketch_demonstration");
  const methodReq = requirement(gate, "teacher_method_adaptation");
  const executionReq = requirement(gate, "teacher_confirmed_target_software_execution");
  const reasoningReq = requirement(gate, "high_to_medium_reasoning_cost_control");

  return [
    {
      id: "review_integrated_evidence_gate",
      status: "ready",
      teacherAction: "Open the integrated gate and review what is implementation evidence versus real completion evidence.",
      evidencePath: gate?.paths?.html || gate?.paths?.gate || "",
      commandOrFile: gate?.paths?.html || gate?.paths?.gate || "",
      completionBoundary: "Review only; this does not accept the goal."
    },
    {
      id: "select_low_token_route",
      status: lowTokenReq?.implementationEvidenceProven ? "ready_for_teacher_selection" : "waiting_for_low_token_gate",
      teacherAction:
        "Pick one low-token observation route for the software you want to trial, or request more evidence before monitor setup.",
      evidencePath: lowTokenReq?.evidencePath || "",
      commandOrFile: lowToken?.teacherRouteSelectionActionPack?.routeReceiptBuilderHtml ||
        lowToken?.teacherRouteSelectionActionPack?.routeReceiptTemplatePath ||
        "",
      validationCommand: lowToken?.teacherRouteSelectionActionPack?.routeReceiptValidationCommandTemplate || "",
      recommendedRouteId: lowToken?.recommendedFirstRouteId || "",
      completionBoundary: "Route selection does not register a monitor, read logs, or write memory."
    },
    {
      id: "draw_transparent_overlay_packet",
      status: overlayReq?.implementationEvidenceProven ? "ready_for_teacher_drawing" : "waiting_for_overlay_kit",
      teacherAction:
        "Open the browser or top-most overlay, draw the teacher intent, and export a transparent sketch packet.",
      evidencePath: overlayReq?.evidencePath || "",
      commandOrFile: spatial?.paths?.browserOverlay || spatial?.paths?.powershellOverlay || "",
      secondaryFile: spatial?.paths?.powershellOverlay || "",
      validationCommand:
        spatial?.nextCommands?.find((item) => item.id === "validate_teacher_exported_overlay_packet")?.command || "",
      completionBoundary: "The bundled sample packet remains implementation proof only; a real teacher export is required."
    },
    {
      id: "review_spatial_intent_and_depth",
      status: spatialReq?.implementationEvidenceProven && depthReq?.implementationEvidenceProven
        ? "ready_after_teacher_packet_validation"
        : "waiting_for_spatial_depth_validator",
      teacherAction:
        "Review the interpreted 2D position, perspective relation, angle/direction, and 3D depth cues before numbered target confirmation.",
      evidencePath: spatialReq?.evidencePath || depthReq?.evidencePath || "",
      commandOrFile:
        spatial?.nextCommands?.find((item) => item.id === "prefill_and_validate_spatial_receipt")?.command || "",
      numberedTargetCommand:
        spatial?.nextCommands?.find((item) => item.id === "after_teacher_review_create_numbered_targets")?.command || "",
      depthRehearsalCommand:
        spatial?.nextCommands?.find((item) => item.id === "optional_depth_demonstration_rehearsal")?.command || "",
      completionBoundary: "No target number is confirmed and no software is executed from this workbench."
    },
    {
      id: "review_teacher_method_profile",
      status: methodReq?.implementationEvidenceProven ? "ready_for_teacher_review" : "waiting_for_method_profile",
      teacherAction:
        "Correct the inferred teaching style, question policy, and preferred evidence order before any reusable method contract.",
      evidencePath: methodReq?.evidencePath || "",
      commandOrFile: method?.paths?.teacherLearningMethodReadme || method?.paths?.teacherLearningMethodProfile || "",
      contractCommand:
        method?.nextCommands?.find((item) => item.id === "create_teacher_method_execution_learning_contract_after_review")
          ?.command || "",
      completionBoundary: "A generated profile is not teacher acceptance."
    },
    {
      id: "prepare_logic_contract_and_reasoning_gate",
      status: reasoningReq?.implementationEvidenceProven ? "ready_after_teacher_review" : "waiting_for_reasoning_policy",
      teacherAction:
        "After low-token, spatial, and method evidence are reviewed, create draft_disabled logic contracts and keep medium runtime reuse locked until validators pass.",
      evidencePath: reasoningReq?.evidencePath || "",
      commandOrFile:
        spatial?.nextCommands?.find((item) => item.id === "after_teacher_review_create_logic_contract_rule_draft")
          ?.command || "",
      methodGateCommand:
        method?.nextCommands?.find((item) => item.id === "create_teacher_method_low_token_workflow_gate_after_contract")
          ?.command || "",
      completionBoundary: "Rules stay draft_disabled/review-only until a separate lifecycle gate."
    },
    {
      id: "prepare_execution_approval_gate",
      status: "blocked_until_all_teacher_evidence_is_validated",
      teacherAction:
        "Only after teacher-reviewed evidence exists, prepare a separate execution approval gate for one confirmed software action.",
      evidencePath: executionReq?.evidencePath || "",
      commandOrFile: commandText("create-spatial-to-software-execution-gate-package.mjs", [
        "--refresh-root",
        join("artifacts", "original-goal-current-status-refreshes"),
        "--spatial-validation",
        "<teacher-reviewed-spatial-intent-receipt-validation.json>",
        "--rollback-point",
        "<retained-rollback-point>",
        "--output-dir",
        join("artifacts", "current-goal-spatial-to-software-execution-gate-packages")
      ]),
      completionBoundary: "This is still not execution; the real runner remains a later teacher-confirmed gate."
    },
    {
      id: "validate_teacher_trial_receipt",
      status: "ready_for_receipt_after_teacher_trial",
      teacherAction:
        "Fill the trial receipt template with selected route, overlay packet, method review, rollback, and evidence paths; then validate it.",
      evidencePath: receiptTemplatePath,
      commandOrFile: commandText("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
        "--workbench",
        workbenchPath,
        "--receipt",
        receiptTemplatePath,
        "--output-dir",
        join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations")
      ]),
      completionBoundary: "Receipt validation routes the next manual command only; it does not run it."
    }
  ];
}

function teacherTrialReceiptTemplate({ workbenchPath, gatePath, lowToken, method }) {
  return {
    format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
    teacherDecision: "needs_teacher_trial",
    allowedTeacherDecisions: [
      "needs_teacher_trial",
      "ready_for_low_token_route_selection",
      "ready_for_overlay_packet_validation",
      "ready_for_method_contract_review",
      "ready_for_execution_gate_prep",
      "blocked"
    ],
    sourceWorkbenchPath: workbenchPath,
    sourceIntegratedGatePath: gatePath,
    selectedSoftware: "",
    selectedLowTokenRouteId: lowToken?.recommendedFirstRouteId || "",
    teacherOverlayPacketPath: "",
    teacherReviewedSpatialIntentPath: "",
    teacherReviewedMethodProfile: false,
    teacherMethodProfilePath: method?.paths?.teacherLearningMethodProfile || "",
    teacherMethodContractPath: "",
    validatedLowTokenRouteReceiptPath: "",
    teacherOverlayPacketValidationPath: "",
    confirmedRollbackPoint: "",
    teacherNotes: "",
    forbiddenDecisions: [
      "accepted",
      "execute_now",
      "enable_rule_now",
      "write_memory_now",
      "downgrade_to_medium_now",
      "delete_rollback_points"
    ],
    locks: {
      accepted: false,
      ruleEnabled: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      mediumRuntimeReuseEnabled: false,
      goalComplete: false
    }
  };
}

function writeHtml(path, workbench) {
  const phaseCards = workbench.trialPhases
    .map(
      (phase, index) => `<article class="phase">
        <h3>${index + 1}. ${htmlEscape(phase.id)}</h3>
        <p><strong>Status:</strong> ${htmlEscape(phase.status)}</p>
        <p>${htmlEscape(phase.teacherAction)}</p>
        <p><strong>Open:</strong> ${phase.commandOrFile && existsSync(phase.commandOrFile) ? link(phase.commandOrFile, phase.commandOrFile) : ""}</p>
        <pre>${htmlEscape(phase.commandOrFile && !existsSync(phase.commandOrFile) ? phase.commandOrFile : "")}</pre>
        ${phase.validationCommand ? `<p><strong>Validate:</strong></p><pre>${htmlEscape(phase.validationCommand)}</pre>` : ""}
        ${phase.numberedTargetCommand ? `<p><strong>Numbered target:</strong></p><pre>${htmlEscape(phase.numberedTargetCommand)}</pre>` : ""}
        ${phase.contractCommand ? `<p><strong>Contract:</strong></p><pre>${htmlEscape(phase.contractCommand)}</pre>` : ""}
        <p class="boundary">${htmlEscape(phase.completionBoundary)}</p>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Teacher Trial Workbench</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; }
    section, .phase { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2, h3 { margin: 0 0 12px; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .boundary { color: #8a2f18; font-weight: 600; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Teacher Trial Workbench</h1>
  <p class="status">${htmlEscape(workbench.status)}</p>
  <section>
    <h2>Start Here</h2>
    <p>This workbench turns the integrated evidence gate into one teacher trial path. It does not execute software, read logs, capture screenshots, write memory, enable rules, delete rollback points, or claim completion.</p>
    <p>${link("Integrated evidence gate", workbench.paths.integratedGateHtml || workbench.paths.integratedGate)}</p>
    <p>${link("Teacher trial receipt template", workbench.paths.receiptTemplate)}</p>
    <p>${link("Teacher trial receipt builder", workbench.paths.receiptBuilderHtml)}</p>
    <p><strong>Validate filled receipt:</strong></p>
    <pre>${htmlEscape(workbench.receiptValidationCommandTemplate)}</pre>
  </section>
  <section>
    <h2>Trial Phases</h2>
    ${phaseCards}
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReceiptBuilderHtml(path, { workbench, receiptTemplate }) {
  const templateJson = JSON.stringify(receiptTemplate, null, 2).replace(/</g, "\\u003c");
  const validationCommand = workbench.receiptValidationCommandTemplate;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Teacher Trial Receipt Builder</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1060px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2 { margin: 0 0 12px; }
    label { display: block; font-weight: 600; margin: 12px 0 4px; }
    input, select, textarea { box-sizing: border-box; width: 100%; padding: 8px; border: 1px solid #b7c3d0; border-radius: 6px; font: inherit; }
    textarea { min-height: 78px; }
    button { padding: 8px 12px; border: 1px solid #1f5d8c; border-radius: 6px; background: #256ea6; color: white; font: inherit; cursor: pointer; margin-right: 8px; }
    button.secondary { background: white; color: #1f5d8c; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .checkline { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
    .checkline input { width: auto; }
    .lock { color: #8a2f18; font-weight: 600; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Teacher Trial Receipt Builder</h1>
  <section>
    <p class="lock">This page only creates a receipt JSON file. It does not validate, read logs, capture screenshots, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
    <p><strong>Workbench:</strong> ${link(workbench.paths.workbench, workbench.paths.workbench)}</p>
    <p><strong>Validation command after download:</strong></p>
    <pre id="validation-command">${htmlEscape(validationCommand)}</pre>
  </section>
  <section>
    <h2>Receipt Fields</h2>
    <label for="teacherDecision">Teacher decision</label>
    <select id="teacherDecision">
      ${receiptTemplate.allowedTeacherDecisions
        .map((decision) => `<option value="${htmlEscape(decision)}">${htmlEscape(decision)}</option>`)
        .join("")}
    </select>
    <div class="grid">
      <div>
        <label for="selectedSoftware">Selected software</label>
        <input id="selectedSoftware" placeholder="Example: SketchUp, SolidWorks, Browser, packaging CAD tool" />
      </div>
      <div>
        <label for="selectedLowTokenRouteId">Selected low-token route id</label>
        <input id="selectedLowTokenRouteId" value="${htmlEscape(receiptTemplate.selectedLowTokenRouteId)}" />
      </div>
      <div>
        <label for="teacherOverlayPacketPath">Teacher overlay packet path</label>
        <input id="teacherOverlayPacketPath" placeholder="Path to teacher-exported transparent sketch packet JSON" />
      </div>
      <div>
        <label for="teacherOverlayPacketValidationPath">Overlay packet validation path</label>
        <input id="teacherOverlayPacketValidationPath" />
      </div>
      <div>
        <label for="teacherReviewedSpatialIntentPath">Teacher-reviewed spatial intent path</label>
        <input id="teacherReviewedSpatialIntentPath" />
      </div>
      <div>
        <label for="validatedLowTokenRouteReceiptPath">Validated low-token route receipt path</label>
        <input id="validatedLowTokenRouteReceiptPath" />
      </div>
      <div>
        <label for="teacherMethodProfilePath">Teacher method profile path</label>
        <input id="teacherMethodProfilePath" value="${htmlEscape(receiptTemplate.teacherMethodProfilePath)}" />
      </div>
      <div>
        <label for="teacherMethodContractPath">Teacher method contract path</label>
        <input id="teacherMethodContractPath" />
      </div>
      <div>
        <label for="confirmedRollbackPoint">Confirmed rollback point</label>
        <input id="confirmedRollbackPoint" placeholder="Retained rollback point id or path" />
      </div>
    </div>
    <label class="checkline"><input type="checkbox" id="teacherReviewedMethodProfile" /> Teacher reviewed the method profile</label>
    <label for="teacherNotes">Teacher notes</label>
    <textarea id="teacherNotes"></textarea>
    <p>
      <button id="generate">Generate Receipt JSON</button>
      <button id="copy" class="secondary">Copy JSON</button>
      <button id="download" class="secondary">Download Receipt JSON</button>
    </p>
  </section>
  <section>
    <h2>Generated Receipt</h2>
    <pre id="output"></pre>
  </section>
</main>
<script id="receipt-template" type="application/json">${templateJson}</script>
<script>
  const template = JSON.parse(document.getElementById("receipt-template").textContent);
  const textFields = [
    "selectedSoftware",
    "selectedLowTokenRouteId",
    "teacherOverlayPacketPath",
    "teacherReviewedSpatialIntentPath",
    "teacherMethodProfilePath",
    "teacherMethodContractPath",
    "validatedLowTokenRouteReceiptPath",
    "teacherOverlayPacketValidationPath",
    "confirmedRollbackPoint",
    "teacherNotes"
  ];
  function buildReceipt() {
    const receipt = JSON.parse(JSON.stringify(template));
    receipt.teacherDecision = document.getElementById("teacherDecision").value;
    for (const field of textFields) {
      receipt[field] = document.getElementById(field).value.trim();
    }
    receipt.teacherReviewedMethodProfile = document.getElementById("teacherReviewedMethodProfile").checked;
    receipt.locks = {
      accepted: false,
      ruleEnabled: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      mediumRuntimeReuseEnabled: false,
      goalComplete: false
    };
    return receipt;
  }
  function render() {
    const json = JSON.stringify(buildReceipt(), null, 2);
    document.getElementById("output").textContent = json;
    return json;
  }
  document.getElementById("generate").addEventListener("click", render);
  document.getElementById("copy").addEventListener("click", async () => {
    const json = render();
    if (navigator.clipboard) await navigator.clipboard.writeText(json);
  });
  document.getElementById("download").addEventListener("click", () => {
    const json = render();
    const blob = new Blob([json + "\\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teacher-filled-trial-workbench-receipt.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
  render();
</script>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, workbench) {
  const lines = [
    "# Current Goal Teacher Trial Workbench",
    "",
    `Status: ${workbench.status}`,
    "",
    "Use this after the integrated evidence gate. It collects the teacher's first real trial choices into one receipt before any execution gate.",
    "",
    "## Order",
    "",
    ...workbench.trialPhases.map((phase, index) => `${index + 1}. ${phase.id}: ${phase.teacherAction}`),
    "",
    "## Fill and validate",
    "",
    `- Receipt builder: ${workbench.paths.receiptBuilderHtml}`,
    `- Receipt template: ${workbench.paths.receiptTemplate}`,
    `- Validation command: ${workbench.receiptValidationCommandTemplate}`,
    "",
    "## Locks",
    "",
    "- Review-only.",
    "- Does not run monitors, read logs, capture screenshots, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Teacher trial for current goal: all-software low-token learning, transparent overlay drawing, spatial 2D/3D depth review, teacher method adaptation, and later execution approval."
);
const slug = slugify(goal);
const workbenchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}`;
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-teacher-trial-workbenches")));
const workbenchDir = join(outputRoot, workbenchId);
mkdirSync(workbenchDir, { recursive: true });

const integratedGatePath =
  argValue("--integrated-gate") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-integrated-evidence-gates"),
    "current-goal-integrated-evidence-gate.json"
  );
const gate = loadOptional(integratedGatePath);
if (!gate) throw new Error("Missing or unreadable integrated evidence gate. Run create-current-goal-integrated-evidence-gate.mjs first.");

const lowTokenPath = gate.paths?.lowTokenHandoff || "";
const spatialPath = gate.paths?.teacherSpatialDrawingHandoff || "";
const methodPath = gate.paths?.teacherMethodAdaptationHandoff || "";
const lowToken = loadOptional(lowTokenPath);
const spatial = loadOptional(spatialPath);
const method = loadOptional(methodPath);

const workbenchPath = join(workbenchDir, "current-goal-teacher-trial-workbench.json");
const htmlPath = join(workbenchDir, "current-goal-teacher-trial-workbench.html");
const readmePath = join(workbenchDir, "CURRENT_GOAL_TEACHER_TRIAL_WORKBENCH.md");
const receiptTemplatePath = join(workbenchDir, "teacher-trial-workbench-receipt-template.json");
const receiptBuilderHtmlPath = join(workbenchDir, "teacher-trial-workbench-receipt-builder.html");
const validationOutputDir = join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations");
const receiptValidationCommandTemplate = commandText("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
  "--workbench",
  workbenchPath,
  "--receipt",
  "<teacher-filled-trial-workbench-receipt.json>",
  "--output-dir",
  validationOutputDir
]);
const phaseRows = trialPhases({ gate, lowToken, spatial, method, workbenchPath, receiptTemplatePath });
const lockState = locks();
const receiptTemplate = teacherTrialReceiptTemplate({
  workbenchPath,
  gatePath: integratedGatePath,
  lowToken,
  method
});

const workbench = {
  ok: true,
  format: "transparent_ai_current_goal_teacher_trial_workbench_v1",
  workbenchId,
  createdAt: new Date().toISOString(),
  goal,
  status: "teacher_trial_ready_review_only_waiting_for_real_teacher_receipt",
  sourceIntegratedGateStatus: gate.status || "",
  sourceCompletionAudit: gate.completionAudit || {},
  trialPhases: phaseRows,
  teacherTrialReceiptTemplateSummary: {
    format: receiptTemplate.format,
    defaultTeacherDecision: receiptTemplate.teacherDecision,
    allowedTeacherDecisions: receiptTemplate.allowedTeacherDecisions,
    forbiddenDecisions: receiptTemplate.forbiddenDecisions
  },
  receiptValidationCommandTemplate,
  paths: {
    workbench: workbenchPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    receiptBuilderHtml: receiptBuilderHtmlPath,
    integratedGate: integratedGatePath,
    integratedGateHtml: gate.paths?.html || "",
    lowTokenHandoff: lowTokenPath,
    teacherSpatialDrawingHandoff: spatialPath,
    teacherMethodAdaptationHandoff: methodPath
  },
  blockedActions: [
    "run_monitor_from_teacher_trial_workbench",
    "read_logs_from_teacher_trial_workbench",
    "capture_screenshot_from_teacher_trial_workbench",
    "execute_target_software_from_teacher_trial_workbench",
    "write_memory_from_teacher_trial_workbench",
    "enable_rules_from_teacher_trial_workbench",
    "downgrade_to_medium_runtime_from_teacher_trial_workbench",
    "delete_rollback_points_from_teacher_trial_workbench",
    "claim_goal_complete_from_teacher_trial_workbench"
  ],
  locks: lockState,
  goalComplete: false
};

writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(workbenchPath, `${JSON.stringify(workbench, null, 2)}\n`, "utf8");
writeReceiptBuilderHtml(receiptBuilderHtmlPath, { workbench, receiptTemplate });
writeHtml(htmlPath, workbench);
writeReadme(readmePath, workbench);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_teacher_trial_workbench_result_v1",
      status: workbench.status,
      workbenchPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      receiptBuilderHtmlPath,
      phaseCount: phaseRows.length,
      locks: lockState
    },
    null,
    2
  )
);
