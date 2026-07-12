#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const root = join(repoRoot, ".ta-smoke", "multiround-learning-convergence");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const scripts = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const profilePath = join(root, "electronic-packaging-apprentice.json");

function run(script, args) {
  const result = spawnSync(process.execPath, [join(scripts, script), ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

const teaching = run("teach-by-demonstration.mjs", [
  "--name", "electronic-packaging-apprentice",
  "--task", "Learn a reusable electronic device packaging protection rule from correction.",
  "--teacher-message", "When the task is electronic device packaging, protect the product from electrostatic discharge and impact.",
  "--apprentice-attempt", "The first attempt used only a paper tray and omitted electrostatic protection.",
  "--teacher-correction", "This is wrong: electronic device packaging must include an antistatic bag and 20 mm protective foam.",
  "--taught-behavior", "For electronic device packaging, add an antistatic bag and 20 mm protective foam before proposing the outer carton.",
  "--future-input", "Design electronic device packaging for a control module."
]);

const beforeApproval = run("run-learned-task.mjs", [
  "--session", teaching.sessionPath,
  "--input", "Design electronic device packaging for a sensor."
]);
const approval = run("approve-teaching-memory.mjs", [
  "--session", teaching.sessionPath,
  "--teacher-approval", "Approve this electronic device packaging rule after the replay matched the intended scope."
]);
const secondAttempt = run("run-learned-task.mjs", [
  "--session", teaching.sessionPath,
  "--input", "Design electronic device packaging for a sensor."
]);
const saved = run("save-apprentice-memory.mjs", [
  "--session", teaching.sessionPath,
  "--profile", profilePath,
  "--profile-name", "electronic-packaging-apprentice"
]);
const futureRun = run("run-apprentice-profile.mjs", [
  "--profile", profilePath,
  "--input", "Design electronic device packaging for a gateway."
]);
const correction = run("correct-apprentice-memory.mjs", [
  "--profile", profilePath,
  "--memory-id", saved.memoryId,
  "--teacher-correction", "Disable this memory until the foam thickness is selected from the confirmed product weight and drop-test requirement.",
  "--decision", "disable"
]);
const afterDisable = run("run-apprentice-profile.mjs", [
  "--profile", profilePath,
  "--input", "Design electronic device packaging for another gateway."
]);

const session = JSON.parse(readFileSync(teaching.sessionPath, "utf8"));
const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });
check("First apprentice attempt records the concrete error", session.teachingExchanges?.[0]?.apprenticeAttempt?.includes("omitted electrostatic protection"));
check("Correction creates a disabled rule and replay before approval", teaching.ruleEnabled === false && teaching.replayResult?.outcome === "needs_teacher_review");
check("Unapproved memory does not change the next run", beforeApproval.outcome === "no_enabled_memory_match" && beforeApproval.ruleEnabled === false);
check("Explicit teacher approval enables only reviewed session memory", approval.ruleEnabled === true && approval.reviewStatus === "approved_for_session");
check("Second attempt applies the corrected behavior", secondAttempt.outcome === "applied_enabled_memory" && secondAttempt.actionTaken.includes("antistatic bag") && secondAttempt.actionTaken.includes("20 mm"), secondAttempt.actionTaken);
check("Second attempt exposes memory provenance", secondAttempt.selectedRuleDraftId === approval.targetRuleDraftId && secondAttempt.matchedCueCount > 0);
check("Approved behavior persists into a durable profile", existsSync(profilePath) && saved.approvedMemoryCount === 1);
check("A later process applies the persisted behavior", futureRun.outcome === "applied_profile_memory" && futureRun.actionTaken.includes("antistatic bag"));
check("Teacher can correct and disable persisted memory", correction.enabled === false && correction.reviewStatus === "disabled_by_teacher");
check("Disabled memory stops affecting future runs", afterDisable.outcome === "no_profile_memory_match" && !afterDisable.selectedMemoryId);
check("Full teach, replay, approval, use, persistence, correction, and disable traces remain visible", (session.publicTraces?.length ?? 0) >= 4 && (profile.publicTraces?.length ?? 0) >= 4);
check("Packaging and technology acceptance stay locked throughout", [beforeApproval, approval, secondAttempt, futureRun, correction, afterDisable].every(item => item.packagingGated === true && item.technologyAccepted === false));

const failed = checks.filter(item => !item.pass);
console.log(JSON.stringify({
  format: "ai_apprentice_multiround_learning_convergence_smoke_v1",
  status: failed.length ? "failed" : "passed",
  passed: checks.length - failed.length,
  total: checks.length,
  sessionPath: teaching.sessionPath,
  profilePath,
  checks
}, null, 2));
if (failed.length) process.exit(1);
