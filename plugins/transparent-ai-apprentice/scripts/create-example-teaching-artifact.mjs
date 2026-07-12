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
    .slice(0, 64) || "example-teaching";
}

const goal = argValue("--goal", argValue("--task", "Teach from before and after examples."));
const tool = argValue("--tool", "before-after-examples");
const teacherAction = argValue("--teacher-action", "Teacher provided before and after examples.");
const taughtBehavior = argValue("--taught-behavior", "Transform future input to match the teacher-confirmed after examples.");
const futureInput = argValue("--future-input");
const beforeValues = argValues("--before");
const afterValues = argValues("--after");
const notes = argValues("--note");

if (beforeValues.length === 0 || afterValues.length === 0) {
  throw new Error("Usage: node create-example-teaching-artifact.mjs --goal <goal> --before <input> --after <expected> [--before ... --after ...]");
}
if (beforeValues.length !== afterValues.length) {
  throw new Error(`Before/after counts must match. before=${beforeValues.length}; after=${afterValues.length}`);
}

const artifactId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const artifactDir = join(process.cwd(), ".transparent-apprentice", "example-artifacts");
const artifactPath = join(artifactDir, `${artifactId}.json`);
mkdirSync(artifactDir, { recursive: true });

const examples = beforeValues.map((before, index) => ({
  id: `example-${index + 1}`,
  order: index + 1,
  before,
  after: afterValues[index],
  teacherNote: notes[index] ?? "",
  reviewStatus: "needs_teacher_review"
}));

const artifact = {
  format: "transparent_ai_before_after_examples_v1",
  artifactId,
  goal,
  tool,
  teacherAction,
  taughtBehavior,
  futureInput,
  examples,
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
      format: "transparent_ai_example_teaching_artifact_result_v1",
      artifactPath,
      artifactId,
      exampleCount: examples.length,
      nextMcpCall: artifact.nextMcpCall,
      locks: artifact.locks
    },
    null,
    2
  )
);
