#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

const created = run("create-visual-teaching-template.mjs", [
  "--goal",
  "Teach a non-technical user to mark before state, teacher action, correct result, and boundary in an existing drawing tool.",
  "--tool",
  "draw.io, Excalidraw, or Mermaid",
  "--future-input",
  "Replay the same pattern on a second workflow drawing."
]);

const session = run("create-teaching-session.mjs", [
  "--name",
  "visual-template-smoke",
  "--task",
  "Verify existing drawing templates can be imported as teaching evidence."
]);

const drawioImport = run("import-demonstration-artifact.mjs", [
  "--session",
  session.sessionPath,
  "--artifact",
  created.files.drawio,
  "--tool",
  "draw.io template",
  "--teacher-action",
  "Teacher fills placeholders in an existing draw.io file.",
  "--taught-behavior",
  "Use filled visual teaching fields as a review-only rule draft."
]);

const excalidrawImport = run("import-demonstration-artifact.mjs", [
  "--session",
  session.sessionPath,
  "--artifact",
  created.files.excalidraw,
  "--tool",
  "Excalidraw template",
  "--teacher-action",
  "Teacher fills placeholders in an existing Excalidraw file.",
  "--taught-behavior",
  "Use filled visual teaching fields as a review-only rule draft."
]);

const mermaidImport = run("import-demonstration-artifact.mjs", [
  "--session",
  session.sessionPath,
  "--artifact",
  created.files.mermaid,
  "--tool",
  "Mermaid template",
  "--teacher-action",
  "Teacher fills placeholders in an existing Mermaid editor.",
  "--taught-behavior",
  "Use filled visual teaching fields as a review-only rule draft."
]);

const review = run("review-teaching-session.mjs", ["--session", session.sessionPath]);

const checks = [
  {
    name: "Visual template creates editable existing-tool files",
    pass:
      created.format === "transparent_ai_visual_teaching_template_result_v1" &&
      existsSync(created.files.drawio) &&
      existsSync(created.files.excalidraw) &&
      existsSync(created.files.mermaid) &&
      existsSync(created.manifestPath),
    evidence: `drawio=${existsSync(created.files.drawio)}; excalidraw=${existsSync(created.files.excalidraw)}; mermaid=${existsSync(created.files.mermaid)}`
  },
  {
    name: "Template handoff points to existing-tool teaching capture",
    pass:
      created.nextMcpCallAfterTeacherEdits.tool === "create_demonstration_capture" &&
      created.teacherSteps.some((step) => step.includes("draw.io") || step.includes("Excalidraw") || step.includes("Mermaid")),
    evidence: `nextTool=${created.nextMcpCallAfterTeacherEdits.tool}`
  },
  {
    name: "Generated draw.io, Excalidraw, and Mermaid templates import as teaching evidence",
    pass:
      drawioImport.ruleEnabled === false &&
      excalidrawImport.ruleEnabled === false &&
      mermaidImport.ruleEnabled === false &&
      drawioImport.extractedCueCount > 5 &&
      excalidrawImport.extractedCueCount > 5 &&
      mermaidImport.extractedCueCount > 5,
    evidence: `drawioCues=${drawioImport.extractedCueCount}; excalidrawCues=${excalidrawImport.extractedCueCount}; mermaidCues=${mermaidImport.extractedCueCount}`
  },
  {
    name: "Visual template workflow keeps review locks closed",
    pass:
      created.locks.ruleEnabled === false &&
      created.locks.accepted === false &&
      review.counts.ruleDrafts === 3 &&
      review.counts.disabledRuleDrafts === 3 &&
      review.locks.packagingGated === true,
    evidence: JSON.stringify({ created: created.locks, review: review.locks })
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  created,
  sessionPath: session.sessionPath,
  review,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
