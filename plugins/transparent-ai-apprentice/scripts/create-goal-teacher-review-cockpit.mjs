#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "goal-teacher-review-cockpit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "goal-teacher-review-cockpit"
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path)) || "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function pathUrl(root, targetPath) {
  if (!targetPath) return "";
  const resolvedTarget = resolve(targetPath);
  const relativePath = relative(root, resolvedTarget);
  if (relativePath.startsWith("..") || resolve(root, relativePath) !== resolvedTarget) return "";
  return relativePath.split(/[\\/]+/).map(encodeURIComponent).join("/");
}

function entryLink(center, id) {
  return (center.entryLinks || []).find((link) => link.id === id) || {};
}

function lane(statusConsole, id) {
  return (statusConsole?.lanes || []).find((item) => item.id === id) || null;
}

function nextSafeAction(statusConsole, contains) {
  return (statusConsole?.nextSafeActions || []).find((action) => action.label.includes(contains)) || null;
}

function addReviewItem(items, item) {
  if (!item.primaryPath && !item.command && !item.detail) return;
  items.push({
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_reviewed_continue", "blocked_needs_more_evidence"],
    blockedDecisions: ["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging"],
    ...item
  });
}

const goal = argValue("--goal", "Review current full-goal teacher gates without changing the system.");
const commandCenterPath = resolve(argValue("--command-center", argValue("--center", "")));
if (!commandCenterPath || !existsSync(commandCenterPath)) throw new Error("--command-center is required");
const center = readJson(commandCenterPath);
const centerDir = dirname(commandCenterPath);
const statusConsolePath = resolve(
  argValue(
    "--status-console",
    firstExisting([
      center.paths?.operationalStatusConsole,
      join(centerDir, "current-evidence", "operational-status-console", "all-software-operational-status-console.json")
    ])
  )
);
const statusConsole = statusConsolePath && existsSync(statusConsolePath) ? readJson(statusConsolePath) : null;
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "goal-teacher-review-cockpits"))
);
mkdirSync(outputRoot, { recursive: true });
const cockpitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const cockpitDir = join(outputRoot, cockpitId);
mkdirSync(cockpitDir, { recursive: true });

const cockpitPath = join(cockpitDir, "goal-teacher-review-cockpit.json");
const htmlPath = join(cockpitDir, "goal-teacher-review-cockpit.html");
const readmePath = join(cockpitDir, "GOAL_TEACHER_REVIEW_COCKPIT_START_HERE.md");
const receiptTemplatePath = join(cockpitDir, "goal-teacher-review-cockpit-receipt-template.json");

const activationLane = lane(statusConsole, "automatic_learning_activation_path");
const coverageLane = lane(statusConsole, "coverage_rollout_receipt_gate");
const voiceLane = lane(statusConsole, "non_expert_engineering_voice_control");
const boundaryLane = lane(statusConsole, "original_goal_boundary");
const reviewItems = [];

addReviewItem(reviewItems, {
  id: "activation_confirmations",
  title: "Activation confirmations",
  currentStatus: activationLane?.status || "unknown",
  detail: activationLane?.detail || "",
  primaryPath: center.paths?.activationReceiptBuilderHtml || "",
  primaryUrl: pathUrl(centerDir, center.paths?.activationReceiptBuilderHtml || ""),
  evidencePath: center.paths?.activationReceiptValidation || center.paths?.activationReviewPacket || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.activationReceiptValidation || center.paths?.activationReviewPacket || ""),
  command:
    nextSafeAction(statusConsole, "activation")?.command ||
    commandLine("validate-all-software-operational-activation-review-receipt.mjs", [
      ["--review-packet", center.paths?.activationReviewPacket],
      ["--receipt", "<teacher-filled-activation-review-receipt.json>"]
    ]),
  teacherQuestion: "Confirm only the rows you actually reviewed. Do not use this as registration permission."
});

