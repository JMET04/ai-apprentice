#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [`plugins/transparent-ai-apprentice/scripts/${scriptName}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

const drawing = join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawing-demo.svg");
const drawio = join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawio-demo.drawio");

const capture = runScript("create-demonstration-capture.mjs", [
  "--goal",
  "Teach from a two-step existing drawing demonstration.",
  "--tool",
  "draw.io plus screenshot export",
  "--file",
  drawing,
  "--file",
  drawio,
  "--teacher-action",
  "Teacher showed the before drawing and the corrected draw.io flow.",
  "--taught-behavior",
  "Follow the teacher-confirmed visual flow only after review.",
  "--future-input",
  "Use the confirmed visual flow on the next diagram."
]);

const taught = runScript("teach-by-demonstration.mjs", [
  "--name",
  `capture-smoke-${Date.now()}`,
  "--task",
  "Teach from a demonstration capture manifest.",
  "--artifact",
  capture.capturePath,
  "--tool",
  "demonstration-capture",
  "--taught-behavior",
  "Follow the teacher-confirmed visual flow only after review.",
  "--future-input",
  "Use the confirmed visual flow on the next diagram."
]);

const review = runScript("review-teaching-session.mjs", ["--session", taught.sessionPath]);

const checks = [
  {
    name: "Capture manifest records ordered existing evidence",
    pass:
      capture.evidenceCount === 2 &&
      capture.missingFiles.length === 0 &&
      capture.nextMcpCall.tool === "teach_by_demonstration",
    evidence: `evidence=${capture.evidenceCount}; missing=${capture.missingFiles.length}`
  },
  {
    name: "Teach by demonstration imports capture manifest",
    pass:
      taught.mode === "existing_tool_artifact" &&
      taught.taughtResult.extractedCueCount > 0 &&
      taught.taughtResult.ruleEnabled === false,
    evidence: `mode=${taught.mode}; cues=${taught.taughtResult.extractedCueCount}`
  },
  {
    name: "Capture import creates reviewable session state",
    pass:
      review.counts.demonstrations === 1 &&
      review.counts.ruleDrafts === 1 &&
      review.counts.disabledRuleDrafts === 1 &&
      review.counts.publicTraces >= 2,
    evidence: `demos=${review.counts.demonstrations}; rules=${review.counts.ruleDrafts}; traces=${review.counts.publicTraces}`
  },
  {
    name: "Capture flow keeps locks closed",
    pass:
      capture.locks.ruleEnabled === false &&
      review.locks.ruleEnabledDefault === false &&
      review.locks.packagingGated === true,
    evidence: JSON.stringify({ capture: capture.locks, review: review.locks })
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  capture,
  taught,
  review,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
