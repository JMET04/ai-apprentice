#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
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

function entryById(launchpad, id) {
  return Array.isArray(launchpad?.entryLinks) ? launchpad.entryLinks.find((item) => item.id === id) || null : null;
}

function actionById(launchpad, id) {
  return Array.isArray(launchpad?.safeNextActions)
    ? launchpad.safeNextActions.find((item) => item.id === id) || null
    : null;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotReadLogs: true,
    packDoesNotReadFullLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotRecordScreen: true,
    packDoesNotRegisterMonitor: true,
    packDoesNotLaunchRunner: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotWriteMemory: true,
    packDoesNotEnableRules: true,
    packDoesNotDowngradeRuntime: true,
    packDoesNotDeleteRollbackPoints: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function step({
  id,
  title,
  teacherAction,
  openPath = "",
  verifyCommand = "",
  requiredReceiptField = "",
  evidenceSlot = "",
  stopIf = "",
  boundary = ""
}) {
  return {
    id,
    title,
    teacherAction,
    openPath,
    openPathExists: Boolean(openPath && existsSync(openPath)),
    verifyCommand,
    requiredReceiptField,
    evidenceSlot,
    stopIf,
    boundary
  };
}

function shortestReceiptTemplate(packPath, teacherTrialPath) {
  return {
    format: "transparent_ai_current_goal_shortest_teacher_evidence_receipt_v1",
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "ready_for_trial_receipt_routing",
      "ready_for_final_acceptance_review",
      "blocked"
    ],
    forbiddenDecisions: [
      "accepted",
      "execute_now",
      "register_monitor_now",
      "read_logs_now",
      "capture_screenshot_now",
      "write_memory_now",
      "enable_rule_now",
      "downgrade_to_medium_now",
      "delete_rollback_points"
    ],
    sourcePackPath: packPath,
    sourceTeacherTrialWorkbenchPath: teacherTrialPath,
    selectedSoftware: "",
    selectedLowTokenRouteId: "",
    validatedLowTokenRouteReceiptPath: "",
    teacherOverlayPacketPath: "",
    teacherOverlayPacketValidationPath: "",
    teacherReviewedSpatialIntentPath: "",
    teacherReviewedMethodProfile: false,
    teacherMethodProfilePath: "",
    teacherMethodContractPath: "",
    confirmedRollbackPoint: "",
    finalTeacherAcceptanceReceiptPath: "",
    teacherNotes: "",
    locks: {
      teacherReceiptDoesNotReadLogs: true,
      teacherReceiptDoesNotCaptureScreenshots: true,
      teacherReceiptDoesNotRegisterMonitor: true,
      teacherReceiptDoesNotExecuteTargetSoftware: true,
      teacherReceiptDoesNotWriteMemory: true,
      teacherReceiptDoesNotEnableRules: true,
      teacherReceiptDoesNotDowngradeRuntime: true,
      teacherReceiptDoesNotDeleteRollbackPoints: true,
      softwareActionsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      goalComplete: false
    }
  };
}

