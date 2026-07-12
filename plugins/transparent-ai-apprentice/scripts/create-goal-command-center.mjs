#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "goal-command-center")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "goal-command-center";
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
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

function packageUrl(targetPath) {
  if (!targetPath) return "";
  const resolvedTarget = resolve(targetPath);
  const relativePath = relative(centerDir, resolvedTarget);
  if (relativePath.startsWith("..") || resolve(centerDir, relativePath) !== resolvedTarget) return "";
  return relativePath.split(/[\\/]+/).map(encodeURIComponent).join("/");
}

function latestDirectory(rootPath) {
  const resolvedRoot = resolve(rootPath);
  if (!existsSync(resolvedRoot)) return "";
  const dirs = readdirSync(resolvedRoot)
    .map((entry) => join(resolvedRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return dirs[0] || "";
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate)) || "";
}

function resolveMaybe(path) {
  return path ? resolve(path) : "";
}

function jsonEvidencePath(path) {
  return path && /\.json$/i.test(path) ? path : "";
}

function copyIntoEvidenceDir(sourcePath, evidenceId) {
  if (!sourcePath || !existsSync(sourcePath)) return "";
  const destDir = join(centerDir, "current-evidence", evidenceId);
  mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, basename(sourcePath));
  copyFileSync(sourcePath, destPath);
  return destPath;
}

const defaultGoal =
  "Make all software on this computer learn from low-token logs or fallback signals, adapt to each teacher, understand transparent 2D perspective 3D sketch intent, and execute only through teacher-confirmed supervised gates.";
const goal = argValue("--goal", argValue("--task", defaultGoal));
const software = argValue("--software", argValue("--app", "selected target software"));
const command = argValue("--command", argValue("--text-command", "Use voice or text to describe the engineering action, then confirm one numbered target."));
const voiceTranscript = argValue("--voice-transcript", "");
const teacherStyle = argValue("--teacher-style", argValue("--style", "voice, typed command, transparent sketch, low-token logs, correction-first"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const operationalStatusConsoleArg = argValue("--operational-status-console", argValue("--status-console", ""));
const originalGoalReadinessAuditArg = argValue("--original-goal-readiness-audit", argValue("--readiness-audit", ""));
const activationReviewPacketArg = argValue("--activation-review-packet", "");
const activationReceiptValidationArg = argValue("--activation-receipt-validation", "");
const coverageExpansionPlanArg = argValue("--coverage-expansion-plan", argValue("--coverage-plan", ""));
const coverageConvergenceArg = argValue("--coverage-convergence", argValue("--coverage-convergence-audit", ""));
const coverageEnrollmentFollowUpPlanArg = argValue(
  "--coverage-enrollment-follow-up-plan",
  argValue("--enrollment-follow-up-plan", "")
);
const coverageEnrollmentFollowUpBatchArg = argValue(
  "--coverage-enrollment-follow-up-batch",
  argValue("--enrollment-follow-up-batch", "")
);
const coverageEnrollmentLedgerArg = argValue("--coverage-enrollment-ledger", argValue("--enrollment-ledger", ""));
const coverageEnrollmentFollowUpReceiptBuilderArg = argValue(
  "--coverage-enrollment-follow-up-receipt-builder",
  argValue("--enrollment-follow-up-receipt-builder", "")
);
const coverageEnrollmentFollowUpReceiptTemplateArg = argValue(
  "--coverage-enrollment-follow-up-receipt-template",
  argValue("--enrollment-follow-up-receipt-template", "")
);
const coverageEnrollmentFollowUpReconciliationArg = argValue(
  "--coverage-enrollment-follow-up-reconciliation",
  argValue("--enrollment-follow-up-reconciliation", "")
);
const executionConvergenceArg = argValue("--execution-convergence", argValue("--execution-convergence-audit", ""));
const executionFollowUpBatchArg = argValue("--execution-follow-up-batch", argValue("--execution-capability-follow-up", ""));
const controlChannelRepairQueueArg = argValue("--control-channel-repair-queue", argValue("--control-repair-queue", ""));
const visualEvidenceArg = argValue("--visual-evidence", argValue("--image", argValue("--screenshot", "")));
const visualCaptureReceiptArg = argValue(
  "--capture-receipt",
  argValue("--visual-capture-receipt", argValue("--triggered-visual-capture-receipt", ""))
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "goal-command-centers")));
const locale = argValue("--locale", "zh-CN");
const maxProcesses = argValue("--max-processes", "40");
const maxInstalled = argValue("--max-installed", "80");
const maxCandidates = argValue("--max-candidates", "12");
const runReadOnlyProbe = hasFlag("--run-read-only-probe");
const noPortScan = hasFlag("--no-port-scan");
const createAdapterSelection = hasFlag("--create-adapter-selection");
const candidates = argValues("--candidate");

mkdirSync(outputRoot, { recursive: true });
const centerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const centerDir = join(outputRoot, centerId);
mkdirSync(centerDir, { recursive: true });

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true,
  engineeringVoiceExecutionApprovalGateRequired: true,
  dryRunFirst: true,
  commandCenterDoesNotExecuteSoftware: true
};

const optimizedPrompt = [
  "Treat this as a supervised teach-execute session, not a generic chat.",
  "First adapt to the teacher's method, then observe software with metadata/log deltas before screenshots.",
  "If the teacher uses voice, text, or a sketch, mark possible targets with numbers and wait for one confirmed number.",
  "Only after confirmation should the system prepare a dry-run-first execution route, an execution approval gate with route evidence and rollback, and a low-token result verifier."
].join(" ");

const methodProfile = runNodeScript("create-teacher-learning-method-profile.mjs", [
  "--goal",
  goal,
  "--teacher-style",
  teacherStyle,
  "--software",
  software,
  "--output-dir",
  join(centerDir, "teacher-method-profile")
]);

const observerBootstrap = runNodeScript("create-all-software-observer-bootstrap.mjs", [
  "--goal",
  goal,
  "--output-dir",
  join(centerDir, "all-software-observer-bootstrap"),
  "--max-processes",
  maxProcesses,
  "--max-installed",
  maxInstalled,
  "--max-candidates",
  maxCandidates,
  "--no-initialize-watch"
]);

const overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "live_topmost_2d_perspective_3d",
  "--output-dir",
  join(centerDir, "transparent-sketch-overlay")
]);

const visualEvidenceCopy = copyIntoEvidenceDir(resolveMaybe(visualEvidenceArg), "voice-visual-evidence");
const visualCaptureReceiptCopy = copyIntoEvidenceDir(resolveMaybe(visualCaptureReceiptArg), "voice-visual-evidence");
const voiceInputDir = join(centerDir, "engineering-voice-control-workbench-inputs");
mkdirSync(voiceInputDir, { recursive: true });
const voiceGoalInputPath = join(voiceInputDir, "goal.txt");
const voiceCommandInputPath = join(voiceInputDir, "command.txt");
const voiceTranscriptInputPath = join(voiceInputDir, "voice-transcript.txt");
writeFileSync(voiceGoalInputPath, `${goal}\n`, "utf8");
writeFileSync(voiceCommandInputPath, `${command}\n`, "utf8");
if (voiceTranscript) writeFileSync(voiceTranscriptInputPath, `${voiceTranscript}\n`, "utf8");
const voiceArgs = [
  "--goal-file",
  voiceGoalInputPath,
  "--software",
  software,
  "--command-file",
  voiceCommandInputPath,
  "--locale",
  locale,
  "--output-dir",
  join(centerDir, "engineering-voice-control-workbench"),
  "--max-files",
  "40",
  "--max-depth",
  "1",
  "--max-registry-items",
  "0"
];
if (voiceTranscript) voiceArgs.push("--voice-transcript-file", voiceTranscriptInputPath);
if (processName) voiceArgs.push("--process-name", processName);
if (windowTitle) voiceArgs.push("--window-title", windowTitle);
if (installPath) voiceArgs.push("--install-path", installPath);
if (executable) voiceArgs.push("--executable", executable);
if (visualEvidenceCopy) voiceArgs.push("--visual-evidence", visualEvidenceCopy);
if (visualCaptureReceiptCopy) voiceArgs.push("--capture-receipt", visualCaptureReceiptCopy);
if (runReadOnlyProbe) voiceArgs.push("--run-read-only-probe");
if (noPortScan) voiceArgs.push("--no-port-scan");
if (createAdapterSelection) voiceArgs.push("--create-adapter-selection");
for (const candidate of candidates) voiceArgs.push("--candidate", candidate);
const voiceWorkbench = runNodeScript("create-engineering-voice-control-workbench.mjs", voiceArgs);
const voiceState = readJson(voiceWorkbench.workbenchPath);
const visualGroundedVoiceWorkbenchReady = Boolean(
  voiceState.generated?.visualTargetConfirmation ||
    voiceState.generated?.visualOverlayPacket ||
    voiceState.generated?.visualEvidencePath
);

