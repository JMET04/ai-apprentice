#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "operational-registration-approved-command-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const sourceRunnerPath = join(smokeRoot, "source-registration-runner.json");
const sourceApprovalGatePath = join(smokeRoot, "source-approval-gate.json");
const sourceSchedulePath = join(smokeRoot, "source-schedule.json");
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: join(smokeRoot, "operational-trial.json"),
  sourceSchedulePath,
  sourceReviewedRunCount: 1,
  teacherReviewedScope: true,
  rollbackPointCreated: true
};
writeJson(sourceSchedulePath, {
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  schedulePolicy: {
    metadataGateFirst: true
  }
});
writeJson(sourceApprovalGatePath, {
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
  status: "ready_for_registration_request",
  readyForRegistrationRequest: true
});
writeJson(sourceRunnerPath, {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  status: "dry_run_ready_for_teacher_review",
  sourceApprovalGatePath,
  locks: {
    dryRunDefault: true,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false
  }
});

const readyGatePath = join(smokeRoot, "ready-operational-registration-execute-gate.json");
writeJson(readyGatePath, {
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  status: "ready_for_teacher_registration_execute_review",
  readyForTeacherRegistrationExecuteReview: true,
  operationalScope,
  executeRequest: {
    preparedButNotExecuted: true
  },
  paths: {
    sourceRegistrationRunner: sourceRunnerPath
  },
  blockers: [],
  locks: {
    executeRequestExecuted: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const builderResult = runNode("create-all-software-operational-registration-approved-command-builder.mjs", [
  "--goal",
  "Build a teacher-facing operational registration approved command.",
  "--registration-execute-gate",
  readyGatePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.paths.builder);
const html = readFileSync(builderResult.paths.html, "utf8");
const readme = readFileSync(builderResult.paths.readme, "utf8");

const placeholderResult = runNode("create-all-software-operational-registration-approved-command-builder.mjs", [
  "--goal",
  "Render placeholder operational registration builder.",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const placeholder = readJson(placeholderResult.paths.builder);

const checks = [
  {
    name: "Operational registration approved command builder loads a ready execute gate",
    pass:
      builder.format === "transparent_ai_operational_registration_approved_command_builder_v1" &&
      builder.status === "operational_registration_command_builder_ready_for_teacher_final_confirmation" &&
      builder.gate.readyForTeacherRegistrationExecuteReview === true &&
      builder.gate.preparedButNotExecuted === true &&
      builder.operationalScope?.teacherReviewedScope === true &&
      builder.gate.blockers.length === 0,
    evidence: builderResult.paths.builder
  },
  {
    name: "Operational registration approved command builder preserves teacher-reviewed operational scope",
    pass:
      builder.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      builder.operationalScope?.sourceSchedulePath === sourceSchedulePath &&
      html.includes("operationalScope") &&
      readme.includes("Operational scope"),
    evidence: JSON.stringify(builder.operationalScope)
  },
  {
    name: "Operational registration approved command builder generates final registration command",
    pass:
      builder.commandTemplate.includes("run-all-software-operational-learning-registration-approved-runner.mjs") &&
      builder.commandTemplate.includes("--execute-approved-registration") &&
      builder.commandTemplate.includes("--allow-system-change") &&
      builder.commandTemplate.includes("--teacher-confirmation") &&
      builder.commandTemplate.includes("<teacher-confirmed-approved-registration-runner-text>") &&
      builder.commandTemplate.includes("--rollback-point-created") &&
      builder.commandTemplate.includes("<retained-rollback-point-path-or-label>") &&
      html.includes("transparent_ai_operational_registration_approved_run_request_v1") &&
      html.includes("teacher confirmed approved registration runner"),
    evidence: builder.commandTemplate
  },
  {
    name: "Operational registration approved command builder writes browser page and README",
    pass:
      existsSync(builderResult.paths.html) &&
      existsSync(builderResult.paths.readme) &&
      html.includes("Download run request JSON") &&
      readme.includes("It does not run the registration approved runner"),
    evidence: builderResult.paths.html
  },
  {
    name: "Operational registration approved command builder keeps system-change locks closed",
    pass:
      builder.locks.reviewOnly === true &&
      builder.locks.accepted === false &&
      builder.locks.ruleEnabled === false &&
      builder.locks.packagingGated === true &&
      builder.locks.builderDoesNotRunRegistration === true &&
      builder.locks.builderDoesNotInvokeRunner === true &&
      builder.locks.builderDoesNotRegisterTask === true &&
      builder.locks.builderDoesNotStartScheduledTask === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.generatedCommandRequiresTeacherRegistrationConfirmation === true &&
      builder.locks.generatedCommandRequiresRollback === true &&
      builder.locks.generatedCommandRequiresAllowSystemChange === true &&
      builder.locks.generatedCommandRequiresExecuteApprovedRegistration === true &&
      builder.locks.goalComplete === false,
    evidence: JSON.stringify(builder.locks)
  },
  {
    name: "Operational registration approved command builder can render before a gate path is available",
    pass:
      placeholder.status === "waiting_for_ready_registration_execute_gate_path" &&
      placeholder.commandTemplate.includes("<ready-operational-registration-execute-gate.json>") &&
      existsSync(placeholder.paths.html),
    evidence: placeholder.paths.html
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_operational_registration_approved_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", smoke: "transparent_ai_operational_registration_approved_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
