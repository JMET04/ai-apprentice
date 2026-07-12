#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-apprentice-session-launcher-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-apprentice-session-launcher-receipt"
  );
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const maybePath = resolve(value);
  const text = existsSync(maybePath) ? readFileSync(maybePath, "utf8") : value;
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`${label} must be a JSON string or a path to JSON: ${error.message}`);
  }
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boolLocks(sourceLocks = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    modelInvoked: false,
    providerInvoked: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullLogRead: false,
    memoryWritten: false,
    ragEvidenceTreatedAsAuthority: false,
    rollbackRequiredBeforeExecution: true,
    teacherConfirmationRequiredBeforeExecution: true,
    numberedTargetConfirmationRequired: true,
    correctionEscalatesToHighReasoning: true,
    mediumRuntimeRequiresConfirmedWorkflow: true,
    doesNotExecuteTargetSoftware: true,
    ...sourceLocks,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    modelInvoked: false,
    providerInvoked: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullLogRead: false,
    memoryWritten: false,
    ragEvidenceTreatedAsAuthority: false,
    doesNotExecuteTargetSoftware: true
  };
}

function normalizePacket(input) {
  if (input?.format === "transparent_ai_tlcl_apprentice_session_launcher_v1") return input;
  if (input?.packetPath) return readJsonInput(input.packetPath, "launcher.packetPath");
  throw new Error("launcher must be transparent_ai_tlcl_apprentice_session_launcher_v1 or a launcher result with packetPath");
}

function pickNextCall(packet, id) {
  return (packet.nextCalls || []).find((call) => call.id === id) || null;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cliValue(value, placeholder) {
  const chosen = cleanString(value) || placeholder;
  if (String(chosen).startsWith("<") && String(chosen).endsWith(">")) return chosen;
  return `"${String(chosen).replace(/"/g, '\\"')}"`;
}

function mergeNextCall(nextCall, args = {}) {
  if (!nextCall) return null;
  const filtered = Object.fromEntries(Object.entries(args).filter(([, value]) => cleanString(value)));
  return {
    ...nextCall,
    arguments: {
      ...(nextCall.arguments || {}),
      ...filtered
    }
  };
}

function placeholdersFromText(value) {
  return Array.from(new Set(String(value || "").match(/<[^<>]+>/g) || []));
}

function commandTemplateForRoute(route, packet, nextCall, receipt = {}) {
  const inputs = receipt.handoffInputs || {};
  const confirmedRollbackPoint =
    cleanString(inputs.rollbackPoint) || cleanString(receipt.confirmedRollbackPoint) || cleanString(packet.sources?.rollbackPoint);
  if (route === "start_with_existing_tool_demo") {
    const sourceDrawing = cleanString(inputs.sourceDrawing) || cleanString(inputs.visualEvidence) || cleanString(packet.sources?.sourceArtifacts?.[0]);
    return {
      command: "continue_teaching",
      template:
        `continue_teaching(goal, software, teacherStyle, teacherMessage, universalDetailLogic=true, sourceDrawing=${sourceDrawing || "<source-drawing-or-artifact>"})`,
      nextCall: mergeNextCall(nextCall, { sourceDrawing })
    };
  }
  if (route === "start_with_rag_sources") {
    const teacherConfirmedSource =
      cleanString(inputs.teacherConfirmedSource) || cleanString(packet.sources?.knowledgeSources?.[0]);
    return {
      command: "knowledge/create-rag-research-intake-queue.mjs",
      template:
        `node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-research-intake-queue.mjs --goal ${cliValue(packet.goal, "<goal>")} --lead ${cliValue(teacherConfirmedSource, "<teacher-confirmed-source>")}`,
      nextCall: mergeNextCall(nextCall, { lead: teacherConfirmedSource })
    };
  }
  if (route === "continue_with_rag_rule_dsl_review") {
    const retrievalDraftReviewValidation =
      cleanString(inputs.retrievalDraftReviewValidation) || cleanString(inputs.reviewValidation);
    return {
      command: "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
      template:
        `node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation ${cliValue(retrievalDraftReviewValidation, "<retrieval-draft-review-validation.json>")} --rollback-point ${cliValue(confirmedRollbackPoint, "<retained-rollback-point>")} --teacher-reviewed`,
      nextCall: mergeNextCall(nextCall, {
        reviewValidation: retrievalDraftReviewValidation,
        rollbackPoint: confirmedRollbackPoint
      })
    };
  }
  if (route === "start_with_voice_numbered_confirmation") {
    const visualEvidence = cleanString(inputs.visualEvidence) || cleanString(packet.sources?.sourceArtifacts?.[0]);
    return {
      command: "create_engineering_voice_control_session",
      template:
        `create_engineering_voice_control_session(software, command, visualEvidence=${visualEvidence || "<visual-evidence>"}, numbered target confirmation)`,
      nextCall: mergeNextCall(nextCall, { visualEvidence })
    };
  }
  if (route === "start_with_low_token_observation") {
    const synthesizedNextCall = {
      id: "start_with_low_token_observation",
      tool: "create_all_software_observer_bootstrap",
      arguments: {
        goal: packet.goal,
        software: packet.software,
        maxProcesses: 40,
        maxInstalled: 80,
        noInitializeWatch: true,
        note: "Low-token observation bootstrap only; no screenshots, full log reads, target commands, memory writes, rule enablement, or packaging unlocks."
      }
    };
    return {
      command: "create_all_software_observer_bootstrap",
      template:
        "create_all_software_observer_bootstrap(goal, software, maxProcesses=40, maxInstalled=80, noInitializeWatch=true)",
      nextCall: synthesizedNextCall
    };
  }
  return { command: "", template: "", nextCall: null };
}

const launcherInput = argValue("--launcher", argValue("--packet", argValue("--launcher-packet", "")));
const receiptInput = argValue("--receipt", "");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-launcher-receipt-validations"))
  )
);