const teachExecuteLoop = runNodeScript("create-teach-execute-learning-loop.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--teacher-style",
  teacherStyle,
  "--output-dir",
  join(centerDir, "teach-execute-loop")
]);

const receiptTemplate = {
  format: "transparent_ai_goal_command_center_receipt_template_v1",
  centerId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "ready_for_read_only_observation",
    "ready_for_numbered_target_confirmation",
    "ready_for_voice_execution_approval_gate",
    "ready_for_dry_run_rehearsal",
    "blocked"
  ],
  blockedDecisions: [
    "accepted",
    "enable_memory",
    "execute_unattended",
    "execute_without_engineering_voice_execution_approval_gate",
    "native_universal_execution",
    "unlock_packaging"
  ],
  selectedCandidateNumber: null,
  teacherCorrections: "",
  observedEvidence: "",
  locks
};

const centerPath = join(centerDir, "goal-command-center.json");
const htmlPath = join(centerDir, "goal-command-center.html");
const receiptTemplatePath = join(centerDir, "goal-command-center-receipt-template.json");
const readmePath = join(centerDir, "GOAL_COMMAND_CENTER_START_HERE.md");

const latestCurrentStatusDir = latestDirectory(join(process.cwd(), ".transparent-apprentice", "current-operational-status-console"));
const latestHistoricalStatusDir = latestDirectory(join(process.cwd(), ".transparent-apprentice", "all-software-operational-status-consoles"));
const latestStatusDir = firstExisting([latestCurrentStatusDir, latestHistoricalStatusDir]);
const latestReadinessDir = latestDirectory(join(process.cwd(), ".transparent-apprentice", "original-goal-readiness-audits"));
const latestActivationReviewPacketDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-packets")
);
const latestActivationReceiptValidationDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-receipt-validations")
);
const latestCoverageConvergenceDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-convergence-audits")
);
const latestCoverageExpansionPlanDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-expansion-plans")
);
const latestCoverageEnrollmentFollowUpPlanDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-plans")
);
const latestCoverageEnrollmentFollowUpBatchDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-batches")
);
const latestCoverageEnrollmentLedgerDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-ledgers")
);
const latestCoverageEnrollmentFollowUpReceiptBuilderDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-receipt-builders")
);
const latestCoverageEnrollmentFollowUpReconciliationDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-reconciliations")
);
const latestExecutionConvergenceDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-convergence-audits")
);
const latestControlChannelCoverageDir = latestDirectory(
  join(process.cwd(), ".transparent-apprentice", "all-software-control-channel-coverage-audits")
);
const sourceOperationalStatusConsole = resolveMaybe(
  operationalStatusConsoleArg ||
    firstExisting([
      join(latestStatusDir, "all-software-operational-status-console.json"),
      join(latestStatusDir, "ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md")
    ])
);
const sourceOperationalStatusReadme = resolveMaybe(
  firstExisting([
    join(dirname(sourceOperationalStatusConsole || centerDir), "ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md"),
    sourceOperationalStatusConsole
  ])
);
const sourceOriginalGoalReadinessAudit = resolveMaybe(
  originalGoalReadinessAuditArg ||
    firstExisting([
      join(latestReadinessDir, "original-goal-readiness-audit.json"),
      join(latestReadinessDir, "ORIGINAL_GOAL_READINESS_AUDIT_START_HERE.md")
    ])
);
const sourceOriginalGoalReadme = resolveMaybe(
  firstExisting([
    join(dirname(sourceOriginalGoalReadinessAudit || centerDir), "ORIGINAL_GOAL_READINESS_AUDIT_START_HERE.md"),
    sourceOriginalGoalReadinessAudit
  ])
);
const operationalStatusConsoleCopy = copyIntoEvidenceDir(sourceOperationalStatusConsole, "operational-status-console");
const operationalStatusReadmeCopy =
  sourceOperationalStatusReadme && sourceOperationalStatusReadme !== sourceOperationalStatusConsole
    ? copyIntoEvidenceDir(sourceOperationalStatusReadme, "operational-status-console")
    : "";
const originalGoalReadinessAuditCopy = copyIntoEvidenceDir(sourceOriginalGoalReadinessAudit, "original-goal-readiness-audit");
const originalGoalReadmeCopy =
  sourceOriginalGoalReadme && sourceOriginalGoalReadme !== sourceOriginalGoalReadinessAudit
    ? copyIntoEvidenceDir(sourceOriginalGoalReadme, "original-goal-readiness-audit")
    : "";
const sourceActivationReviewPacket = resolveMaybe(
  activationReviewPacketArg ||
    firstExisting([
      join(latestActivationReviewPacketDir, "all-software-operational-activation-review-packet.json"),
      join(latestActivationReviewPacketDir, "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_PACKET_START_HERE.md")
    ])
);
const sourceActivationReviewReadme = resolveMaybe(
  firstExisting([
    join(dirname(sourceActivationReviewPacket || centerDir), "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_PACKET_START_HERE.md"),
    sourceActivationReviewPacket
  ])
);
const activationReviewPacketCopy = copyIntoEvidenceDir(sourceActivationReviewPacket, "activation-review-packet");
const activationReviewReadmeCopy =
  sourceActivationReviewReadme && sourceActivationReviewReadme !== sourceActivationReviewPacket
    ? copyIntoEvidenceDir(sourceActivationReviewReadme, "activation-review-packet")
    : "";
let activationReceiptBuilderResult = null;
if (sourceActivationReviewPacket) {
  activationReceiptBuilderResult = runNodeScript("create-all-software-operational-activation-receipt-builder.mjs", [
    "--goal",
    goal,
    "--review-packet",
    sourceActivationReviewPacket,
    "--output-dir",
    join(centerDir, "activation-receipt-builder")
  ]);
}
const sourceActivationReceiptValidation = resolveMaybe(
  activationReceiptValidationArg ||
    firstExisting([
      join(latestActivationReceiptValidationDir, "all-software-operational-activation-review-receipt-validation.json"),
      join(latestActivationReceiptValidationDir, "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_RECEIPT_VALIDATION_START_HERE.md")
    ])
);
const sourceActivationReceiptValidationReadme = resolveMaybe(
  firstExisting([
    join(dirname(sourceActivationReceiptValidation || centerDir), "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_REVIEW_RECEIPT_VALIDATION_START_HERE.md"),
    sourceActivationReceiptValidation
  ])
);
const activationReceiptValidationCopy = copyIntoEvidenceDir(
  sourceActivationReceiptValidation,
  "activation-receipt-validation"
);
const activationReceiptValidationReadmeCopy =
  sourceActivationReceiptValidationReadme && sourceActivationReceiptValidationReadme !== sourceActivationReceiptValidation
    ? copyIntoEvidenceDir(sourceActivationReceiptValidationReadme, "activation-receipt-validation")
    : "";
