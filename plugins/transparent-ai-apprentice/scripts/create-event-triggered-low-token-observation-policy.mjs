#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "event-triggered-low-token-observation-policy")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "event-triggered-low-token-observation-policy"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function isVisualRoute(route) {
  return !isCompactRoute(route) && /screenshot|visual/i.test(String(route || ""));
}

function isCompactRoute(route) {
  return /compact|tail|metadata|skip/i.test(String(route || ""));
}

function buildTriggerRows(plan) {
  const actions = [
    ...(Array.isArray(plan.selectedActions) ? plan.selectedActions : []),
    ...(Array.isArray(plan.deferredActions) ? plan.deferredActions : [])
  ];
  return actions.map((action, index) => {
    const route = action.route || "";
    const visual = isVisualRoute(route);
    return {
      rowId: `trigger-policy-row-${index + 1}`,
      sourceActionId: action.id || "",
      software: action.software || plan.software || "",
      triggerClass:
        route === "skip_visual_check_unchanged_metadata"
          ? "unchanged_metadata_skip"
          : visual
            ? "meaningful_or_ambiguous_change_optional_visual"
            : "changed_metadata_or_compact_event_review",
      evidencePath: action.evidencePath || "",
      route,
      lowTokenDecision: visual
        ? "ask_teacher_before_one_bounded_screenshot"
        : isCompactRoute(route)
          ? "review_compact_evidence_before_visual_tokens"
          : "teacher_review_before_next_step",
      maxTailRead: visual ? "only_after_compact_evidence_is_ambiguous" : "bounded_tail_or_compact_event_only",
      maxScreenshots: visual ? 1 : 0,
      screenshotAllowedNow: false,
      nextTool: action.nextTool || "",
      nextInstruction: action.nextInstruction || "",
      blockedUntil: action.blockedUntil || ["teacher_reviews_low_token_policy_row"],
      tokenReason: action.reason || "",
      estimatedTokenCost: action.estimatedTokenCost ?? 1,
      locks: {
        reviewOnly: true,
        captureNow: false,
        readFullLogNow: false,
        executeNow: false,
        writeMemoryNow: false,
        enableRuleNow: false,
        teacherConfirmationRequired: true
      }
    };
  });
}

