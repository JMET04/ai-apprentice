#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-activation-review-packet")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-activation-review-packet"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function sourceRouteEvidence(activationGate) {
  const evidence = activationGate.lowTokenSourceRouteEvidence || {};
  const scope = activationGate.operationalScope || {};
  const paths = activationGate.paths || {};
  const counts = evidence.counts || {};
  const sourceLogSourceDiscoveryLedger =
    evidence.sourceLogSourceDiscoveryLedger || paths.sourceLogSourceDiscoveryLedger || scope.sourceLogSourceDiscoveryLedger || "";
  const sourceLogSourceDiscoveryLedgerReadme =
    evidence.sourceLogSourceDiscoveryLedgerReadme ||
    paths.sourceLogSourceDiscoveryLedgerReadme ||
    scope.sourceLogSourceDiscoveryLedgerReadme ||
    "";
  const normalizedCounts = {
    logSourceDiscoveryRows: Number(counts.logSourceDiscoveryRows ?? scope.sourceLogSourceDiscoveryRows ?? 0),
    logSourceDiscoveryMissingRows: Number(counts.logSourceDiscoveryMissingRows ?? scope.sourceLogSourceDiscoveryMissingRows ?? 0),
    directLogCandidatesReadyForMetadataGate: Number(counts.directLogCandidatesReadyForMetadataGate ?? 0),
    lowTokenFallbackRoutesReadyForReview: Number(counts.lowTokenFallbackRoutesReadyForReview ?? 0)
  };
  const ledgerReady =
    evidence.ledgerReady === true &&
    evidence.reviewOnly === true &&
    evidence.logContentsRead === false &&
    evidence.screenshotsCaptured === false &&
    evidence.softwareActionsExecuted === false &&
    Boolean(sourceLogSourceDiscoveryLedger) &&
    normalizedCounts.logSourceDiscoveryRows > 0 &&
    normalizedCounts.logSourceDiscoveryMissingRows === 0;
  return {
    ...evidence,
    sourceLogSourceDiscoveryLedger,
    sourceLogSourceDiscoveryLedgerReadme,
    counts: normalizedCounts,
    ledgerReady,
    reviewOnly: evidence.reviewOnly === true,
    logContentsRead: evidence.logContentsRead === true,
    screenshotsCaptured: evidence.screenshotsCaptured === true,
    softwareActionsExecuted: evidence.softwareActionsExecuted === true,
    reviewPacketConsumesSourceRouteEvidence: true,
    reviewPacketDoesNotReadLogContents: true,
    reviewPacketDoesNotCaptureScreenshots: true,
    reviewPacketDoesNotExecuteSoftware: true
  };
}

