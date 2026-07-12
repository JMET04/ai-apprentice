#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "triggered-visual-handoff-review")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "triggered-visual-handoff-review";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function compactResult(value) {
  if (!value || typeof value !== "object") return value;
  const keep = [
    "ok",
    "format",
    "route",
    "goal",
    "sessionPath",
    "primaryResult",
    "review",
    "teacherFacingSummary",
    "nextTeacherAction",
    "locks",
    "status",
    "evidenceCount",
    "missingFiles",
    "ruleEnabled",
    "requiresTeacherConfirmation"
  ];
  return Object.fromEntries(Object.entries(value).filter(([key]) => keep.includes(key)));
}

function runScript(scriptName, args) {
  const packagedScript = join(__dirname, scriptName);
  const sourceTreeScript = join(process.cwd(), "plugins", "transparent-ai-apprentice", "scripts", scriptName);
  const scriptPath = existsSync(packagedScript) ? packagedScript : sourceTreeScript;
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

function commandLine(scriptName, args) {
  const quoted = args.map((arg) => (String(arg).includes(" ") ? `"${String(arg).replace(/"/g, '\\"')}"` : String(arg)));
  return `node plugins/transparent-ai-apprentice/scripts/${scriptName} ${quoted.join(" ")}`.trim();
}

const handoffInput = readJsonInput(argValue("--handoff", argValue("--learning-handoff", "")), "--handoff");
const handoff = handoffInput.value;
if (handoff.format !== "transparent_ai_triggered_visual_evidence_learning_handoff_v1") {
  throw new Error("--handoff must be transparent_ai_triggered_visual_evidence_learning_handoff_v1");
}

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-learning-handoff-reviews"))
);
const goal = argValue("--goal", handoff.teachApprenticeCall?.arguments?.goal || handoff.goal || "Review triggered visual evidence learning.");
const tool = argValue(
  "--tool",
  handoff.teachApprenticeCall?.arguments?.tool || "low-token triggered visual evidence handoff"
);
const teacherAction = argValue(
  "--teacher-action",
  "Teacher supplied a low-token trigger request, a teacher-confirmed one-shot capture receipt, and one bounded visual evidence file."
);
const taughtBehavior = argValue(
  "--taught-behavior",
  "Use the low-token changed evidence first, use the screenshot only together with its trigger request and capture receipt, and wait for teacher review before memory, rules, or execution."
);
const futureInput = argValue(
  "--future-input",
  handoff.teachApprenticeCall?.arguments?.futureInput || "A future software run has a similar low-token change and visual state."
);
const sessionPath = argValue("--session", "");
const evidenceFiles = (handoff.teachApprenticeCall?.arguments?.files || handoff.evidenceFiles || [])
  .map((file) => resolve(file))
  .filter(Boolean);
const missingEvidence = evidenceFiles.filter((file) => !existsSync(file));
const handoffReady =
  handoff.status === "waiting_for_teacher_learning_review" &&
  evidenceFiles.length >= 3 &&
  missingEvidence.length === 0 &&
  handoff.locks?.handoffDoesNotCaptureScreenshots === true &&
  handoff.locks?.handoffDoesNotExecuteSoftware === true &&
  handoff.locks?.handoffDoesNotWriteMemory === true &&
  handoff.locks?.teacherReviewRequiredBeforeMemory === true;

mkdirSync(outputRoot, { recursive: true });
const reviewId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const reviewDir = join(outputRoot, reviewId);
mkdirSync(reviewDir, { recursive: true });

let teachingResult = null;
let learningCard = null;
let status = "blocked_handoff_not_ready_for_review_card";
if (handoffReady) {
  const continueArgs = [
    ...(sessionPath ? ["--session", resolve(sessionPath)] : ["--name", "triggered-visual-evidence-apprentice"]),
    "--goal",
    goal,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    "--future-input",
    futureInput
  ];
  for (const file of evidenceFiles) continueArgs.push("--file", file);
  teachingResult = runScript("continue-teaching.mjs", continueArgs);
  const reviewedSessionPath = teachingResult.sessionPath || sessionPath;
  if (!reviewedSessionPath) throw new Error("continue-teaching.mjs did not return a teaching session path.");
  learningCard = runScript("show-teaching-card.mjs", ["--session", reviewedSessionPath]);
  status = "waiting_for_teacher_review";
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  handoffReviewDoesNotCaptureScreenshots: true,
  handoffReviewDoesNotExecuteSoftware: true,
  handoffReviewDoesNotReadFullLogs: true,
  handoffReviewDoesNotWriteMemory: true,
  handoffReviewDoesNotEnableRules: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  memoryWritten: false,
  teacherReviewRequiredBeforeMemory: true
};

const teachingResultPath = join(reviewDir, "continue-teaching-result.json");
const learningCardPath = join(reviewDir, "teacher-learning-card.json");
const reviewPath = join(reviewDir, "triggered-visual-evidence-learning-handoff-review.json");
const receiptTemplatePath = join(reviewDir, "teacher-triggered-visual-learning-review-receipt-template.json");
const readmePath = join(reviewDir, "TRIGGERED_VISUAL_HANDOFF_REVIEW_START_HERE.md");
if (teachingResult) writeFileSync(teachingResultPath, `${JSON.stringify(teachingResult, null, 2)}\n`, "utf8");
if (learningCard) writeFileSync(learningCardPath, `${JSON.stringify(learningCard, null, 2)}\n`, "utf8");