function writeHtml(path, pack) {
  const rows = pack.teacherSteps
    .map(
      (item, index) => `<article class="step">
        <h3>${index + 1}. ${htmlEscape(item.title)}</h3>
        <p>${htmlEscape(item.teacherAction)}</p>
        <p><strong>Open:</strong> ${item.openPath ? link(basename(item.openPath), item.openPath) : "missing"}</p>
        ${item.verifyCommand ? `<p><strong>Verify:</strong></p><pre>${htmlEscape(item.verifyCommand)}</pre>` : ""}
        <p><strong>Receipt field:</strong> <code>${htmlEscape(item.requiredReceiptField || "(none)")}</code></p>
        <p><strong>Evidence slot:</strong> ${htmlEscape(item.evidenceSlot)}</p>
        <p class="stop"><strong>Stop if:</strong> ${htmlEscape(item.stopIf)}</p>
        <p class="boundary">${htmlEscape(item.boundary)}</p>
      </article>`
    )
    .join("\n");
  const blocked = pack.blockedActions.map((item) => `<li>${htmlEscape(item)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Shortest Teacher Evidence Pack</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; background: #f6f8fb; color: #172033; }
    main { max-width: 1040px; margin: 0 auto; }
    .status, .step, .summary { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 18px; margin: 14px 0; }
    code, pre { background: #eef2f7; border-radius: 6px; padding: 10px; overflow: auto; }
    code { padding: 2px 5px; }
    .boundary, .stop { color: #475569; }
    .lock { border-left: 4px solid #b91c1c; padding-left: 12px; color: #7f1d1d; }
  </style>
</head>
<body>
<main>
  <h1>Shortest Teacher Evidence Pack</h1>
  <section class="status">
    <p><strong>Status:</strong> ${htmlEscape(pack.status)}</p>
    <p><strong>Goal complete:</strong> ${htmlEscape(pack.goalComplete)}</p>
    <p class="lock">This pack only tells the teacher the shortest evidence path. It does not read logs, capture screenshots, register monitors, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
  </section>
  <section class="summary">
    <h2>Use Order</h2>
    <p>${htmlEscape(pack.teacherInstruction)}</p>
    <p>${link("Unified shortest evidence receipt builder", pack.paths.receiptBuilderHtml)}</p>
    <p>${link("Legacy teacher trial receipt builder", pack.paths.teacherTrialReceiptBuilder)}</p>
    <p><strong>Validate unified receipt:</strong></p>
    <pre>${htmlEscape(pack.receiptValidationCommandTemplate)}</pre>
    <p>${link("Final acceptance pack", pack.paths.finalTeacherAcceptanceReviewPack)}</p>
  </section>
  ${rows}
  <section class="summary">
    <h2>Blocked Actions</h2>
    <ul>${blocked}</ul>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReceiptBuilderHtml(path, { pack, receiptTemplate }) {
  const templateJson = JSON.stringify(receiptTemplate, null, 2).replace(/</g, "\\u003c");
  const validationCommand = pack.receiptValidationCommandTemplate;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Shortest Teacher Evidence Receipt Builder</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; background: #f7f9fc; color: #172033; }
    main { max-width: 1080px; margin: 0 auto; }
    section { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 18px; margin: 14px 0; }
    label { display: block; font-weight: 700; margin-top: 12px; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 9px; margin-top: 4px; border: 1px solid #b8c2d2; border-radius: 6px; }
    textarea { min-height: 90px; }
    button { padding: 10px 14px; border: 0; border-radius: 6px; background: #1f2937; color: white; margin: 8px 8px 8px 0; cursor: pointer; }
    pre { background: #eef2f7; border-radius: 6px; padding: 12px; overflow: auto; }
    .lock { border-left: 4px solid #b91c1c; padding-left: 12px; color: #7f1d1d; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Shortest Teacher Evidence Receipt Builder</h1>
  <section>
    <p class="lock">This page creates a receipt JSON only. It does not validate, read logs, capture screenshots, register monitors, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
    <p><strong>After download, validate with:</strong></p>
    <pre id="validation-command">${htmlEscape(validationCommand)}</pre>
  </section>
  <section>
    <label for="teacherDecision">Teacher decision</label>
    <select id="teacherDecision">
      ${receiptTemplate.allowedTeacherDecisions
        .map((decision) => `<option value="${htmlEscape(decision)}">${htmlEscape(decision)}</option>`)
        .join("")}
    </select>
    <div class="grid">
      <div>
        <label for="selectedSoftware">Selected software</label>
        <input id="selectedSoftware" placeholder="Software being reviewed" />
      </div>
      <div>
        <label for="selectedLowTokenRouteId">Selected low-token route id</label>
        <input id="selectedLowTokenRouteId" />
      </div>
    </div>
    <label for="validatedLowTokenRouteReceiptPath">Validated low-token route receipt path</label>
    <input id="validatedLowTokenRouteReceiptPath" />
    <label for="teacherOverlayPacketPath">Teacher-exported overlay packet path</label>
    <input id="teacherOverlayPacketPath" />
    <label for="teacherOverlayPacketValidationPath">Overlay packet validation path</label>
    <input id="teacherOverlayPacketValidationPath" />
    <label for="teacherReviewedSpatialIntentPath">Teacher-reviewed spatial intent path</label>
    <input id="teacherReviewedSpatialIntentPath" />
    <label class="checkline"><input type="checkbox" id="teacherReviewedMethodProfile" style="width:auto" /> Teacher reviewed the method profile</label>
    <label for="teacherMethodProfilePath">Teacher method profile path</label>
    <input id="teacherMethodProfilePath" value="${htmlEscape(receiptTemplate.teacherMethodProfilePath)}" />
    <label for="teacherMethodContractPath">Teacher method contract path</label>
    <input id="teacherMethodContractPath" />
    <label for="confirmedRollbackPoint">Confirmed retained rollback point</label>
    <input id="confirmedRollbackPoint" />
    <label for="finalTeacherAcceptanceReceiptPath">Final teacher acceptance receipt path, only after real final acceptance</label>
    <input id="finalTeacherAcceptanceReceiptPath" />
    <label for="teacherNotes">Teacher notes</label>
    <textarea id="teacherNotes"></textarea>
    <button id="render">Render JSON</button>
    <button id="download">Download Receipt JSON</button>
    <button id="copy">Copy JSON</button>
    <pre id="output"></pre>
  </section>
</main>
<script id="receipt-template" type="application/json">${templateJson}</script>
<script>
  const template = JSON.parse(document.getElementById("receipt-template").textContent);
  const textFields = [
    "selectedSoftware",
    "selectedLowTokenRouteId",
    "validatedLowTokenRouteReceiptPath",
    "teacherOverlayPacketPath",
    "teacherOverlayPacketValidationPath",
    "teacherReviewedSpatialIntentPath",
    "teacherMethodProfilePath",
    "teacherMethodContractPath",
    "confirmedRollbackPoint",
    "finalTeacherAcceptanceReceiptPath",
    "teacherNotes"
  ];
  function buildReceipt() {
    const receipt = JSON.parse(JSON.stringify(template));
    receipt.teacherDecision = document.getElementById("teacherDecision").value;
    for (const field of textFields) receipt[field] = document.getElementById(field).value.trim();
    receipt.teacherReviewedMethodProfile = document.getElementById("teacherReviewedMethodProfile").checked;
    receipt.locks = {
      teacherReceiptDoesNotReadLogs: true,
      teacherReceiptDoesNotCaptureScreenshots: true,
      teacherReceiptDoesNotRegisterMonitor: true,
      teacherReceiptDoesNotExecuteTargetSoftware: true,
      teacherReceiptDoesNotWriteMemory: true,
      teacherReceiptDoesNotEnableRules: true,
      teacherReceiptDoesNotDowngradeRuntime: true,
      teacherReceiptDoesNotDeleteRollbackPoints: true,
      softwareActionsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      goalComplete: false
    };
    return receipt;
  }
  function render() {
    const json = JSON.stringify(buildReceipt(), null, 2);
    document.getElementById("output").textContent = json;
    return json;
  }
  document.getElementById("render").addEventListener("click", render);
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
    anchor.download = "teacher-filled-shortest-evidence-receipt.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
  render();
</script>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, pack) {
  const lines = [
    "# Current Goal Shortest Teacher Evidence Pack",
    "",
    `Status: ${pack.status}`,
    `Goal complete: ${pack.goalComplete}`,
    "",
    "This is the shortest teacher-facing route I can safely present for the current objective. It reuses the existing workbench, low-token route receipt, transparent overlay, spatial grounding, teacher method profile, intake router, and final acceptance pack.",
    "",
    "## Steps",
    ...pack.teacherSteps.map(
      (item, index) =>
        `${index + 1}. ${item.title}: ${item.teacherAction} | open=${item.openPath || "missing"} | verify=${item.verifyCommand || "manual review"}`
    ),
    "",
    "## Locks",
    "- Review only.",
    "- Does not read logs, capture screenshots, register monitors, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.",
    "",
    `Pack JSON: ${pack.paths.pack}`,
    `Pack HTML: ${pack.paths.html}`,
    `Unified receipt builder: ${pack.paths.receiptBuilderHtml}`,
    `Unified receipt template: ${pack.paths.receiptTemplate}`,
    `Unified receipt validation command: ${pack.receiptValidationCommandTemplate}`,
    `Teacher trial receipt builder: ${pack.paths.teacherTrialReceiptBuilder}`,
    `Final teacher acceptance review pack: ${pack.paths.finalTeacherAcceptanceReviewPack}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const launchpadPath = resolve(
  argValue("--launchpad", join("artifacts", "current-goal-start-here", "current-goal-start-here.json"))
);
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-shortest-teacher-evidence-packs")));
mkdirSync(outputRoot, { recursive: true });

const launchpad = readJson(launchpadPath);
const teacherTrialPath = launchpad.paths?.teacherTrialWorkbench || "";
const finalConvergencePath = launchpad.paths?.finalConvergenceReadinessGate || "";
const teacherTrial = loadOptional(teacherTrialPath);
const finalConvergence = loadOptional(finalConvergencePath);

const packPath = join(outputRoot, "current-goal-shortest-teacher-evidence-pack.json");
const htmlPath = join(outputRoot, "current-goal-shortest-teacher-evidence-pack.html");
const readmePath = join(outputRoot, "CURRENT_GOAL_SHORTEST_TEACHER_EVIDENCE_PACK.md");
const receiptTemplatePath = join(outputRoot, "shortest-teacher-evidence-receipt-template.json");
const receiptBuilderHtmlPath = join(outputRoot, "shortest-teacher-evidence-receipt-builder.html");

const validateTrialReceiptCommand =
  actionById(launchpad, "validate_trial_receipt")?.commandOrPath ||
  commandText("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
    "--workbench",
    teacherTrialPath || "<current-goal-teacher-trial-workbench.json>",
    "--receipt",
    "<teacher-filled-trial-workbench-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations")
  ]);