addReviewItem(reviewItems, {
  id: "coverage_rollout_receipt",
  title: "Coverage rollout receipt",
  currentStatus: coverageLane?.status || "unknown",
  detail: coverageLane?.detail || "",
  primaryPath: center.paths?.coverageRolloutReceiptBuilderHtml || "",
  primaryUrl: pathUrl(centerDir, center.paths?.coverageRolloutReceiptBuilderHtml || ""),
  evidencePath: center.paths?.coverageConvergence || center.paths?.coverageExpansionPlan || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.coverageConvergence || center.paths?.coverageExpansionPlan || ""),
  command:
    center.nextCalls?.coverageRolloutReceiptValidation
      ? commandLine("validate-all-software-coverage-rollout-receipt.mjs", [
          ["--plan", center.nextCalls.coverageRolloutReceiptValidation.arguments?.plan],
          ["--receipt", "<teacher-filled-coverage-rollout-receipt.json>"]
        ])
      : "",
  teacherQuestion: "Choose which prepared batches may continue to reviewed rollout. This does not run the supervisor."
});

addReviewItem(reviewItems, {
  id: "coverage_enrollment_follow_up",
  title: "Coverage enrollment follow-up",
  currentStatus: center.paths?.coverageEnrollmentFollowUpReceiptBuilder
    ? "coverage_enrollment_follow_up_receipt_ready_for_teacher_review"
    : center.paths?.coverageEnrollmentFollowUpPlan
      ? "coverage_enrollment_follow_up_plan_ready_for_receipt_builder"
      : "not_generated",
  detail: [
    center.paths?.coverageEnrollmentLedger ? "ledger present" : "ledger missing",
    center.paths?.coverageEnrollmentFollowUpPlan ? "follow-up plan present" : "follow-up plan missing",
    center.paths?.coverageEnrollmentFollowUpBatch ? "dry-run batch evidence present" : "dry-run batch evidence missing"
  ].join("; "),
  primaryPath: center.paths?.coverageEnrollmentFollowUpReceiptBuilderHtml || center.paths?.coverageEnrollmentFollowUpPlan || "",
  primaryUrl: pathUrl(centerDir, center.paths?.coverageEnrollmentFollowUpReceiptBuilderHtml || center.paths?.coverageEnrollmentFollowUpPlan || ""),
  evidencePath: center.paths?.coverageEnrollmentFollowUpPlan || center.paths?.coverageEnrollmentLedger || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.coverageEnrollmentFollowUpPlan || center.paths?.coverageEnrollmentLedger || ""),
  command:
    center.nextCalls?.coverageEnrollmentFollowUpReceiptValidation
      ? commandLine("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
          ["--plan", center.nextCalls.coverageEnrollmentFollowUpReceiptValidation.arguments?.plan],
          ["--receipt", "<teacher-filled-coverage-enrollment-follow-up-receipt.json>"]
        ])
      : "",
  teacherQuestion:
    "Review the remaining per-software enrollment gaps, mark only rows you actually checked, then validate the filled receipt before any reviewed enrollment batch."
});

addReviewItem(reviewItems, {
  id: "control_channel_repair_receipt",
  title: "Control-channel repair receipt",
  currentStatus: center.paths?.controlChannelRepairReceiptBuilderHtml ? "ready_for_teacher_review" : "not_generated",
  detail: "Review app routes that need profile/probe follow-up before native control claims.",
  primaryPath: center.paths?.controlChannelRepairReceiptBuilderHtml || "",
  primaryUrl: pathUrl(centerDir, center.paths?.controlChannelRepairReceiptBuilderHtml || ""),
  evidencePath: center.paths?.controlChannelRepairQueue || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.controlChannelRepairQueue || ""),
  command:
    center.nextCalls?.controlChannelRepairReceiptValidation
      ? commandLine("validate-all-software-control-channel-repair-receipt.mjs", [
          ["--repair-queue", center.nextCalls.controlChannelRepairReceiptValidation.arguments?.repairQueue],
          ["--receipt", "<teacher-filled-control-channel-repair-receipt.json>"]
        ])
      : "",
  teacherQuestion: "Mark which software rows should get safe profile/probe follow-up."
});

addReviewItem(reviewItems, {
  id: "voice_text_numbered_target",
  title: "Voice/text numbered target",
  currentStatus: voiceLane?.status || "unknown",
  detail: voiceLane?.detail || "Confirm exactly one numbered target before dry-run action planning.",
  primaryPath: center.paths?.voiceWorkbenchHtml || entryLink(center, "engineering_voice_control_workbench").path || "",
  primaryUrl: pathUrl(centerDir, center.paths?.voiceWorkbenchHtml || ""),
  evidencePath: center.paths?.voiceWorkbench || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.voiceWorkbench || ""),
  command: center.nextCalls?.confirmNumberedTarget?.arguments?.confirmCommandTemplate || "",
  teacherQuestion: "Use voice/text/sketch intent, then select exactly one visible number or correct the candidates."
});