function writeHtml(path, policy) {
  const rows = policy.triggerRows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.rowId)}</td>
        <td>${escapeHtml(row.software)}</td>
        <td>${escapeHtml(row.triggerClass)}</td>
        <td>${escapeHtml(row.lowTokenDecision)}</td>
        <td>${row.maxScreenshots}</td>
        <td>${escapeHtml(compact(row.tokenReason))}</td>
        <td>${escapeHtml(compact(row.nextInstruction))}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Event Triggered Low Token Observation Policy</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #17202a; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #d5dde5; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; }
    .lock { color: #7b241c; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Event Triggered Low Token Observation Policy</h1>
  <p>Status: <strong>${escapeHtml(policy.status)}</strong></p>
  <p>Decision ladder: metadata-only watch, bounded tail or compact event, teacher review, at most one teacher-confirmed screenshot, learning handoff, optional voice/text numbered-target workbench, then a separate execution gate.</p>
  <p class="lock">No continuous recording, full-log retention, screenshot capture, software execution, UI event dispatch, memory write, rule enablement, packaging unlock, or completion claim happens in this policy.</p>
  <table>
    <thead><tr><th>Row</th><th>Software</th><th>Trigger</th><th>Decision</th><th>Max screenshots</th><th>Reason</th><th>Next instruction</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">No trigger rows. Provide a low-token trigger budget plan first.</td></tr>'}</tbody>
  </table>
</body>
</html>
`,
    "utf8"
  );
}

const planInput = readJsonInput(argValue("--budget-plan", argValue("--plan", "")), "--budget-plan");
const goal = argValue("--goal", "Use event-triggered observation to learn from any software with low token cost.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "event-triggered-low-token-observation-policies")));

mkdirSync(outputRoot, { recursive: true });
const policyId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const policyDir = join(outputRoot, policyId);
mkdirSync(policyDir, { recursive: true });

const plan = planInput.value || {};
const triggerRows = buildTriggerRows(plan);
const visualRows = triggerRows.filter((row) => row.maxScreenshots > 0);
const compactRows = triggerRows.filter((row) => row.maxScreenshots === 0);
const hasBudgetPlan = plan.format === "transparent_ai_low_token_trigger_budget_plan_v1";

const policyPath = join(policyDir, "event-triggered-low-token-observation-policy.json");
const htmlPath = join(policyDir, "event-triggered-low-token-observation-policy.html");
const readmePath = join(policyDir, "EVENT_TRIGGERED_LOW_TOKEN_OBSERVATION_POLICY_START_HERE.md");
const receiptTemplatePath = join(policyDir, "teacher-event-triggered-low-token-observation-policy-receipt-template.json");
const nextReceiptBuilderCommand = commandLine("create-event-triggered-low-token-observation-policy-receipt-builder.mjs", [
  ["--policy", policyPath],
  ["--output-dir", join(policyDir, "receipt-builder")]
]);
const nextReceiptValidationCommand = commandLine("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
  ["--policy", policyPath],
  ["--receipt", "<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"],
  ["--output-dir", join(policyDir, "receipt-validation")]
]);
const nextTriggeredVisualVoiceControlWorkbenchCommand = commandLine("create-triggered-visual-evidence-voice-control-workbench.mjs", [
  ["--handoff", "<triggered-visual-evidence-learning-handoff.json>"],
  ["--software", "<teacher-reviewed-software>"],
  ["--command", "<teacher voice transcript or typed command>"],
  ["--output-dir", join(policyDir, "triggered-visual-voice-control-workbench")]
]);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  metadataFirst: true,
  eventTriggeredOnly: true,
  continuousRecording: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  screenshotAllowedWithoutTeacher: false,
  maxScreenshotsPerTrigger: 1,
  rawFullLogsRetained: false,
  fullLogsRead: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  scheduledTaskRegistered: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false,
  teacherConfirmationRequiredBeforeCapture: true,
  teacherConfirmationRequiredBeforeExecution: true
};

const policy = {
  ok: true,
  format: "transparent_ai_event_triggered_low_token_observation_policy_v1",
  policyId,
  createdAt: new Date().toISOString(),
  goal,
  status: !hasBudgetPlan
    ? "blocked_waiting_for_low_token_trigger_budget_plan"
    : triggerRows.length
      ? "waiting_for_teacher_event_trigger_policy_review"
      : "no_event_trigger_action_needed",
  purpose:
    "Turn the existing all-software observer, metadata delta watcher, bounded tail reader, compact learning events, and triggered visual check into one low-token decision ladder.",
  sourceEvidence: {
    budgetPlanPath: planInput.path,
    budgetPlanFormat: plan.format || "",
    budgetPlanStatus: plan.status || "",
    selectedActionCount: plan.selectedActionCount ?? 0,
    deferredActionCount: plan.deferredActionCount ?? 0,
    sourceFileName: planInput.path ? basename(planInput.path) : ""
  },
  decisionLadder: [
    {
      stage: "metadata_only_watch",
      existingTool: "watch_log_source_metadata_deltas",
      tokenPolicy: "compare file existence, size, and mtime before reading tails or screenshots",
      nextWhenChanged: "bounded_tail_or_compact_event"
    },
    {
      stage: "bounded_tail_or_compact_event",
      existingTool: "monitor_software_observation_deltas or run_all_software_low_token_learning_cycle",
      tokenPolicy: "read selected tail snippets or compact event summaries only",
      nextWhenAmbiguous: "teacher_review_before_visual"
    },
    {
      stage: "teacher_review_before_visual",
      existingTool: "create_low_token_trigger_budget_plan",
      tokenPolicy: "ask the teacher whether one visual check is worth the token cost",
      nextWhenTeacherConfirms: "one_bounded_screenshot"
    },
    {
      stage: "one_bounded_screenshot",
      existingTool: "capture_triggered_visual_check",
      tokenPolicy: "capture or copy at most one reviewed visual evidence file for the trigger",
      nextWhenCaptured: "triggered_visual_learning_handoff"
    },
    {
      stage: "triggered_visual_learning_handoff",
      existingTool: "create_triggered_visual_evidence_learning_handoff",
      tokenPolicy: "teach from compact evidence plus the single reviewed image",
      nextWhenActionNeeded: "voice_text_numbered_target_workbench"
    },
    {
      stage: "voice_text_numbered_target_workbench",
      existingTool: "create_triggered_visual_evidence_voice_control_workbench",
      tokenPolicy:
        "reuse the same reviewed visual evidence; keep only a short voice transcript or typed command, mark possible targets with numbers, and wait for the teacher to confirm one number",
      nextWhenTeacherConfirmsOneNumber: "separate_execution_gate"
    },
    {
      stage: "separate_execution_gate",
      existingTool: "create_real_local_execution_approval_gate",
      tokenPolicy: "execution is never implied by observation; require route, target, rollback, verifier, and teacher confirmation",
      nextWhenApproved: "approved_runner_only"
    }
  ],
  triggerRows,
  compactRowsCount: compactRows.length,
  visualRowsCount: visualRows.length,
  teacherReceiptTemplatePath: receiptTemplatePath,
  nextReceiptBuilderCommand,
  nextReceiptValidationCommand,
  nextReviewCommand: commandLine("create-event-triggered-low-token-observation-policy.mjs", [["--budget-plan", planInput.path || "<low-token-trigger-budget-plan.json>"]]),
  nextCaptureCommandTemplate:
    visualRows.length > 0
      ? commandLine("capture-triggered-visual-check.mjs", [
          ["--request", "<teacher-reviewed-triggered-visual-check-request-or-queue.json>"],
          ["--selected-request-id", "<teacher-reviewed-request-id>"],
          ["--teacher-confirmed", "true"],
          ["--reviewed-source-image", "<optional-reviewed-image-path>"]
        ])
      : "",
  nextTriggeredVisualVoiceControlWorkbenchCommandTemplate: nextTriggeredVisualVoiceControlWorkbenchCommand,
  blockedActions: [
    "continuous_recording",
    "periodic_screenshot_stream",
    "screenshot_without_teacher_confirmation",
    "bulk_screenshot_collection",
    "full_log_retention",
    "full_log_read_before_metadata_change",
    "execute_from_voice_without_numbered_target_confirmation",
    "software_execution_from_observation_policy",
    "ui_event_dispatch_from_observation_policy",
    "long_term_memory_write",
    "rule_enablement",
    "native_universal_execution_claim",
    "packaging_or_goal_completion_claim"
  ],
  locks,
  paths: {
    policy: policyPath,
    html: htmlPath,
    readme: readmePath,
    teacherReceiptTemplate: receiptTemplatePath,
    receiptBuilderCommandTemplate: nextReceiptBuilderCommand,
    receiptValidationCommandTemplate: nextReceiptValidationCommand,
    triggeredVisualVoiceControlWorkbenchCommandTemplate: nextTriggeredVisualVoiceControlWorkbenchCommand
  }
};

const receiptTemplate = {
  format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1",
  policyId,
  policyPath,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "teacher_confirms_policy", "teacher_requests_lower_token_cost", "teacher_marks_visual_trigger_too_expensive", "blocked"],
  forbiddenDecisions: [
    "accepted",
    "execute_now",
    "run_now",
    "capture_now",
    "capture_screenshot",
    "read_full_logs",
    "send_ui_events",
    "register_schedule",
    "continuous_recording",
    "write_memory",
    "enable_rule",
    "unlock_packaging",
    "native_universal_execution",
    "claim_goal_complete"
  ],
  rollbackPointReviewed: false,
  rollbackPointPath: "",
  rowReceipts: triggerRows.map((row) => ({
    rowId: row.rowId,
    teacherDecision: "needs_teacher_review",
    teacherNote: "",
    lowerTokenAlternative: "",
    approvedVisualCheckRequestId: "",
    locks: {
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      captureNow: false,
      executeNow: false,
      writeMemoryNow: false
    }
  })),
  nextReceiptBuilderCommandTemplate: nextReceiptBuilderCommand,
  nextValidationCommandTemplate: nextReceiptValidationCommand,
  nextTriggeredVisualVoiceControlWorkbenchCommandTemplate: nextTriggeredVisualVoiceControlWorkbenchCommand,
  locks
};

writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
writeHtml(htmlPath, policy);
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Event Triggered Low Token Observation Policy",
    "",
    `Status: ${policy.status}`,
    `Compact rows: ${policy.compactRowsCount}`,
    `Visual rows: ${policy.visualRowsCount}`,
    "",
    "Workflow:",
    "- Watch metadata first.",
    "- Read bounded tails or compact events only after a change.",
    "- Ask the teacher before any visual check.",
    "- Confirm a retained rollback point before validating any follow-up queue.",
    "- Capture at most one bounded screenshot for a reviewed trigger.",
    "- If the teacher needs action, reuse the triggered visual evidence in the voice/text numbered-target workbench.",
    "- Keep execution, memory, rules, packaging, and completion behind separate gates.",
    "",
    `Teacher receipt template: ${receiptTemplatePath}`,
    `Open browser receipt builder: ${nextReceiptBuilderCommand}`,
    `Validate teacher-filled receipt before follow-up: ${nextReceiptValidationCommand}`,
    `Voice/text numbered-target workbench command: ${nextTriggeredVisualVoiceControlWorkbenchCommand}`,
    "",
    "This policy does not capture screenshots, read full logs, execute software, send UI events, write memory, enable rules, unlock packaging, or claim completion.",
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_event_triggered_low_token_observation_policy_result_v1",
      policyPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      receiptBuilderCommandTemplate: nextReceiptBuilderCommand,
      receiptValidationCommandTemplate: nextReceiptValidationCommand,
      triggeredVisualVoiceControlWorkbenchCommandTemplate: nextTriggeredVisualVoiceControlWorkbenchCommand,
      status: policy.status,
      compactRowsCount: policy.compactRowsCount,
      visualRowsCount: policy.visualRowsCount,
      locks
    },
    null,
    2
  )
);