const sourceCoverageConvergence = resolveMaybe(
  coverageConvergenceArg ||
    firstExisting([
      join(latestCoverageConvergenceDir, "all-software-coverage-convergence-audit.json"),
      join(latestCoverageConvergenceDir, "all-software-coverage-convergence-audit-receipt.json")
    ])
);
let coverageExpansionPlanFromConvergence = "";
if (sourceCoverageConvergence && /\.json$/i.test(sourceCoverageConvergence)) {
  try {
    coverageExpansionPlanFromConvergence = readJson(sourceCoverageConvergence).sourceExpansionPlanPath || "";
  } catch {
    coverageExpansionPlanFromConvergence = "";
  }
}
const sourceCoverageExpansionPlan = resolveMaybe(
  coverageExpansionPlanArg ||
    firstExisting([
      coverageExpansionPlanFromConvergence,
      join(latestCoverageExpansionPlanDir, "all-software-coverage-expansion-plan.json"),
      join(latestCoverageExpansionPlanDir, "ALL_SOFTWARE_COVERAGE_EXPANSION_PLAN_START_HERE.md")
    ])
);
const sourceExecutionConvergence = resolveMaybe(
  executionConvergenceArg ||
    firstExisting([
      join(latestExecutionConvergenceDir, "all-software-execution-capability-convergence-audit.json"),
      join(latestExecutionConvergenceDir, "all-software-execution-capability-convergence-audit-receipt.json")
    ])
);
const coverageConvergenceCopy = copyIntoEvidenceDir(sourceCoverageConvergence, "coverage-convergence");
const coverageExpansionPlanCopy = copyIntoEvidenceDir(sourceCoverageExpansionPlan, "coverage-expansion-plan");
const sourceCoverageEnrollmentFollowUpPlan = resolveMaybe(
  coverageEnrollmentFollowUpPlanArg ||
    firstExisting([
      join(latestCoverageEnrollmentFollowUpPlanDir, "all-software-coverage-enrollment-follow-up-plan.json"),
      join(latestCoverageEnrollmentFollowUpPlanDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md")
    ])
);
const sourceCoverageEnrollmentFollowUpBatch = resolveMaybe(
  coverageEnrollmentFollowUpBatchArg ||
    firstExisting([
      join(latestCoverageEnrollmentFollowUpBatchDir, "all-software-coverage-enrollment-follow-up-batch-run.json"),
      join(latestCoverageEnrollmentFollowUpBatchDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_START_HERE.md")
    ])
);
const sourceCoverageEnrollmentLedger = resolveMaybe(
  coverageEnrollmentLedgerArg ||
    firstExisting([
      join(latestCoverageEnrollmentLedgerDir, "all-software-coverage-enrollment-ledger.json"),
      join(latestCoverageEnrollmentLedgerDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md")
    ])
);
const sourceCoverageEnrollmentFollowUpReconciliation = resolveMaybe(
  coverageEnrollmentFollowUpReconciliationArg ||
    firstExisting([
      join(latestCoverageEnrollmentFollowUpReconciliationDir, "all-software-coverage-enrollment-follow-up-reconciliation.json"),
      join(latestCoverageEnrollmentFollowUpReconciliationDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECONCILIATION_START_HERE.md")
    ])
);
const coverageEnrollmentFollowUpPlanCopy = copyIntoEvidenceDir(
  sourceCoverageEnrollmentFollowUpPlan,
  "coverage-enrollment-follow-up-plan"
);
const coverageEnrollmentFollowUpBatchCopy = copyIntoEvidenceDir(
  sourceCoverageEnrollmentFollowUpBatch,
  "coverage-enrollment-follow-up-batch"
);
const coverageEnrollmentLedgerCopy = copyIntoEvidenceDir(sourceCoverageEnrollmentLedger, "coverage-enrollment-ledger");
const coverageEnrollmentFollowUpReconciliationCopy = copyIntoEvidenceDir(
  sourceCoverageEnrollmentFollowUpReconciliation,
  "coverage-enrollment-follow-up-reconciliation"
);
const sourceCoverageEnrollmentFollowUpReceiptBuilder = resolveMaybe(
  coverageEnrollmentFollowUpReceiptBuilderArg ||
    firstExisting([
      join(latestCoverageEnrollmentFollowUpReceiptBuilderDir, "all-software-coverage-enrollment-follow-up-receipt-builder.json"),
      join(latestCoverageEnrollmentFollowUpReceiptBuilderDir, "all-software-coverage-enrollment-follow-up-receipt-builder.html")
    ])
);
const sourceCoverageEnrollmentFollowUpReceiptTemplate = resolveMaybe(
  coverageEnrollmentFollowUpReceiptTemplateArg ||
    firstExisting([
      join(dirname(sourceCoverageEnrollmentFollowUpReceiptBuilder || centerDir), "teacher-coverage-enrollment-follow-up-receipt-template.json"),
      join(latestCoverageEnrollmentFollowUpReceiptBuilderDir, "teacher-coverage-enrollment-follow-up-receipt-template.json")
    ])
);
let coverageEnrollmentFollowUpReceiptBuilderResult = null;
if (coverageEnrollmentFollowUpPlanCopy && /\.json$/i.test(coverageEnrollmentFollowUpPlanCopy)) {
  const enrollmentReceiptArgs = [
    "--goal",
    goal,
    "--plan",
    coverageEnrollmentFollowUpPlanCopy,
    "--output-dir",
    join(centerDir, "coverage-enrollment-follow-up-receipt-builder")
  ];
  if (coverageEnrollmentFollowUpBatchCopy && /\.json$/i.test(coverageEnrollmentFollowUpBatchCopy)) {
    enrollmentReceiptArgs.push("--batch", coverageEnrollmentFollowUpBatchCopy);
  }
  coverageEnrollmentFollowUpReceiptBuilderResult = runNodeScript(
    "create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs",
    enrollmentReceiptArgs
  );
}
const coverageEnrollmentFollowUpReceiptBuilderCopy =
  coverageEnrollmentFollowUpReceiptBuilderResult?.builderPath ||
  copyIntoEvidenceDir(sourceCoverageEnrollmentFollowUpReceiptBuilder, "coverage-enrollment-follow-up-receipt-builder");
const coverageEnrollmentFollowUpReceiptBuilderHtml =
  coverageEnrollmentFollowUpReceiptBuilderResult?.htmlPath ||
  firstExisting([
    join(dirname(coverageEnrollmentFollowUpReceiptBuilderCopy || sourceCoverageEnrollmentFollowUpReceiptBuilder || centerDir), "all-software-coverage-enrollment-follow-up-receipt-builder.html"),
    sourceCoverageEnrollmentFollowUpReceiptBuilder
  ]);
const coverageEnrollmentFollowUpReceiptTemplate =
  coverageEnrollmentFollowUpReceiptBuilderResult?.receiptTemplatePath ||
  firstExisting([
    join(dirname(coverageEnrollmentFollowUpReceiptBuilderCopy || sourceCoverageEnrollmentFollowUpReceiptBuilder || centerDir), "teacher-coverage-enrollment-follow-up-receipt-template.json"),
    sourceCoverageEnrollmentFollowUpReceiptTemplate
  ]);
const executionConvergenceCopy = copyIntoEvidenceDir(sourceExecutionConvergence, "execution-convergence");
let coverageRolloutReceiptBuilderResult = null;
if (sourceCoverageExpansionPlan && /\.json$/i.test(sourceCoverageExpansionPlan)) {
  const coverageRolloutArgs = [
    "--goal",
    goal,
    "--plan",
    sourceCoverageExpansionPlan,
    "--output-dir",
    join(centerDir, "coverage-rollout-receipt-builder")
  ];
  if (sourceCoverageConvergence && /\.json$/i.test(sourceCoverageConvergence)) {
    coverageRolloutArgs.push("--convergence-audit", sourceCoverageConvergence);
  }
  coverageRolloutReceiptBuilderResult = runNodeScript("create-all-software-coverage-rollout-receipt-builder.mjs", coverageRolloutArgs);
}
const sourceExecutionFollowUpBatch = resolveMaybe(executionFollowUpBatchArg);
const sourceExecutionFollowUpReadme = resolveMaybe(
  firstExisting([
    join(dirname(sourceExecutionFollowUpBatch || centerDir), "ALL_SOFTWARE_EXECUTION_CAPABILITY_MATRIX_FOLLOW_UP_BATCH_START_HERE.md"),
    sourceExecutionFollowUpBatch
  ])
);
const executionFollowUpBatchCopy = copyIntoEvidenceDir(sourceExecutionFollowUpBatch, "execution-follow-up-batch");
const executionFollowUpReadmeCopy =
  sourceExecutionFollowUpReadme && sourceExecutionFollowUpReadme !== sourceExecutionFollowUpBatch
    ? copyIntoEvidenceDir(sourceExecutionFollowUpReadme, "execution-follow-up-batch")
    : "";
let executionFollowUpReceiptBuilderResult = null;
if (sourceExecutionFollowUpBatch) {
  executionFollowUpReceiptBuilderResult = runNodeScript("create-all-software-execution-follow-up-receipt-builder.mjs", [
    "--goal",
    goal,
    "--batch",
    sourceExecutionFollowUpBatch,
    "--output-dir",
    join(centerDir, "execution-follow-up-receipt-builder")
  ]);
}
const sourceControlChannelRepairQueue = resolveMaybe(
  controlChannelRepairQueueArg ||
    firstExisting([
      join(latestControlChannelCoverageDir, "all-software-control-channel-repair-queue.json"),
      join(latestControlChannelCoverageDir, "ALL_SOFTWARE_CONTROL_CHANNEL_COVERAGE_AUDIT_START_HERE.md")
    ])
);
const controlChannelRepairQueueCopy = copyIntoEvidenceDir(
  sourceControlChannelRepairQueue,
  "control-channel-repair-queue"
);
let controlChannelRepairReceiptBuilderResult = null;
if (sourceExecutionFollowUpBatch || (sourceControlChannelRepairQueue && /\.json$/i.test(sourceControlChannelRepairQueue))) {
  const controlChannelRepairBuilderArgs = [
    "--goal",
    goal,
    "--output-dir",
    join(centerDir, "control-channel-repair-receipt-builder")
  ];
  if (sourceExecutionFollowUpBatch) {
    controlChannelRepairBuilderArgs.push("--follow-up-batch", sourceExecutionFollowUpBatch);
  } else {
    controlChannelRepairBuilderArgs.push("--repair-queue", sourceControlChannelRepairQueue);
  }
  controlChannelRepairReceiptBuilderResult = runNodeScript(
    "create-all-software-control-channel-repair-receipt-builder.mjs",
    controlChannelRepairBuilderArgs
  );
}
const controlChannelRepairBuilderPacket = controlChannelRepairReceiptBuilderResult?.builderPath
  ? readJson(controlChannelRepairReceiptBuilderResult.builderPath)
  : null;
const controlChannelRepairValidationQueuePath =
  controlChannelRepairBuilderPacket?.paths?.derivedRepairQueue ||
  controlChannelRepairBuilderPacket?.paths?.sourceRepairQueue ||
  controlChannelRepairQueueCopy ||
  "";
let originalGoalGapActionBoardResult = null;
const gapStatusConsoleSource = jsonEvidencePath(sourceOperationalStatusConsole);
const gapActivationReceiptValidationSource = jsonEvidencePath(sourceActivationReceiptValidation);
const gapCoverageConvergenceSource = jsonEvidencePath(sourceCoverageConvergence);
const gapExecutionConvergenceSource = jsonEvidencePath(sourceExecutionConvergence);
if (gapStatusConsoleSource || gapActivationReceiptValidationSource || gapCoverageConvergenceSource || gapExecutionConvergenceSource) {
  const gapBoardArgs = [
    "--goal",
    goal,
    "--output-dir",
    join(centerDir, "original-goal-gap-action-board")
  ];
  if (gapStatusConsoleSource) gapBoardArgs.push("--status-console", gapStatusConsoleSource);
  if (gapActivationReceiptValidationSource) gapBoardArgs.push("--activation-receipt-validation", gapActivationReceiptValidationSource);
  if (gapCoverageConvergenceSource) gapBoardArgs.push("--coverage-convergence", gapCoverageConvergenceSource);
  if (gapExecutionConvergenceSource) gapBoardArgs.push("--execution-convergence", gapExecutionConvergenceSource);
  originalGoalGapActionBoardResult = runNodeScript("create-original-goal-gap-action-board.mjs", gapBoardArgs);
}
const statusEntryLinks = [
  {
    id: "current_operational_status",
    label: "Current operational status console",
    path: operationalStatusReadmeCopy || operationalStatusConsoleCopy,
    url: packageUrl(operationalStatusReadmeCopy || operationalStatusConsoleCopy)
  },
  {
    id: "original_goal_readiness_audit",
    label: "Original goal readiness / completion boundary",
    path: originalGoalReadmeCopy || originalGoalReadinessAuditCopy,
    url: packageUrl(originalGoalReadmeCopy || originalGoalReadinessAuditCopy)
  },
  {
    id: "activation_review_packet",
    label: "Activation review packet",
    path: activationReviewReadmeCopy || activationReviewPacketCopy,
    url: packageUrl(activationReviewReadmeCopy || activationReviewPacketCopy)
  },
  {
    id: "activation_receipt_builder",
    label: "Activation receipt builder",
    path: activationReceiptBuilderResult?.htmlPath || "",
    url: packageUrl(activationReceiptBuilderResult?.htmlPath || "")
  },
  {
    id: "activation_receipt_validation",
    label: "Activation receipt validation",
    path: activationReceiptValidationReadmeCopy || activationReceiptValidationCopy,
    url: packageUrl(activationReceiptValidationReadmeCopy || activationReceiptValidationCopy)
  },
  {
    id: "original_goal_gap_action_board",
    label: "Original goal gap action board",
    path: originalGoalGapActionBoardResult?.htmlPath || "",
    url: packageUrl(originalGoalGapActionBoardResult?.htmlPath || "")
  },
  {
    id: "coverage_rollout_receipt_builder",
    label: "Coverage rollout receipt builder",
    path: coverageRolloutReceiptBuilderResult?.htmlPath || coverageExpansionPlanCopy,
    url: packageUrl(coverageRolloutReceiptBuilderResult?.htmlPath || coverageExpansionPlanCopy)
  },
  {
    id: "execution_capability_follow_up_batch",
    label: "Execution capability follow-up batch",
    path: executionFollowUpReadmeCopy || executionFollowUpBatchCopy,
    url: packageUrl(executionFollowUpReadmeCopy || executionFollowUpBatchCopy)
  },
  {
    id: "execution_follow_up_receipt_builder",
    label: "Execution follow-up receipt builder",
    path: executionFollowUpReceiptBuilderResult?.htmlPath || "",
    url: packageUrl(executionFollowUpReceiptBuilderResult?.htmlPath || "")
  },
  {
    id: "control_channel_repair_receipt_builder",
    label: "Control-channel repair receipt builder",
    path: controlChannelRepairReceiptBuilderResult?.htmlPath || controlChannelRepairQueueCopy,
    url: packageUrl(controlChannelRepairReceiptBuilderResult?.htmlPath || controlChannelRepairQueueCopy)
  },
  {
    id: "visual_grounded_voice_control_workbench",
    label: "Visual evidence grounded voice/text workbench",
    path: visualGroundedVoiceWorkbenchReady ? voiceWorkbench.htmlPath : "",
    url: visualGroundedVoiceWorkbenchReady ? packageUrl(voiceWorkbench.htmlPath) : ""
  }
].filter((link) => link.path);

const nextCalls = {
  reviewTeacherMethod: {
    tool: "continue_teaching",
    arguments: {
      goal,
      adaptTeacherMethod: true,
      teacherStyle,
      software
    }
  },
  readOnlyObservation: {
    tool: "start_teach_execute_reviewed_observation",
    arguments: {
      goal,
      software,
      teacherConfirmation: "teacher_reviewed_read_only_observation_only",
      maxProcesses: Number(maxProcesses),
      maxInstalled: Number(maxInstalled),
      maxCandidates: Number(maxCandidates)
    }
  },
  confirmNumberedTarget: voiceState.nextConfirmCall,
  confirmNumberedTargetTool: "confirm_engineering_command_target",
  visualGroundedConfirmNumberedTarget: visualGroundedVoiceWorkbenchReady
    ? {
        tool: "confirm_engineering_command_target",
        arguments: voiceState.nextConfirmCall?.arguments || {},
        visualEvidencePath: voiceState.generated?.visualEvidencePath || visualEvidenceCopy,
        blockedUntil: "teacher reviews the visual backdrop and confirms exactly one numbered target"
      }
    : null,
  voiceExecutionApprovalGate: {
    tool: "create_engineering_voice_execution_approval_gate",
    arguments: {
      goal,
      software,
      confirmation: "<transparent_ai_engineering_command_target_confirmation_receipt_v1 path>",
      executionPackage: "<transparent_ai_existing_software_execution_package_v1 path>",
      adapterId: "<reviewed adapter id>",
      teacherConfirmation: "<explicit teacher voice execution confirmation>",
      rollbackPointCreated: false
    },
    blockedUntil: "one numbered target is confirmed, reviewed route evidence exists, explicit execution confirmation is present, and rollback point is created"
  },
  actionRehearsal: {
    tool: "start_teach_execute_action_rehearsal",
    arguments: {
      goal,
      software,
      teacherConfirmation: "teacher_confirmed_one_number_and_spatial_intent",
      preferredAdapter: "existing-cli-or-script"
    }
  },
  supervisedExecutionGate: {
    tool: "start_teach_execute_supervised_execution",
    arguments: {
      goal,
      software,
      execute: false,
      teacherConfirmation: "dry_run_first"
    }
  },
  postActionEvidenceReview: {
    tool: "create_post_action_evidence_checkpoint",
    arguments: {
      goal,
      software,
      teacherConfirmation: "review_execution_receipt_and_cheap_state_before_screenshot_or_learning"
    }
  },
  executionCapabilityFollowUpBatch: {
    tool: "run_all_software_execution_capability_matrix_follow_up_batch",
    arguments: {
      matrix: "<reviewed transparent_ai_all_software_execution_capability_matrix_v1 path>",
      maxRows: 4,
      teacherReviewed: false
    },
    currentEvidencePath: executionFollowUpBatchCopy,
    blockedUntil: "teacher reviews the current follow-up batch before any dry-run runner invocation or execute gate"
  },
  executionFollowUpReceiptValidation: {
    tool: "validate_all_software_execution_follow_up_receipt",
    arguments: {
      batch: executionFollowUpBatchCopy || "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>",
      receipt: "<teacher-filled-execution-follow-up-receipt.json>"
    },
    currentBuilderPath: executionFollowUpReceiptBuilderResult?.builderPath || "",
    blockedUntil: "teacher generates a receipt from the execution follow-up receipt builder"
  },
  controlChannelRepairReceiptValidation: {
    tool: "validate_all_software_control_channel_repair_receipt",
    arguments: {
      repairQueue: controlChannelRepairValidationQueuePath || "<transparent_ai_all_software_control_channel_repair_queue_v1 path>",
      receipt: "<teacher-filled-control-channel-repair-receipt.json>"
    },
    currentBuilderPath: controlChannelRepairReceiptBuilderResult?.builderPath || "",
    blockedUntil: "teacher generates a receipt from the control-channel repair receipt builder"
  },
  coverageEnrollmentFollowUpReceiptValidation: {
    tool: "validate_all_software_coverage_enrollment_follow_up_receipt",
    arguments: {
      plan: coverageEnrollmentFollowUpPlanCopy || "<transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1 path>",
      receipt: "<teacher-filled-coverage-enrollment-follow-up-receipt.json>"
    },
    currentBuilderPath: coverageEnrollmentFollowUpReceiptBuilderCopy || "",
    currentReceiptTemplatePath: coverageEnrollmentFollowUpReceiptTemplate || "",
    blockedUntil: "teacher fills the coverage enrollment follow-up receipt before any --teacher-reviewed enrollment batch command"
  },
  coverageRolloutReceiptValidation: {
    tool: "validate_all_software_coverage_rollout_receipt",
    arguments: {
      plan: coverageExpansionPlanCopy || "<transparent_ai_all_software_coverage_expansion_plan_v1 path>",
      receipt: "<teacher-filled-coverage-rollout-receipt.json>"
    },
    currentBuilderPath: coverageRolloutReceiptBuilderResult?.builderPath || "",
    blockedUntil: "teacher fills the coverage rollout receipt before any --teacher-reviewed supervisor command"
  }
};

const center = {
  ok: true,
  format: "transparent_ai_goal_command_center_v1",
  centerId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  teacherStyle,
  optimizedPrompt,
  purpose:
    "A single teacher-facing command center that reuses existing plugin tools for low-token observation, transparent spatial sketching, voice/text numbered target confirmation, dry-run action rehearsal, supervised execution gate, outcome verification, and post-action evidence review.",
  paths: {
    centerPath,
    htmlPath,
    receiptTemplatePath,
    readmePath,
    teacherMethodProfile: methodProfile.profilePath,
    observerBootstrap: observerBootstrap.bootstrapPath,
    transparentOverlay: overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "",
    transparentOverlayPowerShell: overlayKit.files?.powershellOverlay || overlayKit.powershellOverlay || "",
    voiceWorkbenchGoalInput: voiceGoalInputPath,
    voiceWorkbenchCommandInput: voiceCommandInputPath,
    voiceWorkbenchVoiceTranscriptInput: voiceTranscript ? voiceTranscriptInputPath : "",
    voiceWorkbench: voiceWorkbench.workbenchPath,
    voiceWorkbenchHtml: voiceWorkbench.htmlPath,
    voiceWorkbenchVisualTargetConfirmation: voiceState.generated?.visualTargetConfirmation || "",
    voiceWorkbenchVisualTargetConfirmationHtml: voiceState.generated?.visualTargetConfirmationHtml || "",
    voiceWorkbenchVisualOverlayPacket: voiceState.generated?.visualOverlayPacket || "",
    voiceWorkbenchVisualEvidence: voiceState.generated?.visualEvidencePath || visualEvidenceCopy,
    voiceWorkbenchVisualCaptureReceipt: visualCaptureReceiptCopy,
    teachExecuteLoop: teachExecuteLoop.runbookPath,
    operationalStatusConsole: operationalStatusConsoleCopy,
    operationalStatusReadme: operationalStatusReadmeCopy,
    originalGoalReadinessAudit: originalGoalReadinessAuditCopy,
    originalGoalReadinessReadme: originalGoalReadmeCopy,
    activationReviewPacket: activationReviewPacketCopy,
    activationReviewReadme: activationReviewReadmeCopy,
    activationReceiptBuilder: activationReceiptBuilderResult?.builderPath || "",
    activationReceiptBuilderHtml: activationReceiptBuilderResult?.htmlPath || "",
    activationReceiptBuilderReadme: activationReceiptBuilderResult?.readmePath || "",
    activationReceiptValidation: activationReceiptValidationCopy,
    activationReceiptValidationReadme: activationReceiptValidationReadmeCopy,
    coverageExpansionPlan: coverageExpansionPlanCopy,
    coverageConvergence: coverageConvergenceCopy,
    coverageEnrollmentFollowUpPlan: coverageEnrollmentFollowUpPlanCopy,
    coverageEnrollmentFollowUpBatch: coverageEnrollmentFollowUpBatchCopy,
    coverageEnrollmentLedger: coverageEnrollmentLedgerCopy,
    coverageEnrollmentFollowUpReconciliation: coverageEnrollmentFollowUpReconciliationCopy,
    coverageEnrollmentFollowUpReceiptBuilder: coverageEnrollmentFollowUpReceiptBuilderCopy,
    coverageEnrollmentFollowUpReceiptBuilderHtml: coverageEnrollmentFollowUpReceiptBuilderHtml,
    coverageEnrollmentFollowUpReceiptTemplate: coverageEnrollmentFollowUpReceiptTemplate,
    coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderResult?.builderPath || "",
    coverageRolloutReceiptBuilderHtml: coverageRolloutReceiptBuilderResult?.htmlPath || "",
    coverageRolloutReceiptBuilderReadme: coverageRolloutReceiptBuilderResult?.readmePath || "",
    executionConvergence: executionConvergenceCopy,
    executionFollowUpBatch: executionFollowUpBatchCopy,
    executionFollowUpReadme: executionFollowUpReadmeCopy,
    executionFollowUpReceiptBuilder: executionFollowUpReceiptBuilderResult?.builderPath || "",
    executionFollowUpReceiptBuilderHtml: executionFollowUpReceiptBuilderResult?.htmlPath || "",
    executionFollowUpReceiptBuilderReadme: executionFollowUpReceiptBuilderResult?.readmePath || "",
    controlChannelRepairQueue: controlChannelRepairQueueCopy,
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderResult?.builderPath || "",
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderResult?.htmlPath || "",
    controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderResult?.readmePath || "",
    originalGoalGapActionBoard: originalGoalGapActionBoardResult?.boardPath || "",
    originalGoalGapActionBoardHtml: originalGoalGapActionBoardResult?.htmlPath || "",
    originalGoalGapActionBoardReceiptTemplate: originalGoalGapActionBoardResult?.receiptTemplatePath || "",
    originalGoalGapActionBoardReadme: originalGoalGapActionBoardResult?.readmePath || ""
  },
  entryLinks: [
    ...statusEntryLinks,
    {
      id: "teacher_method_profile",
      label: "Teacher method profile",
      path: methodProfile.profilePath,
      url: packageUrl(methodProfile.profilePath)
    },
    {
      id: "all_software_observer_bootstrap",
      label: "All-software low-token observer bootstrap",
      path: observerBootstrap.bootstrapPath,
      url: packageUrl(observerBootstrap.bootstrapPath)
    },
    {
      id: "transparent_sketch_overlay",
      label: "Transparent 2D / perspective / 3D sketch overlay",
      path: overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "",
      url: packageUrl(overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "")
    },
    {
      id: "engineering_voice_control_workbench",
      label: "Voice/text numbered target workbench",
      path: voiceWorkbench.htmlPath,
      url: packageUrl(voiceWorkbench.htmlPath)
    },
    {
      id: "teach_execute_loop",
      label: "Teach-execute runbook",
      path: teachExecuteLoop.runbookPath,
      url: packageUrl(teachExecuteLoop.runbookPath)
    },
    ...(coverageEnrollmentLedgerCopy
      ? [
          {
            id: "coverage_enrollment_ledger",
            label: "Coverage enrollment ledger",
            path: coverageEnrollmentLedgerCopy,
            url: packageUrl(coverageEnrollmentLedgerCopy)
          }
        ]
      : []),
    ...(coverageEnrollmentFollowUpPlanCopy
      ? [
          {
            id: "coverage_enrollment_follow_up_plan",
            label: "Coverage enrollment follow-up plan",
            path: coverageEnrollmentFollowUpPlanCopy,
            url: packageUrl(coverageEnrollmentFollowUpPlanCopy)
          }
        ]
      : []),
    ...(coverageEnrollmentFollowUpReceiptBuilderHtml
      ? [
          {
            id: "coverage_enrollment_follow_up_receipt_builder",
            label: "Coverage enrollment follow-up receipt builder",
            path: coverageEnrollmentFollowUpReceiptBuilderHtml,
            url: packageUrl(coverageEnrollmentFollowUpReceiptBuilderHtml)
          }
        ]
      : []),
    {
      id: "receipt_template",
      label: "Review receipt template",
      path: receiptTemplatePath,
      url: packageUrl(receiptTemplatePath)
    }
  ],
  stages: [
    {
      id: "adapt_teacher_method",
      status: "ready_for_teacher_review",
      existingTool: "create_teacher_learning_method_profile",
      evidencePath: methodProfile.profilePath,
      evidenceUrl: packageUrl(methodProfile.profilePath),
      openPath: methodProfile.profilePath,
      openUrl: packageUrl(methodProfile.profilePath)
    },
    {
      id: "observe_all_software_low_token_first",
      status: "ready_for_teacher_review",
      existingTool: "create_all_software_observer_bootstrap",
      evidencePath: observerBootstrap.bootstrapPath,
      evidenceUrl: packageUrl(observerBootstrap.bootstrapPath),
      openPath: observerBootstrap.bootstrapPath,
      openUrl: packageUrl(observerBootstrap.bootstrapPath),
      principle: "metadata and bounded log/event/file deltas before screenshots"
    },
    {
      id: "transparent_2d_perspective_3d_sketch",
      status: "ready_for_teacher_review",
      existingTool: "create_transparent_sketch_overlay_kit",
      evidencePath: overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "",
      evidenceUrl: packageUrl(overlayKit.files?.browserOverlay || overlayKit.browserOverlay || ""),
      openPath: overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "",
      openUrl: packageUrl(overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "")
    },
    {
      id: "voice_text_numbered_target_confirmation",
      status: "ready_for_teacher_review",
      existingTool: "create_engineering_voice_control_workbench",
      evidencePath: voiceWorkbench.workbenchPath,
      evidenceUrl: packageUrl(voiceWorkbench.workbenchPath),
      openPath: voiceWorkbench.htmlPath,
      openUrl: packageUrl(voiceWorkbench.htmlPath)
    },
    {
      id: "visual_evidence_voice_text_numbered_target_confirmation",
      status: visualGroundedVoiceWorkbenchReady ? "ready_for_teacher_review" : "waiting_for_triggered_visual_evidence_or_teacher_screenshot",
      existingTool: "create_visual_engineering_target_confirmation_kit",
      evidencePath: voiceState.generated?.visualTargetConfirmation || visualEvidenceCopy,
      evidenceUrl: packageUrl(voiceState.generated?.visualTargetConfirmation || visualEvidenceCopy),
      openPath: voiceWorkbench.htmlPath,
      openUrl: packageUrl(voiceWorkbench.htmlPath),
      principle: "reuse one reviewed screenshot or triggered visual capture as the numbered-target backdrop before dry-run planning"
    },
    {
      id: "coverage_rollout_receipt_builder",
      status: coverageRolloutReceiptBuilderResult ? "ready_for_teacher_review" : "not_generated_in_this_center",
      existingTool: "create_all_software_coverage_rollout_receipt_builder",
      evidencePath: coverageRolloutReceiptBuilderResult?.builderPath || coverageExpansionPlanCopy,
      evidenceUrl: packageUrl(coverageRolloutReceiptBuilderResult?.builderPath || coverageExpansionPlanCopy),
      openPath: coverageRolloutReceiptBuilderResult?.htmlPath || coverageExpansionPlanCopy,
      openUrl: packageUrl(coverageRolloutReceiptBuilderResult?.htmlPath || coverageExpansionPlanCopy),
      principle: "teacher-filled receipt before any --teacher-reviewed coverage rollout supervisor command"
    },
    {
      id: "coverage_enrollment_follow_up_receipt_builder",
      status: coverageEnrollmentFollowUpReceiptBuilderCopy ? "ready_for_teacher_review" : "not_generated_in_this_center",
      existingTool: "create_all_software_coverage_enrollment_follow_up_receipt_builder",
      evidencePath: coverageEnrollmentFollowUpReceiptBuilderCopy || coverageEnrollmentFollowUpPlanCopy,
      evidenceUrl: packageUrl(coverageEnrollmentFollowUpReceiptBuilderCopy || coverageEnrollmentFollowUpPlanCopy),
      openPath: coverageEnrollmentFollowUpReceiptBuilderHtml || coverageEnrollmentFollowUpPlanCopy,
      openUrl: packageUrl(coverageEnrollmentFollowUpReceiptBuilderHtml || coverageEnrollmentFollowUpPlanCopy),
      principle: "teacher-filled receipt before validating any reviewed enrollment follow-up batch command"
    },
    {
      id: "voice_text_execution_approval_gate",
      status: executionFollowUpBatchCopy
        ? "waiting_for_teacher_review_of_execution_follow_up_batch_before_approval_gate"
        : "waiting_for_confirmed_number_route_evidence_teacher_confirmation_and_rollback",
      existingTool: "create_engineering_voice_execution_approval_gate",
      evidencePath: executionFollowUpBatchCopy,
      evidenceUrl: packageUrl(executionFollowUpBatchCopy),
      openPath: executionFollowUpReadmeCopy || executionFollowUpBatchCopy,
      openUrl: packageUrl(executionFollowUpReadmeCopy || executionFollowUpBatchCopy)
    },
    {
      id: "execution_capability_follow_up_batch",
      status: executionFollowUpBatchCopy ? "ready_for_teacher_review" : "not_generated_in_this_center",
      existingTool: "run_all_software_execution_capability_matrix_follow_up_batch",
      evidencePath: executionFollowUpBatchCopy,
      evidenceUrl: packageUrl(executionFollowUpBatchCopy),
      openPath: executionFollowUpReadmeCopy || executionFollowUpBatchCopy,
      openUrl: packageUrl(executionFollowUpReadmeCopy || executionFollowUpBatchCopy),
      principle: "bounded review-only execution gap advancement before any approval gate"
    },
    {
      id: "execution_follow_up_receipt_builder",
      status: executionFollowUpReceiptBuilderResult ? "ready_for_teacher_review" : "not_generated_in_this_center",
      existingTool: "create_all_software_execution_follow_up_receipt_builder",
      evidencePath: executionFollowUpReceiptBuilderResult?.builderPath || "",
      evidenceUrl: packageUrl(executionFollowUpReceiptBuilderResult?.builderPath || ""),
      openPath: executionFollowUpReceiptBuilderResult?.htmlPath || "",
      openUrl: packageUrl(executionFollowUpReceiptBuilderResult?.htmlPath || ""),
      principle: "teacher-filled review receipt before any dry-run runner review"
    },
    {
      id: "control_channel_repair_receipt_builder",
      status: controlChannelRepairReceiptBuilderResult ? "ready_for_teacher_review" : "not_generated_in_this_center",
      existingTool: "create_all_software_control_channel_repair_receipt_builder",
      evidencePath: controlChannelRepairReceiptBuilderResult?.builderPath || controlChannelRepairQueueCopy,
      evidenceUrl: packageUrl(controlChannelRepairReceiptBuilderResult?.builderPath || controlChannelRepairQueueCopy),
      openPath: controlChannelRepairReceiptBuilderResult?.htmlPath || controlChannelRepairQueueCopy,
      openUrl: packageUrl(controlChannelRepairReceiptBuilderResult?.htmlPath || controlChannelRepairQueueCopy),
      principle: "teacher-filled review receipt before any control-channel profile or read-only probe follow-up"
    },
    {
      id: "dry_run_supervised_execution_chain",
      status: "ready_for_teacher_review",
      existingTool: "create_teach_execute_learning_loop",
      evidencePath: teachExecuteLoop.runbookPath,
      evidenceUrl: packageUrl(teachExecuteLoop.runbookPath),
      openPath: teachExecuteLoop.runbookPath,
      openUrl: packageUrl(teachExecuteLoop.runbookPath)
    }
  ],
  nextCalls,
  locks
};

writeFileSync(centerPath, `${JSON.stringify(center, null, 2)}\n`, "utf8");
let teacherReviewCockpitResult = null;
try {
  teacherReviewCockpitResult = runNodeScript("create-goal-teacher-review-cockpit.mjs", [
    "--goal",
    goal,
    "--command-center",
    centerPath,
    "--output-dir",
    join(centerDir, "teacher-review-cockpit")
  ]);
  center.paths.teacherReviewCockpit = teacherReviewCockpitResult.cockpitPath;
  center.paths.teacherReviewCockpitHtml = teacherReviewCockpitResult.htmlPath;
  center.paths.teacherReviewCockpitReadme = teacherReviewCockpitResult.readmePath;
  center.paths.teacherReviewCockpitReceiptTemplate = teacherReviewCockpitResult.receiptTemplatePath;
  center.entryLinks.unshift({
    id: "teacher_review_cockpit",
    label: "Teacher review cockpit",
    path: teacherReviewCockpitResult.htmlPath,
    url: packageUrl(teacherReviewCockpitResult.htmlPath)
  });
  center.stages.unshift({
    id: "teacher_review_cockpit",
    status: "ready_for_teacher_review",
    existingTool: "create_goal_teacher_review_cockpit",
    evidencePath: teacherReviewCockpitResult.cockpitPath,
    evidenceUrl: packageUrl(teacherReviewCockpitResult.cockpitPath),
    openPath: teacherReviewCockpitResult.htmlPath,
    openUrl: packageUrl(teacherReviewCockpitResult.htmlPath),
    principle: "single review page for current activation, coverage, control-channel, voice/text, and sketch gates"
  });
  center.nextCalls.teacherReviewCockpit = {
    tool: "create_goal_teacher_review_cockpit",
    arguments: {
      commandCenter: centerPath,
      statusConsole: operationalStatusConsoleCopy
    },
    currentEvidencePath: teacherReviewCockpitResult.cockpitPath,
    blockedUntil: "teacher uses the linked review pages and validates the generated downstream receipts separately"
  };
  center.nextCalls.teacherReviewCockpitReceiptValidation = {
    tool: "validate_goal_teacher_review_cockpit_receipt",
    arguments: {
      cockpit: teacherReviewCockpitResult.cockpitPath,
      receipt: "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"
    },
    currentCockpitPath: teacherReviewCockpitResult.cockpitPath,
    blockedUntil: "teacher fills the cockpit receipt after reviewing linked pages; validation only prepares downstream commands"
  };
} catch (error) {
  center.paths.teacherReviewCockpitError = error && error.message ? error.message : String(error);
}

writeFileSync(centerPath, `${JSON.stringify(center, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transparent AI Goal Command Center</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f7f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .top { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 18px; align-items: start; }
    .panel, .stage { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13, 31, 54, 0.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; margin-top: 18px; }
    .stage strong { display: block; margin-bottom: 8px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .locks { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
    .lock { border: 1px solid #e1e6ef; border-radius: 6px; padding: 8px; background: #fbfcfe; font-size: 13px; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    textarea { width: 100%; min-height: 180px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    a { color: #174d89; word-break: break-all; }
    @media (max-width: 760px) { main { padding: 16px; } .top { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Transparent AI Goal Command Center</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="top">
      <div class="panel">
        <h2>下一步调用包</h2>
        <p>这个页面只整理证据和下一步调用，不执行软件、不截图、不写记忆。老师确认后，把需要的 JSON 调用交给插件继续。</p>
        <button id="copyCalls">Copy Next Calls</button>
        <button id="copyReceipt" class="secondary">Copy Receipt Template</button>
        <textarea id="packet" spellcheck="false"></textarea>
      </div>
      <div class="panel">
        <h2>安全锁</h2>
        <span class="badge">review only</span>
        <div class="locks" id="locks"></div>
      </div>
    </section>
    <section class="grid" id="stages"></section>
  </main>
  <script>
    const center = ${jsonForScript(center)};
    const receipt = ${jsonForScript(receiptTemplate)};
    const stages = document.getElementById("stages");
    for (const stage of center.stages) {
      const el = document.createElement("article");
      el.className = "stage";
      el.innerHTML = '<strong>' + stage.id + '</strong><p>' + stage.existingTool + '</p><a href="' + stage.evidencePath + '">' + stage.evidencePath + '</a>';
      stages.appendChild(el);
    }
    const locks = document.getElementById("locks");
    for (const [key, value] of Object.entries(center.locks)) {
      const el = document.createElement("div");
      el.className = "lock";
      el.textContent = key + ": " + value;
      locks.appendChild(el);
    }
    const packet = document.getElementById("packet");
    packet.value = JSON.stringify(center.nextCalls, null, 2);
    document.getElementById("copyCalls").addEventListener("click", async () => {
      packet.value = JSON.stringify(center.nextCalls, null, 2);
      await navigator.clipboard.writeText(packet.value);
    });
    document.getElementById("copyReceipt").addEventListener("click", async () => {
      packet.value = JSON.stringify(receipt, null, 2);
      await navigator.clipboard.writeText(packet.value);
    });
  </script>
</body>
</html>
`,
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transparent AI Goal Command Center</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f7f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .top { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 18px; align-items: start; }
    .panel, .stage { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13, 31, 54, 0.06); }
    .panel { margin-top: 18px; }
    .top .panel { margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; margin-top: 18px; }
    .stage strong { display: block; margin-bottom: 8px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .locks { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
    .lock { border: 1px solid #e1e6ef; border-radius: 6px; padding: 8px; background: #fbfcfe; font-size: 13px; }
    .links { display: grid; gap: 8px; margin-top: 12px; }
    .link-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    textarea { width: 100%; min-height: 180px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    a { color: #174d89; word-break: break-all; }
    .open-link { display: inline-flex; align-items: center; min-height: 34px; padding: 0 10px; border-radius: 6px; border: 1px solid #174d89; text-decoration: none; }
    .muted { color: #586579; font-size: 13px; }
    @media (max-width: 760px) { main { padding: 16px; } .top { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Transparent AI Goal Command Center</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="top">
      <div class="panel">
        <h2>Next-call packet</h2>
        <p>This page organizes evidence and next tool calls only. It does not execute target software, capture screenshots, or write memory. Review a stage, then copy the needed JSON call back to the plugin.</p>
        <button id="copyCalls">Copy Next Calls</button>
        <button id="copyReceipt" class="secondary">Copy Receipt Template</button>
        <textarea id="packet" spellcheck="false"></textarea>
      </div>
      <div class="panel">
        <h2>Safety locks</h2>
        <span class="badge">review only</span>
        <div class="locks" id="locks"></div>
      </div>
    </section>
    <section class="panel">
      <h2>Open package artifacts</h2>
      <div class="links" id="entryLinks"></div>
    </section>
    <section class="grid" id="stages"></section>
  </main>
  <script>
    const center = ${jsonForScript(center)};
    const receipt = ${jsonForScript(receiptTemplate)};
    const text = (value) => String(value ?? "");
    const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function copyButton(value) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.type = "button";
      button.textContent = "Copy path";
      button.addEventListener("click", async () => navigator.clipboard.writeText(text(value)));
      return button;
    }
    function renderLinkRow(parent, link) {
      const row = document.createElement("div");
      row.className = "link-row";
      if (link.url) {
        const anchor = document.createElement("a");
        anchor.className = "open-link";
        anchor.href = link.url;
        anchor.textContent = "Open";
        row.appendChild(anchor);
      }
      const label = document.createElement("span");
      label.textContent = link.label || link.id || link.path || "Artifact";
      row.appendChild(label);
      if (link.path) row.appendChild(copyButton(link.path));
      parent.appendChild(row);
    }
    const entryLinks = document.getElementById("entryLinks");
    for (const link of center.entryLinks || []) renderLinkRow(entryLinks, link);
    const stages = document.getElementById("stages");
    for (const stage of center.stages) {
      const el = document.createElement("article");
      el.className = "stage";
      el.innerHTML = '<strong>' + escapeHtml(stage.id) + '</strong><p>' + escapeHtml(stage.existingTool) + '</p><p class="muted">' + escapeHtml(stage.status) + '</p>';
      const links = document.createElement("div");
      links.className = "links";
      if (stage.openPath || stage.openUrl) {
        renderLinkRow(links, { label: "Primary artifact", path: stage.openPath, url: stage.openUrl });
      }
      if (stage.evidencePath && stage.evidencePath !== stage.openPath) {
        renderLinkRow(links, { label: "Evidence JSON", path: stage.evidencePath, url: stage.evidenceUrl });
      }
      if (!links.children.length) {
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = "Waiting for a confirmed number, reviewed route evidence, teacher confirmation, and rollback point.";
        links.appendChild(note);
      }
      el.appendChild(links);
      stages.appendChild(el);
    }
    const locks = document.getElementById("locks");
    for (const [key, value] of Object.entries(center.locks)) {
      const el = document.createElement("div");
      el.className = "lock";
      el.textContent = key + ": " + value;
      locks.appendChild(el);
    }
    const packet = document.getElementById("packet");
    packet.value = JSON.stringify(center.nextCalls, null, 2);
    document.getElementById("copyCalls").addEventListener("click", async () => {
      packet.value = JSON.stringify(center.nextCalls, null, 2);
      await navigator.clipboard.writeText(packet.value);
    });
    document.getElementById("copyReceipt").addEventListener("click", async () => {
      packet.value = JSON.stringify(receipt, null, 2);
      await navigator.clipboard.writeText(packet.value);
    });
  </script>
</body>
</html>
`,
  "utf8"
);

writeFileSync(
  readmePath,
  [
    "# Goal Command Center",
    "",
    "This package is the current safest unified start point for the original full goal.",
    "",
    `- Command center: ${centerPath}`,
    `- Local HTML: ${htmlPath}`,
    `- Receipt template: ${receiptTemplatePath}`,
    `- Voice/text workbench: ${voiceWorkbench.htmlPath}`,
    `- Transparent overlay: ${center.paths.transparentOverlay}`,
    `- All-software low-token observer bootstrap: ${observerBootstrap.bootstrapPath}`,
    `- Teach-execute loop: ${teachExecuteLoop.runbookPath}`,
    "",
    "Boundaries:",
    "",
    "- It does not execute target software.",
    "- It does not capture screenshots.",
    "- It does not write memory or enable rules.",
    "- It keeps numbered target confirmation, engineering voice execution approval gate, and dry-run-first supervised execution gates closed."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: "created",
      format: "transparent_ai_goal_command_center_result_v1",
      centerId,
      centerPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      voiceWorkbench: voiceWorkbench.workbenchPath,
      observerBootstrap: observerBootstrap.bootstrapPath,
      transparentOverlay: center.paths.transparentOverlay,
      teachExecuteLoop: teachExecuteLoop.runbookPath,
      locks
    },
    null,
    2
  )
);
