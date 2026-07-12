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
    String(value || "current-goal-integrated-evidence-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "current-goal-integrated-evidence-gate"
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
    gateDoesNotRunSourceHandoffs: true,
    gateDoesNotRegisterMonitor: true,
    gateDoesNotLaunchRunner: true,
    gateDoesNotReadLogs: true,
    gateDoesNotReadFullLogs: true,
    gateDoesNotCaptureScreenshots: true,
    gateDoesNotRecordScreen: true,
    gateDoesNotExecuteTargetSoftware: true,
    gateDoesNotWriteMemory: true,
    gateDoesNotEnableRules: true,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function sourceStatus(path, packet, expectedFormat) {
  if (!path) return "missing";
  if (!existsSync(path)) return "missing_file";
  if (!packet) return "unreadable";
  return packet.format === expectedFormat ? "linked" : "format_mismatch";
}

function requirement({
  id,
  userRequirement,
  status,
  evidencePath,
  evidenceSummary,
  implementationEvidenceProven = false,
  completionProven = false,
  blocker,
  nextActionCommand,
  strictLocks = []
}) {
  return {
    id,
    userRequirement,
    status,
    evidencePath: evidencePath || "",
    evidenceSummary,
    implementationEvidenceProven: Boolean(implementationEvidenceProven),
    completionProven: Boolean(completionProven),
    blocker,
    nextActionCommand: nextActionCommand || "",
    strictLocks,
    mayClaimCompleteFromThisGate: false
  };
}

function buildRequirements({
  lowTokenPath,
  lowToken,
  spatialPath,
  spatial,
  physicalGroundingPath,
  physicalGrounding,
  methodPath,
  method,
  voicePath,
  voice,
  refreshPath
}) {
  const lowTokenLinked = sourceStatus(
    lowTokenPath,
    lowToken,
    "transparent_ai_current_goal_all_software_low_token_learning_handoff_v1"
  );
  const spatialLinked = sourceStatus(
    spatialPath,
    spatial,
    "transparent_ai_current_goal_teacher_spatial_drawing_handoff_v1"
  );
  const physicalGroundingLinked = sourceStatus(
    physicalGroundingPath,
    physicalGrounding,
    "transparent_ai_physical_world_spatial_grounding_pack_v1"
  );
  const methodLinked = sourceStatus(
    methodPath,
    method,
    "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1"
  );
  const voiceLinked = sourceStatus(
    voicePath,
    voice,
    "transparent_ai_engineering_voice_control_session_v1"
  );

  const lowTokenPartial = lowToken?.allRowsHaveReviewableLowTokenRoute === true;
  const transparentMaskReady = spatial?.implementedNow?.transparentDrawingMaskKitCreated === true;
  const spatialDepthReady = spatial?.implementedNow?.validates2DPositionPerspective3DDepth === true;
  const logicDraftReady = spatial?.implementedNow?.logicContractRuleDraftCommandPreparedButNotRun === true;
  const physicalGroundingReady =
    physicalGroundingLinked === "linked" &&
    physicalGrounding?.status === "source_project_grounding_ready_for_transparent_overlay_review" &&
    (physicalGrounding?.counts?.presentEvidenceRows || 0) >= 5 &&
    physicalGrounding?.locks?.noTargetSoftwareExecution === true &&
    physicalGrounding?.locks?.noRealWorldAuthorityClaim === true;
  const methodLaneCount = Array.isArray(method?.supportedMethodLanes) ? method.supportedMethodLanes.length : 0;
  const methodReady = methodLaneCount >= 9;
  const voiceLoop = voice?.nonExpertVoiceTextNumberedControlLoop || {};
  const voiceConfirmationKit = voice?.generated?.engineeringCommandConfirmationKit || {};
  const voiceCandidateNumbers = Array.isArray(voiceConfirmationKit.candidateNumbers)
    ? voiceConfirmationKit.candidateNumbers
    : [];
  const voiceReady =
    voiceLoop.confirmationContract?.teacherMustConfirmExactlyOneNumber === true &&
    voiceLoop.confirmationContract?.autoExecuteFromVoiceOnly === false &&
    voiceLoop.executionContract?.dryRunFirst === true &&
    voiceCandidateNumbers.length > 0 &&
    voice?.locks?.softwareActionsExecuted === false &&
    voice?.locks?.targetSoftwareCommandsExecuted === false &&
    voice?.locks?.numberedTargetConfirmationRequired === true;

  return [
    requirement({
      id: "all_software_low_token_log_learning",
      userRequirement:
        "All local software should be able to use metadata/log/event changes for low-token learning, not only CAD or SolidWorks.",
      status: lowTokenPartial ? "partial_review_ready" : `not_ready_${lowTokenLinked}`,
      evidencePath: lowTokenPath,
      evidenceSummary: {
        sourceStatus: lowTokenLinked,
        handoffStatus: lowToken?.status || "",
        reviewableRouteCount: Array.isArray(lowToken?.routeRows) ? lowToken.routeRows.length : 0,
        allRowsHaveReviewableLowTokenRoute: lowTokenPartial,
        recommendedFirstRouteId: lowToken?.recommendedFirstRouteId || ""
      },
      implementationEvidenceProven: lowTokenPartial,
      completionProven: false,
      blocker:
        "Teacher must select and validate a low-token route, then separately approve monitor registration/run-output evidence before any all-software learning claim.",
      nextActionCommand: lowToken?.teacherRouteSelectionActionPack?.routeReceiptValidationCommandTemplate || "",
      strictLocks: ["no_full_log_read", "no_continuous_recording", "no_monitor_registration_from_gate"]
    }),
    requirement({
      id: "teacher_method_adaptation",
      userRequirement: "The apprentice must adapt to any teacher's learning method instead of forcing one teaching style.",
      status: methodReady ? "partial_review_ready" : `not_ready_${methodLinked}`,
      evidencePath: methodPath,
      evidenceSummary: {
        sourceStatus: methodLinked,
        handoffStatus: method?.status || "",
        inferredTeacherModes: method?.inferredTeacherModes || [],
        supportedMethodLaneCount: methodLaneCount
      },
      implementationEvidenceProven: methodReady,
      completionProven: false,
      blocker:
        "Generated teacher method profile still needs teacher review, a retained rollback point, a review-only method contract, and later reuse proof.",
      nextActionCommand:
        method?.nextCommands?.find((item) => item.id === "create_teacher_method_execution_learning_contract_after_review")
          ?.command || "",
      strictLocks: ["no_method_profile_as_teacher_acceptance", "no_medium_runtime_downgrade_from_gate"]
    }),
    requirement({
      id: "transparent_drawing_mask",
      userRequirement:
        "Teacher needs a transparent drawing mask where they can sketch over software or screenshots to express intent.",
      status: transparentMaskReady ? "implementation_review_ready" : `not_ready_${spatialLinked}`,
      evidencePath: spatialPath,
      evidenceSummary: {
        sourceStatus: spatialLinked,
        browserOverlay: spatial?.paths?.browserOverlay || "",
        powershellOverlay: spatial?.paths?.powershellOverlay || "",
        exportsLowTokenOverlayPacket: spatial?.implementedNow?.exportsLowTokenOverlayPacket === true
      },
      implementationEvidenceProven: transparentMaskReady,
      completionProven: false,
      blocker:
        "A real teacher-exported overlay packet must be produced and reviewed; the bundled sample packet is implementation proof only.",
      nextActionCommand:
        spatial?.nextCommands?.find((item) => item.id === "validate_teacher_exported_overlay_packet")?.command || "",
      strictLocks: ["sample_packet_not_teacher_evidence", "no_screenshot_capture_from_gate"]
    }),
    requirement({
      id: "spatial_perspective_position_understanding",
      userRequirement:
        "The apprentice must understand teacher intent through perspective relations, positions, angles, and target numbering before acting.",
      status: spatialDepthReady && logicDraftReady ? "partial_review_ready" : `not_ready_${spatialLinked}`,
      evidencePath: spatialPath,
      evidenceSummary: {
        sourceStatus: spatialLinked,
        validates2DPositionPerspective3DDepth: spatialDepthReady,
        physicalGroundingStatus: physicalGrounding?.status || "",
        physicalGroundingEvidencePath: physicalGroundingPath || "",
        physicalGroundingPresentRows: physicalGrounding?.counts?.presentEvidenceRows ?? null,
        physicalGroundingTotalRows: physicalGrounding?.counts?.evidenceRows ?? null,
        physicalGroundingReadyForOverlayReview: physicalGroundingReady,
        numberedTargetConfirmationPreparedButNotRun:
          spatial?.implementedNow?.numberedTargetConfirmationCommandPreparedButNotRun === true,
        logicContractRuleDraftCommandPreparedButNotRun: logicDraftReady
      },
      implementationEvidenceProven: spatialDepthReady && logicDraftReady,
      completionProven: false,
      blocker:
        "Teacher-reviewed spatial intent, numbered target confirmation, and draft_disabled logic contract validation are still required.",
      nextActionCommand:
        spatial?.nextCommands?.find((item) => item.id === "after_teacher_review_create_numbered_targets")?.command || "",
      strictLocks: ["no_target_confirmation_from_gate", "no_active_spatial_rules_from_gate"]
    }),
    requirement({
      id: "two_d_three_d_depth_sketch_demonstration",
      userRequirement: "2D and 3D-plane depth sketch demonstration must be implemented and checked.",
      status: spatialDepthReady ? "implementation_review_ready" : `not_ready_${spatialLinked}`,
      evidencePath: spatialPath,
      evidenceSummary: {
        sourceStatus: spatialLinked,
        sampleValidationPath: spatial?.proofOnlySample?.validationPath || "",
        sampleValidationStatus: spatial?.proofOnlySample?.validationStatus || "",
        notTeacherEvidence: spatial?.proofOnlySample?.notTeacherEvidence === true,
        physicalGroundingStatus: physicalGrounding?.status || "",
        physicalGroundingPresentRows: physicalGrounding?.counts?.presentEvidenceRows ?? null,
        physicalGroundingTotalRows: physicalGrounding?.counts?.evidenceRows ?? null,
        physicalGroundingOverlayNeeds: Array.isArray(physicalGrounding?.transparentOverlayHandoffRows)
          ? physicalGrounding.transparentOverlayHandoffRows.map((row) => row.overlayNeed)
          : []
      },
      implementationEvidenceProven: spatialDepthReady,
      completionProven: false,
      blocker:
        "The depth sketch demo is implemented as a sample/validator path, but the real teacher packet and review receipt are still missing.",
      nextActionCommand:
        spatial?.nextCommands?.find((item) => item.id === "optional_depth_demonstration_rehearsal")?.command || "",
      strictLocks: ["sample_validation_not_goal_completion", "no_real_software_execution_from_demo"]
    }),
    requirement({
      id: "teacher_confirmed_target_software_execution",
      userRequirement:
        "After understanding teacher intent, the apprentice should execute the confirmed action in the target software.",
      status: "blocked_waiting_for_real_teacher_evidence_and_execution_approval",
      evidencePath: spatialPath,
      evidenceSummary: {
        targetSoftwareExecutionPreparedButNotRun:
          spatial?.implementedNow?.targetSoftwareExecutionPreparedButNotRun === true,
        currentGateExecutesTargetSoftware: false,
        physicalGroundingIncludedInExecutionPreflight: physicalGroundingReady
      },
      implementationEvidenceProven: spatial?.implementedNow?.targetSoftwareExecutionPreparedButNotRun === true,
      completionProven: false,
      blocker:
        "Actual target software execution requires teacher-reviewed overlay evidence, numbered target confirmation, retained rollback, and a separate execution approval gate.",
      nextActionCommand: commandText("create-spatial-to-software-execution-gate-package.mjs", [
        "--physical-world-spatial-grounding-pack",
        physicalGroundingPath || "<physical-world-spatial-grounding-pack.json>",
        "--spatial-receipt",
        "<teacher-reviewed-spatial-intent-receipt-validation.json>",
        "--rollback-point",
        "<retained-rollback-point>",
        "--output-dir",
        join("artifacts", "current-goal-spatial-to-software-execution-gate-packages")
      ]),
      strictLocks: ["no_target_software_execution_from_gate", "no_native_universal_execution_claim"]
    }),
    requirement({
      id: "voice_text_numbered_execution_control",
      userRequirement:
        "Non-experts should be able to control target software by voice or typed command: the apprentice must understand the command, mark possible positions with numbers, wait for teacher confirmation, and only then prepare a dry-run execution gate.",
      status: voiceReady ? "implementation_review_ready_waiting_for_teacher_number" : `not_ready_${voiceLinked}`,
      evidencePath: voicePath,
      evidenceSummary: {
        sourceStatus: voiceLinked,
        sessionId: voice?.sessionId || "",
        acceptedInputModes: voiceLoop.acceptedInputModes || [],
        userFacingLoop: Array.isArray(voiceLoop.userFacingLoop)
          ? voiceLoop.userFacingLoop.map((step) => step.id)
          : [],
        candidateNumbers: voiceCandidateNumbers,
        targetConfirmation: voiceConfirmationKit.targetConfirmation || "",
        commandConfirmationHtml: voiceConfirmationKit.browserHtml || "",
        nextCalls: Array.isArray(voice?.nextCalls) ? voice.nextCalls.map((call) => call.tool) : [],
        softwareActionsExecuted: voice?.locks?.softwareActionsExecuted === true,
        targetSoftwareCommandsExecuted: voice?.locks?.targetSoftwareCommandsExecuted === true
      },
      implementationEvidenceProven: voiceReady,
      completionProven: false,
      blocker:
        "A real teacher must confirm exactly one numbered target, validate the narrowed target receipt, retain a rollback point, and approve a separate dry-run execution gate before any target software action.",
      nextActionCommand: commandText("confirm-engineering-command-target.mjs", [
        "--confirmation",
        voiceConfirmationKit.targetConfirmation || "<numbered-target-confirmation.json>",
        "--selected-number",
        "<teacher confirmed number>",
        "--create-action-kit",
        "--create-execution-adapter",
        "--software",
        voice?.software || "<teacher-selected software>",
        "--window-title",
        voice?.nextCalls?.find((call) => call.tool === "start_teach_execute_supervised_execution")?.arguments?.targetWindowTitle || "<target window title>",
        "--output-dir",
        join("artifacts", "current-goal-confirmed-voice-text-targets")
      ]),
      strictLocks: [
        "voice_text_cannot_execute_without_confirmed_number",
        "voice_text_confirmation_not_teacher_acceptance",
        "dry_run_first_before_target_software_execution"
      ]
    }),
    requirement({
      id: "rollback_teacher_review_control",
      userRequirement: "Rollback points must be retained until the teacher confirms direction is correct.",
      status: "policy_enforced_waiting_for_teacher_cleanup_confirmation",
      evidencePath: join(process.cwd(), ".transparent-apprentice", "rollback-points"),
      evidenceSummary: {
        rollbackRootExists: existsSync(join(process.cwd(), ".transparent-apprentice", "rollback-points")),
        deleteOnlyAfterTeacherConfirmation: true
      },
      implementationEvidenceProven: existsSync(join(process.cwd(), ".transparent-apprentice", "rollback-points")),
      completionProven: false,
      blocker: "Old rollback points are intentionally retained until teacher confirmation; cleanup must not be automatic.",
      nextActionCommand: "",
      strictLocks: ["do_not_delete_rollback_points_without_teacher_confirmation"]
    }),
    requirement({
      id: "high_to_medium_reasoning_cost_control",
      userRequirement:
        "Use high reasoning to build/repair strict logic, then allow lower-cost medium reasoning only after reviewed deterministic workflow gates pass.",
      status: method?.reasoningTierPolicy ? "policy_review_ready" : `not_ready_${methodLinked}`,
      evidencePath: methodPath,
      evidenceSummary: {
        sourceStatus: methodLinked,
        downgradeAllowedOnlyAfter: method?.reasoningTierPolicy?.downgradeAllowedOnlyAfter || "",
        escalationBackToHighReasoningWhen: method?.reasoningTierPolicy?.escalationBackToHighReasoningWhen || "",
        mediumRuntimeReuseEnabled: method?.locks?.mediumRuntimeReuseEnabled === true
      },
      implementationEvidenceProven: Boolean(method?.reasoningTierPolicy),
      completionProven: false,
      blocker:
        "Medium runtime reuse remains locked until teacher-reviewed method contract, low-token evidence gate, spatial logic contract, rollback, and dry-run validation all pass.",
      nextActionCommand:
        method?.nextCommands?.find((item) => item.id === "create_teacher_method_low_token_workflow_gate_after_contract")
          ?.command || "",
      strictLocks: ["medium_runtime_reuse_locked", "corrections_escalate_back_to_high_reasoning"]
    }),
    requirement({
      id: "rag_knowledge_evidence_only",
      userRequirement:
        "Knowledge-augmented/RAG evidence may support learning, but retrieved knowledge must not silently become authority.",
      status: refreshPath ? "source_available_review_only" : "source_missing_review_only",
      evidencePath: refreshPath,
      evidenceSummary: {
        currentStatusRefreshLinked: Boolean(refreshPath),
        retrievalCanEnableRules: false,
        retrievalCanExecuteSoftware: false
      },
      implementationEvidenceProven: Boolean(refreshPath),
      completionProven: false,
      blocker:
        "RAG/source evidence can draft disabled rules only; teacher review and deterministic validation are required before any use.",
      nextActionCommand: commandText("create-knowledge-rag-rule-draft.mjs", [
        "--source",
        "<teacher-confirmed-primary-source.json>",
        "--output-dir",
        join("artifacts", "current-goal-rag-rule-drafts")
      ]),
      strictLocks: ["rag_cannot_enable_rules", "rag_cannot_execute_software", "rag_cannot_unlock_packaging"]
    })
  ];
}

function writeHtml(path, gate) {
  const sourceRows = Object.entries(gate.paths)
    .map(([key, value]) => `<tr><td><code>${htmlEscape(key)}</code></td><td>${value ? link(value, value) : ""}</td></tr>`)
    .join("\n");
  const requirementRows = gate.requirements
    .map(
      (row) => `<tr>
        <td><code>${htmlEscape(row.id)}</code></td>
        <td>${htmlEscape(row.status)}</td>
        <td>${row.implementationEvidenceProven ? "yes" : "no"}</td>
        <td>${row.completionProven ? "yes" : "no"}</td>
        <td>${htmlEscape(row.blocker)}</td>
        <td>${row.evidencePath ? link("evidence", row.evidencePath) : ""}</td>
      </tr>`
    )
    .join("\n");
  const nextCommands = gate.nextCommands
    .map((item) => `<li><strong>${htmlEscape(item.id)}</strong><pre>${htmlEscape(item.command || "manual review")}</pre></li>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Integrated Evidence Gate</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1180px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2 { margin: 0 0 12px; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-top: 1px solid #e5e8ef; padding: 8px; vertical-align: top; text-align: left; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .danger { color: #8a2f18; font-weight: 600; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Integrated Evidence Gate</h1>
  <p class="status">${htmlEscape(gate.status)}</p>
  <section>
    <h2>Completion Boundary</h2>
    <p class="danger">Goal completion is not proven here. This gate links current evidence and lists blockers before any real software execution or medium-runtime reuse.</p>
    <pre>${htmlEscape(JSON.stringify(gate.completionAudit, null, 2))}</pre>
  </section>
  <section>
    <h2>Requirement Matrix</h2>
    <table>
      <thead><tr><th>Requirement</th><th>Status</th><th>Impl proof</th><th>Completion proof</th><th>Blocker</th><th>Evidence</th></tr></thead>
      <tbody>${requirementRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table>${sourceRows}</table>
  </section>
  <section>
    <h2>Next Commands</h2>
    <ol>${nextCommands}</ol>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, gate) {
  const lines = [
    "# Current Goal Integrated Evidence Gate",
    "",
    `Status: ${gate.status}`,
    "",
    "This is a review-only gate for the full current goal. It links the latest low-token, spatial drawing, physical spatial grounding, and teacher-method handoffs and refuses to call the goal complete until every requirement has real evidence.",
    "",
    "## Completion audit",
    "",
    `- Requirements: ${gate.completionAudit.totalRequirements}`,
    `- Implementation evidence ready: ${gate.completionAudit.implementationEvidenceReadyCount}`,
    `- Completion-proven requirements: ${gate.completionAudit.completionProvenCount}`,
    `- Goal complete: ${gate.goalComplete}`,
    "",
    "## Blocked until",
    "",
    ...gate.completionAudit.blockers.map((item) => `- ${item}`),
    "",
    "## Locks",
    "",
    "- Does not read logs or full logs.",
    "- Does not capture screenshots or record the screen.",
    "- Does not execute target software.",
    "- Does not write memory, enable rules, unlock packaging, or claim completion.",
    "- Does not delete rollback points without teacher confirmation.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "All local software should support low-token log/event learning, teacher-method adaptation, transparent drawing mask, spatial/perspective understanding, and 2D/3D depth sketch demonstration before teacher-confirmed execution."
);
const slug = slugify(goal);
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}`;
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-integrated-evidence-gates")));
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const lowTokenPath =
  argValue("--low-token-handoff") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-low-token-learning-handoffs"),
    "current-goal-all-software-low-token-learning-handoff.json"
  );
const spatialPath =
  argValue("--spatial-handoff") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-teacher-spatial-drawing-handoffs"),
    "current-goal-teacher-spatial-drawing-handoff.json"
  );
const physicalGroundingPath =
  argValue("--physical-world-spatial-grounding-pack") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "physical-world-spatial-grounding-packs"),
    "physical-world-spatial-grounding-pack.json"
  );
