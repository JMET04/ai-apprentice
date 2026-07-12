#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function slugify(value) {
  const slug =
    String(value || "voice-numbered-execution-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "voice-numbered-execution-convergence-audit";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-audit`);
}

function fileExists(path) {
  return Boolean(path && existsSync(path));
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

function lockState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotRunCommands: true,
    auditDoesNotConfirmTeacherNumber: true,
    auditDoesNotReadLogs: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotRecordScreen: true,
    auditDoesNotLaunchRunner: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotWriteMemory: true,
    auditDoesNotEnableRules: true,
    auditDoesNotDeleteRollbackPoints: true,
    numberedTargetConfirmationRequired: true,
    teacherConfirmationRequiredBeforeExecution: true,
    dryRunFirst: true,
    screenshotsCaptured: false,
    screenRecorded: false,
    logContentsRead: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function statusRow(id, label, passed, evidence = "", blocker = "") {
  return { id, label, passed: Boolean(passed), evidence, blocker: passed ? "" : blocker };
}

function writeReadme(path, audit) {
  const lines = [
    "# Voice/Text Numbered Execution Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}`,
    `Completion allowed: ${audit.summary.finalGoalCompletionAllowed}`,
    "",
    "This audit proves the existing voice/text control pieces converge into one review-only flow. It does not confirm a target number, run software, read logs, capture screenshots, write memory, enable rules, or claim the goal complete.",
    "",
    "Open evidence:",
    `1. Voice control session: ${audit.sourceEvidence.voiceControlSession.path || "missing"}`,
    `2. Integrated evidence gate: ${audit.sourceEvidence.integratedEvidenceGate.path || "missing"}`,
    `3. Numbered target confirmation: ${audit.sourceEvidence.numberedTargetConfirmation.path || "missing"}`,
    `4. Overlay packet: ${audit.sourceEvidence.overlayPacket.path || "missing"}`,
    "",
    "Checks:",
    ...audit.checks.map((row) => `- ${row.passed ? "PASS" : "BLOCKED"} ${row.id}: ${row.label}${row.blocker ? ` (${row.blocker})` : ""}`),
    "",
    "Next teacher action:",
    audit.nextTeacherAction,
    "",
    "Blocked actions:",
    ...audit.blockedActions.map((item) => `- ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, audit) {
  const rows = audit.checks
    .map(
      (row) =>
        `<tr><td>${htmlEscape(row.id)}</td><td>${row.passed ? "PASS" : "BLOCKED"}</td><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.blocker)}</td></tr>`
    )
    .join("\n");
  const links = audit.primaryOpenOrder
    .map((item) => {
      const href = fileHref(item.path);
      return `<li>${htmlEscape(item.label)}: ${href ? `<a href="${href}">${htmlEscape(item.path)}</a>` : htmlEscape(item.path || "missing")}</li>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html><html><head><meta charset="utf-8"><title>Voice Numbered Convergence Audit</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Voice/Text Numbered Execution Convergence Audit</h1><p>Status: <code>${htmlEscape(audit.status)}</code></p><p>Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}. Completion allowed: ${audit.summary.finalGoalCompletionAllowed}</p><h2>Open Evidence</h2><ol>${links}</ol><h2>Checks</h2><table><thead><tr><th>Id</th><th>Status</th><th>Check</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table><h2>Next Teacher Action</h2><p>${htmlEscape(audit.nextTeacherAction)}</p></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue(
  "--goal",
  "Audit voice/text numbered target confirmation convergence before teacher-confirmed execution."
);
const voiceSessionPath = resolve(
  argValue(
    "--voice-control-session",
    newestFile(join(repoRoot, "artifacts", "current-goal-voice-text-numbered-execution-sessions"), "engineering-voice-control-session.json")
  )
);
const integratedGatePath = resolve(
  argValue(
    "--integrated-evidence-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-integrated-evidence-gates"), "current-goal-integrated-evidence-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-voice-numbered-convergence-audits")));

