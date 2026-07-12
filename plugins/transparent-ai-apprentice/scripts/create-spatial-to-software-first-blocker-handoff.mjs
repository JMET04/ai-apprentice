#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-to-software-first-blocker-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-to-software-first-blocker-handoff"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    handoffDoesNotRunCommands: true,
    handoffDoesNotValidateReceipts: true,
    handoffDoesNotRunSpatialTargetConfirmation: true,
    handoffDoesNotRunRouteBridge: true,
    handoffDoesNotExecuteSoftware: true,
    handoffDoesNotCaptureScreenshots: true,
    handoffDoesNotReadFullLogs: true,
    handoffDoesNotWriteMemory: true,
    handoffDoesNotEnableRules: true,
    commandsExecuted: false,
    spatialTargetConfirmationInvoked: false,
    routeBridgeInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function step(id, label, action, evidencePath, command, allowedInThisHandoff = false) {
  return {
    id,
    label,
    action,
    evidencePath: evidencePath || "",
    command: command || "",
    allowedInThisHandoff,
    locks: locks()
  };
}

function commandsForBlocker(blockerId, gate, refresh, dir, goal) {
  if (blockerId === "formal_spatial_entrypoint") {
    return [
      step(
        "create_formal_spatial_entrypoint",
        "Create formal spatial evidence entrypoint",
        "Generate a review-only entrypoint that states what evidence the teacher must export from the transparent drawing mask.",
        gate.evidencePath,
        commandLine("create-spatial-intent-formal-evidence-entrypoint.mjs", [
          ["--goal", goal],
          ["--output-dir", join(dir, "formal-spatial-entrypoint")]
        ])
      )
    ];
  }
  if (blockerId === "teacher_exported_overlay_validation") {
    return [
      step(
        "open_transparent_sketch_overlay",
        "Open transparent sketch overlay and export packet",
        "Teacher draws the intended 2D anchor, direction or angle, perspective relation, and 3D depth hint on the transparent mask, then exports a real transparent_ai_sketch_overlay_packet_v1 packet.",
        refresh.discoveredEvidence?.transparentSketchOverlay || refresh.paths?.transparentSketchOverlay || "",
        "",
        false
      ),
      step(
        "open_spatial_intent_request",
        "Open spatial intent evidence request",
        "Teacher reviews what the transparent mask export must contain: 2D anchor, direction or angle, perspective relation, 3D depth hint, and universal detail logic evidence.",
        refresh.paths?.spatialIntentEvidenceRequestHtml || refresh.paths?.spatialIntentEvidenceRequest || ""
      ),
      step(
        "resolve_first_blocker_with_exported_overlay_packet",
        "Resolve first blocker with exported overlay packet",
        "After the teacher exports the transparent sketch packet, validate it and prefill the spatial intent evidence receipt without inferring teacher approval or executing software.",
        "",
        commandLine("resolve-spatial-first-blocker-overlay-packet.mjs", [
          ["--request", refresh.paths?.spatialIntentEvidenceRequest || ""],
          ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
          ["--output-dir", join(dir, "first-blocker-overlay-resolution")]
        ])
      ),
      step(
        "open_spatial_intent_receipt_builder",
        "Open spatial intent evidence receipt builder",
        "After exporting a real transparent sketch packet, teacher fills a receipt instead of letting the system infer intent from a placeholder.",
        refresh.paths?.spatialIntentEvidenceReceiptBuilderHtml || refresh.paths?.spatialIntentEvidenceReceiptBuilder || ""
      ),
      step(
        "fill_spatial_intent_receipt_template",
        "Fill spatial intent evidence receipt template",
        "Replace placeholder paths with the real teacher-exported overlay packet and reviewed detail-logic validation evidence.",
        refresh.paths?.spatialIntentEvidenceReceiptTemplate || ""
      ),
      step(
        "validate_spatial_intent_receipt",
        "Validate teacher-filled spatial intent receipt",
        "Only after this validation is ready may the flow prepare numbered spatial target confirmation.",
        refresh.paths?.spatialIntentEvidenceReceiptValidation || "",
        refresh.paths?.spatialIntentEvidenceReceiptValidationCommandTemplate ||
          commandLine("validate-spatial-intent-evidence-receipt.mjs", [
            ["--request", refresh.paths?.spatialIntentEvidenceRequest || "<spatial-intent-evidence-request.json>"],
            ["--receipt", "<teacher-filled-spatial-intent-evidence-receipt.json>"],
            ["--output-dir", join(dir, "spatial-intent-evidence-receipt-validation")]
          ])
      )
    ];
  }
  if (blockerId === "depth_rehearsal_teacher_review") {
    return [
      step(
        "open_depth_rehearsal",
        "Open transparent sketch depth rehearsal",
        "Teacher reviews whether the 2D, perspective, and 3D depth interpretation matches the intended sketch logic.",
        refresh.paths?.transparentSketchDepthDemonstrationRehearsalHtml ||
          refresh.paths?.transparentSketchDepthDemonstrationRehearsal ||
          gate.evidencePath ||
          ""
      ),
      step(
        "open_depth_rehearsal_receipt_builder",
        "Open depth rehearsal review receipt builder",
        "Teacher records pass, correction, or blocker for each depth rehearsal row before route follow-up.",
        refresh.paths?.transparentSketchDepthRehearsalReviewReceiptBuilderHtml ||
          refresh.paths?.transparentSketchDepthRehearsalReviewReceiptBuilder ||
          ""
      ),
      step(
        "fill_depth_rehearsal_receipt_template",
        "Fill depth rehearsal review receipt template",
        "Record teacher observations and keep the decision review-only unless every row is confirmed.",
        refresh.paths?.transparentSketchDepthRehearsalReviewReceiptTemplate || ""
      ),
      step(
        "validate_depth_rehearsal_receipt",
        "Validate teacher-filled depth rehearsal receipt",
        "Validation must pass before numbered target confirmation can feed a route bridge.",
        refresh.paths?.transparentSketchDepthRehearsalReviewReceiptValidation || "",
        refresh.paths?.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate ||
          commandLine("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs", [
            ["--rehearsal", refresh.paths?.transparentSketchDepthDemonstrationRehearsal || "<transparent-sketch-depth-rehearsal.json>"],
            ["--receipt", "<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>"],
            ["--output-dir", join(dir, "depth-rehearsal-review-validation")]
          ])
      )
    ];
  }
  if (blockerId === "numbered_spatial_target_confirmation") {
    return [
      step(
        "create_numbered_spatial_target_confirmation",
        "Create numbered spatial target confirmation",
        "Convert the validated transparent sketch packet into numbered target candidates. Teacher must choose exactly one number.",
        refresh.paths?.lowTokenPreflightTargetConfirmation || "",
        refresh.discoveredEvidence?.spatialTargetConfirmationCommandTemplate ||
          commandLine("create-spatial-target-confirmation-kit.mjs", [
            ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
            ["--goal", goal],
            ["--output-dir", join(dir, "spatial-target-confirmation")]
          ])
      ),
      step(
        "confirm_exactly_one_number",
        "Confirm exactly one numbered spatial target",
        "Replace the selected-number placeholder only after teacher review; do not let the model choose for the teacher.",
        refresh.paths?.lowTokenPreflightTargetConfirmation || "",
        refresh.paths?.numberedTargetConfirmCommandTemplate || ""
      )
    ];
  }
  if (blockerId === "software_execution_route_bridge") {
    return [
      step(
        "create_spatial_route_bridge",
        "Create spatial software execution route bridge",
        "Bind the teacher-confirmed spatial target to review-only software execution routes before any dry-run.",
        refresh.paths?.spatialSoftwareExecutionRouteBridge || "",
        commandLine("create-spatial-software-execution-route-bridge.mjs", [
          ["--goal", goal],
          ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
          ["--target-confirmation", "<teacher-confirmed-spatial-target-confirmation-kit.json>"],
          ["--confirmation-receipt", "<teacher-confirmed-target-receipt.json>"],
          ["--output-dir", join(dir, "spatial-software-execution-route")]
        ])
      )
    ];
  }
  return [
    step(
      "review_unknown_spatial_gate_blocker",
      "Review unknown spatial gate blocker",
      "Open the gate package and resolve the first blocker manually before running any downstream command.",
      gate.evidencePath || ""
    )
  ];
}