const methodPath =
  argValue("--teacher-method-handoff") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-teacher-method-adaptation-handoffs"),
    "current-goal-teacher-method-adaptation-handoff.json"
  );
const voicePath =
  argValue("--voice-control-session") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-voice-text-numbered-execution-sessions"),
    "engineering-voice-control-session.json"
  );
const refreshPath =
  argValue("--current-status-refresh") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "original-goal-current-status-refreshes"),
    "original-goal-current-status-refresh.json"
  );

const lowToken = loadOptional(lowTokenPath);
const spatial = loadOptional(spatialPath);
const physicalGrounding = loadOptional(physicalGroundingPath);
const method = loadOptional(methodPath);
const voice = loadOptional(voicePath);
const requirements = buildRequirements({
  lowTokenPath,
  lowToken,
  spatialPath,
  spatial,
  physicalGroundingPath,
  physicalGrounding,
  methodPath,
  method,
  voicePath,
  voice,
  refreshPath
});
const lockState = locks();
const implementationEvidenceReadyCount = requirements.filter((item) => item.implementationEvidenceProven).length;
const completionProvenCount = requirements.filter((item) => item.completionProven).length;
const blockers = requirements.filter((item) => !item.completionProven).map((item) => `${item.id}: ${item.blocker}`);
const gatePath = join(gateDir, "current-goal-integrated-evidence-gate.json");
const htmlPath = join(gateDir, "current-goal-integrated-evidence-gate.html");
const readmePath = join(gateDir, "CURRENT_GOAL_INTEGRATED_EVIDENCE_GATE.md");

