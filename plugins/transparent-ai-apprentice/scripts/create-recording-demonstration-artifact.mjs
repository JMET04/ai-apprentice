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
    .slice(0, 64) || "recording-demonstration";
}

const goal = argValue("--goal", argValue("--task", "Teach from an existing recording or trace link."));
const recordingUrl = argValue("--recording-url", argValue("--url", argValue("--demonstration-url")));
const sourceTool = argValue("--source-tool", argValue("--tool", "screen recording"));
const observation = argValue("--observation", argValue("--note", "Teacher provided an existing recording for review."));
const teacherAction = argValue("--teacher-action", "Teacher recorded the workflow in an existing tool.");
const taughtBehavior = argValue("--taught-behavior", "Apply the recorded behavior only after teacher review.");
const futureInput = argValue("--future-input");
const validation = argValue("--validation", "Teacher must confirm that inferred steps match the recording.");
const steps = argValues("--step");

if (!recordingUrl) {
  throw new Error("Usage: node create-recording-demonstration-artifact.mjs --recording-url <url> [--step <observed step>]");
}

const artifactId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const outputDir = join(process.cwd(), ".transparent-apprentice", "recordings");
const artifactPath = join(outputDir, `${artifactId}.json`);
mkdirSync(outputDir, { recursive: true });

const eventSteps = (steps.length > 0 ? steps : [observation]).map((step, index) => ({
  order: index + 1,
  type: index === 0 ? "open_recording" : "observed_step",
  target: recordingUrl,
  label: step,
  note: index === 0 ? observation : "",
  validation: index === steps.length - 1 ? validation : ""
}));

const artifact = {
  format: "transparent_ai_screen_event_log_v1",
  sourceTool,
  recordingUrl,
  goal,
  teacherAction,
  taughtBehavior,
  futureInput,
  observation,
  events: eventSteps,
  teacherReviewPoints: [
    "Confirm that the inferred event order matches the recording.",
    "Mark any accidental clicks, irrelevant screens, or missing validation checks.",
    "Approve only after a replay demonstrates the intended behavior."
  ],
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true,
    technologyAccepted: false
  },
  nextMcpCall: {
    tool: "teach_by_demonstration",
    arguments: {
      name: slugify(goal),
      task: goal,
      artifact: artifactPath,
      tool: sourceTool,
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
      format: "transparent_ai_recording_demonstration_artifact_result_v1",
      artifactPath,
      artifactId,
      recordingUrl,
      sourceTool,
      eventCount: eventSteps.length,
      nextMcpCall: artifact.nextMcpCall,
      locks: artifact.locks
    },
    null,
    2
  )
);
