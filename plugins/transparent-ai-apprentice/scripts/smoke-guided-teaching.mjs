#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function run(args) {
  const result = spawnSync(process.execPath, ["plugins/transparent-ai-apprentice/scripts/start-guided-teaching.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "start-guided-teaching failed");
  }
  return JSON.parse(result.stdout);
}

const noArtifact = run([
  "--goal",
  "Teach the assistant to follow my draw.io workflow diagram without me explaining every step.",
  "--context",
  "The teacher wants to demonstrate visually first."
]);

const withArtifact = run([
  "--goal",
  "Teach from an existing drawing export.",
  "--artifact",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawing-demo.svg"),
  "--preferred-tool",
  "draw.io",
  "--future-input",
  "Replay this on a similar workflow."
]);

const checks = [
  {
    name: "Guided flow recommends drawing tools for diagram teaching",
    pass:
      noArtifact.mode === "guided_existing_tool_first" &&
      noArtifact.recommendedRoute.id === "existing-drawing-software" &&
      noArtifact.recommendedRoute.nativeIntegrationRequired === false &&
      noArtifact.routeOptions.length >= 3,
    evidence: `route=${noArtifact.recommendedRoute.id}; nativeIntegrationRequired=${noArtifact.recommendedRoute.nativeIntegrationRequired}`
  },
  {
    name: "Guided flow creates a visual teaching kit path when no drawing artifact is supplied",
    pass:
      noArtifact.artifactStatus.exists === false &&
      noArtifact.teacherFacingPrompt.includes("starter kit") &&
      noArtifact.nextMcpCall.tool === "create_visual_teaching_kit" &&
      noArtifact.nextMcpCall.arguments.goal === noArtifact.goal,
    evidence: `nextTool=${noArtifact.nextMcpCall.tool}; prompt=${noArtifact.teacherFacingPrompt}`
  },
  {
    name: "Guided flow turns an existing artifact into the next teaching call",
    pass:
      withArtifact.artifactStatus.exists === true &&
      withArtifact.nextMcpCall.tool === "teach_by_demonstration" &&
      withArtifact.nextMcpCall.arguments.artifact.endsWith("drawing-demo.svg"),
    evidence: `artifactExists=${withArtifact.artifactStatus.exists}; nextTool=${withArtifact.nextMcpCall.tool}`
  },
  {
    name: "Guided flow keeps all learning locks closed",
    pass:
      withArtifact.locks.ruleEnabled === false &&
      withArtifact.locks.accepted === false &&
      withArtifact.locks.requiresTeacherConfirmation === true &&
      withArtifact.locks.packagingGated === true,
    evidence: JSON.stringify(withArtifact.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  noArtifact,
  withArtifact,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