const gate = {
  ok: true,
  format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    completionProvenCount === requirements.length
      ? "unexpected_all_requirements_completion_proven_review_required"
      : "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run",
  paths: {
    gate: gatePath,
    html: htmlPath,
    readme: readmePath,
    lowTokenHandoff: lowTokenPath,
    teacherSpatialDrawingHandoff: spatialPath,
    physicalWorldSpatialGroundingPack: physicalGroundingPath,
    teacherMethodAdaptationHandoff: methodPath,
    voiceTextNumberedExecutionSession: voicePath,
    currentStatusRefresh: refreshPath
  },
  sourceEvidenceStatus: {
    lowTokenHandoff: sourceStatus(
      lowTokenPath,
      lowToken,
      "transparent_ai_current_goal_all_software_low_token_learning_handoff_v1"
    ),
    teacherSpatialDrawingHandoff: sourceStatus(
      spatialPath,
      spatial,
      "transparent_ai_current_goal_teacher_spatial_drawing_handoff_v1"
    ),
    physicalWorldSpatialGroundingPack: sourceStatus(
      physicalGroundingPath,
      physicalGrounding,
      "transparent_ai_physical_world_spatial_grounding_pack_v1"
    ),
    teacherMethodAdaptationHandoff: sourceStatus(
      methodPath,
      method,
      "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1"
    ),
    voiceTextNumberedExecutionSession: sourceStatus(
      voicePath,
      voice,
      "transparent_ai_engineering_voice_control_session_v1"
    )
  },
  requirements,
  completionAudit: {
    totalRequirements: requirements.length,
    implementationEvidenceReadyCount,
    completionProvenCount,
    completionMissingCount: requirements.length - completionProvenCount,
    goalCompleteProven: false,
    blockers,
    completionRule:
      "Every requirement needs teacher-reviewed real evidence, deterministic validation, retained rollback, and separate execution approval where applicable."
  },
  nextCommands: [
    {
      id: "teacher_select_low_token_route",
      command: lowToken?.teacherRouteSelectionActionPack?.routeReceiptValidationCommandTemplate || "",
      purpose: "Choose and validate one low-token all-software observation route."
    },
    {
      id: "teacher_export_and_validate_overlay_packet",
      command: spatial?.nextCommands?.find((item) => item.id === "validate_teacher_exported_overlay_packet")?.command || "",
      purpose: "Produce real teacher transparent-sketch evidence."
    },
    {
      id: "review_physical_world_spatial_grounding",
      command: physicalGrounding?.paths?.startHere || physicalGrounding?.paths?.html || physicalGroundingPath || "",
      purpose:
        "Review RGB-D, camera calibration, point-cloud, pose, fold-angle, and sim-to-real boundary evidence before treating teacher overlay marks as 2D/perspective/3D intent."
    },
    {
      id: "teacher_review_method_profile",
      command: method?.paths?.teacherLearningMethodReadme || "",
      purpose: "Correct the inferred teaching style before contract generation."
    },
    {
      id: "after_reviews_create_rule_drafts_and_gates",
      command: [
        spatial?.nextCommands?.find((item) => item.id === "after_teacher_review_create_logic_contract_rule_draft")
          ?.command || "",
        method?.nextCommands?.find((item) => item.id === "create_teacher_method_execution_learning_contract_after_review")
          ?.command || ""
      ]
        .filter(Boolean)
        .join("\n"),
      purpose: "Create draft_disabled logic and method contracts only after teacher review."
    },
    {
      id: "teacher_confirm_voice_text_numbered_target",
      command:
        requirements.find((item) => item.id === "voice_text_numbered_execution_control")?.nextActionCommand || "",
      purpose:
        "After the teacher reviews the voice/text interpretation and visible numbered candidates, narrow the command to exactly one target before any execution gate."
    }
  ],
  blockedActions: [
    "claim_current_goal_complete_from_integrated_gate",
    "execute_target_software_from_integrated_gate",
    "register_monitor_from_integrated_gate",
    "read_logs_from_integrated_gate",
    "read_full_logs_from_integrated_gate",
    "capture_screenshot_from_integrated_gate",
    "record_screen_from_integrated_gate",
    "write_memory_from_integrated_gate",
    "enable_rules_from_integrated_gate",
    "downgrade_to_medium_runtime_from_integrated_gate",
    "delete_rollback_points_from_integrated_gate"
  ],
  locks: lockState,
  goalComplete: false
};

writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, gate);
writeReadme(readmePath, gate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_integrated_evidence_gate_result_v1",
      status: gate.status,
      gatePath,
      htmlPath,
      readmePath,
      totalRequirements: requirements.length,
      implementationEvidenceReadyCount,
      completionProvenCount,
      goalComplete: false,
      locks: lockState
    },
    null,
    2
  )
);