const packet = normalizePacket(readJsonInput(launcherInput, "launcher"));
const receipt = readJsonInput(receiptInput, "receipt");
const allowedRoutes = new Set([
  "start_with_existing_tool_demo",
  "start_with_rag_sources",
  "continue_with_rag_rule_dsl_review",
  "start_with_voice_numbered_confirmation",
  "start_with_low_token_observation",
  "blocked"
]);
const forbiddenDecisions = new Set(["accepted", "execute_now", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);
const decision = receipt.teacherSelectedDecision || receipt.decision || receipt.selectedDecision || receipt.defaultDecision || "needs_teacher_review";
const launchId = packet.launchId || receipt.launchId || "unknown-launch";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(`${launchId}-${decision}`)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const locks = boolLocks(packet.locks);
const sourceHash = sha256Json(packet);
const receiptHash = sha256Json(receipt);
const blockers = [];
const warnings = [];

if (packet.format !== "transparent_ai_tlcl_apprentice_session_launcher_v1") {
  blockers.push("INVALID_LAUNCHER_PACKET_FORMAT");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_launcher_receipt_v1") {
  blockers.push("INVALID_RECEIPT_FORMAT");
}
if (receipt.launchId && packet.launchId && receipt.launchId !== packet.launchId) {
  blockers.push("LAUNCH_ID_MISMATCH");
}
if (decision === "needs_teacher_review" || !decision) {
  blockers.push("WAITING_FOR_TEACHER_ROUTE_CHOICE");
}
if (forbiddenDecisions.has(decision)) {
  blockers.push("blocked_for_forbidden_decision");
}
if (!allowedRoutes.has(decision) && decision !== "needs_teacher_review") {
  blockers.push("INVALID_ROUTE_DECISION");
}
if (decision === "start_with_rag_sources" && !packet.sources?.knowledgeSources?.length) {
  warnings.push("RAG_ROUTE_SELECTED_WITHOUT_KNOWLEDGE_SOURCES");
}
if (
  decision === "continue_with_rag_rule_dsl_review" &&
  !cleanString(receipt.handoffInputs?.retrievalDraftReviewValidation) &&
  !cleanString(receipt.handoffInputs?.reviewValidation)
) {
  warnings.push("RAG_RULE_DSL_REVIEW_VALIDATION_INPUT_MISSING_USING_PLACEHOLDER");
}
if (decision !== "blocked" && !receipt.confirmedRollbackPoint && !packet.sources?.rollbackPoint) {
  warnings.push("ROLLBACK_POINT_NOT_CONFIRMED_IN_RECEIPT");
}

const routeNextCallId = {
  start_with_existing_tool_demo: "start_with_existing_tool_demo",
  start_with_rag_sources: "start_with_rag_sources",
  continue_with_rag_rule_dsl_review: "continue_with_rag_rule_dsl_review",
  start_with_voice_numbered_confirmation: "start_with_voice_numbered_confirmation"
}[decision];
const packetNextCall = routeNextCallId ? pickNextCall(packet, routeNextCallId) : null;
if (routeNextCallId && !packetNextCall) blockers.push("SELECTED_ROUTE_NEXT_CALL_MISSING");

const routeTemplate = commandTemplateForRoute(decision, packet, packetNextCall, receipt);
const status =
  blockers.includes("blocked_for_forbidden_decision")
    ? "blocked_for_forbidden_decision"
    : blockers.includes("WAITING_FOR_TEACHER_ROUTE_CHOICE")
      ? "tlcl_apprentice_session_route_waiting_for_teacher_choice"
      : decision === "blocked"
        ? "tlcl_apprentice_session_route_blocked_by_teacher"
        : blockers.length
          ? "tlcl_apprentice_session_route_validation_blocked"
          : "tlcl_apprentice_session_route_ready_for_manual_handoff";

const handoff =
  status === "tlcl_apprentice_session_route_ready_for_manual_handoff"
    ? {
        format: "transparent_ai_tlcl_apprentice_session_launcher_handoff_command_v1",
        status: "manual_handoff_ready",
        selectedRoute: decision,
        commandTemplate: routeTemplate,
        nextCall: routeTemplate.nextCall,
        handoffInputs: receipt.handoffInputs || {},
        teacherNotes: receipt.teacherNotes || "",
        requiresTeacherConfirmationBeforeExecution: true,
        executesNow: false,
        reviewOnly: true,
        locks
      }
    : null;

const validation = {
  format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_validation_v1",
  status,
  selectedRoute: decision,
  launchId: packet.launchId || "",
  validationId,
  sourceHash,
  receiptHash,
  blockers,
  warnings,
  allowedRoutes: [...allowedRoutes],
  forbiddenDecisions: [...forbiddenDecisions],
  optimizedPrompt:
    "Validate the teacher-selected TLCL route and create only a manual handoff template; do not execute software, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
  reviewBoundary: {
    ragIsEvidenceOnly: true,
    routeChoiceIsNotAcceptance: true,
    handoffIsNotExecution: true,
    teacherCorrectionReturnsToHighReasoningRepair: true,
    mediumRuntimeStillRequiresConfirmedWorkflow: true
  },
  handoff,
  handoffInputs: receipt.handoffInputs || {},
  locks
};

const validationPath = join(validationDir, "tlcl-apprentice-session-launcher-receipt-validation.json");
const handoffPath = join(validationDir, "tlcl-apprentice-session-launcher-handoff-command.json");
const handoffMarkdownPath = join(validationDir, "tlcl-apprentice-session-launcher-manual-handoff.md");
const handoffHtmlPath = join(validationDir, "tlcl-apprentice-session-launcher-manual-handoff.html");
const handoffQueuePath = join(validationDir, "tlcl-apprentice-session-launcher-handoff-queue.json");
const handoffQueueHtmlPath = join(validationDir, "tlcl-apprentice-session-launcher-handoff-queue.html");
const handoffQueueReadmePath = join(validationDir, "TLCL_APPRENTICE_SESSION_HANDOFF_QUEUE_START_HERE.md");
const readmePath = join(validationDir, "README.md");

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
if (handoff) writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
let handoffQueue = null;
if (handoff) {
  const nextCallJson = JSON.stringify(handoff.nextCall, null, 2);
  const routeInputsJson = JSON.stringify(handoff.handoffInputs || {}, null, 2);
  const locksJson = JSON.stringify(handoff.locks, null, 2);
  const warningsText = warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "- none";
  const placeholders = placeholdersFromText(handoff.commandTemplate.template);
  const queueItemStatus =
    warnings.length || placeholders.length
      ? "waiting_for_teacher_input_or_warning_review"
      : "ready_for_manual_handoff_review";
  handoffQueue = {
    ok: true,
    format: "transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1",
    status: queueItemStatus === "ready_for_manual_handoff_review" ? "ready_for_manual_handoff_review" : "waiting_for_teacher_input_or_warning_review",
    queueDecision:
      queueItemStatus === "ready_for_manual_handoff_review"
        ? "one_manual_handoff_ready"
        : "review_warnings_or_placeholders_before_handoff",
    validationId,
    selectedRoute: decision,
    counts: {
      queueItems: 1,
      readyItems: queueItemStatus === "ready_for_manual_handoff_review" ? 1 : 0,
      waitingItems: queueItemStatus === "ready_for_manual_handoff_review" ? 0 : 1,
      blockedItems: 0,
      warnings: warnings.length,
      placeholders: placeholders.length
    },
    queueItems: [
      {
        id: "tlcl_apprentice_session_handoff_001",
        order: 1,
        status: queueItemStatus,
        selectedRoute: decision,
        commandKind: handoff.commandTemplate.command,
        commandTemplate: handoff.commandTemplate.template,
        nextCall: handoff.nextCall,
        handoffInputs: handoff.handoffInputs || {},
        warnings,
        placeholders,
        reviewFiles: {
          validationJson: validationPath,
          handoffJson: handoffPath,
          handoffMarkdown: handoffMarkdownPath,
          handoffHtml: handoffHtmlPath
        },
        teacherAction:
          queueItemStatus === "ready_for_manual_handoff_review"
            ? "Review the handoff HTML or Markdown, copy the nextCall or command template, then continue manually in the selected TLCL lane."
            : "Review warnings and placeholders in the handoff HTML or Markdown before manually continuing in the selected TLCL lane.",
        executesNow: false,
        blockedActions: [
          "execute_handoff_queue_item",
          "auto_run_next_call",
          "invoke_model_from_handoff_queue",
          "fetch_rag_from_handoff_queue",
          "write_memory_from_handoff_queue",
          "enable_rule_from_handoff_queue",
          "unlock_packaging_from_handoff_queue",
          "claim_completion_from_handoff_queue"
        ]
      }
    ],
    blockedActions: [
      "execute_handoff_queue",
      "auto_run_next_call_from_queue",
      "invoke_model_from_queue",
      "fetch_rag_from_queue",
      "write_memory_from_queue",
      "enable_rule_from_queue",
      "unlock_packaging_from_queue",
      "claim_completion_from_queue"
    ],
    locks,
    paths: {
      queue: handoffQueuePath,
      html: handoffQueueHtmlPath,
      readme: handoffQueueReadmePath,
      validationJson: validationPath,
      handoffJson: handoffPath,
      handoffMarkdown: handoffMarkdownPath,
      handoffHtml: handoffHtmlPath
    }
  };
  writeFileSync(
    handoffMarkdownPath,
    [
      "# TLCL Apprentice Session Manual Handoff",
      "",
      `- Status: ${status}`,
      `- Selected route: ${decision}`,
      `- Command kind: ${handoff.commandTemplate.command}`,
      `- Validation JSON: ${validationPath}`,
      `- Handoff JSON: ${handoffPath}`,
      "",
      "## Manual Handoff Command Template",
      "",
      "This is a human/agent handoff template only. It does not execute target software, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
      "",
      "```text",
      handoff.commandTemplate.template,
      "```",
      "",
      "## Next Call",
      "",
      "```json",
      nextCallJson,
      "```",
      "",
      "## Route Inputs",
      "",
      "```json",
      routeInputsJson,
      "```",
      "",
      "## Review Locks",
      "",
      "```json",
      locksJson,
      "```",
      "",
      "## Warnings",
      "",
      warningsText
    ].join("\n") + "\n",
    "utf8"
  );
  writeFileSync(
    handoffHtmlPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Manual Handoff</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f6f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 16px; margin: 18px 0 8px; }
    .panel { background: #fff; border: 1px solid #d7dee9; border-radius: 8px; padding: 16px; margin-top: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-top: 10px; }
    .meta div { border: 1px solid #e4e9f1; border-radius: 6px; padding: 8px; background: #fbfcfe; font-size: 13px; }
    textarea { width: 100%; min-height: 110px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 13px Consolas, monospace; }
    textarea.tall { min-height: 190px; }
    button, a.button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; margin: 6px 6px 0 0; }
    button.secondary, a.secondary { background: #fff; color: #174d89; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Apprentice Session Manual Handoff</h1>
    <p>This page is for copyable handoff only. It does not execute target software, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Route</h2>
      <div class="meta">
        <div>Status: <code>${htmlEscape(status)}</code></div>
        <div>Selected route: <code>${htmlEscape(decision)}</code></div>
        <div>Command kind: <code>${htmlEscape(handoff.commandTemplate.command)}</code></div>
      </div>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(handoffMarkdownPath).href)}">Open markdown handoff</a>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(handoffPath).href)}">Open handoff JSON</a>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(validationPath).href)}">Open validation JSON</a>
    </section>
    <section class="panel">
      <h2>Manual Handoff Command Template</h2>
      <textarea id="commandTemplate" spellcheck="false">${htmlEscape(handoff.commandTemplate.template)}</textarea>
      <button data-copy="commandTemplate">Copy command template</button>
    </section>
    <section class="panel">
      <h2>Next Call JSON</h2>
      <textarea id="nextCallJson" class="tall" spellcheck="false">${htmlEscape(nextCallJson)}</textarea>
      <button data-copy="nextCallJson">Copy next call</button>
    </section>
    <section class="panel">
      <h2>Route Inputs</h2>
      <textarea id="routeInputs" spellcheck="false">${htmlEscape(routeInputsJson)}</textarea>
      <button data-copy="routeInputs">Copy route inputs</button>
    </section>
    <section class="panel">
      <h2>Review Locks</h2>
      <textarea id="locksJson" class="tall" spellcheck="false">${htmlEscape(locksJson)}</textarea>
      <button data-copy="locksJson">Copy locks</button>
    </section>
    <section class="panel">
      <h2>Warnings</h2>
      <textarea id="warningsText" spellcheck="false">${htmlEscape(warningsText)}</textarea>
      <button data-copy="warningsText">Copy warnings</button>
    </section>
  </main>
  <script>
    for (const button of document.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.getAttribute("data-copy"));
        await navigator.clipboard.writeText(target.value);
      });
    }
  </script>
