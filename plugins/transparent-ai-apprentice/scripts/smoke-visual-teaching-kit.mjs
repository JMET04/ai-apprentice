#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

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

const kit = run("create-visual-teaching-kit.mjs", [
  "--goal",
  "Teach a non-technical teacher to demonstrate refund triage visually before any rule is enabled.",
  "--tool",
  "draw.io or Excalidraw",
  "--future-input",
  "A second refund ticket that should be replayed before approval.",
  "--teacher-action",
  "Teacher marks the before state, triage action, expected result, and boundary in a diagram.",
  "--taught-behavior",
  "Apply visual refund triage only when the teacher-approved boundary matches."
]);

const session = run("create-teaching-session.mjs", [
  "--name",
  "visual-kit-smoke",
  "--task",
  "Verify the visual teaching kit can feed the ordinary continue_teaching path."
]);

const taught = run("continue-teaching.mjs", [
  "--session",
  session.sessionPath,
  "--goal",
  "Teach refund triage from a visual kit artifact.",
  "--tool",
  "draw.io visual kit",
  "--file",
  kit.files.drawio,
  "--teacher-action",
  "Teacher filled the generated visual kit template.",
  "--taught-behavior",
  "Use visual refund triage fields as a review-only rule draft.",
  "--future-input",
  "Replay a second refund triage case."
]);

const checks = [
  {
    name: "Visual teaching kit creates teacher handoff and existing-tool templates",
    pass:
      kit.format === "transparent_ai_visual_teaching_kit_result_v1" &&
      existsSync(kit.teacherReadme) &&
      existsSync(kit.files.drawio) &&
      existsSync(kit.files.excalidraw) &&
      existsSync(kit.files.mermaid) &&
      existsSync(kit.files.templateManifest),
    evidence: `readme=${existsSync(kit.teacherReadme)}; drawio=${existsSync(kit.files.drawio)}; excalidraw=${existsSync(kit.files.excalidraw)}; mermaid=${existsSync(kit.files.mermaid)}`
  },
  {
    name: "Visual teaching kit tells an ordinary teacher how to continue",
    pass:
      kit.teacherChecklist.length >= 5 &&
      kit.nextMcpCalls.some((call) => call.tool === "continue_teaching" && call.arguments.files) &&
      kit.nextMcpCalls.some((call) => call.tool === "continue_teaching" && call.arguments.screenEvents) &&
      kit.nextMcpCalls.some((call) => call.tool === "continue_teaching" && call.arguments.teacherResponse),
    evidence: `checklist=${kit.teacherChecklist.length}; nextCalls=${kit.nextMcpCalls.length}`
  },
  {
    name: "Visual teaching kit feeds continue_teaching without custom drawing software",
    pass:
      taught.route === "teach_from_existing_artifact" &&
      taught.primaryResult?.taughtResult?.ruleEnabled === false &&
      taught.primaryResult?.replayResult?.outcome === "needs_teacher_review",
    evidence: `route=${taught.route}; replay=${taught.primaryResult?.replayResult?.outcome}`
  },
  {
    name: "Visual teaching kit keeps product and memory locks closed",
    pass:
      kit.locks.ruleEnabled === false &&
      kit.locks.accepted === false &&
      kit.locks.packagingGated === true &&
      taught.locks.accepted === false &&
      taught.locks.packagingGated === true &&
      taught.locks.technologyAccepted === false,
    evidence: JSON.stringify({ kit: kit.locks, taught: taught.locks })
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  kit,
  sessionPath: session.sessionPath,
  taught,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