addReviewItem(reviewItems, {
  id: "transparent_sketch_overlay",
  title: "Transparent sketch overlay",
  currentStatus: "ready_for_teacher_review",
  detail: "Use the overlay for 2D, perspective, and 3D spatial intent demonstrations before execution planning.",
  primaryPath: center.paths?.transparentOverlay || "",
  primaryUrl: pathUrl(centerDir, center.paths?.transparentOverlay || ""),
  evidencePath: center.paths?.teachExecuteLoop || "",
  evidenceUrl: pathUrl(centerDir, center.paths?.teachExecuteLoop || ""),
  command: "",
  teacherQuestion: "Draw the intended relationship, then let the system produce numbered spatial targets for confirmation."
});

const receiptTemplate = {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
  cockpitId,
  defaultDecision: "needs_teacher_review",
  rowDecisions: reviewItems.map((item) => ({
    id: item.id,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    teacherNote: ""
  }))
};
const nextValidationCommand = commandLine("validate-goal-teacher-review-cockpit-receipt.mjs", [
  ["--cockpit", cockpitPath],
  ["--receipt", "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"]
]);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  cockpitDoesNotValidateReceipts: true,
  cockpitDoesNotRunCommands: true,
  rolloutSupervisorInvoked: false,
  coverageRunnerInvoked: false,
  scheduledTaskRegistered: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false
};

const cockpit = {
  ok: true,
  format: "transparent_ai_goal_teacher_review_cockpit_v1",
  cockpitId,
  createdAt: new Date().toISOString(),
  goal,
  status: reviewItems.length ? "waiting_for_teacher_review" : "no_review_items_found",
  purpose:
    "One teacher-facing review cockpit that gathers the current activation, coverage, control-channel, voice/text, and sketch gates without executing any command.",
  source: {
    commandCenter: commandCenterPath,
    statusConsole: statusConsolePath
  },
  summary: {
    missingEvidence: statusConsole?.scan?.missingEvidence || [],
    originalBoundary: boundaryLane?.status || center.completionBoundary?.originalCompletionDecision || "not_complete",
    reviewItemCount: reviewItems.length
  },
  reviewItems,
  receiptTemplate,
  interactiveReceiptBuilder: {
    available: true,
    outputFormat: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    runsValidation: false,
    executesCommands: false,
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_reviewed_continue", "blocked_needs_more_evidence"]
  },
  browserValidationPreview: {
    available: true,
    outputFormat: "transparent_ai_goal_teacher_review_cockpit_browser_validation_preview_v1",
    usesCurrentReceiptControls: true,
    mirrorsValidatorDecisionRules: true,
    writesFiles: false,
    runsValidationScript: false,
    executesCommands: false,
    showsNextSafeCommandsOnly: true
  },
  nextValidationCommand,
  blockedActions: [
    "execute_from_cockpit",
    "register_schedule_from_cockpit",
    "validate_receipts_from_cockpit",
    "run_coverage_rollout_supervisor_from_cockpit",
    "write_memory_from_cockpit",
    "claim_goal_complete_from_cockpit"
  ],
  paths: {
    cockpit: cockpitPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath
  },
  locks
};

