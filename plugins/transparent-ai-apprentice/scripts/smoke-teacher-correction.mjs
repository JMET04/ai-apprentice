#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");

function run(script, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const sessionResult = run("create-teaching-session.mjs", [
  "--name",
  "teacher correction smoke",
  "--task",
  "verify teacher correction narrows disabled rule drafts"
]);

const importResult = run("import-demonstration-artifact.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--artifact",
  "plugins/transparent-ai-apprentice/assets/examples/drawio-demo.drawio",
  "--tool",
  "draw.io",
  "--teacher-action",
  "Teacher connected intent to disabled rule draft",
  "--taught-behavior",
  "Use draw.io connectors as reviewable teaching sequence"
]);

const correctionResult = run("apply-teacher-correction.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--rule-id",
  importResult.ruleDraftId,
  "--type",
  "wrong_connector",
  "--correction",
  "The arrow direction is only a teaching sequence, not a condition. Do not generalize this connector unless I confirm it.",
  "--decision",
  "needs_teacher_review"
]);

const session = JSON.parse(readFileSync(sessionResult.sessionPath, "utf8"));
const correctedRule = session.ruleDrafts.find((rule) => rule.id === importResult.ruleDraftId);
const correctionRecord = session.corrections.find((correction) => correction.id === correctionResult.correctionId);
const correctionTrace = session.publicTraces.find((trace) => trace.sourceCorrectionId === correctionResult.correctionId);

const checks = [
  {
    name: "Correction record created",
    pass: Boolean(correctionRecord) && correctionRecord.correctionType === "wrong_connector",
    evidence: correctionRecord ? correctionRecord.correctionType : "missing"
  },
  {
    name: "Rule draft remains disabled",
    pass: correctedRule?.enabled === false && correctedRule?.requiresTeacherConfirmation === true,
    evidence: `enabled=${correctedRule?.enabled}; requiresTeacherConfirmation=${correctedRule?.requiresTeacherConfirmation}`
  },
  {
    name: "Rule draft has teacher boundary",
    pass:
      correctedRule?.condition?.includes("connector direction/order must be confirmed by teacher") &&
      (correctedRule?.counterexamples?.length ?? 0) >= 2,
    evidence: `counterexamples=${correctedRule?.counterexamples?.length ?? 0}`
  },
  {
    name: "Public correction trace created",
    pass: Boolean(correctionTrace) && correctionTrace.steps.length >= 2,
    evidence: `traceSteps=${correctionTrace?.steps.length ?? 0}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionPath: sessionResult.sessionPath,
  importResult,
  correctionResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}