function classifyBlocker(blockerId) {
  const mapping = {
    formal_spatial_entrypoint: {
      objectiveRequirementId: "transparent_mask_2d_perspective_3d_depth_understanding",
      completionBlockerLane: "transparent_sketch_spatial_intent_teacher_export",
      nextGate: "create_spatial_intent_formal_evidence_entrypoint",
      requiredEvidenceBeforeManualUse: [
        "retained rollback point",
        "formal spatial evidence entrypoint with 2D anchor, perspective relation, and 3D/depth requirements",
        "teacher-visible transparent mask export instructions before any target confirmation"
      ],
      teacherInstruction:
        "Use this path when the transparent sketch evidence contract itself is missing before teacher drawing review can start."
    },
    teacher_exported_overlay_validation: {
      objectiveRequirementId: "transparent_mask_2d_perspective_3d_depth_understanding",
      completionBlockerLane: "transparent_sketch_spatial_intent_teacher_export",
      nextGate: "resolve_spatial_first_blocker_overlay_packet_then_validate_spatial_intent_evidence_receipt",
      requiredEvidenceBeforeManualUse: [
        "retained rollback point",
        "real teacher-exported transparent_ai_sketch_overlay_packet_v1 packet",
        "spatial intent evidence receipt filled from teacher evidence, not placeholders",
        "validated receipt proving 2D anchor, direction or angle, perspective relation, and 3D depth hint"
      ],
      teacherInstruction:
        "Use this path when the teacher must draw on the transparent mask and validate that the model interpreted the spatial intent from real evidence."
    },
    depth_rehearsal_teacher_review: {
      objectiveRequirementId: "transparent_mask_2d_perspective_3d_depth_understanding",
      completionBlockerLane: "transparent_sketch_spatial_intent_teacher_export",
      nextGate: "validate_transparent_sketch_depth_rehearsal_review_receipt",
      requiredEvidenceBeforeManualUse: [
        "retained rollback point",
        "transparent sketch depth rehearsal covering 2D, perspective, and 3D/depth cases",
        "teacher-filled depth rehearsal review receipt",
        "validation status showing teacher review is ready before route follow-up"
      ],
      teacherInstruction:
        "Use this path when the 2D/3D/depth sketch rehearsal exists but still needs teacher review before numbered targets or software routing."
    },
    numbered_spatial_target_confirmation: {
      objectiveRequirementId: "voice_text_numbered_confirmation_supervised_execution_gate",
      completionBlockerLane: "voice_text_numbered_confirmation_supervised_execution_gate",
      nextGate: "create_spatial_target_confirmation_kit_and_teacher_confirm_exactly_one_number",
      requiredEvidenceBeforeManualUse: [
        "retained rollback point",
        "validated teacher-exported spatial intent receipt",
        "numbered spatial target confirmation packet",
        "teacher confirmation of exactly one target number or explicit correction"
      ],
      teacherInstruction:
        "Use this path when validated spatial intent must become numbered choices so a non-expert user can confirm the target before any software action."
    },
    software_execution_route_bridge: {
      objectiveRequirementId: "execute_in_target_software_after_teacher_confirmation",
      completionBlockerLane: "universal_native_execution_control_channel",
      nextGate: "create_spatial_software_execution_route_bridge_after_number_confirmation",
      requiredEvidenceBeforeManualUse: [
        "retained rollback point",
        "teacher-confirmed numbered spatial target receipt",
        "review-only spatial software execution route bridge",
        "separate teacher approval before any dry-run, native control channel, or target software execution"
      ],
      teacherInstruction:
        "Use this path only after one numbered target is teacher-confirmed and the next step is a review-only route bridge, not execution."
    }
  };
  return (
    mapping[blockerId] || {
      objectiveRequirementId: "transparent_mask_2d_perspective_3d_depth_understanding",
      completionBlockerLane: "transparent_sketch_spatial_intent_teacher_export",
      nextGate: "review_unknown_spatial_gate_blocker",
      requiredEvidenceBeforeManualUse: ["retained rollback point", "known spatial-to-software gate blocker"],
      teacherInstruction: "Return to the spatial-to-software execution gate package and resolve the unknown blocker manually."
    }
  );
}