writeFileSync(cockpitPath, `${JSON.stringify(cockpit, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Goal Teacher Review Cockpit",
    "",
    `Status: ${cockpit.status}`,
    `Review items: ${reviewItems.length}`,
    "",
    "Open the HTML page first. It collects the current teacher review gates into one place.",
    "",
    `- HTML: ${htmlPath}`,
    `- JSON: ${cockpitPath}`,
    `- Receipt template: ${receiptTemplatePath}`,
    `- Next validation command: ${nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This cockpit does not run commands.",
    "- It does not validate receipts.",
    "- It does not execute software, register schedules, capture screenshots, write memory, enable rules, accept technology, or claim completion."
  ].join("\n") + "\n",
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Goal Teacher Review Cockpit</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .item { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    a, code { word-break: break-all; }
    a.open { display: inline-flex; align-items: center; min-height: 34px; padding: 0 10px; border: 1px solid #174d89; border-radius: 6px; color: #174d89; text-decoration: none; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 34px; padding: 0 10px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    .muted { color: #586579; font-size: 13px; }
    .receipt-controls { display: grid; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #edf1f6; }
    label { display: grid; gap: 4px; font-size: 13px; color: #344154; }
    select, input[type="text"] { min-height: 34px; border: 1px solid #cfd7e4; border-radius: 6px; padding: 0 8px; font: inherit; }
    .inline { display: flex; gap: 8px; align-items: center; }
    .inline input { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <main>
    <h1>Goal Teacher Review Cockpit</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Current boundary</h2>
      <p>${htmlEscape(cockpit.summary.originalBoundary)}</p>
      <p class="muted">Missing evidence: ${htmlEscape(cockpit.summary.missingEvidence.join(", ") || "none")}</p>
      <button id="copyReceipt">Copy cockpit receipt template</button>
      <button id="generateReceipt">Generate reviewed receipt JSON</button>
      <button id="previewValidation">Preview safe next commands</button>
      <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
      <button id="copyJson" class="secondary">Copy cockpit JSON</button>
      <button id="copyValidation" class="secondary">Copy cockpit validation command</button>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <section class="grid" id="items"></section>
  </main>
  <script>
    const cockpit = ${jsonForScript(cockpit)};
    const output = document.getElementById("output");
    const items = document.getElementById("items");
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    }
    function copyButton(text, label = "Copy") {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = label;
      button.addEventListener("click", () => navigator.clipboard?.writeText(String(text || "")));
      return button;
    }
    for (const item of cockpit.reviewItems) {
      const el = document.createElement("article");
      el.className = "item";
      el.innerHTML =
        "<h2>" + escapeHtml(item.title) + "</h2>" +
        "<p><span class='badge'>" + escapeHtml(item.currentStatus) + "</span></p>" +
        "<p>" + escapeHtml(item.detail) + "</p>" +
        "<p class='muted'>" + escapeHtml(item.teacherQuestion) + "</p>";
      if (item.primaryUrl) {
        const link = document.createElement("a");
        link.className = "open";
        link.href = item.primaryUrl;
        link.textContent = "Open review page";
        el.appendChild(link);
      }
      if (item.primaryPath) el.appendChild(copyButton(item.primaryPath, "Copy page path"));
      if (item.command) el.appendChild(copyButton(item.command, "Copy next command"));
      const controls = document.createElement("div");
      controls.className = "receipt-controls";
      controls.innerHTML =
        "<label>Review decision<select data-row-id='" + escapeHtml(item.id) + "' data-field='teacherDecision'>" +
        "<option value='needs_teacher_review'>needs_teacher_review</option>" +
        "<option value='teacher_reviewed_continue'>teacher_reviewed_continue</option>" +
        "<option value='blocked_needs_more_evidence'>blocked_needs_more_evidence</option>" +
        "</select></label>" +
        "<label class='inline'><input type='checkbox' data-row-id='" + escapeHtml(item.id) + "' data-field='evidenceReviewed'>Evidence reviewed</label>" +
        "<label>Teacher note<input type='text' data-row-id='" + escapeHtml(item.id) + "' data-field='teacherNote' placeholder='Optional note or blocker'></label>";
      el.appendChild(controls);
      items.appendChild(el);
    }
    function reviewedReceipt() {
      const receipt = JSON.parse(JSON.stringify(cockpit.receiptTemplate));
      for (const row of receipt.rowDecisions) {
        const controls = Array.from(document.querySelectorAll("[data-row-id]")).filter((control) => control.dataset.rowId === row.id);
        const decision = controls.find((control) => control.dataset.field === "teacherDecision");
        const evidence = controls.find((control) => control.dataset.field === "evidenceReviewed");
        const note = controls.find((control) => control.dataset.field === "teacherNote");
        row.teacherDecision = decision?.value || "needs_teacher_review";
        row.evidenceReviewed = evidence?.checked === true;
        row.teacherNote = note?.value || "";
      }
      receipt.generatedBy = "goal_teacher_review_cockpit_browser_receipt_builder";
      receipt.builderLocks = cockpit.locks;
      return receipt;
    }
    function writeReceiptToOutput(copy = false) {
      output.value = JSON.stringify(reviewedReceipt(), null, 2);
      if (copy) navigator.clipboard?.writeText(output.value);
    }
    function downloadReceipt() {
      writeReceiptToOutput(false);
      const blob = new Blob([output.value + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "teacher-filled-goal-teacher-review-cockpit-receipt.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    function normalizeDecision(value) {
      const text = String(value || "needs_teacher_review").trim().toLowerCase();
      if (["teacher_reviewed_continue", "ready_for_follow_up", "ready_to_continue"].includes(text)) return "teacher_reviewed_continue";
      if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
      if (["accepted", "execute_now", "register_schedule", "enable_memory", "claim_complete", "unlock_packaging"].includes(text)) return text;
      return "needs_teacher_review";
    }
    function validationPreview() {
      const receipt = reviewedReceipt();
      const itemsById = new Map(cockpit.reviewItems.map((item) => [item.id, item]));
      const forbidden = new Set([
        "accepted",
        "execute_now",
        "register_schedule",
        "enable_memory",
        "claim_complete",
        "unlock_packaging",
        ...(cockpit.blockedActions || [])
      ]);
      const validationRows = receipt.rowDecisions.map((row) => {
        const item = itemsById.get(row.id);
        const decision = normalizeDecision(row.teacherDecision);
        const forbiddenDecision = forbidden.has(decision);
        const canAdvance = Boolean(item) && decision === "teacher_reviewed_continue" && row.evidenceReviewed === true && !forbiddenDecision;
        return {
          id: row.id,
          title: item?.title || "",
          normalizedDecision: decision,
          evidenceReviewed: row.evidenceReviewed === true,
          status: !item
            ? "unknown_cockpit_item"
            : forbiddenDecision
              ? "blocked_for_forbidden_decision"
              : canAdvance
                ? "ready_for_downstream_receipt_or_gate_review"
                : decision === "blocked_needs_more_evidence"
                  ? "blocked_needs_more_evidence"
                  : "needs_teacher_review_or_evidence",
          canAdvance,
          nextSafeCommand: canAdvance && item.command
            ? {
                id: "review_" + item.id,
                itemId: item.id,
                title: item.title,
                command: item.command,
                executesNow: false,
                blockedUntil: "teacher runs the copied downstream validation command separately with its required receipt"
              }
            : null
        };
      });
      const readyRows = validationRows.filter((row) => row.canAdvance);
      const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
      const waitingRows = validationRows.filter((row) => !row.canAdvance && row.status !== "blocked_for_forbidden_decision");
      return {
        ok: true,
        format: "transparent_ai_goal_teacher_review_cockpit_browser_validation_preview_v1",
        status: forbiddenDecisionUsed ? "blocked" : readyRows.length > 0 ? "preview_has_safe_next_commands" : "waiting_for_teacher_review",
        validationDecision: forbiddenDecisionUsed
          ? "blocked_for_forbidden_decision"
          : readyRows.length > 0 && waitingRows.length === 0
            ? "all_rows_ready_for_downstream_review"
            : readyRows.length > 0
              ? "some_rows_ready_for_downstream_review"
              : "needs_teacher_review",
        readyRowCount: readyRows.length,
        waitingRowCount: waitingRows.length,
        validationRows,
        nextSafeCommands: readyRows.map((row) => row.nextSafeCommand).filter(Boolean),
        previewOnly: true,
        writesFiles: false,
        runsValidationScript: false,
        commandsExecuted: false,
        locks: cockpit.locks
      };
    }
    document.getElementById("copyReceipt").addEventListener("click", () => {
      output.value = JSON.stringify(cockpit.receiptTemplate, null, 2);
      navigator.clipboard?.writeText(output.value);
    });
    document.getElementById("generateReceipt").addEventListener("click", () => writeReceiptToOutput(true));
    document.getElementById("previewValidation").addEventListener("click", () => {
      output.value = JSON.stringify(validationPreview(), null, 2);
      navigator.clipboard?.writeText(output.value);
    });
    document.getElementById("downloadReceipt").addEventListener("click", downloadReceipt);
    document.getElementById("copyJson").addEventListener("click", () => {
      output.value = JSON.stringify(cockpit, null, 2);
      navigator.clipboard?.writeText(output.value);
    });
    document.getElementById("copyValidation").addEventListener("click", () => {
      output.value = cockpit.nextValidationCommand || "";
      navigator.clipboard?.writeText(output.value);
    });
    output.value = JSON.stringify(cockpit.receiptTemplate, null, 2);
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: "created",
      format: "transparent_ai_goal_teacher_review_cockpit_result_v1",
      cockpitId,
      cockpitPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      reviewItemCount: reviewItems.length,
      locks
    },
    null,
    2
  )
);
