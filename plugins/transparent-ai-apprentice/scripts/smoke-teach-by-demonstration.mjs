#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const artifactResult = run("teach-by-demonstration.mjs", [
  "--name",
  "one-click-artifact-smoke",
  "--task",
  "Learn from an existing drawing export",
  "--artifact",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "excalidraw-demo.json"),
  "--tool",
  "Excalidraw",
  "--teacher-action",
  "Teacher drew the intended flow in an existing whiteboard tool.",
  "--taught-behavior",
  "Use confirmed visual flow cues to plan the next task step.",
  "--future-input",
  "A future Excalidraw flow has input, transform, and output labels."
]);

const exchangeResult = run("teach-by-demonstration.mjs", [
  "--name",
  "one-click-exchange-smoke",
  "--task",
  "Learn from teacher conversation",
  "--teacher-message",
  "If the teacher says the goal is a Codex plugin, keep the deliverable inside the plugin package.",
  "--apprentice-attempt",
  "The apprentice started explaining a standalone app.",
  "--teacher-correction",
  "Do not ship a separate app; make the Codex plugin easier to train through direct teaching.",
  "--taught-behavior",
  "Prefer a plugin training flow over standalone app work when the teacher says Codex plugin.",
  "--future-input",
  "The teacher wants a Codex plugin that learns from direct teaching."
]);

const artifactSession = JSON.parse(readFileSync(artifactResult.sessionPath, "utf8"));
const exchangeSession = JSON.parse(readFileSync(exchangeResult.sessionPath, "utf8"));

const checks = [
  {
    name: "One-click artifact route creates session and replay",
    pass:
      artifactResult.mode === "existing_tool_artifact" &&
      artifactResult.replayResult?.outcome === "needs_teacher_review" &&
      artifactSession.teacherDemonstrations?.length === 1,
    evidence: `mode=${artifactResult.mode}; demonstrations=${artifactSession.teacherDemonstrations?.length ?? 0}; outcome=${artifactResult.replayResult?.outcome}`
  },
  {
    name: "One-click conversation route creates exchange and replay",
    pass:
      exchangeResult.mode === "conversation_exchange" &&
      exchangeResult.replayResult?.outcome === "needs_teacher_review" &&
      exchangeSession.teachingExchanges?.length === 1,
    evidence: `mode=${exchangeResult.mode}; exchanges=${exchangeSession.teachingExchanges?.length ?? 0}; outcome=${exchangeResult.replayResult?.outcome}`
  },
  {
    name: "Both routes keep rule drafts disabled",
    pass:
      artifactResult.ruleEnabled === false &&
      exchangeResult.ruleEnabled === false &&
      artifactSession.ruleDrafts?.every((rule) => rule.enabled === false) &&
      exchangeSession.ruleDrafts?.every((rule) => rule.enabled === false),
    evidence: `artifactRules=${artifactSession.ruleDrafts?.length ?? 0}; exchangeRules=${exchangeSession.ruleDrafts?.length ?? 0}`
  },
  {
    name: "Both routes produce public traces",
    pass: (artifactSession.publicTraces?.length ?? 0) >= 2 && (exchangeSession.publicTraces?.length ?? 0) >= 2,
    evidence: `artifactTraces=${artifactSession.publicTraces?.length ?? 0}; exchangeTraces=${exchangeSession.publicTraces?.length ?? 0}`
  },
  {
    name: "User-facing next prompt is present",
    pass:
      artifactResult.nextTeacherPrompt?.includes("Review the replay") &&
      exchangeResult.nextTeacherPrompt?.includes("Review the replay"),
    evidence: "nextTeacherPrompt present for both routes"
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  artifactResult,
  exchangeResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
