#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "action-sequence";
}

function inferActionType(step) {
  const lower = step.toLowerCase();
  if (lower.includes("click") || lower.includes("tap") || lower.includes("select")) return "select";
  if (lower.includes("type") || lower.includes("enter") || lower.includes("paste")) return "input";
  if (lower.includes("check") || lower.includes("verify") || lower.includes("confirm")) return "verify";
  if (lower.includes("save") || lower.includes("submit") || lower.includes("export")) return "commit";
  return "action";
}

const goal = argValue("--goal", argValue("--task", "Teach from an action sequence demonstration."));
const tool = argValue("--tool", "manual-action-sequence");
const teacherAction = argValue("--teacher-action", "Teacher demonstrated an ordered workflow.");
const taughtBehavior = argValue("--taught-behavior", "Follow the teacher-confirmed action sequence after review.");
const futureInput = argValue("--future-input");
const context = argValue("--context");
const rawSteps = argValues("--step");
const notes = argValues("--note");

if (rawSteps.length === 0) {
  throw new Error("Usage: node create-action-sequence-artifact.mjs --goal <goal> --step <teacher action> [--step ...]");
}

const artifactId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const artifactDir = join(process.cwd(), ".transparent-apprentice", "action-sequences");
const artifactPath = join(artifactDir, `${artifactId}.json`);
mkdirSync(artifactDir, { recursive: true });

const steps = rawSteps.map((step, index) => ({
  id: `action-${index + 1}`,
  order: index + 1,
  actionType: inferActionType(step),
  instruction: step,
  teacherNote: notes[index] ?? "",
  reviewStatus: "needs_teacher_review"
}));

const artifact = {
  format: "transparent_ai_action_sequence_v1",
  artifactId,
  goal,
  tool,
  context,
  teacherAction,
  taughtBehavior,
  futureInput,
  steps,
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true
  },
  nextMcpCall: {
    tool: "teach_by_demonstration",
    arguments: {
      name: slugify(goal),
      task: goal,
      artifact: artifactPath,
      tool,
      teacherAction,
      taughtBehavior,
      ...(futureInput ? { futureInput } : {})
    }
  }
};

writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_action_sequence_artifact_result_v1",
      artifactPath,
      artifactId,
      stepCount: steps.length,
      nextMcpCall: artifact.nextMcpCall,
      locks: artifact.locks
    },
    null,
    2
  )
);
