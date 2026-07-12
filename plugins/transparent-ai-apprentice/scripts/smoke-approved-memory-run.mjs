#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(script, args) {
  const result = spawnSync(process.execPath, [`plugins/transparent-ai-apprentice/scripts/${script}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const teachResult = run("teach-by-demonstration.mjs", [
  "--name",
  "approved-memory-smoke",
  "--task",
  "Use explicit teacher approval before learned behavior changes future runs",
  "--teacher-message",
  "When I say this task is a Codex plugin, keep the deliverable inside the plugin package.",
  "--apprentice-attempt",
  "The apprentice proposed a standalone app.",
  "--teacher-correction",
  "Do not make a standalone app for this objective; build the Codex plugin workflow.",
  "--taught-behavior",
  "Keep implementation work inside the Codex plugin package for this objective.",
  "--future-input",
  "This Codex plugin task should stay inside the plugin package."
]);

const approvalResult = run("approve-teaching-memory.mjs", [
  "--session",
  teachResult.sessionPath,
  "--teacher-approval",
  "I approve this rule for this teaching session after replay."
]);

const runResult = run("run-learned-task.mjs", [
  "--session",
  teachResult.sessionPath,
  "--input",
  "For this Codex plugin task, keep the deliverable inside the plugin package."
]);

const autoTeachResult = run("teach-by-demonstration.mjs", [
  "--name",
  "approved-memory-auto-smoke",
  "--task",
  "Approve latest replayed teaching memory without passing a session path.",
  "--teacher-message",
  "When I demonstrate a refund triage recording, keep the event order review-only until I approve it.",
  "--apprentice-attempt",
  "The apprentice applied the event order to every ticket.",
  "--teacher-correction",
  "Only apply this order after a matching refund triage replay.",
  "--taught-behavior",
  "Use the demonstrated refund triage order only after teacher review.",
  "--future-input",
  "Use the refund triage order for this damaged item ticket."
]);

const autoApprovalResult = run("approve-teaching-memory.mjs", [
  "--teacher-approval",
  "Yes, approve the latest replayed refund triage behavior for this session."
]);

const autoRunResult = run("run-learned-task.mjs", [
  "--session",
  autoTeachResult.sessionPath,
  "--input",
  "Use the refund triage order for this damaged item ticket."
]);

const session = JSON.parse(readFileSync(teachResult.sessionPath, "utf8"));
const approvedRule = session.ruleDrafts?.find((rule) => rule.id === approvalResult.targetRuleDraftId);
const learnedAttempt = session.executionAttempts?.find((attempt) => attempt.id === runResult.attemptId);

const checks = [
  {
    name: "Teaching starts review-only",
    pass:
      teachResult.ruleEnabled === false &&
      teachResult.replayResult?.outcome === "needs_teacher_review" &&
      teachResult.replayResult?.ruleEnabled === false,
    evidence: `teachRuleEnabled=${teachResult.ruleEnabled}; replayOutcome=${teachResult.replayResult?.outcome}`
  },
  {
    name: "Teacher approval enables only session memory",
    pass:
      approvalResult.ruleEnabled === true &&
      approvalResult.packagingGated === true &&
      approvalResult.technologyAccepted === false &&
      approvedRule?.reviewStatus === "approved_for_session",
    evidence: `ruleEnabled=${approvalResult.ruleEnabled}; packagingGated=${approvalResult.packagingGated}; technologyAccepted=${approvalResult.technologyAccepted}`
  },
  {
    name: "Teacher approval can discover latest replayed session",
    pass:
      autoApprovalResult.autoDiscoveredSession === true &&
      autoApprovalResult.sessionPath === autoTeachResult.sessionPath &&
      autoApprovalResult.ruleEnabled === true &&
      autoRunResult.outcome === "applied_enabled_memory",
    evidence: `auto=${autoApprovalResult.autoDiscoveredSession}; session=${autoApprovalResult.sessionPath}; outcome=${autoRunResult.outcome}`
  },
  {
    name: "Learned run applies approved memory",
    pass:
      runResult.outcome === "applied_enabled_memory" &&
      runResult.ruleEnabled === true &&
      runResult.matchedCueCount > 0 &&
      learnedAttempt?.selectedRuleDraftId === approvedRule?.id,
    evidence: `outcome=${runResult.outcome}; matchedCueCount=${runResult.matchedCueCount}`
  },
  {
    name: "Public traces cover teach, approval, and learned run",
    pass:
      (session.publicTraces ?? []).some((trace) => trace.sourceApprovalId === approvalResult.approvalId) &&
      (session.publicTraces ?? []).some((trace) => trace.sourceAttemptId === runResult.attemptId),
    evidence: `traces=${session.publicTraces?.length ?? 0}`
  },
  {
    name: "Packaging remains locked after memory use",
    pass: runResult.packagingGated === true && runResult.technologyAccepted === false,
    evidence: `packagingGated=${runResult.packagingGated}; technologyAccepted=${runResult.technologyAccepted}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  teachResult,
  approvalResult,
  runResult,
  autoTeachResult,
  autoApprovalResult,
  autoRunResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