const routeTrialReceiptCommand =
  actionById(launchpad, "route_teacher_trial_receipt")?.commandOrPath ||
  commandText("create-current-goal-teacher-trial-intake-router.mjs", [
    "--receipt",
    "<teacher-filled-trial-workbench-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-teacher-trial-intake-routers")
  ]);

const validateFinalAcceptanceCommand =
  actionById(launchpad, "validate_final_teacher_acceptance_receipt")?.commandOrPath ||
  commandText("validate-current-goal-final-teacher-acceptance-receipt.mjs", [
    "--final-convergence-readiness-gate",
    finalConvergencePath || "<current-goal-final-convergence-readiness-gate.json>",
    "--receipt",
    "<teacher-filled-current-goal-final-acceptance-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-final-teacher-acceptance-receipt-validations")
  ]);
const receiptValidationCommandTemplate = commandText("validate-current-goal-shortest-teacher-evidence-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  "<teacher-filled-shortest-evidence-receipt.json>",
  "--validate-derived-trial",
  "--output-dir",
  join("artifacts", "current-goal-shortest-teacher-evidence-receipt-validations")
]);

const teacherSteps = [
  step({
    id: "pick_one_low_token_route",
    title: "Pick one low-token route",
    teacherAction:
      "Choose the target software and one low-token observation route from the existing route receipt builder before any monitor registration.",
    openPath: entryById(launchpad, "low_token_route_receipt_builder_html")?.path || "",
    verifyCommand: actionById(launchpad, "select_low_token_route")?.commandOrPath || "",
    requiredReceiptField: "validatedLowTokenRouteReceiptPath",
    evidenceSlot: "validated low-token route receipt",
    stopIf: "the next action reads full logs, registers a monitor, or writes memory before teacher selection",
    boundary: "Route selection is evidence only and does not start unattended learning."
  }),
  step({
    id: "draw_and_validate_overlay_packet",
    title: "Draw and validate the transparent overlay packet",
    teacherAction:
      "Open the transparent drawing mask, draw the teacher intent, export a real packet, then validate 2D position, perspective, angle, and 3D depth cues.",
    openPath: entryById(launchpad, "transparent_overlay_browser_html")?.path || "",
    verifyCommand: actionById(launchpad, "validate_teacher_overlay_packet")?.commandOrPath || "",
    requiredReceiptField: "teacherOverlayPacketValidationPath",
    evidenceSlot: "teacher-exported overlay packet plus validation",
    stopIf: "the packet is a bundled sample, lacks depth/perspective evidence, or is not teacher exported",
    boundary: "Overlay validation does not capture screenshots or execute target software."
  }),
  step({
    id: "ground_spatial_intent_with_physical_world_pack",
    title: "Ground the sketch in physical-world spatial evidence",
    teacherAction:
      "Review RGB-D, camera calibration, point cloud, panel pose, fold angle, and sim-to-real boundary evidence so 2D/perspective/3D marks are not only visually similar.",
    openPath: entryById(launchpad, "physical_world_spatial_grounding_html")?.path || "",
    verifyCommand: actionById(launchpad, "create_physical_world_spatial_grounding_pack")?.commandOrPath || "",
    requiredReceiptField: "teacherReviewedSpatialIntentPath",
    evidenceSlot: "teacher-reviewed spatial intent and depth grounding",
    stopIf: "the review treats generated sample geometry as real-world authority or skips near/far/depth relationships",
    boundary: "Physical grounding is review-only and cannot replace teacher confirmation."
  }),
  step({
    id: "review_teacher_method_profile",
    title: "Review the teacher method profile",
    teacherAction:
      "Correct the inferred teaching style, preferred evidence order, and correction policy before reusable logic contracts or medium-runtime reuse.",
    openPath: entryById(launchpad, "teacher_method_profile_readme")?.path || "",
    verifyCommand: actionById(launchpad, "prepare_method_contract_after_review")?.commandOrPath || "",
    requiredReceiptField: "teacherReviewedMethodProfile",
    evidenceSlot: "teacher-reviewed method profile or method contract",
    stopIf: "the profile is generated but not teacher reviewed",
    boundary: "Method review does not enable rules or downgrade reasoning runtime."
  }),
  step({
    id: "build_validate_and_route_teacher_trial_receipt",
    title: "Build, validate, and route one teacher trial receipt",
    teacherAction:
      "Use the receipt builder once to attach the route, overlay, spatial review, method review, rollback point, and notes; validate it, then route it to the next manual command.",
    openPath: entryById(launchpad, "teacher_trial_receipt_builder_html")?.path || "",
    verifyCommand: `${validateTrialReceiptCommand}\n${routeTrialReceiptCommand}`,
    requiredReceiptField: "teacher-filled-trial-workbench-receipt.json",
    evidenceSlot: "validated teacher trial receipt and intake router output",
    stopIf: "the receipt claims acceptance, software execution, memory write, rule enablement, or rollback deletion",
    boundary: "Receipt routing returns a manual next command only; it does not run the command."
  }),
  step({
    id: "final_acceptance_only_after_real_evidence",
    title: "Final acceptance only after real evidence exists",
    teacherAction:
      "Open the final teacher acceptance pack only after the real trial evidence is valid, then fill and validate a final receipt if the full objective is actually accepted.",
    openPath: entryById(launchpad, "final_teacher_acceptance_review_pack_html")?.path || "",
    verifyCommand: validateFinalAcceptanceCommand,
    requiredReceiptField: "teacher-filled-current-goal-final-acceptance-receipt.json",
    evidenceSlot: "validated final teacher acceptance receipt",
    stopIf: "any lane remains only implementation evidence, completion-ready lanes are zero, or the teacher has not accepted the full objective",
    boundary: "Final review remains blocked by default and cannot claim completion without real teacher acceptance."
  })
];