const voiceSession = fileExists(voiceSessionPath) ? readJson(voiceSessionPath) : null;
const integratedGate = fileExists(integratedGatePath) ? readJson(integratedGatePath) : null;
const loop = voiceSession?.nonExpertVoiceTextNumberedControlLoop || {};
const generated = voiceSession?.generated || {};
const confirmationKit = generated.engineeringCommandConfirmationKit || {};
const controlProfile = generated.softwareControlChannelProfile || {};
const inputModes = Array.isArray(loop.acceptedInputModes) ? loop.acceptedInputModes : [];
const workflow = Array.isArray(voiceSession?.orderedWorkflow) ? voiceSession.orderedWorkflow : [];
const nextCalls = Array.isArray(voiceSession?.nextCalls) ? voiceSession.nextCalls : [];
const blockedActions = Array.isArray(voiceSession?.blockedActions) ? voiceSession.blockedActions : [];
const candidateNumbers = Array.isArray(confirmationKit.candidateNumbers)
  ? confirmationKit.candidateNumbers
  : loop.userFacingLoop?.find?.((step) => step.id === "mark_numbered_possible_positions")?.candidateNumbers || [];

const checks = [
  statusRow(
    "voice_or_text_input_supported",
    "Accepts both voice transcript and typed text command inputs without continuous recording.",
    inputModes.includes("browser_or_system_speech_transcript") && inputModes.includes("typed_text_command") && voiceSession?.locks?.fullContinuousRecording === false,
    inputModes.join(", "),
    "voice_or_text_input_modes_missing"
  ),
  statusRow(
    "intent_restatement_before_targeting",
    "Workflow restates the understood operation before target marking.",
    loop.userFacingLoop?.some?.((step) => step.id === "restate_understanding") || workflow.includes("interpret_command"),
    workflow.join(" -> "),
    "intent_restatement_step_missing"
  ),
  statusRow(
    "numbered_candidates_prepared",
    "Visible numbered candidates are prepared for teacher confirmation.",
    candidateNumbers.length >= 2 && fileExists(confirmationKit.targetConfirmation),
    confirmationKit.targetConfirmation || "",
    "numbered_target_confirmation_missing"
  ),
  statusRow(
    "transparent_overlay_packet_linked",
    "Numbered target overlay packet is linked as review evidence.",
    fileExists(confirmationKit.overlayPacket),
    confirmationKit.overlayPacket || "",
    "numbered_overlay_packet_missing"
  ),
  statusRow(
    "teacher_must_confirm_exactly_one_number",
    "Execution remains blocked until the teacher confirms exactly one visible number.",
    loop.confirmationContract?.teacherMustConfirmExactlyOneNumber === true &&
      loop.confirmationContract?.autoExecuteFromVoiceOnly === false &&
      nextCalls.some((call) => call.tool === "confirm_engineering_command_target"),
    "confirm_engineering_command_target",
    "exactly_one_number_confirmation_bridge_missing"
  ),
  statusRow(
    "dry_run_first_execution_gate",
    "After target confirmation, execution is still dry-run-first and separately approved.",
    loop.executionContract?.dryRunFirst === true &&
      loop.executionContract?.teacherConfirmationRequiredBeforeExecution === true &&
      nextCalls.some((call) => call.tool === "start_teach_execute_supervised_execution"),
    "start_teach_execute_supervised_execution",
    "dry_run_or_execution_approval_gate_missing"
  ),
  statusRow(
    "structured_control_route_preferred",
    "The flow prefers existing APIs, CLI/scripts, browser automation, or file routes before supervised UI fallback.",
    Array.isArray(loop.executionContract?.structuredRoutesBeforeUiFallback) &&
      loop.executionContract.structuredRoutesBeforeUiFallback.length >= 4 &&
      fileExists(controlProfile.executionPackagePath),
    controlProfile.executionPackagePath || "",
    "structured_control_route_package_missing"
  ),
  statusRow(
    "integrated_gate_links_voice_lane",
    "Current integrated evidence gate links the voice/text numbered execution session.",
    Boolean(integratedGate?.paths?.voiceTextNumberedExecutionSession || integratedGate?.requirements?.some?.((item) => item.id === "voice_text_numbered_execution_control")),
    integratedGatePath || "",
    "integrated_gate_voice_lane_missing"
  ),
  statusRow(
    "execution_and_learning_locks_closed",
    "The evidence does not execute software, read logs, capture screenshots, write memory, enable rules, or claim completion.",
    voiceSession?.locks?.softwareActionsExecuted === false &&
      voiceSession?.locks?.targetSoftwareCommandsExecuted === false &&
      voiceSession?.locks?.screenshotsCaptured === false &&
      voiceSession?.locks?.fileContentsRead === false &&
      voiceSession?.locks?.ruleEnabled === false &&
      integratedGate?.locks?.goalComplete === false,
    "locks",
    "unsafe_lock_state_detected"
  )
];

