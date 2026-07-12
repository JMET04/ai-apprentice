#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "post-activation-witness-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const rehearsalPath = writeJson(join(smokeRoot, "dry-run-rehearsal.json"), {
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  status: "passed_no_system_change",
  paths: { wrapper: join(smokeRoot, "register-wrapper.ps1"), sourceRegistrationRunner: join(smokeRoot, "registration-runner.json") },
  locks: {
    activationDryRunWrapperExecuted: true,
    wrapperExecuteFlagPassed: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});
const executeGatePath = writeJson(join(smokeRoot, "registration-execute-gate.json"), {
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  status: "ready_for_teacher_registration_execute_review",
  paths: { wrapper: join(smokeRoot, "register-wrapper.ps1"), sourceRegistrationRunner: join(smokeRoot, "registration-runner.json") },
  locks: {
    executeRequestPrepared: true,
    executeRequestExecuted: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});
const registrationStatusPath = writeJson(join(smokeRoot, "registration-status.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "verified_not_registered_yet"
});

const witnessResult = runScript("create-all-software-operational-learning-post-activation-witness.mjs", [
  "--goal",
  "Build post activation witness receipt builder smoke.",
  "--dry-run-rehearsal",
  rehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--registration-status",
  registrationStatusPath,
  "--output-dir",
  join(smokeRoot, "witness")
]);
const builderResult = runScript("create-all-software-operational-post-activation-witness-receipt-builder.mjs", [
  "--goal",
  "Build a post activation evidence receipt builder.",
  "--witness",
  witnessResult.witnessPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const readme = readFileSync(builderResult.readmePath, "utf8");

const checks = [
  {
    name: "Post-activation witness receipt builder writes HTML and receipt template",
    pass:
      builderResult.format === "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_result_v1" &&
      builder.format === "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_all_software_operational_post_activation_witness_evidence_receipt_v1" &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Post-Activation Witness Receipt Builder") &&
      html.includes("Run-output audit") &&
      html.includes("Unattended learning audit"),
    evidence: builderResult.htmlPath
  },
  {
    name: "Post-activation receipt builder pre-fills existing witness evidence and placeholders",
    pass:
      receiptTemplate.evidencePaths.dryRunRehearsal === rehearsalPath &&
      receiptTemplate.evidencePaths.registrationExecuteGate === executeGatePath &&
      receiptTemplate.evidencePaths.registrationStatus === registrationStatusPath &&
      receiptTemplate.evidencePaths.runOutputAudit === "<post-activation-run-output-audit.json>" &&
      receiptTemplate.teacherDecision === "needs_teacher_review" &&
      receiptTemplate.evidenceReviewed === false,
    evidence: builderResult.receiptTemplatePath
  },
  {
    name: "Post-activation receipt builder prepares only witness rerun command and keeps system locks closed",
    pass:
      builder.nextWitnessCommandTemplate.includes("create-all-software-operational-learning-post-activation-witness.mjs") &&
      builder.nextWitnessCommandTemplate.includes("<post-activation-run-output-audit.json>") &&
      builder.blockedActions.includes("register_or_start_scheduled_task_from_builder") &&
      builder.locks.builderDoesNotRerunWitness === true &&
      builder.locks.builderDoesNotRegisterTask === true &&
      builder.locks.builderDoesNotLaunchRunner === true &&
      builder.locks.builderDoesNotExecuteSoftware === true &&
      builder.locks.scheduledTaskRegistered === false &&
      builder.locks.runnerLaunched === false &&
      builder.locks.softwareActionsExecuted === false &&
      builder.locks.goalComplete === false &&
      readme.includes("does not register or start scheduled tasks"),
    evidence: builderResult.builderPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_smoke_v1",
      smokeRoot,
      paths: {
        witness: witnessResult.witnessPath,
        builder: builderResult.builderPath,
        html: builderResult.htmlPath,
        receiptTemplate: builderResult.receiptTemplatePath,
        readme: builderResult.readmePath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