const pack = {
  ok: true,
  format: "transparent_ai_current_goal_shortest_teacher_evidence_pack_v1",
  createdAt: new Date().toISOString(),
  status: "shortest_teacher_evidence_path_ready_review_only_goal_not_complete",
  teacherInstruction:
    "Do these steps in order. The first five steps collect the minimum real teacher evidence; the final acceptance step stays locked until all real evidence is validated.",
  receiptValidationCommandTemplate,
  sourceStatus: {
    launchpadStatus: launchpad.status || "",
    teacherTrialWorkbenchStatus: teacherTrial?.status || "",
    finalConvergenceReadinessGateStatus: finalConvergence?.status || "",
    reviewEvidenceReadyLanes: finalConvergence?.summary?.reviewEvidenceReadyLanes ?? null,
    completionReadyLanes: finalConvergence?.summary?.completionReadyLanes ?? null,
    goalComplete: false
  },
  teacherSteps,
  blockedActions: [
    "read_logs_from_shortest_teacher_pack",
    "read_full_logs_from_shortest_teacher_pack",
    "capture_screenshots_from_shortest_teacher_pack",
    "record_screen_from_shortest_teacher_pack",
    "register_monitor_from_shortest_teacher_pack",
    "launch_runner_from_shortest_teacher_pack",
    "execute_target_software_from_shortest_teacher_pack",
    "write_memory_from_shortest_teacher_pack",
    "enable_rules_from_shortest_teacher_pack",
    "downgrade_to_medium_runtime_from_shortest_teacher_pack",
    "delete_rollback_points_from_shortest_teacher_pack",
    "claim_goal_complete_from_shortest_teacher_pack"
  ],
  paths: {
    pack: packPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    receiptBuilderHtml: receiptBuilderHtmlPath,
    launchpad: launchpadPath,
    teacherTrialWorkbench: teacherTrialPath,
    teacherTrialReceiptBuilder: entryById(launchpad, "teacher_trial_receipt_builder_html")?.path || "",
    teacherTrialIntakeRouter: launchpad.paths?.teacherTrialIntakeRouter || "",
    finalTeacherAcceptanceReviewPack: entryById(launchpad, "final_teacher_acceptance_review_pack_html")?.path || "",
    finalConvergenceReadinessGate: finalConvergencePath
  },
  locks: locks(),
  goalComplete: false
};

const receiptTemplate = shortestReceiptTemplate(packPath, teacherTrialPath);
receiptTemplate.teacherMethodProfilePath = entryById(launchpad, "teacher_method_profile_readme")?.path || "";

writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeHtml(htmlPath, pack);
writeReceiptBuilderHtml(receiptBuilderHtmlPath, { pack, receiptTemplate });
writeReadme(readmePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_shortest_teacher_evidence_pack_result_v1",
      status: pack.status,
      packPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      receiptBuilderHtmlPath,
      teacherStepCount: teacherSteps.length,
      goalComplete: false
    },
    null,
    2
  )
);