</body>
</html>
`,
    "utf8"
  );
  writeFileSync(handoffQueuePath, `${JSON.stringify(handoffQueue, null, 2)}\n`, "utf8");
  writeFileSync(
    handoffQueueReadmePath,
    [
      "# TLCL Apprentice Session Handoff Queue",
      "",
      `- Status: ${handoffQueue.status}`,
      `- Decision: ${handoffQueue.queueDecision}`,
      `- Selected route: ${decision}`,
      `- Queue items: ${handoffQueue.counts.queueItems}`,
      `- Handoff HTML: ${handoffHtmlPath}`,
      `- Handoff Markdown: ${handoffMarkdownPath}`,
      "",
      "This is a manual review queue only. It does not execute the next call, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
      "",
      "Next teacher action:",
      `- ${handoffQueue.queueItems[0].teacherAction}`
    ].join("\n") + "\n",
    "utf8"
  );
  writeFileSync(
    handoffQueueHtmlPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Handoff Queue</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f6f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1100px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d7dee9; border-radius: 8px; padding: 16px; margin-top: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e7f0ff; color: #174d89; font-size: 12px; margin-right: 6px; }
    textarea { width: 100%; min-height: 150px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 13px Consolas, monospace; }
    button, a.button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; margin: 6px 6px 0 0; }
    button.secondary, a.secondary { background: #fff; color: #174d89; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Apprentice Session Handoff Queue</h1>
    <p>This page lists the next manual review item only. It does not execute the next call, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section class="panel">
      <span class="badge">${htmlEscape(handoffQueue.status)}</span>
      <span class="badge">${htmlEscape(handoffQueue.queueDecision)}</span>
      <span class="badge">items=${handoffQueue.counts.queueItems}</span>
      <p>Selected route: <code>${htmlEscape(decision)}</code></p>
      <p>${htmlEscape(handoffQueue.queueItems[0].teacherAction)}</p>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(handoffHtmlPath).href)}">Open handoff page</a>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(handoffMarkdownPath).href)}">Open handoff markdown</a>
      <a class="button secondary" href="${htmlEscape(pathToFileURL(handoffPath).href)}">Open handoff JSON</a>
    </section>
    <section class="panel">
      <h2>Queue Item JSON</h2>
      <textarea id="queueItemJson" spellcheck="false">${htmlEscape(JSON.stringify(handoffQueue.queueItems[0], null, 2))}</textarea>
      <button data-copy="queueItemJson">Copy queue item</button>
    </section>
    <section class="panel">
      <h2>Blocked Actions</h2>
      <textarea id="blockedActions" spellcheck="false">${htmlEscape(handoffQueue.blockedActions.join("\n"))}</textarea>
      <button data-copy="blockedActions">Copy blocked actions</button>
    </section>
  </main>
  <script>
    for (const button of document.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.getAttribute("data-copy"));
        await navigator.clipboard.writeText(target.value);
      });
    }
  </script>
</body>
</html>
`,
    "utf8"
  );
}
writeFileSync(
  readmePath,
  [
    "# TLCL Apprentice Session Launcher Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Selected route: ${decision}`,
    `- Validation: ${validationPath}`,
    handoff ? `- Handoff command: ${handoffPath}` : "- Handoff command: not created",
    handoff ? `- Manual handoff markdown: ${handoffMarkdownPath}` : "- Manual handoff markdown: not created",
    handoff ? `- Manual handoff HTML: ${handoffHtmlPath}` : "- Manual handoff HTML: not created",
    handoff ? `- Manual handoff queue: ${handoffQueuePath}` : "- Manual handoff queue: not created",
    handoff ? `- Manual handoff queue HTML: ${handoffQueueHtmlPath}` : "- Manual handoff queue HTML: not created",
    "",
    "This validation is deterministic and review-only. It turns one allowed teacher route into a next-call template only.",
    "It does not execute target software, invoke models, fetch RAG sources, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_validation_result_v1",
      status,
      selectedRoute: decision,
      validationPath,
      handoffPath: handoff ? handoffPath : "",
      handoffMarkdownPath: handoff ? handoffMarkdownPath : "",
      handoffHtmlPath: handoff ? handoffHtmlPath : "",
      handoffQueuePath: handoff ? handoffQueuePath : "",
      handoffQueueHtmlPath: handoff ? handoffQueueHtmlPath : "",
      handoffQueueReadmePath: handoff ? handoffQueueReadmePath : "",
      readmePath,
      blockers,
      warnings,
      nextCall: handoff?.nextCall || null,
      locks
    },
    null,
    2
  )
);

if (status === "tlcl_apprentice_session_route_validation_blocked") process.exit(1);
