#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (!options.expectFailure && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  if (options.expectFailure && result.status === 0) {
    throw new Error(`${script} unexpectedly succeeded`);
  }
  return result.stdout ? JSON.parse(result.stdout) : { status: result.status, stderr: result.stderr };
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

async function callDefaultTeachApprenticeFinalTeacherAcceptanceReceiptBuilder() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Create the final teacher acceptance receipt template from this final completion gate.",
        createOriginalGoalFinalTeacherAcceptanceReceiptBuilder: true,
        finalCompletionGate: finalGatePath,
        outputDir: join(smokeRoot, "default-teach-apprentice-builder")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprenticeFinalTeacherAcceptanceReceiptValidation() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Validate the final teacher acceptance receipt before the final completion gate consumes it.",
        validateOriginalGoalFinalTeacherAcceptanceReceipt: true,
        finalCompletionGate: finalGatePath,
        receipt: teacherReceiptPath,
        outputDir: join(smokeRoot, "default-teach-apprentice-validation")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-final-teacher-acceptance-receipt-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const laneIds = [
  "completion_blocker_matrix_present",
  "all_software_low_token_coverage_final_review",
  "unattended_all_software_operational_evidence",
  "transparent_2d_perspective_3d_sketch_implementation",
  "teacher_validated_spatial_intent_and_detail_logic",
  "voice_text_numbered_execution_capability_convergence",
  "explicit_final_teacher_acceptance"
];
const finalGatePath = writeJson(join(smokeRoot, "gate", "original-goal-final-completion-gate.json"), {
  ok: true,
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  status: "blocked_before_original_goal_completion_claim",
  completionDecision: "not_complete_full_original_goal_missing_required_evidence",
  readyForCompletionClaim: false,
  blockers: ["explicit_final_teacher_acceptance"],
  lanes: laneIds.map((id) => ({
    id,
    requirement: `Review ${id}`,
    status: id === "explicit_final_teacher_acceptance" ? "blocked_before_goal_completion_claim" : "ready_for_final_teacher_acceptance_review",
    ready: id !== "explicit_final_teacher_acceptance",
    evidence: `fixture evidence for ${id}`,
    blocker: id === "explicit_final_teacher_acceptance" ? "Need final teacher receipt validation." : "",
    sourcePath: ""
  })),
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const builderResult = runScript("create-original-goal-final-teacher-acceptance-receipt-builder.mjs", [
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const teacherReceiptPath = writeJson(join(smokeRoot, "teacher", "teacher-final-acceptance-receipt.json"), {
  ...template,
  teacherDecision: "accept_full_original_goal_completion",
  teacherConfirmedFullScope: true,
  reviewedEvidenceBundle: true,
  acceptsRemainingBoundaries: true,
  forbiddenAutomationRequested: false,
  teacherSummaryNote: "Teacher reviewed the full fixture evidence bundle.",
  evidenceLaneReviews: laneIds.map((laneId) => ({
    laneId,
    teacherConfirmed: true,
    teacherNote: `Confirmed ${laneId}`
  }))
});
const validationResult = runScript("validate-original-goal-final-teacher-acceptance-receipt.mjs", [
  "--final-completion-gate",
  finalGatePath,
  "--receipt",
  teacherReceiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);
const validation = readJson(validationResult.validationPath);
const forbiddenReceiptPath = writeJson(join(smokeRoot, "teacher", "forbidden-final-acceptance-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  teacherConfirmedFullScope: true,
  reviewedEvidenceBundle: true,
  acceptsRemainingBoundaries: true,
  forbiddenAutomationRequested: true,
  evidenceLaneReviews: laneIds.map((laneId) => ({
    laneId,
    teacherConfirmed: true,
    teacherNote: `Confirmed ${laneId}`
  }))
});
const forbiddenValidationResult = runScript(
  "validate-original-goal-final-teacher-acceptance-receipt.mjs",
  [
    "--final-completion-gate",
    finalGatePath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(smokeRoot, "forbidden-validation")
  ],
  { expectFailure: true }
);
const defaultBuilderCard = await callDefaultTeachApprenticeFinalTeacherAcceptanceReceiptBuilder();
const defaultValidationCard = await callDefaultTeachApprenticeFinalTeacherAcceptanceReceiptValidation();

const checks = [
  check(
    "Final teacher acceptance receipt builder creates teacher-facing HTML and safe template",
    builder.format === "transparent_ai_original_goal_final_teacher_acceptance_receipt_builder_v1" &&
      builder.readyForTeacherAcceptanceReceipt === true &&
      template.format === "transparent_ai_original_goal_final_teacher_acceptance_receipt_v1" &&
      template.teacherDecision === "needs_teacher_review" &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Download Receipt JSON") &&
      html.includes("does not validate, run the final gate"),
    builderResult.htmlPath
  ),
  check(
    "Final teacher acceptance receipt validation prepares only a validated final-gate input",
    validation.format === "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1" &&
      validation.status === "validated_ready_for_final_completion_gate" &&
      validation.validationDecision === "teacher_acceptance_ready_for_final_completion_gate" &&
      validation.readyForFinalCompletionGate === true &&
      validation.validationRows.every((row) => row.status === "teacher_confirmed_lane") &&
      validation.nextFinalGateCommand.includes("--final-teacher-receipt-validation") &&
      validation.locks.validationDoesNotRunFinalGate === true &&
      validation.locks.validationDoesNotExecuteTargetSoftware === true,
    validationResult.validationPath
  ),
  check(
    "Final teacher acceptance receipt validation fails closed on forbidden decisions",
    forbiddenValidationResult.status === "blocked_for_forbidden_final_teacher_decision" &&
      forbiddenValidationResult.blockers.some((blocker) => String(blocker).includes("forbidden_teacher_decision")) &&
      forbiddenValidationResult.readyForFinalCompletionGate === false,
    JSON.stringify(forbiddenValidationResult.blockers)
  ),
  check(
    "Default teach_apprentice routes final teacher acceptance receipt builder without claiming completion",
    defaultBuilderCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultBuilderCard.status === "waiting_for_final_teacher_acceptance_receipt" &&
      defaultBuilderCard.whatHappened.includes("final teacher acceptance receipt template") &&
      defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.readyForTeacherAcceptanceReceipt === true &&
      defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.goalCompleteClaimedByThisTool === false &&
      defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.builderDoesNotRunFinalGate === true &&
      defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.builderDoesNotExecuteTargetSoftware === true &&
      existsSync(defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.receiptTemplatePath || ""),
    defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.builderPath
  ),
  check(
    "Default teach_apprentice routes final teacher acceptance receipt validation without running final gate",
    defaultValidationCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultValidationCard.status === "waiting_for_final_teacher_acceptance_receipt_validation" &&
      defaultValidationCard.whatHappened.includes("teacher-filled final acceptance receipt") &&
      defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.readyForFinalCompletionGate === true &&
      defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.goalCompleteClaimedByThisTool === false &&
      defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.validationDoesNotRunFinalGate === true &&
      defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.validationDoesNotExecuteTargetSoftware === true &&
      defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.nextFinalGateCommand.includes(
        "--final-teacher-receipt-validation"
      ),
    defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  builderPath: builderResult.builderPath,
  validationPath: validationResult.validationPath,
  defaultBuilderPath: defaultBuilderCard.originalGoalFinalTeacherAcceptanceReceiptBuilder.builderPath,
  defaultValidationPath: defaultValidationCard.originalGoalFinalTeacherAcceptanceReceiptValidation.validationPath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