function confirmationRows(activationGate) {
  const confirmations = activationGate.confirmations || {};
  const blockers = new Set(activationGate.blockers || []);
  const routeEvidence = sourceRouteEvidence(activationGate);
  return [
    {
      id: "recurring_monitor_teacher_confirmation",
      label: "Teacher confirms recurring low-token monitoring may be reviewed",
      current: confirmations.teacherConfirmationMatched === true ? "confirmed" : "missing",
      requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review",
      blocker: blockers.has("missing_explicit_teacher_recurring_monitor_confirmation"),
      commandFlag: "--teacher-confirmation"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      label: "Teacher reviewed the monitored software scope",
      current: confirmations.scopeConfirmationMatched === true ? "confirmed" : "missing",
      requiredPhrase: "teacher_reviewed_monitor_scope",
      blocker: blockers.has("missing_reviewed_monitor_scope_confirmation"),
      commandFlag: "--scope-confirmation"
    },
    {
      id: "registration_review_confirmation",
      label: "Teacher confirms registration may proceed only to dry-run review",
      current: confirmations.registrationConfirmationMatched === true ? "confirmed" : "missing",
      requiredPhrase: "teacher_confirmed_registration_dry_run_review_only",
      blocker: blockers.has("missing_explicit_teacher_registration_confirmation"),
      commandFlag: "--registration-confirmation"
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      label: "Teacher reviewed knowledge-augmented RAG and low-token source-route ledger evidence",
      current: routeEvidence.ledgerReady === true ? "ready_for_teacher_review" : "missing",
      requiredPhrase: "teacher_reviewed_low_token_source_route_ledger",
      blocker: blockers.has("source_trial_log_source_discovery_ledger_missing_or_unreviewed") || routeEvidence.ledgerReady !== true,
      commandFlag: "--source-route-confirmation",
      evidence: {
        sourceLogSourceDiscoveryLedger: routeEvidence.sourceLogSourceDiscoveryLedger,
        sourceLogSourceDiscoveryLedgerReadme: routeEvidence.sourceLogSourceDiscoveryLedgerReadme,
        counts: routeEvidence.counts,
        reviewOnly: routeEvidence.reviewOnly,
        logContentsRead: routeEvidence.logContentsRead,
        screenshotsCaptured: routeEvidence.screenshotsCaptured,
        softwareActionsExecuted: routeEvidence.softwareActionsExecuted
      }
    },
    {
      id: "rollback_point_retained",
      label: "Rollback point exists and remains retained",
      current: confirmations.rollbackPointCreated === true ? "confirmed" : "missing",
      requiredPhrase: "rollback_point_created_and_retained",
      blocker: confirmations.rollbackPointCreated !== true,
      commandFlag: "--rollback-point-created"
    }
  ];
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Operational Activation Review Packet",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    `Operational scope: ${packet.operationalScope?.scopeKind || "unspecified"}`,
    `Low-token source route ledger: ${packet.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedgerReadme || packet.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedger || "not provided"}`,
    "",
    "What this packet is for:",
    "- Translate the activation gate blockers into teacher-reviewable confirmation rows.",
    "- Show the exact safe next commands after confirmation.",
    "- Keep registration, runner launch, screenshots, target software execution, and memory writes locked.",
    "",
    "Confirmation rows:",
    ...packet.confirmationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.current}; phrase=${row.requiredPhrase}`),
    "",
    "Next safe commands:",
    ...packet.nextSafeCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`),
    "",
    "Blocked actions:",
    ...packet.blockedActions.map((action) => `- ${action}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Review all-software operational learning activation before any registration.");
const activationInput = readJsonInput(
  argValue("--activation-gate", argValue("--activation", argValue("--gate", ""))),
  "--activation-gate",
  "transparent_ai_all_software_operational_learning_activation_gate_v1"
);
if (!activationInput.value) throw new Error("--activation-gate is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-packets"))
);
mkdirSync(outputRoot, { recursive: true });
const packetId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packetDir = join(outputRoot, packetId);
mkdirSync(packetDir, { recursive: true });

const activationGate = activationInput.value;
const operationalScope = activationGate.operationalScope || null;
const lowTokenSourceRouteEvidence = sourceRouteEvidence(activationGate);
const rows = confirmationRows(activationGate);
const missingRows = rows.filter((row) => row.current !== "confirmed");
const readyForDryRun = activationGate.readyForTeacherRegistrationReview === true && missingRows.length === 0;
const reviewPacketPath = join(packetDir, "all-software-operational-activation-review-packet.json");
const htmlPath = join(packetDir, "all-software-operational-activation-review-packet.html");
const receiptTemplatePath = join(packetDir, "all-software-operational-activation-review-receipt-template.json");
const readmePath = join(packetDir, "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_PACKET_START_HERE.md");

const rerunActivationCommand = commandLine("create-all-software-operational-learning-activation-gate.mjs", [
  ["--trial", activationGate.paths?.sourceTrial],
  ["--goal", goal],
  ["--teacher-confirmation", rows[0].requiredPhrase],
  ["--scope-confirmation", rows[1].requiredPhrase],
  ["--registration-confirmation", rows[2].requiredPhrase],
  ["--teacher-reviewed-scope", true],
  ["--rollback-point-created", true]
]);
const dryRunCommand = commandLine("run-all-software-operational-learning-activation-dry-run-rehearsal.mjs", [
  ["--activation-gate", activationGate.paths?.activationGate || activationInput.path]
]);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  packetDoesNotRegisterTask: true,
  packetDoesNotLaunchRunner: true,
  packetDoesNotExecuteWrapper: true,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  teacherConfirmationRequiredBeforeSystemChange: true
};

const receiptTemplate = {
  format: "transparent_ai_all_software_operational_activation_review_receipt_template_v1",
  packetId,
  sourceActivationGate: activationInput.path,
  operationalScope,
  lowTokenSourceRouteEvidence,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_to_rerun_activation_gate", "blocked"],
  blockedDecisions: ["accepted", "register_task", "start_runner", "execute_target_software", "write_memory", "unlock_packaging"],
  confirmationRows: rows.map((row) => ({
    id: row.id,
    teacherObservedEvidence: "",
    teacherDecision: row.current === "confirmed" ? "already_confirmed" : "needs_teacher_review",
    requiredPhrase: row.requiredPhrase
  })),
  locks
};

const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_activation_review_packet_v1",
  packetId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyForDryRun ? "activation_gate_ready_for_dry_run_rehearsal" : "waiting_for_teacher_activation_confirmations",
  operationalScope,
  sourceActivationGateStatus: activationGate.status,
  sourceReadyForTeacherRegistrationReview: activationGate.readyForTeacherRegistrationReview === true,
  sourceBlockers: activationGate.blockers || [],
  lowTokenSourceRouteEvidence,
  confirmationRows: rows,
  missingConfirmationCount: missingRows.length,
  nextSafeCommands: [
    {
      id: "rerun_activation_gate_after_teacher_confirmation",
      label: "Rerun activation gate after teacher fills confirmation receipt",
      command: rerunActivationCommand,
      enabledWhen: "teacher explicitly confirms recurring monitoring review, reviewed scope, registration dry-run review, and retained rollback"
    },
    {
      id: "run_activation_dry_run_rehearsal_after_gate_ready",
      label: "Run activation dry-run rehearsal only after activation gate is ready",
      command: dryRunCommand,
      enabledWhen: "source activation gate or rerun activation gate reports readyForTeacherRegistrationReview=true"
    }
  ],
  blockedActions: [
    "register_scheduled_task_from_review_packet",
    "start_recurring_runner_from_review_packet",
    "execute_activation_wrapper_with_execute_flag_from_review_packet",
    "execute_target_software_from_review_packet",
    "write_long_term_memory_from_review_packet",
    "claim_goal_complete_from_review_packet"
  ],
  existingAbilitiesReused: [
    "create_all_software_operational_learning_activation_gate",
    "run_all_software_operational_learning_activation_dry_run_rehearsal",
    "create_rollback_point",
    "create_all_software_operational_status_console"
  ],
  paths: {
    reviewPacket: reviewPacketPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceActivationGate: activationInput.path,
    sourceTrial: activationGate.paths?.sourceTrial || "",
    sourceLogSourceDiscoveryLedger: lowTokenSourceRouteEvidence.sourceLogSourceDiscoveryLedger,
    sourceLogSourceDiscoveryLedgerReadme: lowTokenSourceRouteEvidence.sourceLogSourceDiscoveryLedgerReadme
  },
  locks
};

writeFileSync(reviewPacketPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Activation Review Packet</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #1e2937; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 16px; }
    .row strong { display: block; margin-bottom: 8px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    textarea { width: 100%; min-height: 180px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    a { color: #174d89; word-break: break-all; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Activation Review Packet</h1>
    <p>${htmlEscape(packet.goal)}</p>
    <p><span class="badge">${htmlEscape(packet.status)}</span></p>
    <section class="panel">
      <h2>Review receipt</h2>
      <p>Fill the receipt outside this page, then rerun the activation gate. This page does not register tasks, launch runners, or execute software.</p>
      <button id="copyReceipt">Copy Receipt Template</button>
      <button id="copyCommands">Copy Next Commands</button>
      <textarea id="packetBox" spellcheck="false"></textarea>
    </section>
    <section class="grid" id="rows"></section>
    <section class="panel" style="margin-top:16px">
      <h2>Source evidence</h2>
      <p><a href="${htmlEscape(packet.paths.sourceActivationGate)}">${htmlEscape(packet.paths.sourceActivationGate)}</a></p>
      <p>Low-token source route ledger: <a href="${htmlEscape(packet.paths.sourceLogSourceDiscoveryLedgerReadme || packet.paths.sourceLogSourceDiscoveryLedger)}">${htmlEscape(packet.paths.sourceLogSourceDiscoveryLedgerReadme || packet.paths.sourceLogSourceDiscoveryLedger || "not provided")}</a></p>
      <p>Ledger rows: <code>${htmlEscape(packet.lowTokenSourceRouteEvidence.counts.logSourceDiscoveryRows)}</code>; missing rows: <code>${htmlEscape(packet.lowTokenSourceRouteEvidence.counts.logSourceDiscoveryMissingRows)}</code>; review only: <code>${htmlEscape(packet.lowTokenSourceRouteEvidence.reviewOnly)}</code></p>
    </section>
  </main>
  <script>
    const packet = ${jsonForScript(packet)};
    const receipt = ${jsonForScript(receiptTemplate)};
    const rows = document.getElementById("rows");
    for (const row of packet.confirmationRows) {
      const el = document.createElement("article");
      el.className = "row";
      el.innerHTML = '<strong>' + row.id + '</strong><p>' + row.label + '</p><p>Status: <code>' + row.current + '</code></p><p>Phrase: <code>' + row.requiredPhrase + '</code></p>';
      rows.appendChild(el);
    }
    const box = document.getElementById("packetBox");
    box.value = JSON.stringify(receipt, null, 2);
    document.getElementById("copyReceipt").addEventListener("click", async () => {
      box.value = JSON.stringify(receipt, null, 2);
      await navigator.clipboard.writeText(box.value);
    });
    document.getElementById("copyCommands").addEventListener("click", async () => {
      box.value = JSON.stringify(packet.nextSafeCommands, null, 2);
      await navigator.clipboard.writeText(box.value);
    });
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
      format: "transparent_ai_all_software_operational_activation_review_packet_result_v1",
      packetId,
      status: packet.status,
      operationalScope,
      reviewPacketPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      missingConfirmationCount: packet.missingConfirmationCount,
      locks
    },
    null,
    2
  )
);
