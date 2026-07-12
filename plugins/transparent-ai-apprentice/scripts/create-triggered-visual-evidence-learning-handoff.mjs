#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "triggered-visual-learning-handoff")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "triggered-visual-learning-handoff";
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function quoteArg(value) {
  const text = String(value ?? "");
  return text.includes(" ") ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function optionalExistingPath(path) {
  if (!path) return "";
  const resolved = resolve(path);
  return existsSync(resolved) ? resolved : "";
}

const captureInput = readJsonInput(argValue("--capture-receipt", argValue("--receipt", "")), "--capture-receipt");
const capture = captureInput.value;
if (capture.format !== "transparent_ai_triggered_visual_check_capture_receipt_v1") {
  throw new Error("--capture-receipt must be transparent_ai_triggered_visual_check_capture_receipt_v1");
}

const requestInput = readJsonInput(
  argValue("--request", argValue("--visual-check-queue", capture.requestPath || "")),
  "--request",
  true
);
const screenshotPath = optionalExistingPath(argValue("--screenshot", capture.screenshotPath || ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-learning-handoffs")));
const goal = argValue(
  "--goal",
  `Teach from low-token changed evidence plus one teacher-confirmed visual check for ${capture.software || "the selected software"}.`
);
const teacherNote = argValue("--teacher-note", capture.teacherNote || "");
const futureInput = argValue("--future-input", "A future software run has a similar low-token change and visual state.");

mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(capture.software || capture.captureId)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const captureReady =
  capture.status === "captured_one_bounded_visual_evidence" &&
  capture.screenshotCount === 1 &&
  Boolean(screenshotPath) &&
  capture.locks?.fullContinuousRecording === false &&
  capture.locks?.softwareActionsExecuted === false &&
  capture.locks?.nativeUniversalExecution === false;

const requestPath = requestInput.path || optionalExistingPath(capture.requestPath || "");
const evidenceFiles = [requestPath, captureInput.path, screenshotPath].filter(Boolean);
const missingEvidence = [
  requestPath ? "" : "source_request_or_queue_path",
  captureInput.path ? "" : "capture_receipt_path",
  screenshotPath ? "" : "single_visual_evidence_path"
].filter(Boolean);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  handoffDoesNotCaptureScreenshots: true,
  handoffDoesNotExecuteSoftware: true,
  handoffDoesNotReadFullLogs: true,
  handoffDoesNotWriteMemory: true,
  handoffDoesNotEnableRules: true,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  memoryWritten: false,
  teacherReviewRequiredBeforeMemory: true
};

const handoffPath = join(handoffDir, "triggered-visual-evidence-learning-handoff.json");
const readmePath = join(handoffDir, "TRIGGERED_VISUAL_LEARNING_HANDOFF_START_HERE.md");
const nextLearningCardReviewCommand = [
  "node",
  "plugins/transparent-ai-apprentice/scripts/run-triggered-visual-evidence-learning-handoff-review.mjs",
  "--handoff",
  quoteArg(handoffPath),
  "--output-dir",
  quoteArg(join(outputRoot, `${handoffId}-review-card`))
].join(" ");

const handoff = {
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  status: captureReady ? "waiting_for_teacher_learning_review" : "blocked_capture_not_ready_for_learning_handoff",
  lowTokenPolicy:
    "Use the changed log/state evidence first, then exactly one teacher-confirmed visual evidence file; do not stream recording or learn from a screenshot without its trigger receipt.",
  sourceEvidence: {
    sourceRequestPath: requestPath,
    sourceRequestFormat: requestInput.value?.format || capture.sourceRequestFormat || "",
    sourceRequestKind: capture.sourceRequestKind || "",
    captureReceiptPath: captureInput.path,
    captureReceiptStatus: capture.status,
    selectedRequestId: capture.selectedRequestId || "",
    screenshotPath,
    screenshotSha256: capture.screenshotSha256 || "",
    software: capture.software || "",
    processName: capture.processName || "",
    triggerReason: capture.triggerReason || "",
    triggerEvidence: capture.triggerEvidence || null
  },
  evidenceFiles,
  missingEvidence,
  teachApprenticeCall:
    captureReady
      ? {
          tool: "teach_apprentice",
          arguments: {
            goal,
            tool: "low-token triggered visual evidence handoff",
            files: evidenceFiles,
            teacherMessage:
              teacherNote ||
              "The low-token signal changed first, then the teacher approved exactly one bounded visual check. Use all files together as review-only teaching evidence.",
            futureInput
          }
        }
      : null,
  nextLearningCardReviewCommand: captureReady ? nextLearningCardReviewCommand : "",
  nextAllowedActions: captureReady
    ? [
        "review_handoff_packet",
        "run_learning_handoff_review_card",
        "ask_teacher_to_correct_or_approve_the_learning_card",
        "only_write_memory_after_explicit_teacher_approval"
      ]
    : ["repair_missing_capture_or_request_evidence_before_learning"],
  blockedActions: [
    "learn_from_visual_evidence_without_trigger_receipt",
    "continuous_recording",
    "bulk_screenshot_collection",
    "execute_software_actions",
    "write_memory_without_explicit_teacher_approval",
    "enable_rules_without_teacher_approval",
    "unlock_packaging"
  ],
  locks
};

writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Triggered Visual Evidence Learning Handoff",
    "",
    `Status: ${handoff.status}`,
    `Evidence files: ${evidenceFiles.length}`,
    `Missing evidence: ${missingEvidence.length ? missingEvidence.join(", ") : "none"}`,
    "",
    "Use this packet after a low-token trigger and one teacher-confirmed visual check. The handoff keeps all evidence together so the apprentice does not learn from an isolated screenshot.",
    "",
    captureReady
      ? "Next: run `run-triggered-visual-evidence-learning-handoff-review.mjs` with this handoff to create a teacher-facing learning card, then wait for teacher correction or approval."
      : "Next: repair the missing or not-ready capture evidence before teaching.",
    "",
    `Handoff: ${handoffPath}`,
    `Capture receipt: ${captureInput.path || "inline receipt"}`,
    requestPath ? `Request or queue: ${requestPath}` : "Request or queue: missing",
    screenshotPath ? `Single visual evidence: ${screenshotPath}` : "Single visual evidence: missing",
    captureReady ? `Learning card review command: ${nextLearningCardReviewCommand}` : "Learning card review command: blocked until capture is ready",
    "",
    "Locked defaults: no new screenshots, no software execution, no full-log reading, no memory write, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_result_v1",
  handoffId,
  handoffPath,
  teacherReadme: readmePath,
  status: handoff.status,
  evidenceFiles,
  missingEvidence,
  teachApprenticeCallReady: Boolean(handoff.teachApprenticeCall),
  learningCardReviewCommandReady: Boolean(handoff.nextLearningCardReviewCommand),
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  ruleEnabled: false,
  packagingGated: true
}, null, 2));