function nextGateHandoff(blockerInfo, firstBlocker, activeGate, firstTeacherAction, lockState) {
  return {
    format: "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1",
    status: "review_only_next_gate_handoff_ready",
    objectiveRequirementId: blockerInfo.objectiveRequirementId,
    completionBlockerLane: blockerInfo.completionBlockerLane,
    firstBlockerId: firstBlocker?.id || "none",
    firstBlockerStatus: firstBlocker?.status || "",
    firstBlockerReason: firstBlocker?.blocker || activeGate?.blocker || "",
    nextGate: blockerInfo.nextGate,
    teacherInstruction: blockerInfo.teacherInstruction,
    firstTeacherActionId: firstTeacherAction?.id || "",
    firstTeacherActionLabel: firstTeacherAction?.label || "",
    commandTemplate: firstTeacherAction?.command || "",
    evidencePath: firstTeacherAction?.evidencePath || activeGate?.evidencePath || "",
    requiredEvidenceBeforeManualUse: blockerInfo.requiredEvidenceBeforeManualUse,
    returnToCompletionBlockerMatrixAfterNextGate: true,
    followUpAuditExpectation:
      "After the selected spatial next gate returns evidence, refresh the original-goal current status and completion blocker matrix before any target confirmation, route bridge, native execution, memory write, or completion claim.",
    blockedActions: [
      "run_next_gate_from_spatial_first_blocker_handoff",
      "infer_spatial_intent_without_teacher_exported_packet",
      "validate_receipt_without_teacher_filled_input",
      "choose_numbered_target_without_teacher_confirmation",
      "run_route_bridge_without_teacher_confirmed_number",
      "execute_target_software_from_spatial_first_blocker_handoff",
      "write_memory_from_spatial_first_blocker_handoff",
      "enable_rule_from_spatial_first_blocker_handoff",
      "claim_goal_complete_from_spatial_first_blocker_handoff"
    ],
    locks: lockState
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Spatial To Software First Blocker Handoff",
    "",
    `Status: ${packet.status}`,
    `Gate package: ${packet.paths.gatePackage}`,
    `First blocker: ${packet.firstBlocker?.id || "none"}`,
    `First action: ${packet.firstTeacherAction?.label || ""}`,
    `Completion blocker lane: ${packet.nextGateHandoff.completionBlockerLane}`,
    `Next gate: ${packet.nextGateHandoff.nextGate}`,
    "",
    "This handoff turns the current spatial-to-software execution blocker into teacher-readable steps.",
    "It does not run commands, validate receipts, run target confirmation, run route bridges, execute software, capture screenshots, write memory, enable rules, accept technology, unlock packaging, or claim completion.",
    "",
    "Next-gate handoff:",
    `- Objective requirement: ${packet.nextGateHandoff.objectiveRequirementId}`,
    `- Teacher instruction: ${packet.nextGateHandoff.teacherInstruction}`,
    `- Follow-up audit: ${packet.nextGateHandoff.followUpAuditExpectation}`,
    "",
    "Required evidence before manual use:",
    ...packet.nextGateHandoff.requiredEvidenceBeforeManualUse.map((item) => `- ${item}`),
    "",
    "Teacher steps:",
    ...packet.teacherSteps.map((item, index) => `${index + 1}. ${item.id}: ${item.label}; evidence=${item.evidencePath || "missing"}; command=${item.command || "open evidence only"}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.teacherSteps
    .map(
      (item, index) => `<tr>
        <td>${index + 1}</td>
        <td>${htmlEscape(item.label)}</td>
        <td>${htmlEscape(item.action)}</td>
        <td>${item.evidencePath ? `<a href="${htmlEscape(fileHref(item.evidencePath))}">${htmlEscape(basename(item.evidencePath))}</a>` : "missing"}</td>
        <td><code>${htmlEscape(item.command || "open evidence only")}</code></td>
        <td><code>${htmlEscape(item.allowedInThisHandoff)}</code></td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial To Software First Blocker Handoff</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #162230; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .summary { background: #fff; border: 1px solid #dce5ef; border-radius: 8px; padding: 16px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dce5ef; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8eef5; text-align: left; vertical-align: top; }
    th { background: #edf3f9; }
    code { background: #edf3f9; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Spatial To Software First Blocker Handoff</h1>
  <section class="summary">
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Gate package:</strong> <a href="${htmlEscape(fileHref(packet.paths.gatePackageHtml || packet.paths.gatePackage))}">${htmlEscape(packet.paths.gatePackageHtml || packet.paths.gatePackage)}</a></p>
    <p><strong>First blocker:</strong> <code>${htmlEscape(JSON.stringify(packet.firstBlocker || null))}</code></p>
    <p><strong>Completion blocker lane:</strong> <code>${htmlEscape(packet.nextGateHandoff.completionBlockerLane)}</code></p>
    <p><strong>Next gate:</strong> <code>${htmlEscape(packet.nextGateHandoff.nextGate)}</code></p>
    <p><strong>Follow-up audit:</strong> ${htmlEscape(packet.nextGateHandoff.followUpAuditExpectation)}</p>
    <p><strong>Boundary:</strong> This page is a teacher handoff only; it does not execute software or run commands.</p>
  </section>
  <section class="summary">
    <h2>Required Evidence Before Manual Use</h2>
    <ul>${packet.nextGateHandoff.requiredEvidenceBeforeManualUse.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </section>
  <table>
    <thead><tr><th>#</th><th>Step</th><th>Teacher action</th><th>Evidence</th><th>Command template</th><th>Allowed here</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const gatePath = resolve(argValue("--gate", argValue("--spatial-to-software-execution-gate-package", "")));
if (!gatePath || !existsSync(gatePath)) {
  throw new Error("--gate <spatial-to-software-execution-gate-package.json> is required");
}
const gatePackage = readJson(gatePath);
if (gatePackage.format !== "transparent_ai_spatial_to_software_execution_gate_package_v1") {
  throw new Error("--gate must be transparent_ai_spatial_to_software_execution_gate_package_v1");
}

const refreshPath = gatePackage.sourceEvidence?.refresh || "";
const refresh = refreshPath && existsSync(refreshPath) ? readJson(refreshPath) : {};
const goal = gatePackage.goal || refresh.goal || "Resolve spatial-to-software execution first blocker";
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "spatial-to-software-first-blocker-handoffs")));
mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, handoffId);
mkdirSync(dir, { recursive: true });

const firstBlocker = gatePackage.firstBlocker || null;
const activeGate = firstBlocker ? gatePackage.gates.find((item) => item.id === firstBlocker.id) || null : null;
const teacherSteps = firstBlocker ? commandsForBlocker(firstBlocker.id, activeGate || {}, refresh, dir, goal) : [];
const lockState = locks();
const blockerInfo = classifyBlocker(firstBlocker?.id || "none");
const nextGate = nextGateHandoff(blockerInfo, firstBlocker, activeGate, teacherSteps[0] || null, lockState);
const handoffPath = join(dir, "spatial-to-software-first-blocker-handoff.json");
const htmlPath = join(dir, "spatial-to-software-first-blocker-handoff.html");
const readmePath = join(dir, "SPATIAL_TO_SOFTWARE_FIRST_BLOCKER_HANDOFF_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_spatial_to_software_first_blocker_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  status: firstBlocker
    ? "waiting_for_teacher_to_resolve_spatial_execution_first_blocker"
    : "ready_for_review_only_spatial_route_follow_up",
  goal,
  firstBlocker,
  activeGate,
  firstTeacherAction: teacherSteps[0] || null,
  teacherSteps,
  objectiveRequirementId: blockerInfo.objectiveRequirementId,
  completionBlockerLane: blockerInfo.completionBlockerLane,
  nextGate: blockerInfo.nextGate,
  nextGateHandoff: nextGate,
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath,
    gatePackage: gatePath,
    gatePackageHtml: gatePackage.paths?.html || ""
  },
  blockedActions: [
    "run_command_from_handoff_automatically",
    "validate_receipt_without_teacher_filled_input",
    "run_spatial_target_confirmation_without_teacher_exported_packet",
    "run_route_bridge_without_teacher_confirmed_number",
    "execute_target_software_from_handoff",
    "claim_spatial_gate_complete_from_handoff"
  ],
  locks: lockState
};

writeFileSync(handoffPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_to_software_first_blocker_handoff_result_v1",
      handoffId,
      status: packet.status,
      firstBlocker,
      firstTeacherAction: packet.firstTeacherAction,
      objectiveRequirementId: packet.objectiveRequirementId,
      completionBlockerLane: packet.completionBlockerLane,
      nextGate: packet.nextGate,
      nextGateHandoff: packet.nextGateHandoff,
      handoffPath,
      htmlPath,
      readmePath,
      locks: lockState
    },
    null,
    2
  )
);