const receiptValidationCommand = commandLine("validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs", [
  "--review",
  reviewPath,
  "--receipt",
  "<teacher-filled-triggered-visual-learning-review-receipt.json>",
  "--output-dir",
  join(reviewDir, "receipt-validation")
]);

const receiptTemplate = {
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_v1",
  reviewId,
  reviewPath,
  handoffPath: handoffInput.path,
  learningCardPath: learningCard ? learningCardPath : "",
  defaultDecision: "needs_teacher_review",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "correct_learning_card", "ready_for_follow_up"],
  blockedDecisions: ["accepted", "enable_rule", "write_memory", "execute_software", "unlock_packaging"],
  reviewedEvidenceFiles: evidenceFiles,
  teacherConfirmations: {
    lowTokenTriggerReviewed: false,
    captureReceiptReviewed: false,
    exactlyOneVisualEvidenceFile: false,
    visualEvidenceUsedOnlyWithTriggerReceipt: false,
    noContinuousRecording: true,
    noSoftwareExecution: true,
    noMemoryWrite: true,
    ruleRemainsDisabled: true,
    packagingRemainsLocked: true
  },
  teacherCorrectionOrNarrowing: "",
  teacherNote: "",
  mustKeep: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    screenshotsCapturedByReview: false,
    softwareActionsExecuted: false,
    memoryWritten: false
  }
};
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");

const review = {
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1",
  reviewId,
  createdAt: new Date().toISOString(),
  status,
  handoffPath: handoffInput.path,
  goal,
  evidenceFiles,
  missingEvidence,
  usedExistingTeachingEngine: true,
  invokedScripts: handoffReady ? ["continue-teaching.mjs", "show-teaching-card.mjs"] : [],
  teachingSessionPath: teachingResult?.sessionPath || "",
  teachingResultPath: teachingResult ? teachingResultPath : "",
  learningCardPath: learningCard ? learningCardPath : "",
  learningCardFormat: learningCard?.format || "",
  learningCardStatus: learningCard?.status || "",
  teacherReceiptTemplatePath: receiptTemplatePath,
  teacherReceiptValidationCommand: receiptValidationCommand,
  nextTeacherAction:
    status === "waiting_for_teacher_review"
      ? "Review the generated learning card, fill the triggered visual learning review receipt, and correct the inferred rule if it is too broad or too narrow. Memory remains blocked until a later explicit approval path."
      : "Repair the handoff status, missing evidence, or closed-lock assertions before creating a learning card.",
  nextAllowedActions:
    status === "waiting_for_teacher_review"
      ? [
          "review_teacher_learning_card",
          "teacher_corrects_or_approves_replay",
          "write_memory_only_after_explicit_teacher_approval"
        ]
      : ["repair_handoff_before_learning_card"],
  blockedActions: [
    "learn_from_visual_evidence_without_trigger_receipt",
    "continuous_recording",
    "bulk_screenshot_collection",
    "execute_software_actions",
    "write_memory_without_explicit_teacher_approval",
    "enable_rules_without_teacher_approval",
    "unlock_packaging"
  ],
  reusableCommands: {
    showLearningCard: learningCard ? commandLine("show-teaching-card.mjs", ["--session", teachingResult.sessionPath]) : "",
    continueTeachingCorrection: learningCard
      ? commandLine("continue-teaching.mjs", ["--session", teachingResult.sessionPath, "--reply", "<teacher correction or explicit approval>"])
      : ""
  },
  teachingResult: compactResult(teachingResult),
  learningCardSummary: learningCard
    ? {
        format: learningCard.format,
        status: learningCard.status,
        task: compact(learningCard.task),
        teacherFacingSummary: compact(learningCard.teacherFacingSummary),
        evidenceCount: Array.isArray(learningCard.evidence) ? learningCard.evidence.length : 0,
        latestReplayOutcome: learningCard.latestReplay?.outcome || "",
        ruleEnabled: learningCard.latestReplay?.ruleEnabled === true
      }
    : null,
  locks
};

writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Triggered Visual Handoff Review",
    "",
    `Status: ${status}`,
    `Evidence files: ${evidenceFiles.length}`,
    `Missing evidence: ${missingEvidence.length ? missingEvidence.join(", ") : "none"}`,
    "",
    "This runner reuses the existing teaching engine. It turns a triggered visual evidence handoff into a teacher-facing learning card, without learning from an isolated screenshot.",
    "",
    learningCard ? `Learning card: ${learningCardPath}` : "Learning card: not created",
    teachingResult ? `Teaching session: ${teachingResult.sessionPath}` : "Teaching session: not created",
    `Review packet: ${reviewPath}`,
    `Teacher receipt template: ${receiptTemplatePath}`,
    `Receipt validation command: ${receiptValidationCommand}`,
    "",
    "Locked defaults: no screenshots, no full-log reads, no software execution, no memory write, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1",
  reviewId,
  reviewPath,
  teacherReadme: readmePath,
  status,
  teachingSessionPath: review.teachingSessionPath,
  learningCardPath: review.learningCardPath,
  teacherReceiptTemplatePath: receiptTemplatePath,
  teacherReceiptValidationCommand: receiptValidationCommand,
  evidenceFiles,
  missingEvidence,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  ruleEnabled: false,
  packagingGated: true
}, null, 2));