const failed = checks.filter((row) => !row.passed);
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });
const auditPath = join(auditDir, "voice-numbered-execution-convergence-audit.json");
const readmePath = join(auditDir, "VOICE_NUMBERED_EXECUTION_CONVERGENCE_AUDIT_START_HERE.md");
const htmlPath = join(auditDir, "voice-numbered-execution-convergence-audit.html");
const receiptTemplatePath = join(auditDir, "voice-numbered-execution-convergence-audit-receipt-template.json");
const locks = lockState();

const audit = {
  ok: failed.length === 0,
  format: "transparent_ai_voice_numbered_execution_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failed.length
    ? "blocked_waiting_for_voice_numbered_convergence_evidence"
    : "voice_text_numbered_execution_convergence_ready_for_teacher_review_not_execution",
  summary: {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    blockedChecks: failed.length,
    finalGoalCompletionAllowed: false
  },
  sourceEvidence: {
    voiceControlSession: { path: voiceSessionPath, exists: Boolean(voiceSession), format: voiceSession?.format || "" },
    integratedEvidenceGate: { path: integratedGatePath, exists: Boolean(integratedGate), format: integratedGate?.format || "" },
    numberedTargetConfirmation: { path: confirmationKit.targetConfirmation || "", exists: fileExists(confirmationKit.targetConfirmation) },
    overlayPacket: { path: confirmationKit.overlayPacket || "", exists: fileExists(confirmationKit.overlayPacket) },
    executionPackage: { path: controlProfile.executionPackagePath || "", exists: fileExists(controlProfile.executionPackagePath) }
  },
  convergence: {
    acceptedInputModes: inputModes,
    orderedWorkflow: workflow,
    candidateNumbers,
    confirmationBridge: "confirm_engineering_command_target",
    dryRunExecutionBridge: "start_teach_execute_supervised_execution",
    selectedNumberConfirmed: false,
    targetSoftwareExecutionPreparedButNotRun: true,
    targetSoftwareExecuted: false
  },
  checks,
  blockers: failed.map((row) => `${row.id}:${row.blocker}`),
  nextTeacherAction:
    "Review the voice/text interpretation and numbered overlay, then either confirm exactly one number with confirm_engineering_command_target or correct the candidate list. Do not execute target software from this audit.",
  primaryOpenOrder: [
    { label: "Voice Control Session", path: voiceSessionPath },
    { label: "Numbered Target Confirmation", path: confirmationKit.targetConfirmation || "" },
    { label: "Numbered Overlay Packet", path: confirmationKit.overlayPacket || "" },
    { label: "Integrated Evidence Gate", path: integratedGatePath }
  ],
  blockedActions: [
    "claim_goal_complete_from_convergence_audit",
    "confirm_number_without_teacher",
    "execute_target_software_from_audit",
    "read_logs_from_audit",
    "capture_screenshot_from_audit",
    "record_screen_from_audit",
    "launch_runner_from_audit",
    "write_memory_from_audit",
    "enable_rule_from_audit",
    "delete_rollback_points_from_audit",
    "unlock_packaging_from_audit"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This audit only proves convergence of voice/text numbered target confirmation evidence. Real completion still requires teacher-confirmed number, receipt validation, retained rollback, dry-run approval, real target execution evidence where approved, and final teacher acceptance."
  },
  paths: {
    audit: auditPath,
    readme: readmePath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath
  },
  locks
};

const receiptTemplate = {
  format: "transparent_ai_voice_numbered_execution_convergence_audit_receipt_template_v1",
  auditId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "confirmed_one_number_elsewhere", "correct_candidate_list", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "execute_target_software",
    "read_logs_now",
    "capture_screenshot_now",
    "record_screen_now",
    "write_memory",
    "enable_rule",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  reviewRows: checks.map((row) => ({
    checkId: row.id,
    passed: row.passed,
    teacherReviewed: false,
    teacherNote: ""
  })),
  selectedNumber: "",
  selectedNumberMustBeProvidedThrough: "confirm_engineering_command_target",
  locks
};

writeJson(auditPath, audit);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, audit);
writeHtml(htmlPath, audit);

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      format: "transparent_ai_voice_numbered_execution_convergence_audit_result_v1",
      status: audit.status,
      auditPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: audit.summary,
      blockers: audit.blockers,
      locks
    },
    null,
    2
  )
);
