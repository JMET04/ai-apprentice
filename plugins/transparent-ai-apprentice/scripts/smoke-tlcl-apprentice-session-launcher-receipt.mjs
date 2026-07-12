#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const launcherScript = join(
  repoRoot,
  "plugins",
  "transparent-ai-apprentice",
  "scripts",
  "create-tlcl-apprentice-session-launcher.mjs"
);
const validatorScript = join(
  repoRoot,
  "plugins",
  "transparent-ai-apprentice",
  "scripts",
  "validate-tlcl-apprentice-session-launcher-receipt.mjs"
);
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-launcher-receipt-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const fixtureManual = join(outRoot, "fixture-manual.md");
const fixtureDrawing = join(outRoot, "fixture-drawing.svg");
const fixtureRollback = join(outRoot, "fixture-rollback-point.json");
const fixtureReviewValidation = join(outRoot, "fixture-retrieval-draft-review-validation.json");
writeFileSync(fixtureManual, "# Fixture Manual\n\nRAG evidence is review-only and cannot authorize execution.\n", "utf8");
writeFileSync(
  fixtureDrawing,
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#fff"/><text x="30" y="60">Fixture Drawing</text></svg>',
  "utf8"
);
writeFileSync(
  fixtureRollback,
  JSON.stringify(
    {
      format: "transparent_ai_rollback_point_result_v1",
      rollbackId: "receipt-smoke-rollback",
      status: "waiting_for_teacher_confirmation",
      deleteOnlyAfterTeacherConfirmation: true
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureReviewValidation,
  JSON.stringify(
    {
      format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
      status: "ready_for_rule_dsl_validation_package",
      reviewOnly: true
    },
    null,
    2
  ),
  "utf8"
);

function runJson(script, args) {
  return JSON.parse(
    execFileSync(process.execPath, [script, ...args], {
      cwd: repoRoot,
      encoding: "utf8"
    })
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const launcher = runJson(launcherScript, [
  "--output-dir",
  join(outRoot, "launcher"),
  "--goal",
  "Teach a TLCL CAD apprentice to derive strict geometry from reviewed data logic.",
  "--software",
  "FixtureCAD",
  "--teacher-command",
  "Create the reinforced panel from reviewed dimensions, then ask before changing the slot.",
  "--teacher-style",
  "voice, drawing, correction-first",
  "--knowledge-source",
  fixtureManual,
  "--artifact",
  fixtureDrawing,
  "--rollback-point",
  fixtureRollback
]);
const packet = readJson(launcher.packetPath);

function validateRoute(decision, extra = {}) {
  const receipt = {
    format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_v1",
    launchId: packet.launchId,
    teacherSelectedDecision: decision,
    teacherNotes: `Smoke route: ${decision}`,
    confirmedRollbackPoint: fixtureRollback,
    ...extra
  };
  const receiptPath = join(outRoot, `${decision}.receipt.json`);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return runJson(validatorScript, [
    "--launcher",
    launcher.packetPath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(outRoot, "validations")
  ]);
}

const existingTool = validateRoute("start_with_existing_tool_demo");
const rag = validateRoute("start_with_rag_sources");
const ragRuleDsl = validateRoute("continue_with_rag_rule_dsl_review", {
  handoffInputs: {
    retrievalDraftReviewValidation: fixtureReviewValidation,
    teacherConfirmedSource: fixtureManual,
    sourceDrawing: fixtureDrawing,
    visualEvidence: fixtureDrawing
  }
});
const voice = validateRoute("start_with_voice_numbered_confirmation");
const lowToken = validateRoute("start_with_low_token_observation");
const forbidden = validateRoute("execute_now");
const waiting = validateRoute("needs_teacher_review");

const existingToolValidation = readJson(existingTool.validationPath);
const ragValidation = readJson(rag.validationPath);
const ragRuleDslValidation = readJson(ragRuleDsl.validationPath);
const ragRuleDslHandoffMarkdown = readFileSync(ragRuleDsl.handoffMarkdownPath, "utf8");
const ragRuleDslHandoffHtml = readFileSync(ragRuleDsl.handoffHtmlPath, "utf8");
const ragRuleDslHandoffQueue = readJson(ragRuleDsl.handoffQueuePath);
const ragRuleDslHandoffQueueHtml = readFileSync(ragRuleDsl.handoffQueueHtmlPath, "utf8");
const ragRuleDslHandoffQueueReadme = readFileSync(ragRuleDsl.handoffQueueReadmePath, "utf8");
const voiceValidation = readJson(voice.validationPath);
const lowTokenValidation = readJson(lowToken.validationPath);
const forbiddenValidation = readJson(forbidden.validationPath);
const waitingValidation = readJson(waiting.validationPath);

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "Existing-tool route becomes a manual continue_teaching handoff",
  existingTool.status === "tlcl_apprentice_session_route_ready_for_manual_handoff" &&
    existingTool.nextCall?.tool === "continue_teaching" &&
    existingToolValidation.handoff?.executesNow === false &&
    existsSync(existingTool.handoffPath),
  { status: existingTool.status, nextCall: existingTool.nextCall?.tool }
);
check(
  "RAG route stays evidence-only without fetch",
  rag.status === "tlcl_apprentice_session_route_ready_for_manual_handoff" &&
    rag.nextCall?.tool === "knowledge/create-rag-research-intake-queue.mjs" &&
    ragValidation.reviewBoundary?.ragIsEvidenceOnly === true &&
    ragValidation.locks?.ragEvidenceTreatedAsAuthority === false,
  { status: rag.status, nextCall: rag.nextCall?.tool }
);
check(
  "Reviewed RAG Rule DSL route becomes a manual disabled-rule validation handoff",
  ragRuleDsl.status === "tlcl_apprentice_session_route_ready_for_manual_handoff" &&
    ragRuleDsl.nextCall?.tool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    ragRuleDsl.nextCall?.arguments?.reviewValidation === fixtureReviewValidation &&
    ragRuleDslValidation.handoff?.executesNow === false &&
    ragRuleDslValidation.handoff?.commandTemplate?.template.includes(fixtureReviewValidation) &&
    !ragRuleDslValidation.handoff?.commandTemplate?.template.includes("<retrieval-draft-review-validation.json>") &&
    ragRuleDslValidation.handoff?.handoffInputs?.retrievalDraftReviewValidation === fixtureReviewValidation &&
    ragRuleDslValidation.locks?.ruleEnabled === false,
  { status: ragRuleDsl.status, nextCall: ragRuleDsl.nextCall?.tool, reviewValidation: ragRuleDsl.nextCall?.arguments?.reviewValidation }
);
check(
  "Receipt validation writes a readable manual handoff markdown",
  existsSync(ragRuleDsl.handoffMarkdownPath) &&
    ragRuleDslHandoffMarkdown.includes("Manual Handoff Command Template") &&
    ragRuleDslHandoffMarkdown.includes(fixtureReviewValidation) &&
    ragRuleDslHandoffMarkdown.includes("This is a human/agent handoff template only") &&
    ragRuleDslHandoffMarkdown.includes("does not execute target software") &&
    ragRuleDslHandoffMarkdown.includes("unlock packaging") &&
    ragRuleDslHandoffMarkdown.includes('"reviewValidation"'),
  { handoffMarkdownPath: ragRuleDsl.handoffMarkdownPath }
);
check(
  "Receipt validation writes a copyable manual handoff HTML page",
  existsSync(ragRuleDsl.handoffHtmlPath) &&
    ragRuleDslHandoffHtml.includes("TLCL Apprentice Session Manual Handoff") &&
    ragRuleDslHandoffHtml.includes("Copy command template") &&
    ragRuleDslHandoffHtml.includes("Copy next call") &&
    ragRuleDslHandoffHtml.includes(fixtureReviewValidation) &&
    ragRuleDslHandoffHtml.includes("does not execute target software") &&
    ragRuleDslHandoffHtml.includes("Open markdown handoff") &&
    ragRuleDslHandoffHtml.includes("data-copy"),
  { handoffHtmlPath: ragRuleDsl.handoffHtmlPath }
);
check(
  "Receipt validation writes a single-item manual handoff queue",
  existsSync(ragRuleDsl.handoffQueuePath) &&
    existsSync(ragRuleDsl.handoffQueueHtmlPath) &&
    existsSync(ragRuleDsl.handoffQueueReadmePath) &&
    ragRuleDslHandoffQueue.format === "transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1" &&
    ragRuleDslHandoffQueue.counts?.queueItems === 1 &&
    ragRuleDslHandoffQueue.queueItems?.[0]?.selectedRoute === "continue_with_rag_rule_dsl_review" &&
    ragRuleDslHandoffQueue.queueItems?.[0]?.commandTemplate.includes(fixtureReviewValidation) &&
    ragRuleDslHandoffQueue.queueItems?.[0]?.executesNow === false &&
    ragRuleDslHandoffQueue.blockedActions.includes("auto_run_next_call_from_queue") &&
    ragRuleDslHandoffQueue.locks?.targetSoftwareCommandsExecuted === false &&
    ragRuleDslHandoffQueueHtml.includes("TLCL Apprentice Session Handoff Queue") &&
    ragRuleDslHandoffQueueHtml.includes("Copy queue item") &&
    ragRuleDslHandoffQueueReadme.includes("manual review queue only"),
  {
    handoffQueuePath: ragRuleDsl.handoffQueuePath,
    handoffQueueHtmlPath: ragRuleDsl.handoffQueueHtmlPath,
    handoffQueueReadmePath: ragRuleDsl.handoffQueueReadmePath
  }
);
check(
  "Voice route requires numbered target confirmation",
  voice.status === "tlcl_apprentice_session_route_ready_for_manual_handoff" &&
    voice.nextCall?.tool === "create_engineering_voice_control_session" &&
    voiceValidation.locks?.numberedTargetConfirmationRequired === true,
  { status: voice.status, nextCall: voice.nextCall?.tool }
);
check(
  "Low-token route is synthesized without screenshots",
  lowToken.status === "tlcl_apprentice_session_route_ready_for_manual_handoff" &&
    lowToken.nextCall?.tool === "create_all_software_observer_bootstrap" &&
    lowTokenValidation.locks?.screenshotsCaptured === false &&
    lowTokenValidation.locks?.fullLogRead === false,
  { status: lowToken.status, nextCall: lowToken.nextCall?.tool }
);
check(
  "Forbidden execute decision is blocked",
  forbidden.status === "blocked_for_forbidden_decision" &&
    forbiddenValidation.blockers.includes("blocked_for_forbidden_decision") &&
    forbiddenValidation.handoff === null,
  { status: forbidden.status, blockers: forbiddenValidation.blockers }
);
check(
  "Default needs_teacher_review waits without handoff",
  waiting.status === "tlcl_apprentice_session_route_waiting_for_teacher_choice" &&
    waitingValidation.blockers.includes("WAITING_FOR_TEACHER_ROUTE_CHOICE") &&
    waitingValidation.handoff === null,
  { status: waiting.status, blockers: waitingValidation.blockers }
);
check(
  "All receipt validations keep execution, model, memory, and packaging locks",
  [existingTool, rag, ragRuleDsl, voice, lowToken, forbidden, waiting].every(
    (item) =>
      item.locks?.modelInvoked === false &&
      item.locks?.targetSoftwareCommandsExecuted === false &&
      item.locks?.memoryWritten === false &&
      item.locks?.packagingGated === true
  ),
  { statuses: [existingTool, rag, ragRuleDsl, voice, lowToken, forbidden, waiting].map((item) => item.status) }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  launcher,
  routes: {
    existingTool,
    rag,
    ragRuleDsl,
    voice,
    lowToken,
    forbidden,
    waiting
  }
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
