#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(repoRoot, args) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  return JSON.parse(result.stdout);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-voice-numbered-convergence-"));
const targetConfirmation = join(root, "numbered-target-confirmation.json");
const overlayPacket = join(root, "numbered-target-overlay-packet.json");
const executionPackage = join(root, "execution-package.json");
const voiceSessionPath = join(root, "engineering-voice-control-session.json");
const integratedGatePath = join(root, "current-goal-integrated-evidence-gate.json");

writeJson(targetConfirmation, { format: "transparent_ai_numbered_target_confirmation_v1", candidates: [{ number: 1 }, { number: 2 }, { number: 3 }] });
writeJson(overlayPacket, { format: "transparent_ai_numbered_target_overlay_packet_v1", candidates: [{ number: 1 }, { number: 2 }] });
writeJson(executionPackage, { format: "transparent_ai_existing_execution_package_v1", runnerEntries: [] });
writeJson(voiceSessionPath, {
  format: "transparent_ai_engineering_voice_control_session_v1",
  nonExpertVoiceTextNumberedControlLoop: {
    acceptedInputModes: ["browser_or_system_speech_transcript", "typed_text_command", "manual_transcript_from_any_dictation_tool"],
    userFacingLoop: [
      { id: "receive_voice_or_text" },
      { id: "restate_understanding" },
      { id: "mark_numbered_possible_positions", candidateNumbers: [1, 2, 3] },
      { id: "wait_for_confirmed_number", blocksExecution: true }
    ],
    confirmationContract: {
      teacherMustConfirmExactlyOneNumber: true,
      autoExecuteFromVoiceOnly: false
    },
    executionContract: {
      dryRunFirst: true,
      teacherConfirmationRequiredBeforeExecution: true,
      structuredRoutesBeforeUiFallback: [
        "existing-application-api",
        "existing-cli-or-script",
        "existing-browser-automation",
        "existing-file-import-export"
      ]
    }
  },
  generated: {
    engineeringCommandConfirmationKit: {
      candidateNumbers: [1, 2, 3],
      targetConfirmation,
      overlayPacket
    },
    softwareControlChannelProfile: {
      executionPackagePath: executionPackage
    }
  },
  orderedWorkflow: ["capture_or_type_command", "interpret_command", "mark_numbered_candidates", "teacher_confirms_exactly_one_number"],
  nextCalls: [
    { tool: "confirm_engineering_command_target", blockedUntil: "teacher confirms exactly one visible number" },
    { tool: "start_teach_execute_supervised_execution", blockedUntil: "dry-run and teacher approval" }
  ],
  blockedActions: ["execute_without_confirmed_number"],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    fileContentsRead: false
  }
});
writeJson(integratedGatePath, {
  format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
  paths: { voiceTextNumberedExecutionSession: voiceSessionPath },
  requirements: [{ id: "voice_text_numbered_execution_control" }],
  locks: { goalComplete: false }
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-voice-numbered-execution-convergence-audit.mjs"),
  "--voice-control-session",
  voiceSessionPath,
  "--integrated-evidence-gate",
  integratedGatePath,
  "--output-dir",
  join(root, "audit")
]);
const audit = readJson(result.auditPath);
const receipt = readJson(result.receiptTemplatePath);
const auditDirName = basename(dirname(result.auditPath));

assert(audit.format === "transparent_ai_voice_numbered_execution_convergence_audit_v1", "bad audit format");
assert(!/[.\s]$/.test(auditDirName), "audit directory must not end with a Windows-hostile dot or space");
assert(audit.status === "voice_text_numbered_execution_convergence_ready_for_teacher_review_not_execution", "audit should be review-ready");
assert(audit.summary.totalChecks === 9, "check count changed unexpectedly");
assert(audit.summary.passedChecks === 9, "all checks should pass");
assert(audit.summary.finalGoalCompletionAllowed === false, "completion must remain false");
assert(audit.convergence.candidateNumbers.length === 3, "candidate numbers missing");
assert(audit.convergence.selectedNumberConfirmed === false, "audit must not confirm selected number");
assert(audit.locks.auditDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(audit.locks.auditDoesNotWriteMemory === true, "memory lock missing");
assert(audit.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("execute_target_software"), "execute forbidden missing");
assert(receipt.selectedNumberMustBeProvidedThrough === "confirm_engineering_command_target", "selection bridge missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_voice_numbered_execution_convergence_audit_smoke_v1",
      audit: result.auditPath,
      receiptTemplate: result.receiptTemplatePath,
      summary: audit.summary,
      locks: audit.locks
    },
    null,
    2
  )
);
