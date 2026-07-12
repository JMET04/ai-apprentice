#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "operational-post-registration-output-witness-command-builder-smoke", String(Date.now()));
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

const reviewedRunnerPath = join(smokeRoot, "reviewed-scheduled-runner.ps1");
writeFileSync(reviewedRunnerPath, "param([string]$RunLabel)\nWrite-Output $RunLabel\n", "utf8");
const schedulePath = join(smokeRoot, "schedule.json");
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: join(smokeRoot, "operational-trial.json"),
  sourceSchedulePath: schedulePath,
  sourceReviewedRunCount: 1,
  teacherReviewedScope: true,
  rollbackPointCreated: true
};
writeJson(schedulePath, {
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  schedulePolicy: {
    metadataGateFirst: true,
    scheduledTaskInstalled: false
  },
  files: {
    runner: reviewedRunnerPath
  },
  locks: {
    scheduledTaskInstalled: false
  },
  runOutputDir: join(smokeRoot, "runs")
});

const registrationRunnerPath = join(smokeRoot, "registration-runner.json");
writeJson(registrationRunnerPath, {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  status: "executed_registration_and_verified_status",
  locks: {
    scheduledTaskRegistered: true,
    scheduledTaskStarted: false
  }
});

const registrationStatusPath = join(smokeRoot, "registered-status.json");
writeJson(registrationStatusPath, {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_and_matches_reviewed_runner",
  registeredMatchesExpectedRunner: true,
  taskRegistered: true,
  sourceSchedulePath: schedulePath,
  sourceRegistrationRunnerPath: registrationRunnerPath,
  locks: {
    statusVerifierDoesNotChangeSystem: true,
    scheduledTaskStarted: false
  }
});

const approvedRunnerPath = join(smokeRoot, "approved-runner.json");
writeJson(approvedRunnerPath, {
  format: "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
  status: "registration_executed_and_status_verified",
  postExecuteRegisteredMatchesExpectedRunner: true,
  operationalScope,
  paths: {
    sourceRegistrationRunner: registrationRunnerPath
  },
  locks: {
    registrationRunnerInvoked: true,
    scheduledTaskStarted: false
  }
});

const dryRunRehearsalPath = join(smokeRoot, "dry-run-rehearsal.json");
writeJson(dryRunRehearsalPath, {
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  status: "passed_activation_registration_dry_run_rehearsal",
  operationalScope
});

const executeGatePath = join(smokeRoot, "registration-execute-gate.json");
writeJson(executeGatePath, {
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  status: "ready_for_teacher_registration_execute_review",
  readyForTeacherRegistrationExecuteReview: true,
  operationalScope,
  executeRequest: {
    preparedButNotExecuted: true
  },
  locks: {
    executeRequestExecuted: false,
    scheduledTaskRegistered: false
  }
});

const builderResult = runNode("create-all-software-operational-post-registration-output-witness-command-builder.mjs", [
  "--goal",
  "Build a teacher-facing post-registration output witness command.",
  "--registration-status",
  registrationStatusPath,
  "--registration-approved-runner",
  approvedRunnerPath,
  "--dry-run-rehearsal",
  dryRunRehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.paths.builder);
const html = readFileSync(builderResult.paths.html, "utf8");
const readme = readFileSync(builderResult.paths.readme, "utf8");

const placeholderResult = runNode("create-all-software-operational-post-registration-output-witness-command-builder.mjs", [
  "--goal",
  "Render placeholder post-registration output witness command builder.",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const placeholder = readJson(placeholderResult.paths.builder);

const checks = [
  {
    name: "Operational post-registration output witness command builder loads matching status evidence",
    pass:
      builder.format === "transparent_ai_operational_post_registration_output_witness_command_builder_v1" &&
      builder.status === "operational_post_registration_output_witness_command_builder_ready_for_teacher_final_confirmation" &&
      builder.registrationStatus.registeredMatchesExpectedRunner === true &&
      builder.registrationStatus.taskRegistered === true &&
      builder.registrationStatus.blockers.length === 0 &&
      builder.approvedRunner.witnessedMatchingStatus === true &&
      builder.operationalScope?.teacherReviewedScope === true &&
      builder.approvedRunner.blockers.length === 0,
    evidence: builderResult.paths.builder
  },
  {
    name: "Operational post-registration output witness command builder preserves teacher-reviewed operational scope",
    pass:
      builder.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      builder.operationalScope?.sourceSchedulePath === schedulePath &&
      builder.operationalScopeSummary?.sourceCount === 3 &&
      builder.operationalScopeSummary?.blockers.length === 0 &&
      html.includes("operationalScope") &&
      readme.includes("Operational scope"),
    evidence: JSON.stringify(builder.operationalScopeSummary)
  },
  {
    name: "Operational post-registration output witness command builder generates final witness command",
    pass:
      builder.commandTemplate.includes("run-all-software-operational-learning-post-registration-output-witness-runner.mjs") &&
      builder.commandTemplate.includes("--registration-status") &&
      builder.commandTemplate.includes("--trigger-reviewed-output") &&
      builder.commandTemplate.includes("--allow-runner-trigger") &&
      builder.commandTemplate.includes("--teacher-confirmation") &&
      builder.commandTemplate.includes("<teacher-confirmed-post-registration-output-witness-text>") &&
      builder.commandTemplate.includes("--rollback-point-created") &&
      builder.commandTemplate.includes("<retained-rollback-point-path-or-label>") &&
      html.includes("transparent_ai_operational_post_registration_output_witness_run_request_v1") &&
      html.includes("teacher confirmed post-registration output witness"),
    evidence: builder.commandTemplate
  },
  {
    name: "Operational post-registration output witness command builder writes browser page and README",
    pass:
      existsSync(builderResult.paths.html) &&
      existsSync(builderResult.paths.readme) &&
      html.includes("Download run request JSON") &&
      readme.includes("It does not invoke the output witness runner"),
    evidence: builderResult.paths.html
  },
  {
    name: "Operational post-registration output witness command builder keeps runner and system-change locks closed",
    pass:
      builder.locks.reviewOnly === true &&
      builder.locks.accepted === false &&
      builder.locks.ruleEnabled === false &&
      builder.locks.packagingGated === true &&
      builder.locks.builderDoesNotTriggerRunner === true &&
      builder.locks.builderDoesNotInvokeReviewedScheduledRunner === true &&
      builder.locks.builderDoesNotRegisterTask === true &&
      builder.locks.builderDoesNotStartScheduledTask === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotReadFullLogs === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.generatedCommandRequiresMatchingRegistrationStatus === true &&
      builder.locks.generatedCommandRequiresTeacherOutputWitnessConfirmation === true &&
      builder.locks.generatedCommandRequiresRollback === true &&
      builder.locks.generatedCommandRequiresTriggerReviewedOutput === true &&
      builder.locks.generatedCommandRequiresAllowRunnerTrigger === true &&
      builder.locks.goalComplete === false,
    evidence: JSON.stringify(builder.locks)
  },
  {
    name: "Operational post-registration output witness command builder can render before status evidence is available",
    pass:
      placeholder.status === "waiting_for_registered_matching_status_path" &&
      placeholder.commandTemplate.includes("<registered-and-matching-recurring-monitor-status.json>") &&
      existsSync(placeholder.paths.html),
    evidence: placeholder.paths.html
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_operational_post_registration_output_witness_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", smoke: "transparent_ai_operational_post_registration_output_witness_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
